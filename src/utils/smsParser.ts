import { PaymentType, PaymentCategory } from '../types/index.ts';

export interface ParsedPayment {
  bank: string;
  senderAddress: string;
  type: PaymentType;
  category: PaymentCategory;
  amount: number;
  amountCents: number;
  amountSantim?: number;
  currency: string;
  counterparty: string;
  reference: string;
  ftNumber?: string;
  v2Code?: string;
  receiptUrl?: string;
  accountNumber?: string;
  balance?: number;
  balanceSantim?: number;
  fee?: number;
  feeCents?: number;
  date: string;
  timestamp: number;
  rawMessage: string;
}

// -------------------------------------------------------------
// EDITABLE SENDER MAP (All Major Ethiopian Banks & Wallets)
// -------------------------------------------------------------
export const DEFAULT_SENDER_BANK_MAP: Record<string, string> = {
  '127': 'Telebirr',
  'TELEBIRR': 'Telebirr',
  'CBE': 'CBE',
  'COMMERCIAL BANK OF ETHIOPIA': 'CBE',
  'CBEBIRR': 'CBE Birr',
  'CBE_BIRR': 'CBE Birr',
  'CBE BIRR': 'CBE Birr',
  'AWASHBANK': 'Awash Bank',
  'AWASH': 'Awash Bank',
  'DASHEN': 'Dashen Bank',
  'DASHENBANK': 'Dashen Bank',
  'BOA': 'Bank of Abyssinia',
  'ABYSSINIA': 'Bank of Abyssinia',
  'ZEMEN': 'Zemen Bank',
  'ZEMENBANK': 'Zemen Bank',
  'SIINQEE': 'Siinqee Bank',
  'SINQEE': 'Siinqee Bank',
  'SIINQEEBANK': 'Siinqee Bank',
  'EBIRR': 'eBirr',
  'ZAMZAM': 'ZamZam Bank',
  'ZAMZAMBANK': 'ZamZam Bank',
  'BUNNA': 'Bunna Bank',
  'BUNNABANK': 'Bunna Bank',
  'WEGAGEN': 'Wegagen Bank',
  'WEGAGENBANK': 'Wegagen Bank',
  'M-PESA': 'M-Pesa',
  'MPESA': 'M-Pesa',
  'ABAYBANK': 'Abay Bank',
  'ABAY': 'Abay Bank',
  'NIBBANK': 'Nib Bank',
  'NIB': 'Nib Bank',
  'HIBRET': 'Hibret Bank',
  'HIBRETBANK': 'Hibret Bank',
  'UNITEDBANK': 'Hibret Bank',
  'COOPBANK': 'Coop Bank',
  'COOP': 'Coop Bank',
  'TSEDEY': 'Tsedey Bank',
  'ADDISBANK': 'Addis Bank',
  'AMHARABANK': 'Amhara Bank',
  'BERHAN': 'Berhan Bank',
  'BERHANBANK': 'Berhan Bank',
  'ENAT': 'Enat Bank',
  'ENATBANK': 'Enat Bank',
};

// -------------------------------------------------------------
// HELPER: CBE-ONLY FT RULE
// -------------------------------------------------------------
export function isCbeBank(bank: string): boolean {
  const b = (bank || '').trim().toUpperCase();
  return b === 'CBE' || b === 'COMMERCIAL BANK OF ETHIOPIA';
}

/**
 * Only CBE bank transfers rely on FT / v2 receipt codes for verification.
 * Telebirr, Awash, BOA, Dashen, Zemen, Siinqee, Wegagen, M-Pesa, etc. resolve on their own.
 */
export function needsFtRecovery(payment: {
  bank: string;
  category?: string;
  ftNumber?: string;
  v2Code?: string;
  reference?: string;
}): boolean {
  if (!isCbeBank(payment.bank)) return false;
  if (payment.category === 'alert' || payment.category === 'atm-card') return false;
  if (payment.v2Code && /^v2-/i.test(payment.v2Code.trim())) return false;
  if (payment.ftNumber && /^FT[A-Z0-9]{6,}$/i.test(payment.ftNumber.trim())) return false;
  const ref = (payment.reference || '').trim();
  if (/^(?:FT[A-Z0-9]{6,}|v2-[A-Za-z0-9_-]+)$/i.test(ref)) {
    return false;
  }
  return true;
}

// -------------------------------------------------------------
// HELPER: BUILD OFFICIAL RECEIPT URL
// -------------------------------------------------------------
export function buildOfficialReceiptUrl(
  bank: string,
  reference: string,
  accountNumber?: string,
  extractedUrl?: string
): string | undefined {
  if (extractedUrl && /^https?:\/\//i.test(extractedUrl)) {
    return extractedUrl.replace(/[.,;)\]]+$/, '');
  }
  const ref = (reference || '').trim();
  if (!ref || ref.startsWith('SMS-')) return undefined;

  const b = (bank || '').toLowerCase();
  if (b.includes('telebirr') || b === '127') {
    return `https://transactioninfo.ethiotelecom.et/receipt/${encodeURIComponent(ref)}`;
  }
  if (isCbeBank(bank)) {
    if (ref.startsWith('v2-')) {
      return `https://mbreciept.cbe.com.et/${encodeURIComponent(ref)}`;
    }
    const cleanAcc = (accountNumber || '').replace(/\D/g, '');
    if (cleanAcc.length >= 8) {
      return `https://apps.cbe.com.et:100/?id=${encodeURIComponent(ref.toUpperCase() + cleanAcc.slice(-8))}`;
    }
    return `https://apps.cbe.com.et:100/?id=${encodeURIComponent(ref.toUpperCase())}`;
  }
  if (b.includes('abyssinia') || b === 'boa') {
    return `https://cs.bankofabyssinia.com/slip/?trx=${encodeURIComponent(ref.toUpperCase())}`;
  }
  if (b.includes('dashen')) {
    return `https://receipts.dashenbanksc.com/receipt/${encodeURIComponent(ref.toUpperCase())}`;
  }
  if (b.includes('zemen')) {
    return `https://share.zemenbank.com/rt/${encodeURIComponent(ref)}/pdf`;
  }
  if (b.includes('siinqee') || b.includes('sinqee')) {
    return `https://receipts.siinqeebank.com:871/generate/${encodeURIComponent(ref)}`;
  }
  if (b.includes('zamzam')) {
    return `https://receipt.zamzambank.com.et/receipt/${encodeURIComponent(ref)}`;
  }
  if (b.includes('cbe birr') || b.includes('cbebirr')) {
    return `https://cbepay1.cbe.com.et/aureceipt?TID=${encodeURIComponent(ref.toUpperCase())}`;
  }
  if (b.includes('wegagen')) {
    return `https://transinfo.wegagenbanksc.com.et:8183/?id=${encodeURIComponent(ref)}`;
  }
  if (b.includes('bunna')) {
    return `https://online.bunnabanksc.com/receipt/#/${encodeURIComponent(ref)}`;
  }
  if (b.includes('m-pesa') || b.includes('mpesa')) {
    return `https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=${encodeURIComponent(ref.toUpperCase())}`;
  }
  return undefined;
}

