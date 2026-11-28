import React, { useState } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Globe,
  Loader2,
  ExternalLink,
  ReceiptText,
} from 'lucide-react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { PaymentRecord, AppSettings } from '../types/index.ts';
import { parseBankSms, buildOfficialReceiptUrl } from '../utils/smsParser.ts';
import { resolveHuluBetEndpointUrl } from '../utils/hulubetSync.ts';

interface LocalVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: PaymentRecord[];
  settings?: AppSettings;
}

const VERIFY_BANKS = [
  'CBE',
  'Telebirr',
  'Awash Bank',
  'Dashen Bank',
  'Bank of Abyssinia',
  'Zemen Bank',
  'Siinqee Bank',
  'CBE Birr',
  'Bunna Bank',
  'Wegagen Bank',
  'ZamZam Bank',
  'eBirr',
];

export const LocalVerifyModal: React.FC<LocalVerifyModalProps> = ({
  isOpen,
  onClose,
  payments,
  settings,
}) => {
  const [queryInput, setQueryInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [selectedBank, setSelectedBank] = useState('CBE');
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [matchedPayment, setMatchedPayment] = useState<PaymentRecord | null>(null);

  // Official receipt lookup state
  const [lookingUpReceipt, setLookingUpReceipt] = useState(false);
  const [receiptLookupResult, setReceiptLookupResult] = useState<any | null>(null);
  const [receiptLookupError, setReceiptLookupError] = useState<string | null>(null);

  // Read-only server check state
  const [checkingServer, setCheckingServer] = useState(false);
  const [serverCheckResult, setServerCheckResult] = useState<any | null>(null);
  const [serverCheckError, setServerCheckError] = useState<string | null>(null);

  if (!isOpen) return null;

  const extractSearchTarget = (raw: string): { ref: string; extractedAmount?: number; detectedBank?: string } => {
    const text = raw.trim();
    if (!text) return { ref: '' };

    const v2Match = text.match(/\b(v2-[A-Za-z0-9_-]+)/);
    if (v2Match && v2Match[1]) {
      return { ref: v2Match[1], detectedBank: 'CBE' };
    }

    const ftMatch = text.match(/\b(FT[A-Za-z0-9]{8,15})\b/i);
    if (ftMatch && ftMatch[1]) {
      return { ref: ftMatch[1].toUpperCase(), detectedBank: 'CBE' };
    }

    if (text.length > 35 && (text.includes('ETB') || text.includes('ብር') || text.includes('account') || text.includes('ተቀብለዋል'))) {
      const parsed = parseBankSms(selectedBank, text);
      if (parsed.reference) {
        return {
          ref: parsed.reference,
          extractedAmount: parsed.amount > 0 ? parsed.amount : undefined,
          detectedBank: parsed.bank,
        };
      }
    }

    const clean = text.replace(/^(Ref|TXN|FT)[\s:#-]+/i, '').trim();
    return { ref: clean };
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setServerCheckResult(null);
    setServerCheckError(null);
    setReceiptLookupResult(null);
    setReceiptLookupError(null);

    const { ref: targetRef, extractedAmount, detectedBank } = extractSearchTarget(queryInput);
    if (!targetRef) return;

    if (extractedAmount && !amountInput) setAmountInput(String(extractedAmount));
    if (detectedBank && detectedBank !== 'Unknown') setSelectedBank(detectedBank);

    const normTarget = targetRef.toLowerCase();
    const found = payments.find(p => {
      const pRef = (p.reference || '').toLowerCase().trim();
      const pFt = (p.ftNumber || '').toLowerCase().trim();
      const pV2 = (p.v2Code || '').toLowerCase().trim();
      const rawLower = (p.rawMessage || '').toLowerCase();

      return (
        pRef === normTarget ||
        pFt === normTarget ||
        pV2 === normTarget ||
        (targetRef.length >= 6 && (pRef.includes(normTarget) || rawLower.includes(normTarget)))
      );
    });

    setMatchedPayment(found || null);
    setSearchTriggered(true);
  };

  const handleOfficialReceiptLookup = async () => {
    const { ref: targetRef } = extractSearchTarget(queryInput);
    const reference = targetRef || matchedPayment?.ftNumber || matchedPayment?.reference || '';
    const bank = matchedPayment?.bank || selectedBank;
    const directUrl = matchedPayment?.receiptUrl || buildOfficialReceiptUrl(bank, reference, matchedPayment?.accountNumber);

    if (!reference && !directUrl) {
      setReceiptLookupError('Enter a transaction reference or receipt URL first.');
      return;
    }

    setLookingUpReceipt(true);
    setReceiptLookupError(null);
    setReceiptLookupResult(null);
    try {
      const resp = await fetch('/api/receipt/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bank, reference, receiptUrl: directUrl }),
      });
      const data = await resp.json();
      setReceiptLookupResult(data);
    } catch (err: any) {
      setReceiptLookupError(err?.message || 'Official receipt lookup failed.');
    } finally {
      setLookingUpReceipt(false);
    }
  };

  const handleCheckWithServerReadOnly = async () => {
    const { ref: targetRef } = extractSearchTarget(queryInput);
    const searchRef = targetRef || matchedPayment?.reference;
    if (!searchRef) return;

    const serverUrl = settings?.serverUrl?.trim();
    const token = settings?.secretKey || '';

    if (!serverUrl) {
      setServerCheckError('No server URL configured in Settings.');
      return;
    }

    setCheckingServer(true);
    setServerCheckError(null);
    setServerCheckResult(null);

    try {
      const endpoint = resolveHuluBetEndpointUrl(serverUrl, '/api/check');
      const checkUrl = `${endpoint}?token=${encodeURIComponent(token.trim())}&ref=${encodeURIComponent(searchRef)}&live=1`;

      let rawText = '';
      if (Capacitor.isNativePlatform()) {
        try {
          const capRes = await CapacitorHttp.get({
            url: checkUrl,
            headers: { Accept: 'application/json' },
            connectTimeout: 10000,
            readTimeout: 10000,
          });
          if (typeof capRes.data === 'string') {
            rawText = capRes.data;
          } else if (capRes.data !== undefined && capRes.data !== null) {
            setServerCheckResult(capRes.data);
            return;
          }
        } catch {}
      }

      if (rawText) {
        try {
          setServerCheckResult(JSON.parse(rawText));
        } catch {
          setServerCheckResult({ rawText });
        }
        return;
      }

      const response = await fetch(checkUrl, { method: 'GET', headers: { Accept: 'application/json' } });
      const text = await response.text();
      try {
        setServerCheckResult(JSON.parse(text));
      } catch {
        setServerCheckResult({ rawText: text, status: response.status });
      }
    } catch (err: any) {
      setServerCheckError(err?.message || 'Network request to /api/check failed.');
    } finally {
      setCheckingServer(false);
    }
  };

  const searchedAmount = parseFloat(amountInput.replace(/,/g, ''));
  const hasAmountInput = !isNaN(searchedAmount) && amountInput.trim() !== '';
  const isAmountMatch = matchedPayment && hasAmountInput && Math.abs(matchedPayment.amount - searchedAmount) < 0.01;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl p-5 border border-slate-200 space-y-4 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0F4C3A] text-white flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Payment & Receipt Verification
              </h3>
              <p className="text-xs text-slate-500">
                Search local store & build/check official Ethiopian bank receipts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close verify modal"
            className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-900"
          >
            <X size={15} />
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2 text-amber-950 text-xs">
          <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Security Reminder: </span>
            Confirm receipts directly with official bank portals when needed; SMS sender labels can be spoofed.
          </div>
        </div>

        <form onSubmit={handleVerify} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Bank Channel</label>
              <select
                value={selectedBank}
                onChange={e => setSelectedBank(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 bg-white"
              >
                {VERIFY_BANKS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Expected ETB (Optional)</label>
              <input
                type="number"
                step="0.01"
                value={amountInput}
                onChange={e => {
                  setAmountInput(e.target.value);
                  setSearchTriggered(false);
                }}
                placeholder="e.g. 100.00"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Ref / FT / v2 / Receipt Link / Full SMS *
            </label>
            <textarea
              rows={2}
              autoFocus
              value={queryInput}
              onChange={e => {
                setQueryInput(e.target.value);
                setSearchTriggered(false);
              }}
              placeholder="Paste DK06LG3250, FT26294BDL5T, v2-xxxx, receipt URL, or full SMS..."
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono focus:outline-none focus:border-[#0F4C3A]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="submit"
              disabled={!queryInput.trim()}
              className="py-2.5 px-3 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold hover:bg-[#0B3B2E] disabled:opacity-40 flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Search size={13} />
              <span>Search Local Storage</span>
            </button>
            <button
              type="button"
              disabled={!queryInput.trim() || lookingUpReceipt}
              onClick={handleOfficialReceiptLookup}
              className="py-2.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {lookingUpReceipt ? <Loader2 size={13} className="animate-spin" /> : <ReceiptText size={13} />}
              <span>Official Bank Receipt</span>
            </button>
          </div>
        </form>

        {/* Official Receipt Lookup Result */}
        {receiptLookupError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            {receiptLookupError}
          </div>
        )}

        {receiptLookupResult && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-900">
                Official Receipt Endpoint ({receiptLookupResult.bank || selectedBank})
              </span>
              {receiptLookupResult.receiptUrl && (
                <a
                  href={receiptLookupResult.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0F4C3A] font-semibold hover:underline flex items-center gap-1 whitespace-nowrap"
                >
                  <span>Open Portal</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            {receiptLookupResult.receiptUrl && (
              <div className="font-mono text-[11px] text-slate-600 break-all bg-white p-2 rounded border border-slate-200">
                {receiptLookupResult.receiptUrl}
              </div>
            )}
            {receiptLookupResult.message && (
              <div className="text-xs text-slate-700">{receiptLookupResult.message}</div>
            )}
            {receiptLookupResult.ok && receiptLookupResult.status && (
              <div className="text-xs font-semibold text-emerald-700">
                Verification response: HTTP {receiptLookupResult.status}
              </div>
            )}
          </div>
        )}

        {/* Local Search Result */}
        {searchTriggered && (
          <div className="space-y-3">
            {matchedPayment ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
                    <CheckCircle2 size={14} className="text-emerald-700" />
                    <span>Found in Local Storage</span>
                  </span>

                  {hasAmountInput && (
                    isAmountMatch ? (
                      <span className="text-xs font-semibold text-emerald-700">Amount Matches</span>
                    ) : (
                      <span className="text-xs font-semibold text-amber-800">
                        Mismatch (Expected {searchedAmount.toLocaleString()} vs {matchedPayment.amount.toLocaleString()})
                      </span>
                    )
                  )}
                </div>

                {matchedPayment.type === 'sent' && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900">
                    <strong>Outgoing Payment:</strong> This is a debit sent from your account, not an incoming customer payment.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Bank</span>
                    <span className="font-semibold text-slate-900">{matchedPayment.bank}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Direction</span>
                    <span className="font-semibold capitalize flex items-center gap-1 text-slate-900">
                      {matchedPayment.type === 'received' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                      {matchedPayment.type} ({matchedPayment.category || 'other'})
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Amount</span>
                    <span className="font-bold text-sm text-[#0F4C3A] tabular-nums">
                      ETB {matchedPayment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Counterparty</span>
                    <span className="font-semibold text-slate-900 truncate block">{matchedPayment.counterparty || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Reference / FT</span>
                    <span className="font-mono font-semibold text-slate-800 truncate block">{matchedPayment.ftNumber || matchedPayment.reference || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Date & Time</span>
                    <span className="font-mono text-[11px] text-slate-700">{new Date(matchedPayment.timestamp).toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-600 block mb-1">Raw Bank SMS</span>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-700 break-words select-all">
                    {matchedPayment.rawMessage}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center space-y-1">
                <XCircle size={20} className="text-rose-600 mx-auto" />
                <div className="text-xs font-bold text-rose-900">Not Found in Local Storage</div>
                <p className="text-xs text-rose-700">
                  No captured SMS matches that reference in your local store. You can still check the official bank portal above.
                </p>
              </div>
            )}

            {/* Optional Read-Only Server Check */}
            {settings?.serverUrl?.trim() && (
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700">Optional Webhook Read-Only Check</span>
                  <button
                    type="button"
                    onClick={handleCheckWithServerReadOnly}
                    disabled={checkingServer}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {checkingServer ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
                    <span>Check /api/check</span>
                  </button>
                </div>

                {serverCheckError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-mono">
                    {serverCheckError}
                  </div>
                )}

                {serverCheckResult && (
                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-lg font-mono text-[11px] whitespace-pre-wrap break-words overflow-x-auto">
                    {JSON.stringify(serverCheckResult, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}

        <div className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5 pt-2 border-t border-slate-100">
          <ShieldCheck size={12} className="text-emerald-700" />
          <span>Read-only local & official receipt verification.</span>
        </div>
      </div>
    </div>
  );
};
