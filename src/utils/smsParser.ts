export interface ParsedPayment {
  bank: string;
  senderAddress: string;
  type: 'received' | 'sent';
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

export function parseBankSms(sender: string, message: string): ParsedPayment {
  const cleanMsg = message.trim();
  const lowerMsg = cleanMsg.toLowerCase();
  const senderNorm = sender.trim().toUpperCase();

  let bank = 'Unknown';
  if (senderNorm.includes('CBE') || senderNorm === '127' || senderNorm === '889' || lowerMsg.includes('cbe') || lowerMsg.includes('commercial bank')) {
    bank = 'CBE';
  } else if (senderNorm.includes('TELEBIRR') || lowerMsg.includes('telebirr') || lowerMsg.includes('ethio telecom')) {
    bank = 'Telebirr';
  } else if (senderNorm.includes('AWASH') || lowerMsg.includes('awash')) {
    bank = 'Awash Bank';
  } else if (senderNorm.includes('DASHEN') || lowerMsg.includes('dashen')) {
    bank = 'Dashen Bank';
  } else if (senderNorm.includes('BOA') || senderNorm.includes('ABYSSINIA') || lowerMsg.includes('abyssinia')) {
    bank = 'Bank of Abyssinia';
  } else if (senderNorm.includes('HIBRET') || lowerMsg.includes('hibret')) {
    bank = 'Hibret Bank';
  } else if (senderNorm.includes('COOP') || lowerMsg.includes('cooperative')) {
    bank = 'Coop Bank';
  } else {
    bank = sender || 'Bank';
  }

  // Determine Sent vs Received
  let type: 'received' | 'sent' = 'received';
  if (
    lowerMsg.includes('debited') ||
    lowerMsg.includes('transferred to') ||
    lowerMsg.includes('sent') ||
    lowerMsg.includes('you have paid') ||
    lowerMsg.includes('withdrawn') ||
    lowerMsg.includes('payment to')
  ) {
    type = 'sent';
  } else if (
    lowerMsg.includes('credited') ||
    lowerMsg.includes('received') ||
    lowerMsg.includes('deposited') ||
    lowerMsg.includes('has sent you') ||
    lowerMsg.includes('inward')
  ) {
    type = 'received';
  }

  // Extract Amount (e.g., ETB 8,400.00, 8400 ETB, Birr 500.00, ETB. 1,500)
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

  // Extract Counterparty / Sender / Beneficiary Name
  let counterparty = 'Customer';
  const cbeReceivedMatch = cleanMsg.match(/by\s+([A-Za-z\s]+?)\s+(?:with\s+txn|with\s+transaction|on\s+\d|\.)/i);
  const cbeSentMatch = cleanMsg.match(/to\s+([A-Za-z\s]+?)\s+(?:with\s+txn|with\s+transaction|on\s+\d|\.)/i);
  const telebirrFromMatch = cleanMsg.match(/from\s+([A-Za-z\s]+?)(?:\s*\(\d+\)|\s+on\s+\d|\.)/i);
  const telebirrToMatch = cleanMsg.match(/to\s+([A-Za-z\s]+?)(?:\s*\(\d+\)|\s+on\s+\d|\.)/i);
  const genericFrom = cleanMsg.match(/(?:from|by)\s+([A-Za-z\s]{3,35})(?:\s+on|\s+with|\s+at|\.|$)/i);

  if (type === 'received' && (cbeReceivedMatch || telebirrFromMatch || genericFrom)) {
    counterparty = (cbeReceivedMatch?.[1] || telebirrFromMatch?.[1] || genericFrom?.[1] || 'Customer').trim();
  } else if (type === 'sent' && (cbeSentMatch || telebirrToMatch)) {
    counterparty = (cbeSentMatch?.[1] || telebirrToMatch?.[1] || 'Merchant').trim();
  } else if (genericFrom && genericFrom[1]) {
    counterparty = genericFrom[1].trim();
  }

  // Clean up counterparty name
  counterparty = counterparty.replace(/^(the|dear)\s+/i, '').replace(/[\r\n]+/g, ' ').trim();
  if (counterparty.length > 30) {
    counterparty = counterparty.substring(0, 30);
  }

  // Extract Reference / Txn ID
  let reference = '';
  const refMatch = cleanMsg.match(/(?:txn\s*id|transaction\s*id|ref\s*(?:no|number)?|ft\s*no\.?)\s*:?\s*([A-Za-z0-9]+)/i) ||
                   cleanMsg.match(/(FT\d{8,14}|TXN[0-9A-Z]+|[A-Z0-9]{8,14})/);
  if (refMatch && refMatch[1]) {
    reference = refMatch[1];
  } else {
    reference = 'TXN-' + Math.random().toString(36).substring(2, 9).toUpperCase();
  }

  // Extract Balance if present
  let balance: number | undefined;
  const balanceMatch = cleanMsg.match(/(?:balance\s*(?:is)?|current\s*balance)\s*(?:ETB|Birr)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (balanceMatch && balanceMatch[1]) {
    const bNum = parseFloat(balanceMatch[1].replace(/,/g, ''));
    if (!isNaN(bNum)) balance = bNum;
  }

  // Extract Account Masked Number if present
  let accountNumber: string | undefined;
  const accMatch = cleanMsg.match(/(?:account|acc(?:ount)?\.?)\s*(?:number)?\s*([xX*•\d]{4,16})/i);
  if (accMatch && accMatch[1]) {
    accountNumber = accMatch[1];
  }

  return {
    bank,
    senderAddress: sender,
    type,
    amount,
    currency: 'ETB',
    counterparty: counterparty || (type === 'received' ? 'Customer' : 'Vendor'),
    reference,
    accountNumber,
    balance,
    date: new Date().toISOString(),
    timestamp: Date.now(),
    rawMessage: cleanMsg,
  };
}