// -------------------------------------------------------------
// GE'EZ / AMHARIC NUMERAL CONVERTER (፩ to ፼)
// -------------------------------------------------------------
const GEEZ_NUMERALS: Record<string, number> = {
  '፩': 1, '፪': 2, '፫': 3, '፬': 4, '፭': 5,
  '፮': 6, '፯': 7, '፰': 8, '፱': 9, '፲': 10,
  '፳': 20, '፴': 30, '፵': 40, '፶': 50, '፷': 60,
  '፸': 70, '፹': 80, '፺': 90, '፻': 100, '፼': 10000,
};

export function convertAmharicNumerals(text: string): string {
  if (!text) return '';
  if (!/[፩-፼]/.test(text)) return text;

  return text.replace(/[፩-፼]+/g, match => {
    let total = 0;
    let current = 0;
    for (const char of match) {
      const val = GEEZ_NUMERALS[char] || 0;
      if (val === 100 || val === 10000) {
        if (current === 0) current = 1;
        total += current * val;
        current = 0;
      } else {
        current += val;
      }
    }
    total += current;
    return total > 0 ? String(total) : match;
  });
}

// -------------------------------------------------------------
// BANK DETECTION (Sender First -> URL Domain -> Body Text)
// -------------------------------------------------------------
export function determineBank(sender: string, message: string, customMap?: Record<string, string>): string {
  const normSender = (sender || '').trim().toUpperCase();
  const map = { ...DEFAULT_SENDER_BANK_MAP, ...(customMap || {}) };

  // 1. Exact sender match
  for (const [key, val] of Object.entries(map)) {
    if (key.trim().toUpperCase() === normSender) {
      return val;
    }
  }

  // 2. Partial sender match
  for (const [key, val] of Object.entries(map)) {
    const kUpper = key.trim().toUpperCase();
    if (kUpper.length >= 2 && normSender.includes(kUpper)) {
      return val;
    }
  }

  // 3. Receipt URL / Body text match
  const lowerMsg = (message || '').toLowerCase();
  if (lowerMsg.includes('cbepay1.cbe.com.et') || lowerMsg.includes('cbe birr') || lowerMsg.includes('cbebirr')) {
    return 'CBE Birr';
  }
  if (lowerMsg.includes('ethiotelecom.et') || lowerMsg.includes('telebirr') || lowerMsg.includes('ቴሌብር') || lowerMsg.includes('ethio telecom')) {
    return 'Telebirr';
  }
  if (lowerMsg.includes('mbreciept.cbe.com.et') || lowerMsg.includes('apps.cbe.com.et') || lowerMsg.includes('commercial bank of ethiopia') || /\bcbe\b/.test(lowerMsg) || lowerMsg.includes('የኢትዮጵያ ንግድ ባንክ')) {
    return 'CBE';
  }
  if (lowerMsg.includes('awashpay.awashbank.com') || lowerMsg.includes('awash bank') || lowerMsg.includes('awash international') || lowerMsg.includes('አዋሽ')) {
    return 'Awash Bank';
  }
  if (lowerMsg.includes('dashenbanksc.com') || lowerMsg.includes('dashensuperapp.com') || lowerMsg.includes('dashen') || lowerMsg.includes('ዳሽን')) {
    return 'Dashen Bank';
  }
  if (lowerMsg.includes('bankofabyssinia.com') || lowerMsg.includes('abyssinia') || /\bboa\b/.test(lowerMsg) || lowerMsg.includes('አቢሲኒያ')) {
    return 'Bank of Abyssinia';
  }
  if (lowerMsg.includes('zemenbank.com') || lowerMsg.includes('zemen') || lowerMsg.includes('ዘመን')) {
    return 'Zemen Bank';
  }
  if (lowerMsg.includes('siinqeebank.com') || lowerMsg.includes('siinqee') || lowerMsg.includes('sinqee') || lowerMsg.includes('ሲንቄ')) {
    return 'Siinqee Bank';
  }
  if (lowerMsg.includes('ebirr.com') || lowerMsg.includes('ebirr')) {
    return 'eBirr';
  }
  if (lowerMsg.includes('zamzambank.com') || lowerMsg.includes('zamzam') || lowerMsg.includes('ዘምዘም')) {
    return 'ZamZam Bank';
  }
  if (lowerMsg.includes('bunnabanksc.com') || lowerMsg.includes('bunna') || lowerMsg.includes('ቡና ባንክ')) {
    return 'Bunna Bank';
  }
  if (lowerMsg.includes('wegagenbanksc.com') || lowerMsg.includes('wegagen') || lowerMsg.includes('ወጋገን')) {
    return 'Wegagen Bank';
  }
  if (lowerMsg.includes('safaricom.et') || lowerMsg.includes('m-pesa') || lowerMsg.includes('mpesa')) {
    return 'M-Pesa';
  }
  if (lowerMsg.includes('coopbank') || lowerMsg.includes('cooperative bank of oromia')) {
    return 'Coop Bank';
  }
  if (lowerMsg.includes('abay bank') || lowerMsg.includes('abaybank') || lowerMsg.includes('ዓባይ') || lowerMsg.includes('አባይ')) {
    return 'Abay Bank';
  }
  if (lowerMsg.includes('nib bank') || lowerMsg.includes('nib international') || lowerMsg.includes('ንብ')) {
    return 'Nib Bank';
  }
  if (lowerMsg.includes('hibret') || lowerMsg.includes('united bank') || lowerMsg.includes('ህብረት')) {
    return 'Hibret Bank';
  }
  if (lowerMsg.includes('tsedey') || lowerMsg.includes('ፀደይ')) {
    return 'Tsedey Bank';
  }
  if (lowerMsg.includes('addis international') || lowerMsg.includes('addis bank')) {
    return 'Addis Bank';
  }
  if (lowerMsg.includes('amhara bank') || lowerMsg.includes('አማራ ባንክ')) {
    return 'Amhara Bank';
  }
  if (lowerMsg.includes('berhan bank') || lowerMsg.includes('ብርሃን ባንክ')) {
    return 'Berhan Bank';
  }
  if (lowerMsg.includes('enat bank') || lowerMsg.includes('እናት ባንክ')) {
    return 'Enat Bank';
  }

  return 'Unknown';
}

