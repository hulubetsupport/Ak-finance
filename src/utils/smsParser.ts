import { PaymentType, PaymentCategory } from '../types/index.ts';

export interface ParsedPayment {
  bank: string;
  senderAddress: string;
  type: PaymentType;
  category: PaymentCategory;
  amount: number;
  amountCents: number;
  currency: string;
  counterparty: string;
  reference: string;
  accountNumber?: string;
  balance?: number;
  fee?: number;
  feeCents?: number;
  date: string;
  timestamp: number;
  rawMessage: string;
}

export const DEFAULT_SENDER_BANK_MAP: Record<string, string> = {
  '127': 'Telebirr',
  'CBE': 'CBE',
  'AWASHBANK': 'Awash Bank',
  'AWASH': 'Awash Bank',
  'DASHEN': 'Dashen Bank',
  'BOA': 'Bank of Abyssinia',
  'ABYSSINIA': 'Bank of Abyssinia',
};

// -------------------------------------------------------------
// EDITABLE KEYWORD LISTS (Constants)
// -------------------------------------------------------------
export const TELEBIRR_RECEIVED_KEYWORDS: readonly string[] = [
  'ተቀብለዋል',
  'ደርሶዎታል',
  'received',
  'credited',
  'deposited',
  'ገቢ ተደርጓል',
];

export const TELEBIRR_SENT_KEYWORDS: readonly string[] = [
  'ልከዋል',
  'አስተላልፈዋል',
  'transferred',
  'transfered',
  'sent',
  'debited',
  'has been debited',
  'ወጪ ተደርጓል',
];

export const TELEBIRR_PAID_KEYWORDS: readonly string[] = [
  'ከፍለዋል',
  'ገዝተዋል',
  'paid',
  'purchase',
  'withdrawn',
  'ክፍያ ፈጽመዋል',
];

export const TELEBIRR_AIRTIME_KEYWORDS: readonly string[] = [
  'አየር ሰዓት',
  'የአየር ሰዓት',
  'airtime',
  'recharge',
  'top up',
  'top-up',
];

export const TELEBIRR_DATA_KEYWORDS: readonly string[] = [
  'ዳታ',
  'ጥቅል',
  'ኢንተርኔት',
  'package',
  'data',
  'bundle',
  'internet',
];

export const TELEBIRR_BILL_KEYWORDS: readonly string[] = [
  'ቢል',
  'የቢል ክፍያ',
  'merchant',
  'bill',
  'utility',
  'pay bill',
  'pay with telebirr',
  'ለነጋዴ',
];

export const TELEBIRR_CASH_KEYWORDS: readonly string[] = [
  'cash-in',
  'cash in',
  'cash-out',
  'cash out',
  'ወኪል',
  'ኤጀንት',
  'agent',
  'via agent',
  'deposited via',
];

