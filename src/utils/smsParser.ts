import { PaymentType } from '../types/index.ts';

export interface ParsedPayment {
  bank: string;
  senderAddress: string;
  type: PaymentType;
  amount: number;
  currency: string;
  counterparty: string;
  reference: string;
  accountNumber?: string;
  balance?: number;
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

const OUTGOING_PHRASES = [
  'you have transferred',
  'you have paid',
  'has been debited',
  'debited',
  'transfered',
  'withdrawn',
  'purchase',
  'sent',
];

const INCOMING_PHRASES = [
  'you have received',
  'has been credited',
  'credited',
  'deposited',
];

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
  if (lowerMsg.includes('telebirr') || lowerMsg.includes('ethio telecom')) {
    return 'Telebirr';
  }
  if (lowerMsg.includes('cbe') || lowerMsg.includes('commercial bank of ethiopia') || lowerMsg.includes('commercial bank')) {
    return 'CBE';
  }
  if (lowerMsg.includes('awash')) {
    return 'Awash Bank';
  }
  if (lowerMsg.includes('dashen')) {
    return 'Dashen Bank';
  }
  if (lowerMsg.includes('abyssinia') || lowerMsg.includes('boa')) {
    return 'Bank of Abyssinia';
  }
  if (lowerMsg.includes('coop') || lowerMsg.includes('cooperative')) {
    return 'Coop Bank';
  }
  if (lowerMsg.includes('hibret')) {
    return 'Hibret Bank';
  }
  if (lowerMsg.includes('wegagen')) {
    return 'Wegagen Bank';
  }
  if (lowerMsg.includes('zemen')) {
    return 'Zemen Bank';
  }
  if (lowerMsg.includes('nib')) {
    return 'Nib Bank';
  }
  if (lowerMsg.includes('abay')) {
    return 'Abay Bank';
  }

  return 'Unknown';
}

export function determineDirection(message: string): PaymentType {
  const lowerMsg = message.toLowerCase();

  // Find earliest position of any outgoing phrase
  let earliestOutgoingIndex = -1;
  for (const phrase of OUTGOING_PHRASES) {
    const idx = lowerMsg.indexOf(phrase);
    if (idx !== -1) {
      if (earliestOutgoingIndex === -1 || idx < earliestOutgoingIndex) {
        earliestOutgoingIndex = idx;
      }
    }
  }

  // Find earliest position of any incoming phrase
  let earliestIncomingIndex = -1;
  for (const phrase of INCOMING_PHRASES) {
    const idx = lowerMsg.indexOf(phrase);
    if (idx !== -1) {
      if (earliestIncomingIndex === -1 || idx < earliestIncomingIndex) {
        earliestIncomingIndex = idx;
      }
    }
  }

  // If both appear, use whichever phrase appears first in the text. Check OUTGOING first in ties.
  if (earliestOutgoingIndex !== -1 && earliestIncomingIndex !== -1) {
    if (earliestOutgoingIndex <= earliestIncomingIndex) {
      return 'sent';
    } else {
      return 'received';
    }
  }

  if (earliestOutgoingIndex !== -1) {
    return 'sent';
  }

  if (earliestIncomingIndex !== -1) {
    return 'received';
  }

  // Never default to Received when unsure; show "unknown" and let user tap to set it
  return 'unknown';
}

