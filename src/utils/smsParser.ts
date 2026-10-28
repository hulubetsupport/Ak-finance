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
// EDITABLE SENDER MAP
// -------------------------------------------------------------
export const DEFAULT_SENDER_BANK_MAP: Record<string, string> = {
  '127': 'Telebirr',
  'CBE': 'CBE',
  'COMMERCIAL BANK OF ETHIOPIA': 'CBE',
  'AWASHBANK': 'Awash Bank',
  'AWASH': 'Awash Bank',
  'DASHEN': 'Dashen Bank',
  'BOA': 'Bank of Abyssinia',
  'ABYSSINIA': 'Bank of Abyssinia',
};

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
// BANK DETECTION (Sender Decides First)
// -------------------------------------------------------------
export function determineBank(sender: string, message: string, customMap?: Record<string, string>): string {
  const normSender = (sender || '').trim().toUpperCase();
  const map = { ...DEFAULT_SENDER_BANK_MAP, ...(customMap || {}) };

  // 1. SENDER FIRST: Check exact sender match
  for (const [key, val] of Object.entries(map)) {
    if (key.trim().toUpperCase() === normSender) {
      return val;
    }
  }

  // Also check if sender contains key (e.g. "CBE-SMS" or "Telebirr")
  for (const [key, val] of Object.entries(map)) {
    if (normSender.includes(key.trim().toUpperCase())) {
      return val;
    }
  }

  // 2. If sender is unknown, guess from the text
  const lowerMsg = (message || '').toLowerCase();
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
  if (lowerMsg.includes('abay') || lowerMsg.includes('ዓባይ') || lowerMsg.includes('አባይ')) {
    return 'Abay Bank';
  }
  if (lowerMsg.includes('wegagen') || lowerMsg.includes('ወጋገን')) {
    return 'Wegagen Bank';
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
  'you have transferred',
  'you have paid',
];

export const TELEBIRR_INCOMING_PHRASES: readonly string[] = [
  'ተቀብለዋል',
  'ገቢ',
  'you have received',
  'has been credited',
];

export function determineDirection(cleanMsg: string): PaymentType {
  const lowerMsg = cleanMsg.toLowerCase();

  // Outgoing phrases
  const allOutgoing = [
    ...CBE_OUTGOING_PHRASES,
    ...TELEBIRR_OUTGOING_PHRASES,
    'withdrawn',
    'sent',
  ];

  // Incoming phrases
  const allIncoming = [
    ...CBE_INCOMING_PHRASES,
    ...TELEBIRR_INCOMING_PHRASES,
    'deposited',
  ];

  let earliestOutgoingIndex = -1;
  for (const phrase of allOutgoing) {
    const idx = lowerMsg.indexOf(phrase.toLowerCase());
    if (idx !== -1) {
      if (earliestOutgoingIndex === -1 || idx < earliestOutgoingIndex) {
        earliestOutgoingIndex = idx;
      }
    }
  }

  let earliestIncomingIndex = -1;
  for (const phrase of allIncoming) {
    const idx = lowerMsg.indexOf(phrase.toLowerCase());
    if (idx !== -1) {
      if (earliestIncomingIndex === -1 || idx < earliestIncomingIndex) {
        earliestIncomingIndex = idx;
      }
    }
  }

  // If both appear the first one wins
  if (earliestOutgoingIndex !== -1 && earliestIncomingIndex !== -1) {
    return earliestOutgoingIndex <= earliestIncomingIndex ? 'sent' : 'received';
  }

  if (earliestOutgoingIndex !== -1) return 'sent';
  if (earliestIncomingIndex !== -1) return 'received';

  // Never default to Received; show "unknown"
  return 'unknown';
}

// -------------------------------------------------------------
// MAIN PARSE FUNCTION
// -------------------------------------------------------------
export function parseBankSms(sender: string, message: string, customMap?: Record<string, string>): ParsedPayment {
  const originalMsg = (message || '').trim();
  const cleanMsg = convertAmharicNumerals(originalMsg);
  const lowerMsg = cleanMsg.toLowerCase();

  const bank = determineBank(sender, cleanMsg, customMap);
  let type = determineDirection(cleanMsg);

  // 1. EXTRACT V2 CODE AND FT NUMBER
  // CBE v2 link: https://mbreciept.cbe.com.et/v2-xxxx or /v2-xxxx (case-sensitive, NEVER uppercase)
  let v2Code: string | undefined = undefined;
  const v2Match = originalMsg.match(/\b(v2-[A-Za-z0-9_-]+)/);
  if (v2Match && v2Match[1]) {
    v2Code = v2Match[1].trim();
  }

  // FT Number: e.g. /BranchReceipt/FT26294BDL5T&6233 or FT...
  let ftNumber: string | undefined = undefined;
  const ftMatch = originalMsg.match(/\b(FT[A-Za-z0-9]{8,15})\b/i);
  if (ftMatch && ftMatch[1]) {
    ftNumber = ftMatch[1].toUpperCase().trim();
  }

  // Reference for Telebirr or general (10-character code after transaction number / የግብይት ቁጥርዎ)
  let reference = '';
  if (v2Code) {
    reference = v2Code;
  } else if (ftNumber) {
    reference = ftNumber;
  } else {
    const telebirrRefMatch =
      cleanMsg.match(/(?:የግብይት\s*ቁጥርዎ?|የሂሳብ\s*እንቅስቃሴ\s*ቁጥርዎ?|transaction\s*(?:number|id|no\.?)|txn\s*id)\s*(?:is|ነው|ነዉ)?\s*:?\s*([A-Za-z0-9]{8,15})/i) ||
      cleanMsg.match(/(?:receipt\/)([A-Za-z0-9]{8,15})/i);
    if (telebirrRefMatch && telebirrRefMatch[1]) {
      reference = telebirrRefMatch[1].trim();
    }
  }

  // 2. CATEGORY DETECTION
  // Airtime (አየር ሰዓት, airtime, recharge)
  // Data (ኢንተርኔት, ዳታ, ጥቅል, package, bundle)
  // Payment (ከፍለዋል, paid)
  // ATM-Card (CBE "has been debited with ETB x including Service charge" with no receipt link and no "to account")
  let category: PaymentCategory = 'other';

  const isAirtime = /አየር\s*ሰዓት|የአየር\s*ሰዓት|airtime|recharge|top\s*up/i.test(cleanMsg);
  const isData = /ኢንተርኔት|ዳታ|ጥቅል|package|bundle|internet/i.test(cleanMsg);
  const isPayment = /ከፍለዋል|\bpaid\b|\bmerchant\b|ለነጋዴ/i.test(cleanMsg);
  const isAlertMsg =
    /logged\s*in|login|log\s*in|otp|one\s*time\s*password|verification\s*code|security\s*alert|password\s*(?:changed|reset)|daily\s*limit|limit\s*has\s*been|statement\s*request|session\s*expired|announcement|fraud\s*alert|alert\s*:|notice\s*:/i.test(cleanMsg) ||
    /የይለፍ\s*ቃል|ማረጋገጫ\s*ኮድ|ማስጠንቀቂያ|የደህንነት|የመግቢያ/i.test(cleanMsg);

  const isCbeAtmCard =
    bank === 'CBE' &&
    /debited\s*with/i.test(cleanMsg) &&
    /including\s*service\s*charge/i.test(cleanMsg) &&
    !v2Code &&
    !ftNumber &&
    !/to\s*account/i.test(cleanMsg);

  if (isCbeAtmCard) {
    category = 'atm-card';
    type = 'sent';
  } else if (isAirtime) {
    category = 'airtime';
    type = 'sent';
  } else if (isData) {
    category = 'data';
    type = 'sent';
  } else if (isPayment) {
    category = 'payment';
    type = 'sent';
  } else if (type === 'received') {
    category = 'received';
  } else if (type === 'sent') {
    category = 'transfer';
  }

  // 3. EXTRACT MAIN AMOUNT ONLY
  // Ignore balance, service charge, VAT and total!
  // Handle ETB/Birr/ብር, commas, decimals, also "ETB10000.00" with no space.
  let amount = 0;

  // Primary Action Amount Regexes (matches right after primary action word)
  // E.g. "received ETB 10,000.00", "transferred ETB10000.00", "debited with ETB 201.15", "debit transaction of ETB 5980.0.", "credited with ETB 300.00"
  const actionAmountMatch =
    cleanMsg.match(/(?:received|transferred|debited\s*with|credited\s*with|debit\s*transaction\s*of|credit\s*transaction\s*of|paid)\s*(?:ETB|Birr|ብር)?\s*([0-9,]+(?:\.[0-9]+)?\.?)/i) ||
    cleanMsg.match(/(?:received|transferred|debited|credited|paid)\s*ETB([0-9,]+(?:\.[0-9]+)?\.?)/i);

  if (actionAmountMatch && actionAmountMatch[1]) {
    const rawNumStr = actionAmountMatch[1].replace(/,/g, '').replace(/\.+$/, '');
    const num = parseFloat(rawNumStr);
    if (!isNaN(num) && num > 0) {
      amount = num;
    }
  }

  // Telebirr Amharic Amount Regexes:
  // E.g. "50.00 ብር ... ተቀብለዋል", "500.00 ብር ከፍለዋል።", "የ 25.00 ብር የአየር ሰዓት"
  if (amount === 0) {
    const telebirrAmountMatch =
      cleanMsg.match(/([0-9,]+(?:\.[0-9]+)?)\s*ብር\s*(?:በ\s*\d|\s*ተቀብለዋል|ከፍለዋል|ልከዋል|አስተላልፈዋል|ገዝተዋል)/) ||
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

  // Fallback: general ETB/Birr/ብር match, avoiding words like "total of", "service charge", "vat", "balance"
  if (amount === 0) {
    const generalMatch =
      cleanMsg.match(/(?:ETB|Birr|ብር)\s*([0-9,]+(?:\.[0-9]+)?)/i) ||
      cleanMsg.match(/([0-9,]+(?:\.[0-9]+)?)\s*(?:ETB|Birr|ብር)/i);

    if (generalMatch && generalMatch[1]) {
      const rawNumStr = generalMatch[1].replace(/,/g, '').replace(/\.+$/, '');
      const num = parseFloat(rawNumStr);
      if (!isNaN(num) && num > 0) {
        amount = num;
      }
    }
  }

  // If amount is 0 and it's an alert or has no financial debit/credit words, mark as 'alert'
  if (amount === 0 && (isAlertMsg || (type === 'unknown' && !actionAmountMatch))) {
    category = 'alert';
    type = 'unknown';
  }

  const amountCents = Math.round(amount * 100);
  const amountSantim = amountCents;

  // 4. EXTRACT BALANCE AFTER ("current balance" / "ቀሪ ሂሳብ")
  let balance: number | undefined = undefined;
  const balanceMatch =
    cleanMsg.match(/(?:current\s*balance\s*(?:is)?|your\s*balance\s*(?:is)?|ቀሪ\s*ሂሳብ\s*(?:ነው|ዎ|ነዉ)?|አሁን\s*ያለዎት\s*ቀሪ\s*ሂሳብ|ያለዎት\s*ቀሪ\s*ሂሳብ)\s*(?:is|:|ነው|ነዉ)?\s*(?:ETB|Birr|ብር)?\s*([0-9,]+(?:\.[0-9]+)?)/i) ||
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
  // CBE rule: first parenthesis that has letters and no "%", OR "by <Name> with txn id", OR "from <Name>"
  // Telebirr received: text between "ከ" and "("
  // Telebirr sent/paid: the word after "ለ"
  let counterparty = '';

  if (bank === 'CBE') {
    // Rule A: Parentheses check (first parenthesis with letters, no %, not system tokens)
    const matches = cleanMsg.matchAll(/\(([^)]+)\)/g);
    for (const m of matches) {
      const inside = m[1].trim();
      if (
        /[A-Za-z\u1200-\u137F]/.test(inside) &&
        !inside.includes('%') &&
        !/^[0-9+*#\s-]+$/.test(inside) &&
        !/^(?:vat|service\s*charge|cbe|ft|cbs|shorturl|http|charge)/i.test(inside)
      ) {
        counterparty = inside;
        break;
      }
    }

    // Rule B1: Amharic "በ <NAME> በኩል" (very common in CBE Amharic messages)
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
    // Handles: "by MERON TESHOME with txn id FT...", "by MERON TESHOME Ref: FT...", "by MERON TESHOME. Ref..."
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

    // Rule C: "deposited by <NAME>" or "credited by <NAME>" or "received from <NAME>"
    if (!counterparty) {
      const depMatch = cleanMsg.match(/(?:deposited\s+by|credited\s+by|received\s+from)\s+([A-Za-z\u1200-\u137F\s]{2,40}?)(?:\s+(?:with|on|ref|txn|ft)|\.|$|,|;)/i);
      if (depMatch && depMatch[1]) {
        const cand = depMatch[1].trim();
        if (!cand.includes('%') && cand.length >= 2) {
          counterparty = cand;
        }
      }
    }

    // Rule D: Explicit Key-Value labels (Sender: <NAME>, Payer: <NAME>, Depositor: <NAME>, ላኪ: <NAME>)
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

    // Rule E: "transfer to <NAME>", "transferred to <NAME>", "for transfer to <NAME>", "sent to <NAME>" for sent
    if (!counterparty && type === 'sent') {
      const toMatch = cleanMsg.match(/(?:(?:for\s+)?transfer(?:red)?\s+to|sent\s+to|debited\s+for(?:\s+transfer\s+to)?|paid\s+to|ተቀባይ|የተቀባይ\s*ስም|ለ)\s*(?:account\s+[0-9*]+\s+)?[:፡\-]?\s*([A-Za-z\u1200-\u137F\s]{2,40}?)(?:\s+(?:with|on|ref|txn|ft|\/branchreceipt)|\.|$|,|;|\(|\n)/i);
      if (toMatch && toMatch[1]) {
        const cand = toMatch[1].trim();
        if (!cand.includes('%') && !/^(?:account|cbe|boa|etb|service|vat|bank|your)/i.test(cand) && cand.length >= 2) {
          counterparty = cand;
        }
      }
    }

    // Rule F: "from account ... (Name) to your account" (Only for received payments)
    if (!counterparty && type === 'received') {
      const fromAcctMatch = cleanMsg.match(/from\s+(?:account\s+[0-9*]+\s+)?\(?([A-Za-z\u1200-\u137F\s]{2,40}?)\)?\s+to\s+(?:your\s+account|account)/i);
      if (fromAcctMatch && fromAcctMatch[1]) {
        const cand = fromAcctMatch[1].trim();
        if (!cand.includes('%') && !/^(?:your|my|our|account|cbe)/i.test(cand) && !/^[0-9*]+$/.test(cand) && cand.length >= 2) {
          counterparty = cand;
        }
      }
    }
  } else if (bank === 'Telebirr') {
    if (type === 'received') {
      // Text between "ከ" and "("
      const fromMatch = cleanMsg.match(/ከ\s+([A-Za-z\u1200-\u137F\s]+?)\s*\(/);
      if (fromMatch && fromMatch[1]?.trim()) {
        counterparty = fromMatch[1].trim();
      } else {
        const engFrom = cleanMsg.match(/from\s+([A-Za-z\s]+?)(?:\s*\(|\s+on|\s+for|\.|$)/i);
        if (engFrom && engFrom[1]?.trim()) {
          counterparty = engFrom[1].trim();
        }
      }
    } else {
      // Sent/Paid: the word or name after "ለ"
      const toMatch = cleanMsg.match(/ለ\s+([A-Za-z0-9\u1200-\u137F]+)/);
      if (toMatch && toMatch[1]?.trim()) {
        counterparty = toMatch[1].trim();
      } else {
        const engTo = cleanMsg.match(/to\s+([A-Za-z0-9\s]+?)(?:\s*\(|\s+for|\s+on|\.|$|\s+Transaction)/i);
        if (engTo && engTo[1]?.trim()) {
          counterparty = engTo[1].trim();
        }
      }
    }
  }

  // General fallback for names across all banks if not yet found
  if (!counterparty && category !== 'alert') {
    // Check "by <Name> with txn id / on"
    const byMatch = cleanMsg.match(/\b(?:by|በ)\s+([A-Za-z\u1200-\u137F\s]{2,40}?)(?:\s+with\s+(?:txn|tx|ref|id)|(?:\s+on\s+\d)|\.|$|,)/i);
    if (byMatch && byMatch[1]) {
      const candidate = byMatch[1].trim();
      if (!candidate.includes('%') && !/^(?:account|service|vat|bank|customer)/i.test(candidate) && !/^[0-9+*#\s-]+$/.test(candidate)) {
        counterparty = candidate;
      }
    }
  }

  if (!counterparty && category !== 'alert') {
    if (type === 'received') {
      const fromMatch = cleanMsg.match(/(?:from|ከ)\s+([A-Za-z\u1200-\u137F\s]+?)(?:\s*\(|\s+to\s+|\s+for|\.|$)/i);
      if (fromMatch && fromMatch[1]?.trim()) {
        const candidate = fromMatch[1].trim();
        if (!candidate.includes('%') && !/^[0-9+*#\s-]+$/.test(candidate)) {
          counterparty = candidate;
        }
      }
    } else if (type === 'sent') {
      const toMatch = cleanMsg.match(/(?:to|ለ)\s+([A-Za-z0-9\u1200-\u137F\s]+?)(?:\s*\(|\s+for|\.|$)/i);
      if (toMatch && toMatch[1]?.trim()) {
        const candidate = toMatch[1].trim();
        if (!candidate.includes('%')) {
          counterparty = candidate;
        }
      }
    }
  }

  // If this is an alert message and counterparty is empty, set friendly alert title
  if (category === 'alert' && !counterparty) {
    counterparty = bank === 'BOA' ? 'BOA Service Alert' : bank ? `${bank} Alert` : 'Bank Notification';
  }

  // Clean up counterparty
  counterparty = counterparty
    .replace(/^(the|dear|customer|ለ|ከ|by|በ)\s+/i, '')
    .replace(/[\r\n።፤]+/g, ' ')
    .trim();

  // 6. EXTRACT ACCOUNT NUMBER
  let accountNumber: string | undefined = undefined;
  if (type === 'received') {
    const fromAcc = cleanMsg.match(/from\s+account\s+([0-9*]{4,20})/i);
    if (fromAcc && fromAcc[1]) {
      accountNumber = fromAcc[1];
    }
  } else if (type === 'sent') {
    const toAcc = cleanMsg.match(/to\s+account\s+([0-9*]{4,20})/i);
    if (toAcc && toAcc[1]) {
      accountNumber = toAcc[1];
    }
  }

  if (!accountNumber) {
    const accMatch = cleanMsg.match(/(?:account|acc\.?|a\/c|ሂሳብ\s*ቁጥር)\s*(?:no\.?|number)?\s*:?\s*([0-9*]{4,20})/i);
    if (accMatch && accMatch[1]) {
      accountNumber = accMatch[1];
    }
  }

  // 7. EXTRACT DATE / TIME
  let dateStr = new Date().toISOString();
  let timestamp = Date.now();
  const dateMatch =
    cleanMsg.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(?::\d{2})?)/) ||
    cleanMsg.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/);

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
    amountSantim,
    currency: 'ETB',
    counterparty,
    reference,
    ftNumber,
    v2Code,
    accountNumber,
    balance,
    balanceSantim,
    date: dateStr,
    timestamp,
    rawMessage: originalMsg,
  };
}

// -------------------------------------------------------------
// BENCHMARK REAL SAMPLE SUITE FOR HIDDEN TEST SCREEN (8 SAMPLES)
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
    title: 'Telebirr English Received and Transferred',
    sender: '127',
    raw: 'You have received ETB 2,800.00 from Dawit Haile (0912345678) … Transaction number is 10E9944P1X',
    expectedBank: 'Telebirr',
    expectedType: 'received',
    expectedAmount: 2800.0,
    expectedCounterparty: 'Dawit Haile',
    expectedRef: '10E9944P1X',
  },
];
