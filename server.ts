import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { AI_CHAT_AND_PARSER_MODELS, resolveAllowedAiModel } from './src/constants/aiModels.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function resolveModel(requested?: string) {
  return resolveAllowedAiModel(requested);
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isSafeExternalUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function buildOfficialReceiptUrl(
  bank: string,
  reference: string,
  accountNumber?: string,
  phoneNumber?: string,
  existingUrl?: string
): { receiptUrl: string | null; note: string; geoBlocked?: boolean } {
  if (existingUrl && existingUrl.startsWith('http')) {
    return {
      receiptUrl: existingUrl,
      note: 'Extracted direct receipt link from bank SMS.',
    };
  }
  const b = (bank || '').toLowerCase();
  const ref = (reference || '').trim();
  if (!ref || ref.startsWith('SMS-')) {
    return { receiptUrl: null, note: 'No official transaction reference available yet.' };
  }

  if (b.includes('telebirr') || b === '127') {
    return {
      receiptUrl: `https://transactioninfo.ethiotelecom.et/receipt/${encodeURIComponent(ref)}`,
      note: 'Telebirr official receipt page (requires Ethiopian IP if fetched directly).',
      geoBlocked: true,
    };
  }
  if (b === 'cbe' || b.includes('commercial bank')) {
    if (ref.startsWith('v2-')) {
      return {
        receiptUrl: `https://mbreciept.cbe.com.et/${encodeURIComponent(ref)}`,
        note: 'CBE v2 public receipt link.',
      };
    }
    const cleanAcc = (accountNumber || '').replace(/\D/g, '');
    const last8 = cleanAcc.length >= 8 ? cleanAcc.slice(-8) : '';
    if (last8) {
      return {
        receiptUrl: `https://apps.cbe.com.et:100/?id=${encodeURIComponent(ref.toUpperCase() + last8)}`,
        note: 'CBE legacy FT receipt URL (FT + last 8 account digits).',
      };
    }
    return {
      receiptUrl: `https://apps.cbe.com.et:100/?id=${encodeURIComponent(ref.toUpperCase())}`,
      note: 'CBE FT receipt URL (add last 8 digits of receiving account if required by CBE portal).',
    };
  }
  if (b.includes('abyssinia') || b === 'boa') {
    return {
      receiptUrl: `https://cs.bankofabyssinia.com/slip/?trx=${encodeURIComponent(ref.toUpperCase())}`,
      note: 'Bank of Abyssinia online slip link.',
    };
  }
  if (b.includes('dashen')) {
    return {
      receiptUrl: `https://receipts.dashenbanksc.com/receipt/${encodeURIComponent(ref.toUpperCase())}`,
      note: 'Dashen Bank digital receipt link.',
    };
  }
  if (b.includes('zemen')) {
    return {
      receiptUrl: `https://share.zemenbank.com/rt/${encodeURIComponent(ref)}/pdf`,
      note: 'Zemen Bank PDF receipt link.',
    };
  }
  if (b.includes('siinqee') || b.includes('sinqee')) {
    return {
      receiptUrl: `https://receipts.siinqeebank.com:871/generate/${encodeURIComponent(ref)}`,
      note: 'Siinqee Bank receipt portal (case-sensitive reference).',
    };
  }
  if (b.includes('zamzam')) {
    return {
      receiptUrl: `https://receipt.zamzambank.com.et/receipt/${encodeURIComponent(ref)}`,
      note: 'ZamZam Bank invoice receipt.',
    };
  }
  if (b.includes('cbe birr') || b.includes('cbebirr')) {
    const cleanPhone = (phoneNumber || '').replace(/\D/g, '');
    if (cleanPhone) {
      return {
        receiptUrl: `https://cbepay1.cbe.com.et/aureceipt?TID=${encodeURIComponent(ref.toUpperCase())}&PH=${encodeURIComponent(cleanPhone)}`,
        note: 'CBE Birr auto-receipt URL.',
      };
    }
    return {
      receiptUrl: `https://cbepay1.cbe.com.et/aureceipt?TID=${encodeURIComponent(ref.toUpperCase())}`,
      note: 'CBE Birr receipt link (payer phone may be required).',
    };
  }
  if (b.includes('wegagen')) {
    return {
      receiptUrl: `https://transinfo.wegagenbanksc.com.et:8183/?id=${encodeURIComponent(ref)}`,
      note: 'Wegagen Bank transaction info share link.',
    };
  }
  if (b.includes('bunna')) {
    return {
      receiptUrl: `https://online.bunnabanksc.com/receipt/#/${encodeURIComponent(ref)}`,
      note: 'Bunna Bank online receipt link.',
    };
  }
  if (b.includes('m-pesa') || b.includes('mpesa')) {
    return {
      receiptUrl: `https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=${encodeURIComponent(ref.toUpperCase())}`,
      note: 'M-Pesa Ethiopia receipt endpoint (Ethiopian network only).',
      geoBlocked: true,
    };
  }
  return {
    receiptUrl: null,
    note: `Reference ${ref} captured locally for ${bank || 'Bank'}.`,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // AI Health & Configuration Status (never exposes secret key)
  app.get('/api/ai/status', (_req, res) => {
    const configured = Boolean(getAiClient());
    res.json({
      configured,
      defaultModel: 'gemini-4-hydrogen',
      availableModels: AI_CHAT_AND_PARSER_MODELS,
    });
  });

  // AI Financial Assistant Chat
  app.post('/api/ai/chat', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server. Add it in Settings -> Secrets to enable live Gemini AI.',
        configured: false,
      });
      return;
    }

    const { question, summaryContext, language, model } = req.body || {};
    if (typeof question !== 'string' || !question.trim()) {
      res.status(400).json({ error: 'Question is required.' });
      return;
    }

    const chosenModel = resolveModel(model);
    const langHint = language === 'am' ? 'Respond in clear Amharic (with ETB figures).' : 'Respond in crisp, concise English (with ETB figures).';

    try {
      const response = await ai.models.generateContent({
        model: chosenModel,
        contents: `User question: ${question.trim()}\n\nLocal ledger summary JSON:\n${JSON.stringify(summaryContext || {}, null, 2)}`,
        config: {
          systemInstruction: `You are Ejeta AI inside Ak Finance, an Ethiopian business payment & SMS ledger workspace. Answer ONLY from the provided local ledger summary JSON and Ethiopian banking knowledge (CBE, Telebirr, Awash, BOA, Dashen, Zemen, Siinqee, Wegagen, eBirr, M-Pesa). Never invent transaction numbers or amounts not present in the context. ${langHint}`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              mainFigure: { type: Type.STRING },
              answer: { type: Type.STRING },
              highlights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    value: { type: Type.STRING },
                  },
                  required: ['label', 'value'],
                },
              },
            },
            required: ['title', 'mainFigure', 'answer'],
          },
        },
      });

      const rawText = response.text || '{}';
      const parsed = JSON.parse(rawText);
      res.json({
        ok: true,
        model: chosenModel,
        ...parsed,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI generation failed';
      res.status(500).json({ error: msg, configured: true });
    }
  });

  // AI Smart SMS Parser Fallback for unrecognized or complex Ethiopian bank SMS
  app.post('/api/ai/parse-sms', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server.',
        configured: false,
      });
      return;
    }

    const { sender, message, model } = req.body || {};
    if (typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'SMS message text is required.' });
      return;
    }

    const chosenModel = resolveModel(model);

    try {
      const response = await ai.models.generateContent({
        model: chosenModel,
        contents: `SMS Sender: ${String(sender || 'Unknown')}\nSMS Body: ${message.trim()}`,
        config: {
          systemInstruction: `Extract structured Ethiopian bank or mobile money transaction fields from this SMS (English or Amharic).
Rules:
- Distinguish executed ATM withdrawals ("request to withdraw ETB X ... is successfully completed" -> type="sent", category="atm-card") from pre-withdrawal ATM secret code OTP notices ("ATM withdrawal secret code is ... please use before ..." -> isAlert=true, type="unknown", category="alert", amount=0).
- Ignore VAT/Service charge when determining main amount; report fee separately.
- Only CBE uses FT numbers; Telebirr and other banks use transaction numbers / receipt links.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bank: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['received', 'sent', 'unknown'] },
              category: { type: Type.STRING, enum: ['received', 'transfer', 'airtime', 'data', 'payment', 'bill', 'cash', 'atm-card', 'alert', 'other'] },
              amount: { type: Type.NUMBER },
              fee: { type: Type.NUMBER },
              balance: { type: Type.NUMBER },
              counterparty: { type: Type.STRING },
              reference: { type: Type.STRING },
              receiptUrl: { type: Type.STRING },
              isAlert: { type: Type.BOOLEAN },
            },
            required: ['bank', 'type', 'category', 'amount', 'counterparty', 'isAlert'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json({ ok: true, model: chosenModel, parsed });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI SMS parse failed';
      res.status(500).json({ error: msg, configured: true });
    }
  });

  // Official Ethiopian Bank Receipt URL Builder & Optional Verification Lookup
  app.post('/api/receipt/lookup', async (req, res) => {
    const { bank, reference, accountNumber, phoneNumber, receiptUrl: existingUrl } = req.body || {};
    const built = buildOfficialReceiptUrl(
      String(bank || ''),
      String(reference || ''),
      accountNumber ? String(accountNumber) : undefined,
      phoneNumber ? String(phoneNumber) : undefined,
      existingUrl ? String(existingUrl) : undefined
    );

    if (!built.receiptUrl) {
      res.json({ verified: false, receiptUrl: null, note: built.note });
      return;
    }

    // Attempt live public JSON verification for supported open endpoints (e.g. CBE v2)
    const bLower = String(bank || '').toLowerCase();
    if ((bLower === 'cbe' || bLower.includes('commercial')) && String(reference || '').startsWith('v2-')) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(`https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/${encodeURIComponent(String(reference))}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        clearTimeout(timer);
        if (resp.ok) {
          const data = await resp.json();
          res.json({
            verified: true,
            receiptUrl: built.receiptUrl,
            note: 'Verified directly with CBE public receipt endpoint.',
            bankResponse: data,
          });
          return;
        }
      } catch {
        // Fallback smoothly to link-only
      }
    }

    res.json({
      verified: false,
      receiptUrl: built.receiptUrl,
      geoBlocked: Boolean(built.geoBlocked),
      note: built.note,
    });
  });

  // Server Sync Forwarder (avoids browser CORS when syncing local-storage SMS to user's webhook)
  app.post('/api/sync/forward', async (req, res) => {
    const { url, serverUrl, token, method, sender, message, ts } = req.body || {};
    const targetInputUrl = typeof url === 'string' && url.trim() ? url.trim() : typeof serverUrl === 'string' ? serverUrl.trim() : '';
    if (!targetInputUrl || !isSafeExternalUrl(targetInputUrl)) {
      res.status(400).json({ ok: false, httpCode: 0, status: 'Unknown', error: 'Invalid or unsafe server webhook URL.' });
      return;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const httpMethod = method === 'POST' ? 'POST' : 'GET';
      let response: Response;

      if (httpMethod === 'POST') {
        response = await fetch(targetInputUrl, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'save_sms',
            token: String(token || ''),
            sender: String(sender || ''),
            message: String(message || ''),
            ts: Number(ts) || Date.now(),
          }),
        });
      } else {
        const target = new URL(targetInputUrl);
        target.searchParams.set('action', 'save_sms');
        if (token) target.searchParams.set('token', String(token));
        target.searchParams.set('sender', String(sender || ''));
        target.searchParams.set('message', String(message || ''));
        response = await fetch(target.toString(), {
          method: 'GET',
          signal: controller.signal,
        });
      }
      clearTimeout(timer);

      const rawText = await response.text();
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(rawText);
      } catch {
        // non-JSON reply
      }

      const rawStatus = String(parsed.status || '').toLowerCase();
      let mappedStatus: 'Saved' | 'Duplicate' | 'Ignored' | 'Unknown' = 'Unknown';
      if (rawStatus.includes('save') || rawStatus === 'ok' || rawStatus === 'success') mappedStatus = 'Saved';
      else if (rawStatus.includes('dup')) mappedStatus = 'Duplicate';
      else if (rawStatus.includes('ignor')) mappedStatus = 'Ignored';
      else if (response.ok && !rawText.toLowerCase().includes('ignored')) mappedStatus = 'Saved';

      const refVal = typeof parsed.ref === 'string' ? parsed.ref : undefined;
      const reasonVal = typeof parsed.reason === 'string' ? parsed.reason : undefined;

      res.json({
        ok: response.ok,
        httpCode: response.status,
        status: mappedStatus,
        ref: refVal,
        reason: reasonVal,
        raw: rawText,
        parsed: {
          status: mappedStatus,
          ref: refVal,
          reason: reasonVal,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error reaching webhook server';
      res.status(502).json({
        ok: false,
        httpCode: 0,
        status: 'Unknown',
        error: msg,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ak Finance server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