export const AMOUNT_KEYWORDS: readonly string[] = ['ብር', 'ETB', 'Birr'];
export const REFERENCE_KEYWORDS: readonly string[] = [
  'የግብይት ቁጥር',
  'የግብይት መለያ',
  'transaction number',
  'transaction id',
  'txn id',
  'txn',
  'ref',
  'ft',
];
export const BALANCE_KEYWORDS: readonly string[] = [
  'ቀሪ ሂሳብ',
  'ቀሪ ሂሳብዎ',
  'ቀሪ',
  'balance',
  'current balance',
  'new balance',
];
export const FEE_KEYWORDS: readonly string[] = [
  'የአገልግሎት ክፍያ',
  'አገልግሎት ክፍያ',
  'ቫት',
  'fee',
  'service fee',
  'vat',
];

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
  // Check if text contains Ge'ez numbers
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
// BANK DETECTION
// -------------------------------------------------------------
export function determineBank(sender: string, message: string, customMap?: Record<string, string>): string {
  const normSender = sender.trim().toUpperCase();
  const map = { ...DEFAULT_SENDER_BANK_MAP, ...(customMap || {}) };

  // 1. SENDER FIRST: Check exact sender match (case-insensitive)
  for (const [key, val] of Object.entries(map)) {
    if (key.trim().toUpperCase() === normSender) {
      return val;
    }
  }

  // Also check if sender contains key (e.g. CBE-SMS or Telebirr)
  for (const [key, val] of Object.entries(map)) {
    if (normSender.includes(key.trim().toUpperCase())) {
      return val;
    }
  }

  // 2. If sender is unknown, guess from the SMS text
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes('telebirr') || lowerMsg.includes('ቴሌብር') || lowerMsg.includes('ethio telecom')) {
    return 'Telebirr';
  }
  if (lowerMsg.includes('cbe') || lowerMsg.includes('commercial bank of ethiopia') || lowerMsg.includes('የኢትዮጵያ ንግድ ባንክ')) {
    return 'CBE';
  }
  if (lowerMsg.includes('awash') || lowerMsg.includes('አዋሽ')) {
    return 'Awash Bank';
  }
  if (lowerMsg.includes('dashen') || lowerMsg.includes('ዳሽን')) {
    return 'Dashen Bank';
  }
  if (lowerMsg.includes('abyssinia') || lowerMsg.includes('boa') || lowerMsg.includes('አቢሲኒያ')) {
    return 'Bank of Abyssinia';
  }
  if (lowerMsg.includes('coop') || lowerMsg.includes('cooperative')) {
    return 'Coop Bank';
  }
  if (lowerMsg.includes('hibret')) {
    return 'Hibret Bank';
  }
  if (lowerMsg.includes('wegagen') || lowerMsg.includes('ወጋገን')) {
    return 'Wegagen Bank';
  }
  if (lowerMsg.includes('zemen')) {
    return 'Zemen Bank';
  }
  if (lowerMsg.includes('nib') || lowerMsg.includes('ንብ')) {
    return 'Nib Bank';
  }
  if (lowerMsg.includes('abay') || lowerMsg.includes('ዓባይ') || lowerMsg.includes('አባይ')) {
    return 'Abay Bank';
  }

  return 'Unknown';
}

// -------------------------------------------------------------
// CATEGORY DETECTION
// -------------------------------------------------------------
export function determineCategory(message: string): PaymentCategory {
  const lower = message.toLowerCase();

  for (const k of TELEBIRR_AIRTIME_KEYWORDS) {
    if (lower.includes(k.toLowerCase())) return 'airtime';
  }
  for (const k of TELEBIRR_DATA_KEYWORDS) {
    if (lower.includes(k.toLowerCase())) return 'data';
  }
  for (const k of TELEBIRR_BILL_KEYWORDS) {
    if (lower.includes(k.toLowerCase())) return 'bill';
  }
  // Non-airtime/data payments or purchases are bill / merchant payments
  for (const k of TELEBIRR_PAID_KEYWORDS) {
    if (lower.includes(k.toLowerCase())) return 'bill';
  }
  for (const k of TELEBIRR_CASH_KEYWORDS) {
    if (lower.includes(k.toLowerCase())) return 'cash';
  }
  return 'transfer';
}