export function parseBankSms(sender: string, message: string, customMap?: Record<string, string>): ParsedPayment {
  const cleanMsg = message.trim();
  const lowerMsg = cleanMsg.toLowerCase();

  const bank = determineBank(sender, cleanMsg, customMap);
  const type = determineDirection(cleanMsg);

  // Extract Amount (e.g., ETB 8,400.00, ETB 500.00, 8400 ETB, Birr 500.00, ብር 500)
  let amount = 0;
  const amountMatch = cleanMsg.match(/(?:ETB|Birr|ብር)\.?\s*([\d,]+(?:\.\d{1,2})?)/i) ||
                      cleanMsg.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:ETB|Birr|ብር)/i) ||
                      cleanMsg.match(/(?:amount|with|for)\s*(?:of)?\s*([\d,]+(?:\.\d{1,2})?)/i);

  if (amountMatch && amountMatch[1]) {
    const rawVal = amountMatch[1].replace(/,/g, '');
    const num = parseFloat(rawVal);
    if (!isNaN(num)) {
      amount = num;
    }
  }

  // Extract Current Balance if present (e.g., "Your current balance is ETB 142,500.20", "balance is ETB 79,120.50")
  let balance: number | undefined = undefined;
  const balanceMatch = cleanMsg.match(/(?:current\s*balance|your\s*balance|new\s*balance|balance)\s*(?:is|:)?\s*(?:ETB|Birr|ብር)?\.?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (balanceMatch && balanceMatch[1]) {
    const rawBal = balanceMatch[1].replace(/,/g, '');
    const numBal = parseFloat(rawBal);
    if (!isNaN(numBal)) {
      balance = numBal;
    }
  }

  // Extract Account Number (e.g. "account 1000****4819", "Account 1*****4321", "0132****3321")
  let accountNumber: string | undefined = undefined;
  const accMatch = cleanMsg.match(/(?:account|acc\.?|a\/c)\s*(?:no\.?|number)?\s*:?\s*([0-9*]{4,20})/i);
  if (accMatch && accMatch[1]) {
    accountNumber = accMatch[1];
  }

  // Extract Counterparty Name:
  // e.g.:
  // "to Abel (0911...)" or "to Abel"
  // "from Dawit Haile (0912...)"
  // "from Meron ..."
  // "by Tadesse Girma with txn id"
  // "to Addis Supplier Ltd with txn"
  let counterparty = 'Customer';
  const toMatch = cleanMsg.match(/\bto\s+([A-Za-z\s]+?)(?:\s*\(\d+\)|\s+with\s+txn|\s+on\s+\d|\s+ref|\s+Transaction|\.|$)/i);
  const fromMatch = cleanMsg.match(/\bfrom\s+([A-Za-z\s]+?)(?:\s*\(\d+\)|\s+with\s+txn|\s+on\s+\d|\s+ref|\s+Transaction|\.|$)/i);
  const byMatch = cleanMsg.match(/\bby\s+([A-Za-z\s]+?)(?:\s*\(\d+\)|\s+with\s+txn|\s+on\s+\d|\s+ref|\s+Transaction|\.|$)/i);

  if (type === 'sent' && toMatch && toMatch[1]?.trim()) {
    counterparty = toMatch[1].trim();
  } else if (type === 'received' && (fromMatch || byMatch)) {
    counterparty = (fromMatch?.[1] || byMatch?.[1] || 'Customer').trim();
  } else if (fromMatch && fromMatch[1]?.trim()) {
    counterparty = fromMatch[1].trim();
  } else if (toMatch && toMatch[1]?.trim()) {
    counterparty = toMatch[1].trim();
  }

  counterparty = counterparty.replace(/^(the|dear|customer)\s+/i, '').replace(/[\r\n]+/g, ' ').trim();
  counterparty = counterparty.replace(/\s+(?:with|on|at|ref|txn)\b.*$/i, '').trim();
  if (counterparty.length > 32) {
    counterparty = counterparty.substring(0, 32).trim();
  }
  if (!counterparty) {
    counterparty = bank !== 'Unknown' ? bank : sender;
  }

  // Extract Reference / Txn ID
  let reference = '';
  const refMatch = cleanMsg.match(/(?:transaction\s*number\s*is|txn\s*id|transaction\s*id|ref\s*(?:no|number)?|ft\s*no\.?)\s*:?\s*([A-Za-z0-9]+)/i) ||
                   cleanMsg.match(/\b(FT\d{8,14}|TXN[0-9A-Z]+|[A-Z0-9]{8,14})\b/);

  if (refMatch && refMatch[1]) {
    reference = refMatch[1].trim();
  }

  // Extract Date/Time if present in message text
  let dateStr = new Date().toISOString();
  let timestamp = Date.now();
  const dateMatch = cleanMsg.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?)/) ||
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
    amount,
    currency: 'ETB',
    counterparty,
    reference,
    accountNumber,
    balance,
    date: dateStr,
    timestamp,
    rawMessage: cleanMsg,
  };
}