// -------------------------------------------------------------
// DIRECTION DETERMINATION (OUTGOING FIRST; FIRST OCCURRENCE WINS)
// -------------------------------------------------------------
export const CBE_OUTGOING_PHRASES: readonly string[] = [
  'you have successfully transferred',
  'you have transferred',
  'has been debited',
  'a debit transaction',
  'debited with',
  'debited from',
  'debited for',
  'debited',
  'transferred to',
  'sent to',
  'paid to',
  'request to withdraw',
  'withdrawn from',
  'withdrew',
  'withdraw etb',
  'ወጪ',
  'ተላልፏል',
  'አስተላልፈዋል',
];

export const CBE_INCOMING_PHRASES: readonly string[] = [
  'you have received',
  'has been credited',
  'a credit transaction',
  'credited with',
  'credited to',
  'credited by',
  'credited',
  'deposited to',
  'deposited by',
  'deposited',
  'received from',
  'received a payment',
  'ገቢ',
  'ተላልፎልዎታል',
  'ተላልፎልዎታ',
  'ገቢ ሆኗል',
];

export const TELEBIRR_OUTGOING_PHRASES: readonly string[] = [
  'ከፍለዋል',
  'ልከዋል',
  'አስተላልፈዋል',
  'ገዝተዋል',
  'ወጪ',
  'አውጥተዋል',
  'you have transferred',
  'you have paid',
  'you have withdrawn',
  'request to withdraw',
];

export const TELEBIRR_INCOMING_PHRASES: readonly string[] = [
  'ተቀብለዋል',
  'ገቢ',
  'you have received',
  'has been credited',
];

export function determineDirection(cleanMsg: string): PaymentType {
  const lowerMsg = cleanMsg.toLowerCase();

  const allOutgoing = [
    ...CBE_OUTGOING_PHRASES,
    ...TELEBIRR_OUTGOING_PHRASES,
    'withdrawn',
    'sent',
    'cash out',
  ];

  const allIncoming = [
    ...CBE_INCOMING_PHRASES,
    ...TELEBIRR_INCOMING_PHRASES,
    'deposited',
  ];

  let earliestOutgoingIndex = -1;
  for (const phrase of allOutgoing) {
    const idx = lowerMsg.indexOf(phrase.toLowerCase());
    if (idx !== -1 && (earliestOutgoingIndex === -1 || idx < earliestOutgoingIndex)) {
      earliestOutgoingIndex = idx;
    }
  }

  let earliestIncomingIndex = -1;
  for (const phrase of allIncoming) {
    const idx = lowerMsg.indexOf(phrase.toLowerCase());
    if (idx !== -1 && (earliestIncomingIndex === -1 || idx < earliestIncomingIndex)) {
      earliestIncomingIndex = idx;
    }
  }

  if (earliestOutgoingIndex !== -1 && earliestIncomingIndex !== -1) {
    return earliestOutgoingIndex <= earliestIncomingIndex ? 'sent' : 'received';
  }
  if (earliestOutgoingIndex !== -1) return 'sent';
  if (earliestIncomingIndex !== -1) return 'received';

  return 'unknown';
}