// -------------------------------------------------------------
// DIRECTION DETERMINATION (OUTGOING FIRST RULE)
// -------------------------------------------------------------
export function determineDirection(message: string): { type: PaymentType; category: PaymentCategory } {
  const cleanMsg = convertAmharicNumerals(message);
  const lowerMsg = cleanMsg.toLowerCase();
  const category = determineCategory(cleanMsg);

  // Rule: Airtime, data and bill payments are ALWAYS Sent
  if (category === 'airtime' || category === 'data' || category === 'bill') {
    return { type: 'sent', category };
  }

  // Combined Outgoing Phrases (English + Amharic)
  const allOutgoing = [
    ...TELEBIRR_SENT_KEYWORDS,
    ...TELEBIRR_PAID_KEYWORDS,
    'you have transferred',
    'you have paid',
    'has been debited',
    'debited',
    'transfered',
    'withdrawn',
    'purchase',
    'sent',
  ];

  // Combined Incoming Phrases (English + Amharic)
  const allIncoming = [
    ...TELEBIRR_RECEIVED_KEYWORDS,
    'you have received',
    'has been credited',
    'credited',
    'deposited',
  ];

  // Find earliest position of any outgoing phrase
  let earliestOutgoingIndex = -1;
  for (const phrase of allOutgoing) {
    const idx = lowerMsg.indexOf(phrase.toLowerCase());
    if (idx !== -1) {
      if (earliestOutgoingIndex === -1 || idx < earliestOutgoingIndex) {
        earliestOutgoingIndex = idx;
      }
    }
  }

  // Find earliest position of any incoming phrase
  let earliestIncomingIndex = -1;
  for (const phrase of allIncoming) {
    const idx = lowerMsg.indexOf(phrase.toLowerCase());
    if (idx !== -1) {
      if (earliestIncomingIndex === -1 || idx < earliestIncomingIndex) {
        earliestIncomingIndex = idx;
      }
    }
  }

  // If both appear, use whichever phrase appears first in the text. Check OUTGOING first in ties.
  if (earliestOutgoingIndex !== -1 && earliestIncomingIndex !== -1) {
    if (earliestOutgoingIndex <= earliestIncomingIndex) {
      return { type: 'sent', category };
    } else {
      return { type: 'received', category };
    }
  }

  if (earliestOutgoingIndex !== -1) {
    return { type: 'sent', category };
  }

  if (earliestIncomingIndex !== -1) {
    return { type: 'received', category };
  }

  // Never default to Received when unsure; show "unknown"
  return { type: 'unknown', category };
}

// -------------------------------------------------------------
// MAIN PARSE FUNCTION
// -------------------------------------------------------------
export function parseBankSms(sender: string, message: string, customMap?: Record<string, string>): ParsedPayment {
  const originalMsg = message.trim();
  const cleanMsg = convertAmharicNumerals(originalMsg);
  const lowerMsg = cleanMsg.toLowerCase();

  const bank = determineBank(sender, cleanMsg, customMap);
  const { type, category } = determineDirection(cleanMsg);

  // 1. EXTRACT AMOUNT
  let amount = 0;
  // Match patterns like:
  // "የ 25.00 ብር", "25.00 ብር", "ETB 2,800.00", "2800 ETB", "ETB 500.00", "Birr 500.00", "ብር 500"
  const amountMatch =
    cleanMsg.match(/(?:የ\s*)?([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|Birr|ብር)/i) ||
    cleanMsg.match(/(?:ETB|Birr|ብር)\.?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    cleanMsg.match(/(?:amount|with|for)\s*(?:of)?\s*(?:ETB|Birr|ብር)?\s*([\d,]+(?:\.\d{1,2})?)/i);

  if (amountMatch && amountMatch[1]) {
    const rawVal = amountMatch[1].replace(/,/g, '');
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num > 0) {
      amount = num;
    }
  }

  const amountCents = Math.round(amount * 100);

  // 2. EXTRACT SERVICE FEE / VAT IF SHOWN
  let fee: number | undefined = undefined;
  const feeMatch =
    cleanMsg.match(/(?:የአገልግሎት\s*ክፍያ|አገልግሎት\s*ክፍያ|service\s*fee|fee\s*is|fee)\s*(?:is|:|ነው)?\s*(?:ETB|Birr|ብር)?\.?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    cleanMsg.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|Birr|ብር)?\s*(?:አገልግሎት\s*ክፍያ|የአገልግሎት\s*ክፍያ)/i);

  if (feeMatch && feeMatch[1]) {
    const numFee = parseFloat(feeMatch[1].replace(/,/g, ''));
    if (!isNaN(numFee) && numFee >= 0) {
      fee = numFee;
    }
  }
  const feeCents = fee !== undefined ? Math.round(fee * 100) : undefined;

  // 3. EXTRACT CURRENT BALANCE IF SHOWN
  let balance: number | undefined = undefined;
  const balanceMatch =
    cleanMsg.match(/(?:ቀሪ\s*ሂሳብዎ|ቀሪ\s*ሂሳብ|current\s*balance|your\s*balance|new\s*balance|balance)\s*(?:is|:)?\s*(?:ETB|Birr|ብር)?\.?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    cleanMsg.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|Birr|ብር)\s*(?:ቀሪ\s*ሂሳብ|ቀሪ)/i);

  if (balanceMatch && balanceMatch[1]) {
    const numBal = parseFloat(balanceMatch[1].replace(/,/g, ''));
    if (!isNaN(numBal)) {
      balance = numBal;
    }
  }

  // 4. EXTRACT ACCOUNT NUMBER
  let accountNumber: string | undefined = undefined;
  const accMatch = cleanMsg.match(/(?:account|acc\.?|a\/c|ሂሳብ\s*ቁጥር)\s*(?:no\.?|number)?\s*:?\s*([0-9*]{4,20})/i);
  if (accMatch && accMatch[1]) {
    accountNumber = accMatch[1];
  }

  // 5. EXTRACT COUNTERPARTY / MERCHANT NAME
  let counterparty = '';

  if (category === 'airtime') {
    const airtimePhoneMatch = cleanMsg.match(/ለ\s*([0-9+]{9,14})/);
    counterparty = airtimePhoneMatch ? `Airtime (${airtimePhoneMatch[1]})` : 'Airtime Top-up';
  } else if (category === 'data') {
    counterparty = 'Data Package';
  } else {
    // Check Amharic prefixes: "ለ <name>" (to) or "ከ <name>" (from)
    const amharicToMatch = cleanMsg.match(/(?:ለ)\s+([A-Za-z\u1200-\u137F\s]+?)(?:\s*\([0-9+]+\)|\s+\d|\s+የግብይት|\s+በተሳካ|።|\.|$)/);
    const amharicFromMatch = cleanMsg.match(/(?:ከ)\s+([A-Za-z\u1200-\u137F\s]+?)(?:\s*\([0-9+]+\)|\s+\d|\s+የግብይት|\s+በተሳካ|።|\.|$)/);

    // English prefixes: "to <name>", "from <name>", "by <name>"
    const toMatch = cleanMsg.match(/\bto\s+([A-Za-z\s]+?)(?:\s*\([0-9+]+\)|\s+for\s+|\s+with\s+txn|\s+on\s+\d|\s+ref|\s+Transaction|\.|$)/i);
    const fromMatch = cleanMsg.match(/\bfrom\s+([A-Za-z\s]+?)(?:\s*\([0-9+]+\)|\s+for\s+|\s+with\s+txn|\s+on\s+\d|\s+ref|\s+Transaction|\.|$)/i);
    const byMatch = cleanMsg.match(/\bby\s+([A-Za-z\s]+?)(?:\s*\([0-9+]+\)|\s+for\s+|\s+with\s+txn|\s+on\s+\d|\s+ref|\s+Transaction|\.|$)/i);

    if (type === 'sent') {
      if (toMatch && toMatch[1]?.trim()) counterparty = toMatch[1].trim();
      else if (amharicToMatch && amharicToMatch[1]?.trim()) counterparty = amharicToMatch[1].trim();
    } else if (type === 'received') {
      if (fromMatch && fromMatch[1]?.trim()) counterparty = fromMatch[1].trim();
      else if (byMatch && byMatch[1]?.trim()) counterparty = byMatch[1].trim();
      else if (amharicFromMatch && amharicFromMatch[1]?.trim()) counterparty = amharicFromMatch[1].trim();
    }

    if (!counterparty) {
      if (fromMatch?.[1]) counterparty = fromMatch[1].trim();
      else if (toMatch?.[1]) counterparty = toMatch[1].trim();
      else if (amharicFromMatch?.[1]) counterparty = amharicFromMatch[1].trim();
      else if (amharicToMatch?.[1]) counterparty = amharicToMatch[1].trim();
    }
  }

  // Counterparty cleanup
  counterparty = counterparty
    .replace(/^(the|dear|customer|ለ|ከ)\s+/i, '')
    .replace(/[\r\n።፤]+/g, ' ')
    .trim();
  counterparty = counterparty.replace(/\s+(?:with|on|at|ref|txn|for|የግብይት|በተሳካ)\b.*$/i, '').trim();

  if (counterparty.length > 32) {
    counterparty = counterparty.substring(0, 32).trim();
  }
  if (!counterparty) {
    counterparty = bank !== 'Unknown' ? bank : sender;
  }

  // 6. EXTRACT REFERENCE / TRANSACTION ID
  let reference = '';
  const refMatch =
    cleanMsg.match(/(?:የግብይት\s*ቁጥር|የግብይት\s*መለያ|transaction\s*(?:number|id)|txn\s*id|ref\s*(?:no|number)?|ft\s*no\.?)\s*(?:is|ነው)?\s*:?\s*([A-Za-z0-9]+)/i) ||
    cleanMsg.match(/\b(FT\d{8,14}|TXN[0-9A-Z]+|[A-Z0-9]{8,14})\b/);

  if (refMatch && refMatch[1]) {
    reference = refMatch[1].replace(/[።፤.:]+$/, '').trim();
  }

  // 7. EXTRACT DATE / TIME
  let dateStr = new Date().toISOString();
  let timestamp = Date.now();
  const dateMatch =
    cleanMsg.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/) ||
    cleanMsg.match(/(\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}(?::\d{2})?)/) ||
    cleanMsg.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?)/);

  if (dateMatch && dateMatch[1]) {
    try {
      const parsedTs = Date.parse(dateMatch[1].replace(/-/g, '/'));
      if (!isNaN(parsedTs)) {
        timestamp = parsedTs;
        dateStr = new Date(parsedTs).toISOString();
      }
    } catch {}
  }

  return {
    bank,
    senderAddress: sender,
    type,
    category,
    amount,
    amountCents,
    currency: 'ETB',
    counterparty,
    reference,
    accountNumber,
    balance,
    fee,
    feeCents,
    date: dateStr,
    timestamp,
    rawMessage: originalMsg,
  };
}