// -------------------------------------------------------------
// MAIN PARSE FUNCTION
// -------------------------------------------------------------
export function parseBankSms(sender: string, message: string, customMap?: Record<string, string>): ParsedPayment {
  const originalMsg = (message || '').trim();
  const cleanMsg = convertAmharicNumerals(originalMsg);

  const bank = determineBank(sender, cleanMsg, customMap);

  // 0. DETECT PRE-EXECUTION ATM SECRET CODE NOTICE (e.g. "Your ATM withdrawal secret code is 215822 for an amount of ETB 100.00. Please use this code before ...")
  // This is an authorization OTP notice, NOT an actual ledger movement!
  const isAtmSecretCodeNotice =
    /atm\s*withdrawal\s*secret\s*code\s*is\s*\d+/i.test(cleanMsg) &&
    !/successfully\s*completed|transaction\s*number|receipt\//i.test(cleanMsg);

  if (isAtmSecretCodeNotice) {
    const codeMatch = cleanMsg.match(/secret\s*code\s*is\s*(\d{4,8})/i);
    const amtMatch = cleanMsg.match(/(?:amount\s*of\s*)?(?:ETB|Birr|ብር)\s*([0-9,]+(?:\.[0-9]+)?)/i);
    const code = codeMatch?.[1] || '';
    const reservedAmt = amtMatch?.[1] || '';
    const labelParts = ['ATM Secret Code'];
    if (code) labelParts.push(code);
    if (reservedAmt) labelParts.push(`ETB ${reservedAmt}`);

    let dateStr = new Date().toISOString();
    let timestamp = Date.now();
    const dtMatch = cleanMsg.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/);
    if (dtMatch?.[1]) {
      const ts = Date.parse(dtMatch[1].replace(/-/g, '/'));
      if (!isNaN(ts)) {
        timestamp = ts;
        dateStr = new Date(ts).toISOString();
      }
    }

    return {
      bank,
      senderAddress: sender,
      type: 'unknown',
      category: 'alert',
      amount: 0,
      amountCents: 0,
      amountSantim: 0,
      currency: 'ETB',
      counterparty: labelParts.join(' · '),
      reference: code ? `OTP-${code}` : '',
      date: dateStr,
      timestamp,
      rawMessage: originalMsg,
    };
  }

  let type = determineDirection(cleanMsg);

  // 1. EXTRACT RECEIPT URL, V2 CODE, FT NUMBER & MULTI-BANK REFERENCES
  let extractedUrl: string | undefined = undefined;
  const urlMatch = originalMsg.match(/https?:\/\/[^\s"'<>]+/i);
  if (urlMatch && urlMatch[0]) {
    extractedUrl = urlMatch[0].replace(/[.,;)\]]+$/, '');
  }

  // CBE v2 link: https://mbreciept.cbe.com.et/v2-xxxx (case-sensitive)
  let v2Code: string | undefined = undefined;
  const v2Match = originalMsg.match(/\b(v2-[A-Za-z0-9_-]+)/);
  if (v2Match && v2Match[1]) {
    v2Code = v2Match[1].trim();
  }

  // FT Number (CBE, Dashen, Awash): e.g. FT26294BDL5T
  let ftNumber: string | undefined = undefined;
  const ftMatch = originalMsg.match(/\b(FT[A-Za-z0-9]{8,16})\b/i);
  if (ftMatch && ftMatch[1]) {
    ftNumber = ftMatch[1].toUpperCase().trim();
  }

  let reference = '';
  if (v2Code) {
    reference = v2Code;
  } else if (ftNumber) {
    reference = ftNumber;
  } else if (extractedUrl) {
    // Bank-specific URL parameter extraction (from cheki & ethiobank-receipts)
    const idParam = extractedUrl.match(/[?&]id=([A-Za-z0-9_-]+)/i);
    const tidParam = extractedUrl.match(/[?&]TID=([A-Za-z0-9_-]+)/i);
    const trxParam = extractedUrl.match(/[?&]trx=([A-Za-z0-9_-]+)/i);
    const zemenMatch = extractedUrl.match(/\/rt\/([A-Za-z0-9_-]+)/i);
    const awashToken = extractedUrl.match(/awashbank\.com:\d+\/-?([A-Za-z0-9_-]+)/i);
    const bunnaToken = extractedUrl.match(/receipt\/#\/([^?\s]+)/i);
    const pathTail = extractedUrl.match(/\/(?:receipt|generate|slip)\/([A-Za-z0-9_-]{5,32})/i);

    if (idParam?.[1]) reference = idParam[1].trim();
    else if (tidParam?.[1]) reference = tidParam[1].trim();
    else if (trxParam?.[1]) reference = trxParam[1].trim();
    else if (zemenMatch?.[1]) reference = zemenMatch[1].trim();
    else if (awashToken?.[1]) reference = awashToken[1].trim();
    else if (bunnaToken?.[1]) reference = bunnaToken[1].trim();
    else if (pathTail?.[1]) reference = pathTail[1].trim();
  }

  if (!reference) {
    const genRefMatch =
      cleanMsg.match(/(?:የግብይት\s*ቁጥርዎ?|የሂሳብ\s*እንቅስቃሴ\s*ቁጥርዎ?|transaction\s*(?:number|id|no\.?|ref)|txn\s*(?:id|no\.?)|receipt\s*(?:number|no\.?)|trx\s*no\.?)\s*(?:is|ነው|ነዉ)?\s*[:#]?\s*([A-Za-z0-9-]{6,20})/i) ||
      cleanMsg.match(/\bRef(?:\s*No\.?)?\s*[:#]\s*([A-Za-z0-9-]{6,24})/i);
    if (genRefMatch && genRefMatch[1]) {
      reference = genRefMatch[1].trim();
    }
  }

  // 2. CATEGORY DETECTION
  let category: PaymentCategory = 'other';

  const isCompletedAtmWithdrawal =
    /(?:request\s*to\s*withdraw|withdrawn|cash\s*withdrawal|using\s+.*\batm\b)/i.test(cleanMsg) &&
    (/(?:successfully\s*completed|transaction\s*number|receipt\/|service\s*fee|balance)/i.test(cleanMsg) || /\batm\b/i.test(cleanMsg));

  const isAirtime = /አየር\s*ሰዓት|የአየር\s*ሰዓት|airtime|recharge|top\s*up/i.test(cleanMsg);
  const isData = /ኢንተርኔት|ዳታ|ጥቅል|package|bundle|internet/i.test(cleanMsg);
  const isBill = /\bbill\b|electric|water\s*bill|utility|መብራት|ውሃ/i.test(cleanMsg);
  const isPayment = /ከፍለዋል|\bpaid\b|\bmerchant\b|ለነጋዴ/i.test(cleanMsg);
  const isAlertMsg =
    !isCompletedAtmWithdrawal &&
    (/logged\s*in|login|log\s*in|\botp\b|one\s*time\s*password|verification\s*code|security\s*alert|password\s*(?:changed|reset)|daily\s*limit|limit\s*has\s*been|statement\s*request|session\s*expired|announcement|fraud\s*alert|alert\s*:|notice\s*:/i.test(cleanMsg) ||
      /የይለፍ\s*ቃል|ማረጋገጫ\s*ኮድ|ማስጠንቀቂያ|የደህንነት|የመግቢያ/i.test(cleanMsg));

  const isCbeAtmCard =
    bank === 'CBE' &&
    /debited\s*with/i.test(cleanMsg) &&
    /including\s*service\s*charge/i.test(cleanMsg) &&
    !v2Code &&
    !ftNumber &&
    !/to\s*account/i.test(cleanMsg);

  if (isCompletedAtmWithdrawal || isCbeAtmCard) {
    category = 'atm-card';
    type = 'sent';
  } else if (isAirtime) {
    category = 'airtime';
    type = 'sent';
  } else if (isData) {
    category = 'data';
    type = 'sent';
  } else if (isBill) {
    category = 'bill';
    type = 'sent';
  } else if (isPayment) {
    category = 'payment';
    type = 'sent';
  } else if (type === 'received') {
    category = 'received';
  } else if (type === 'sent') {
    category = 'transfer';
  }

  // 3. EXTRACT MAIN AMOUNT ONLY (Ignore balance, service charge, fee, VAT and total)
  let amount = 0;

  const actionAmountMatch =
    cleanMsg.match(/(?:received|transferred|debited\s*with|credited\s*with|debit\s*transaction\s*of|credit\s*transaction\s*of|deposited|withdrawn|withdraw|paid|sent)\s*(?:of|with|amount\s*of)?\s*(?:ETB|Birr|ብር)?\s*[-+]?\s*([0-9,]+(?:\.[0-9]+)?\.?)/i) ||
    cleanMsg.match(/(?:received|transferred|debited|credited|deposited|withdrawn|withdraw|paid)\s*ETB\s*[-+]?\s*([0-9,]+(?:\.[0-9]+)?\.?)/i);

  if (actionAmountMatch && actionAmountMatch[1]) {
    const rawNumStr = actionAmountMatch[1].replace(/,/g, '').replace(/\.+$/, '');
    const num = parseFloat(rawNumStr);
    if (!isNaN(num) && num > 0) {
      amount = num;
    }
  }

  // Telebirr Amharic Amount Regexes
  if (amount === 0) {
    const telebirrAmountMatch =
      cleanMsg.match(/([0-9,]+(?:\.[0-9]+)?)\s*ብር\s*(?:በ\s*\d|\s*ተቀብለዋል|ከፍለዋል|ልከዋል|አስተላልፈዋል|ገዝተዋል|አውጥተዋል)/) ||
      cleanMsg.match(/(?:የ\s*)?([0-9,]+(?:\.[0-9]+)?)\s*ብር\s*(?:የአየር|አየር|ጥቅል|ኢንተርኔት|ዳታ)/) ||
      cleanMsg.match(/(?:ለመግዛት\s*)?([0-9,]+(?:\.[0-9]+)?)\s*ብር\s*(?:ከፍለዋል|ተቀብለዋል|ልከዋል)/);

    if (telebirrAmountMatch && telebirrAmountMatch[1]) {
      const rawNumStr = telebirrAmountMatch[1].replace(/,/g, '').replace(/\.+$/, '');
      const num = parseFloat(rawNumStr);
      if (!isNaN(num) && num > 0) {
        amount = num;
      }
    }
  }

  // Fallback general ETB/Birr/ብር match (strip balance/fee clauses first so we don't grab balance!)
  if (amount === 0) {
    const scrubbedForMainAmt = cleanMsg
      .replace(/(?:current|available|your)\s*(?:account\s*)?balance[^.;\n]*/gi, '')
      .replace(/(?:service\s*fee|service\s*charge|vat)[^.;\n]*/gi, '');
    const generalMatch =
      scrubbedForMainAmt.match(/(?:ETB|Birr|ብር)\s*([0-9,]+(?:\.[0-9]+)?)/i) ||
      scrubbedForMainAmt.match(/([0-9,]+(?:\.[0-9]+)?)\s*(?:ETB|Birr|ብር)/i);

    if (generalMatch && generalMatch[1]) {
      const rawNumStr = generalMatch[1].replace(/,/g, '').replace(/\.+$/, '');
      const num = parseFloat(rawNumStr);
      if (!isNaN(num) && num > 0) {
        amount = num;
      }
    }
  }

  // Mark pure alerts cleanly
  if (isAlertMsg || (amount === 0 && type === 'unknown')) {
    category = 'alert';
    type = 'unknown';
  }

  const amountCents = Math.round(amount * 100);
  const amountSantim = amountCents;

  // 3b. EXTRACT SERVICE FEE
  let fee: number | undefined = undefined;
  const feeMatch = cleanMsg.match(
    /(?:service\s*fee(?:\s*\([^)]*\))?|service\s*charge(?:\s*of)?|charge\s*of|fee\s*is)\s*(?:is|of)?\s*(?:ETB|Birr|ብር)\s*([0-9,]+(?:\.[0-9]+)?)/i
  );
  if (feeMatch && feeMatch[1]) {
    const f = parseFloat(feeMatch[1].replace(/,/g, '').replace(/\.+$/, ''));
    if (!isNaN(f) && f > 0) {
      fee = f;
    }
  }
  const feeCents = fee !== undefined ? Math.round(fee * 100) : undefined;

  // 4. EXTRACT BALANCE AFTER ("current balance" / "balance now is" / "Available balance" / "ቀሪ ሂሳብ")
  let balance: number | undefined = undefined;
  const balanceMatch =
    cleanMsg.match(/(?:current\s*(?:account\s*)?balance\s*(?:is)?|your\s*(?:current\s*)?(?:account\s*)?balance\s*(?:now\s*is|is)?|balance\s+now\s+is|available\s*balance\s*(?:is)?|balance\s*is|ቀሪ\s*ሂሳብ\s*(?:ነው|ዎ|ነዉ)?|አሁን\s*ያለዎት\s*ቀሪ\s*ሂሳብ|ያለዎት\s*ቀሪ\s*ሂሳብ)\s*(?:is|:|ነው|ነዉ)?\s*(?:ETB|Birr|ብር)?\s*([0-9,]+(?:\.[0-9]+)?)/i) ||
    cleanMsg.match(/([0-9,]+(?:\.[0-9]+)?)\s*(?:ETB|Birr|ብር)\s*(?:ቀሪ\s*ሂሳብ|ቀሪ)/i);

  if (balanceMatch && balanceMatch[1]) {
    const rawBalStr = balanceMatch[1].replace(/,/g, '').replace(/\.+$/, '');
    const numBal = parseFloat(rawBalStr);
    if (!isNaN(numBal)) {
      balance = numBal;
    }
  }
  const balanceSantim = balance !== undefined ? Math.round(balance * 100) : undefined;

  // 5. EXTRACT COUNTERPARTY NAME
  let counterparty = '';

  // Priority ATM Terminal Extraction (e.g. "using Awash International Bank S C ATM with transaction number ...")
  if (category === 'atm-card') {
    const atmUsingMatch = cleanMsg.match(/\busing\s+([A-Za-z0-9\u1200-\u137F\s.&'-]{3,60}?\bATM\b)/i);
    if (atmUsingMatch && atmUsingMatch[1]) {
      counterparty = atmUsingMatch[1].trim();
    } else if (/atm/i.test(cleanMsg)) {
      const atmAtMatch = cleanMsg.match(/\bat\s+([A-Za-z0-9\s.&'-]{3,50}?\bATM\b)/i);
      if (atmAtMatch?.[1]) {
        counterparty = atmAtMatch[1].trim();
      }
    }
  }

  if (!counterparty && isCbeBank(bank)) {
    // Rule A: Parentheses check
    const matches = cleanMsg.matchAll(/\(([^)]+)\)/g);
    for (const m of matches) {
      const inside = m[1].trim();
      if (
        /[A-Za-z\u1200-\u137F]/.test(inside) &&
        !inside.includes('%') &&
        !/^[0-9+*#\s-]+$/.test(inside) &&
        !/^(?:vat|service\s*charge|cbe|ft|cbs|shorturl|http|charge|including)/i.test(inside)
      ) {
        counterparty = inside;
        break;
      }
    }

    // Rule B1: Amharic "በ <NAME> በኩል"
    if (!counterparty) {
      const amharicBekulMatch = cleanMsg.match(/በ\s+([A-Za-z\u1200-\u137F\s]{2,40}?)\s+በኩል/);
      if (amharicBekulMatch && amharicBekulMatch[1]) {
        const cand = amharicBekulMatch[1].trim();
        if (!cand.includes('%') && !/^[0-9+*#\s\/-]+$/.test(cand) && cand.length >= 2) {
          counterparty = cand;
        }
      }
    }

    // Rule B2: "by <NAME> [with/on/ref/txn/ft/.]"
    if (!counterparty) {
      const byMatch = cleanMsg.match(/\bby\s+([A-Za-z\u1200-\u137F\s]{2,40}?)(?:\s+(?:with\s+)?(?:txn|tx|ref|id|ft|ft\d|\/branchreceipt)|\s+on\s+\d|\.|$|,|;|(?:\s+(?:available|current|your|balance|ቀሪ)))/i);
      if (byMatch && byMatch[1]) {
        const cand = byMatch[1].trim();
        if (
          !cand.includes('%') &&
          !/^(?:account|cbe|boa|etb|service|vat|bank|customer|branch|the)/i.test(cand) &&
          !/^[0-9+*#\s-]+$/.test(cand) &&
          cand.length >= 2
        ) {
          counterparty = cand;
        }
      }
    }

    // Rule C: "deposited by / credited by / received from <NAME>"
    if (!counterparty) {
      const depMatch = cleanMsg.match(/(?:deposited\s+by|credited\s+by|received\s+from)\s+([A-Za-z\u1200-\u137F\s]{2,40}?)(?:\s+(?:with|on|ref|txn|ft)|\.|$|,|;)/i);
      if (depMatch && depMatch[1]) {
        const cand = depMatch[1].trim();
        if (!cand.includes('%') && cand.length >= 2) {
          counterparty = cand;
        }
      }
    }

    // Rule D: Explicit Key-Value labels
    if (!counterparty) {
      const labelMatch = cleanMsg.match(/(?:sender|payer|depositor|from\s*[:፡\-]|ላኪ|የላኪ\s*ስም)\s*[:፡\-]?\s*([A-Za-z\u1200-\u137F\s]{2,40}?)(?:\s+(?:with|on|ref|txn|ft|account|a\/c)|\.|$|,|;|\n)/i);
      if (labelMatch && labelMatch[1]) {
        const cand = labelMatch[1].trim();
        if (
          !cand.includes('%') &&
          !/^(?:your|my|our|account|cbe|customer|dear|service)/i.test(cand) &&
          !/^[0-9+*#\s-]+$/.test(cand) &&
          cand.length >= 2
        ) {
          counterparty = cand;
        }
      }
    }

    // Rule E: "transfer to <NAME>"
    if (!counterparty && type === 'sent') {
      const toMatch = cleanMsg.match(/(?:(?:for\s+)?transfer(?:red)?\s+to|sent\s+to|debited\s+for(?:\s+transfer\s+to)?|paid\s+to|ተቀባይ|የተቀባይ\s*ስም|ለ)\s*(?:account\s+[0-9*]+\s+)?[:፡\-]?\s*([A-Za-z\u1200-\u137F\s]{2,40}?)(?:\s+(?:with|on|ref|txn|ft|\/branchreceipt)|\.|$|,|;|\(|\n)/i);
      if (toMatch && toMatch[1]) {
        const cand = toMatch[1].trim();
        if (!cand.includes('%') && !/^(?:account|cbe|boa|etb|service|vat|bank|your)/i.test(cand) && cand.length >= 2) {
          counterparty = cand;
        }
      }
    }

    // Rule F: "from account ... (Name) to your account"
    if (!counterparty && type === 'received') {
      const fromAcctMatch = cleanMsg.match(/from\s+(?:account\s+[0-9*]+\s+)?\(?([A-Za-z\u1200-\u137F\s]{2,40}?)\)?\s+to\s+(?:your\s+account|account)/i);
      if (fromAcctMatch && fromAcctMatch[1]) {
        const cand = fromAcctMatch[1].trim();
        if (!cand.includes('%') && !/^(?:your|my|our|account|cbe)/i.test(cand) && !/^[0-9*]+$/.test(cand) && cand.length >= 2) {
          counterparty = cand;
        }
      }
    }
  } else if (!counterparty && bank === 'Telebirr') {
    if (type === 'received') {
      const fromMatch = cleanMsg.match(/ከ\s+([A-Za-z\u1200-\u137F\s]+?)\s*\(/);
      if (fromMatch && fromMatch[1]?.trim()) {
        counterparty = fromMatch[1].trim();
      } else {
        const engFrom = cleanMsg.match(/from\s+([A-Za-z\s]+?)(?:\s*\(|\s+on|\s+for|\.|$)/i);
        if (engFrom && engFrom[1]?.trim() && !/your\s+telebirr/i.test(engFrom[1])) {
          counterparty = engFrom[1].trim();
        }
      }
    } else if (type === 'sent') {
      const toMatch = cleanMsg.match(/ለ\s+([A-Za-z0-9\u1200-\u137F]+)/);
      if (toMatch && toMatch[1]?.trim()) {
        counterparty = toMatch[1].trim();
      } else {
        const engTo = cleanMsg.match(/\bto\s+([A-Za-z0-9\s.&'-]+?)(?:\s*\(|\s+for|\s+on|\.|$|\s+Transaction|\s+via)/i);
        if (engTo && engTo[1]?.trim() && !/^withdraw\b/i.test(engTo[1].trim())) {
          counterparty = engTo[1].trim();
        }
      }
    }
  }

  // General fallback for all other Ethiopian banks (Awash, BOA, Dashen, Zemen, Siinqee, Wegagen, M-Pesa, etc.)
  if (!counterparty && category !== 'alert') {
    const byMatch = cleanMsg.match(/\b(?:by|በ)\s+([A-Za-z\u1200-\u137F\s.&'-]{2,40}?)(?:\s+(?:with\s+)?(?:txn|tx|ref|id|ft)|\s+on\s+\d|\.|$|,)/i);
    if (byMatch && byMatch[1]) {
      const candidate = byMatch[1].trim();
      if (!candidate.includes('%') && !/^(?:account|service|vat|bank|customer|secret\s*code|ref\b)/i.test(candidate) && !/^[0-9+*#\s-]+$/.test(candidate)) {
        counterparty = candidate;
      }
    }
  }

  if (!counterparty && category !== 'alert') {
    if (type === 'received') {
      const fromMatch = cleanMsg.match(/(?:from|ከ)\s+(?:account\s+[0-9*]+\s+)?([A-Za-z\u1200-\u137F\s.&'-]{2,45}?)(?:\s*\(|\s+(?:an\s+)?amount\b|\s+to\s+|\s+with\s+ref|\s+on\s+\d|\s+for\b|\.|$)/i);
      if (fromMatch && fromMatch[1]?.trim()) {
        const candidate = fromMatch[1].trim();
        if (!candidate.includes('%') && !/^(?:your|account|bank|x+)/i.test(candidate) && !/^[0-9+*#\s-]+$/.test(candidate)) {
          counterparty = candidate;
        }
      }
    } else if (type === 'sent') {
      const toMatch = cleanMsg.match(/(?:transferred\s+to|sent\s+to|paid\s+to|for\s+transfer\s+to|\bto|ለ)\s+(?:account\s+[0-9*]+\s+)?([A-Za-z0-9\u1200-\u137F\s.&'-]{2,45}?)(?:\s*\(|\s+with\s+ref|\s+on\s+\d|\s+for\b|\.|$)/i);
      if (toMatch && toMatch[1]?.trim()) {
        const candidate = toMatch[1].trim();
        if (!candidate.includes('%') && !/^(?:withdraw|your|account|bank|fayda)/i.test(candidate)) {
          counterparty = candidate;
        }
      }
      if (!counterparty) {
        const forFeeMatch = cleanMsg.match(/\bfor\s+the\s+([A-Za-z0-9\s.&'-]{3,50}?)(?:,\s*including|\s+including|\.|$)/i);
        if (forFeeMatch && forFeeMatch[1]?.trim()) {
          counterparty = forFeeMatch[1].trim();
        }
      }
    }
  }

  if (category === 'alert' && !counterparty) {
    counterparty = bank === 'Bank of Abyssinia' ? 'BOA Service Alert' : bank && bank !== 'Unknown' ? `${bank} Alert` : 'Bank Notification';
  }

  counterparty = counterparty
    .replace(/^(the|dear|customer|ለ|ከ|by|በ)\s+/i, '')
    .replace(/[\r\n።፤]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 6. EXTRACT ACCOUNT NUMBER
  let accountNumber: string | undefined = undefined;
  if (type === 'received') {
    const fromAcc = cleanMsg.match(/from\s+account\s+([0-9*]{4,20})/i);
    if (fromAcc?.[1]) accountNumber = fromAcc[1];
  } else if (type === 'sent') {
    const toAcc = cleanMsg.match(/to\s+account\s+([0-9*]{4,20})/i);
    if (toAcc?.[1]) accountNumber = toAcc[1];
  }

  if (!accountNumber) {
    const accMatch = cleanMsg.match(/(?:account|telebirr\s*account|acc\.?|a\/c|ሂሳብ\s*ቁጥር)\s*(?:no\.?|number)?\s*:?\s*([0-9*]{4,20})/i);
    if (accMatch?.[1]) accountNumber = accMatch[1];
  }

  // 7. EXTRACT DATE / TIME (supports dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd)
  let dateStr = new Date().toISOString();
  let timestamp = Date.now();
  const isoMatch = cleanMsg.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/);
  const slashOrDashMatch = cleanMsg.match(/(\d{2})[\/-](\d{2})[\/-](\d{4})\s+(\d{2}:\d{2}(?::\d{2})?)/);

  if (isoMatch?.[1]) {
    const parsedTs = Date.parse(isoMatch[1].replace(' ', 'T'));
    if (!isNaN(parsedTs)) {
      timestamp = parsedTs;
      dateStr = new Date(parsedTs).toISOString();
    }
  } else if (slashOrDashMatch) {
    const [, dd, mm, yyyy, time] = slashOrDashMatch;
    const parsedTs = Date.parse(`${yyyy}-${mm}-${dd}T${time}`);
    if (!isNaN(parsedTs)) {
      timestamp = parsedTs;
      dateStr = new Date(parsedTs).toISOString();
    }
  }

  // 8. BUILD RECEIPT URL (alerts/OTPs never get a fake payment receipt link)
  const receiptUrl =
    category === 'alert'
      ? undefined
      : buildOfficialReceiptUrl(bank, reference, accountNumber, extractedUrl);

  return {
    bank,
    senderAddress: sender,
    type,
    category,
    amount,
    amountCents,
    amountSantim,
    currency: 'ETB',
    counterparty,
    reference,
    ftNumber,
    v2Code,
    receiptUrl,
    accountNumber,
    balance,
    balanceSantim,
    fee,
    feeCents,
    date: dateStr,
    timestamp,
    rawMessage: originalMsg,
  };
}

// -------------------------------------------------------------
// BENCHMARK REAL SAMPLE SUITE
// -------------------------------------------------------------
export interface ParserBenchmarkSample {
  id: string;
  sampleNum: number;
  title: string;
  sender: string;
  raw: string;
  expectedBank: string;
  expectedType: PaymentType;
  expectedCategory?: PaymentCategory;
  expectedAmount: number;
  expectedCounterparty?: string;
  expectedRef?: string;
  expectedBalance?: number;
}

export const OFFICIAL_PARSER_BENCHMARKS: ParserBenchmarkSample[] = [
  {
    id: 'sample-1',
    sampleNum: 1,
    title: 'CBE Received with v2 receipt link',
    sender: 'CBE',
    raw: 'You have received ETB 10,000.00 from account 1********3557 (Usmeal Abdela Usmeal) to your account 1********9427. Your current balance is ETB11,487.36 .Thank you for banking with CBE! https://mbreciept.cbe.com.et/v2-hfHCxHOFHkYg2iE8Cxoo',
    expectedBank: 'CBE',
    expectedType: 'received',
    expectedAmount: 10000.0,
    expectedCounterparty: 'Usmeal Abdela Usmeal',
    expectedRef: 'v2-hfHCxHOFHkYg2iE8Cxoo',
    expectedBalance: 11487.36,
  },
  {
    id: 'sample-2',
    sampleNum: 2,
    title: 'CBE Transfer Sent (no space ETB10000.00)',
    sender: 'CBE',
    raw: 'You have successfully transferred ETB10000.00 from account 1********9427 to account 1********6157 (Bilal Seid Abdu). Service charge of ETB 0.00 and VAT(15%) of 0.0 … with total of ETB10000.00 .Your current balance is ETB1,487.36 … /v2-hfHCxHOSAUhicDpLO8l2',
    expectedBank: 'CBE',
    expectedType: 'sent',
    expectedAmount: 10000.0,
    expectedCounterparty: 'Bilal Seid Abdu',
    expectedRef: 'v2-hfHCxHOSAUhicDpLO8l2',
    expectedBalance: 1487.36,
  },
  {
    id: 'sample-3',
    sampleNum: 3,
    title: 'CBE Debited ATM/Card (no link, no to account)',
    sender: 'CBE',
    raw: 'Your Account 1********9427 has been debited with ETB 201.15 including Service charge ETB0.00ETB0.00 and VAT(15%) . Your Current Balance is ETB 1487.36 … shorturl.at/auUX0',
    expectedBank: 'CBE',
    expectedType: 'sent',
    expectedCategory: 'atm-card',
    expectedAmount: 201.15,
    expectedCounterparty: '',
    expectedRef: '',
    expectedBalance: 1487.36,
  },
  {
    id: 'sample-4',
    sampleNum: 4,
    title: 'CBE Debit Transaction of ETB 5980.0. (main amount vs total)',
    sender: 'CBE',
    raw: 'A debit transaction of ETB 5980.0. has occurred on your account 1********9427. Service charge of ETB 10.00 and VAT(15%) of ETB1.50 … total of ETB5992.00 .Your current balance is ETB1,625.23 … /v2-hfHCxHOjjcsmjYVFI685',
    expectedBank: 'CBE',
    expectedType: 'sent',
    expectedAmount: 5980.0,
    expectedRef: 'v2-hfHCxHOjjcsmjYVFI685',
    expectedBalance: 1625.23,
  },
  {
    id: 'sample-5',
    sampleNum: 5,
    title: 'CBE Credited with FT Number receipt',
    sender: 'CBE',
    raw: 'Your Account 1********9427 has been credited with ETB 300.00. Your Current Balance is ETB 1888.95 … for Reciept https://apps.cbe.com.et:100/BranchReceipt/FT26294BDL5T&62339427',
    expectedBank: 'CBE',
    expectedType: 'received',
    expectedAmount: 300.0,
    expectedRef: 'FT26294BDL5T',
    expectedBalance: 1888.95,
  },
  {
    id: 'sample-6',
    sampleNum: 6,
    title: 'Telebirr 127 Amharic Received (ከ Name)',
    sender: '127',
    raw: 'ውድ Aymen ከ Nestanet Markos(2519****6855) 50.00 ብር በ 25/10/2026 15:01:17 ተቀብለዋል፡፡ የሂሳብ እንቅስቃሴ ቁጥርዎ DJP8AHMQEE ነዉ፡፡ አሁን ያለዎት ቀሪ ሂሳብ 2,046.06 ብር ነዉ፡፡',
    expectedBank: 'Telebirr',
    expectedType: 'received',
    expectedAmount: 50.0,
    expectedCounterparty: 'Nestanet Markos',
    expectedRef: 'DJP8AHMQEE',
    expectedBalance: 2046.06,
  },
  {
    id: 'sample-7',
    sampleNum: 7,
    title: 'Telebirr 127 Data Package Purchase (ለ Phone)',
    sender: '127',
    raw: 'ዉድ Aymen በ 24/10/2026 21:58:37. ለ 996910607 ሳምንታዊ ኢንተርኔት 18 ጊ.ባ ጥቅል ጥቅል ለመግዛት 500.00 ብር ከፍለዋል። የግብይት ቁጥርዎ DJO19S1SYB ነው። ያለዎት ቀሪ ሂሳብ 1,946.06 ብር ነዉ::',
    expectedBank: 'Telebirr',
    expectedType: 'sent',
    expectedCategory: 'data',
    expectedAmount: 500.0,
    expectedCounterparty: '996910607',
    expectedRef: 'DJO19S1SYB',
    expectedBalance: 1946.06,
  },
  {
    id: 'sample-8',
    sampleNum: 8,
    title: 'Telebirr Completed ATM Withdrawal (100 ETB)',
    sender: '127',
    raw: 'Dear Aymen The request to withdraw ETB 100.00 from your telebirr account 251996910607 via secret code 215822 on 2026-11-24 12:46:58 using Awash International Bank S C ATM with transaction number DK06LG3250 is successfully completed. The service fee (including 15% VAT) is ETB 0.57. Your current Account balance is ETB 1,785.36.To download your payment information please click this link: https://transactioninfo.ethiotelecom.et/receipt/DK06LG3250',
    expectedBank: 'Telebirr',
    expectedType: 'sent',
    expectedCategory: 'atm-card',
    expectedAmount: 100.0,
    expectedCounterparty: 'Awash International Bank S C ATM',
    expectedRef: 'DK06LG3250',
    expectedBalance: 1785.36,
  },
];