// -------------------------------------------------------------
// BENCHMARK REAL SAMPLE SUITE FOR THE HIDDEN TEST SCREEN
// -------------------------------------------------------------
export interface ParserSample {
  id: string;
  name: string;
  sender: string;
  raw: string;
  expectedBank: string;
  expectedType: PaymentType;
  expectedCategory: PaymentCategory;
  expectedAmount: number;
}

export const TELEBIRR_PARSER_SAMPLES: ParserSample[] = [
  {
    id: 'sample-1',
    name: 'Telebirr Airtime Purchase (Amharic)',
    sender: '127',
    raw: 'የ 25.00 ብር የአየር ሰዓት ለ 0911223344 በተሳካ ሁኔታ ገዝተዋል። የግብይት ቁጥር ER56TY78UI። ቀሪ ሂሳብዎ 520.50 ብር ነው። telebirr',
    expectedBank: 'Telebirr',
    expectedType: 'sent',
    expectedCategory: 'airtime',
    expectedAmount: 25.0,
  },
  {
    id: 'sample-2',
    name: 'Telebirr Data Package Purchase (Amharic)',
    sender: '127',
    raw: 'የ 100.00 ብር የሳምንታዊ 1GB የዳታ ጥቅል በተሳካ ሁኔታ ገዝተዋል። የግብይት ቁጥር DF89KJ23NM ነው። ቀሪ ሂሳብዎ 420.50 ብር ነው።',
    expectedBank: 'Telebirr',
    expectedType: 'sent',
    expectedCategory: 'data',
    expectedAmount: 100.0,
  },
  {
    id: 'sample-3',
    name: 'Telebirr Transfer Sent (Amharic)',
    sender: '127',
    raw: 'ለ Abel (0911223344) 500.00 ብር አስተላልፈዋል። የአገልግሎት ክፍያ 1.50 ብር ተቆርጧል። የግብይት ቁጥር TXN88776655 ነው። ቀሪ ሂሳብዎ 318.50 ብር ነው።',
    expectedBank: 'Telebirr',
    expectedType: 'sent',
    expectedCategory: 'transfer',
    expectedAmount: 500.0,
  },
  {
    id: 'sample-4',
    name: 'Telebirr Transfer Received (Amharic)',
    sender: '127',
    raw: 'ከ Dawit Haile (0912345678) 2,800.00 ብር ተቀብለዋል። የግብይት ቁጥር 10E9944P1 ነው። ቀሪ ሂሳብዎ 3,118.50 ብር ነው። telebirr',
    expectedBank: 'Telebirr',
    expectedType: 'received',
    expectedCategory: 'transfer',
    expectedAmount: 2800.0,
  },
  {
    id: 'sample-5',
    name: 'Telebirr Transfer Sent (English)',
    sender: '127',
    raw: 'You have transferred ETB 500.00 to Abel (0911223344). Service fee is ETB 1.50. Transaction number is TB77889911. Your current balance is ETB 1,240.00.',
    expectedBank: 'Telebirr',
    expectedType: 'sent',
    expectedCategory: 'transfer',
    expectedAmount: 500.0,
  },
  {
    id: 'sample-6',
    name: 'Telebirr Transfer Received (English)',
    sender: '127',
    raw: 'You have received ETB 2,800.00 from Dawit Haile (0912345678). Transaction ID is 10E9944P1. Your current balance is ETB 4,040.00.',
    expectedBank: 'Telebirr',
    expectedType: 'received',
    expectedCategory: 'transfer',
    expectedAmount: 2800.0,
  },
  {
    id: 'sample-7',
    name: 'Telebirr Bill Payment (English)',
    sender: '127',
    raw: 'You have paid ETB 1,250.00 to Ethiopian Airlines for ticket booking. Transaction ID is ETB77889900. Your current balance is ETB 1,868.50.',
    expectedBank: 'Telebirr',
    expectedType: 'sent',
    expectedCategory: 'bill',
    expectedAmount: 1250.0,
  },
  {
    id: 'sample-8',
    name: 'CBE Account Credited (Received)',
    sender: 'CBE',
    raw: 'Your Account 1*****4321 has been Credited with ETB 8,400.00 from Meron Teshome. Transaction number is FT2630981120. Your balance is ETB 150,900.20.',
    expectedBank: 'CBE',
    expectedType: 'received',
    expectedCategory: 'transfer',
    expectedAmount: 8400.0,
  },
  {
    id: 'sample-9',
    name: 'CBE Account Debited (Sent)',
    sender: 'CBE',
    raw: 'Your Account 1*****4321 has been Debited with ETB 4,200.00 to Addis Supplier Ltd. Transaction number is FT2630971100. Your balance is ETB 146,700.20.',
    expectedBank: 'CBE',
    expectedType: 'sent',
    expectedCategory: 'transfer',
    expectedAmount: 4200.0,
  },
  {
    id: 'sample-10',
    name: 'Amharic Ge\'ez Digits Airtime (፩፻ ብር)',
    sender: '127',
    raw: 'የ ፻ ብር የአየር ሰዓት በተሳካ ሁኔታ ገዝተዋል። የግብይት ቁጥር GZ100AIR ነው።',
    expectedBank: 'Telebirr',
    expectedType: 'sent',
    expectedCategory: 'airtime',
    expectedAmount: 100.0,
  },
];
