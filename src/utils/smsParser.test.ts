import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBankSms, TELEBIRR_PARSER_SAMPLES, convertAmharicNumerals } from './smsParser.ts';

test('Test case a: sender 127 transferred -> Telebirr, Sent', () => {
  const sms = 'You have transferred ETB 500.00 to Abel (0911000000) on 2026-10-24 10:15:00. Transaction number is 10M9933K1. Your current balance is ETB 4,500.00.';
  const parsed = parseBankSms('127', sms);

  assert.equal(parsed.bank, 'Telebirr');
  assert.equal(parsed.type, 'sent');
  assert.equal(parsed.amount, 500);
  assert.equal(parsed.amountCents, 50000);
  assert.equal(parsed.counterparty, 'Abel');
  assert.equal(parsed.reference, '10M9933K1');
  assert.equal(parsed.balance, 4500);
});

test('Test case b: sender 127 received -> Telebirr, Received', () => {
  const sms = 'You have received ETB 2,800.00 from Dawit Haile (0912345678) on 2026-10-24 11:20:00. Transaction ID: 10E9944P1. Your current balance is ETB 7,300.00.';
  const parsed = parseBankSms('127', sms);

  assert.equal(parsed.bank, 'Telebirr');
  assert.equal(parsed.type, 'received');
  assert.equal(parsed.amount, 2800);
  assert.equal(parsed.amountCents, 280000);
  assert.equal(parsed.counterparty, 'Dawit Haile');
  assert.equal(parsed.reference, '10E9944P1');
  assert.equal(parsed.balance, 7300);
});

test('Test case c: sender CBE credited -> CBE, Received', () => {
  const sms = 'Your Account 1*****4321 has been Credited with ETB 8,400.00 from Meron with txn id FT2630981120. Your current balance is ETB 150,900.20.';
  const parsed = parseBankSms('CBE', sms);

  assert.equal(parsed.bank, 'CBE');
  assert.equal(parsed.type, 'received');
  assert.equal(parsed.amount, 8400);
  assert.equal(parsed.counterparty, 'Meron');
  assert.equal(parsed.reference, 'FT2630981120');
  assert.equal(parsed.balance, 150900.20);
});

test('Test case d: sender CBE debited -> CBE, Sent', () => {
  const sms = 'Your Account 1*****4321 has been Debited with ETB 4,200.00 to Addis Supplier with txn id FT2630971100. Your current balance is ETB 146,700.20.';
  const parsed = parseBankSms('CBE', sms);

  assert.equal(parsed.bank, 'CBE');
  assert.equal(parsed.type, 'sent');
  assert.equal(parsed.amount, 4200);
  assert.equal(parsed.counterparty, 'Addis Supplier');
  assert.equal(parsed.reference, 'FT2630971100');
  assert.equal(parsed.balance, 146700.20);
});

test('Awash Bank credited -> Awash Bank, Received', () => {
  const sms = 'Awash Bank: Your account 0132****3321 has been credited with ETB 15,000.00 on 22/10/2026 14:10:00 from Yohannes Girma with ref FT993102AW. Balance is ETB 79,120.50.';
  const parsed = parseBankSms('AwashBank', sms);

  assert.equal(parsed.bank, 'Awash Bank');
  assert.equal(parsed.type, 'received');
  assert.equal(parsed.amount, 15000);
  assert.equal(parsed.counterparty, 'Yohannes Girma');
  assert.equal(parsed.reference, 'FT993102AW');
});

test('Unknown direction does not default to received', () => {
  const sms = 'Your transaction is under review for ETB 1,000.00.';
  const parsed = parseBankSms('127', sms);

  assert.equal(parsed.type, 'unknown');
  assert.equal(parsed.amount, 1000);
});

test('Telebirr Amharic Airtime Purchase: Sent & Airtime Category', () => {
  const sms = 'የ 25.00 ብር የአየር ሰዓት ለ 0911223344 በተሳካ ሁኔታ ገዝተዋል። የግብይት ቁጥር ER56TY78UI። ቀሪ ሂሳብዎ 520.50 ብር ነው። telebirr';
  const parsed = parseBankSms('127', sms);

  assert.equal(parsed.bank, 'Telebirr');
  assert.equal(parsed.type, 'sent');
  assert.equal(parsed.category, 'airtime');
  assert.equal(parsed.amount, 25.0);
  assert.equal(parsed.amountCents, 2500);
  assert.equal(parsed.reference, 'ER56TY78UI');
  assert.equal(parsed.balance, 520.50);
});

test('Telebirr Amharic Data Package: Sent & Data Category', () => {
  const sms = 'የ 100.00 ብር የሳምንታዊ 1GB የዳታ ጥቅል በተሳካ ሁኔታ ገዝተዋል። የግብይት ቁጥር DF89KJ23NM ነው። ቀሪ ሂሳብዎ 420.50 ብር ነው።';
  const parsed = parseBankSms('127', sms);

  assert.equal(parsed.bank, 'Telebirr');
  assert.equal(parsed.type, 'sent');
  assert.equal(parsed.category, 'data');
  assert.equal(parsed.amount, 100.0);
  assert.equal(parsed.amountCents, 10000);
  assert.equal(parsed.reference, 'DF89KJ23NM');
  assert.equal(parsed.balance, 420.50);
});

test('Telebirr Amharic Transfer Sent: Sent & Fee extracted', () => {
  const sms = 'ለ Abel (0911223344) 500.00 ብር አስተላልፈዋል። የአገልግሎት ክፍያ 1.50 ብር ተቆርጧል። የግብይት ቁጥር TXN88776655 ነው። ቀሪ ሂሳብዎ 318.50 ብር ነው።';
  const parsed = parseBankSms('127', sms);

  assert.equal(parsed.bank, 'Telebirr');
  assert.equal(parsed.type, 'sent');
  assert.equal(parsed.category, 'transfer');
  assert.equal(parsed.amount, 500.0);
  assert.equal(parsed.fee, 1.50);
  assert.equal(parsed.feeCents, 150);
  assert.equal(parsed.reference, 'TXN88776655');
  assert.equal(parsed.balance, 318.50);
});

test('Telebirr Amharic Transfer Received: Received & Counterparty extracted', () => {
  const sms = 'ከ Dawit Haile (0912345678) 2,800.00 ብር ተቀብለዋል። የግብይት ቁጥር 10E9944P1 ነው። ቀሪ ሂሳብዎ 3,118.50 ብር ነው። telebirr';
  const parsed = parseBankSms('127', sms);

  assert.equal(parsed.bank, 'Telebirr');
  assert.equal(parsed.type, 'received');
  assert.equal(parsed.category, 'transfer');
  assert.equal(parsed.amount, 2800.0);
  assert.equal(parsed.counterparty, 'Dawit Haile');
  assert.equal(parsed.reference, '10E9944P1');
  assert.equal(parsed.balance, 3118.50);
});

test('Telebirr English Bill Payment: Sent & Bill Category', () => {
  const sms = 'You have paid ETB 1,250.00 to Ethiopian Airlines for ticket booking. Transaction ID is ETB77889900. Your current balance is ETB 1,868.50.';
  const parsed = parseBankSms('127', sms);

  assert.equal(parsed.bank, 'Telebirr');
  assert.equal(parsed.type, 'sent');
  assert.equal(parsed.category, 'bill');
  assert.equal(parsed.amount, 1250.0);
  assert.equal(parsed.counterparty, 'Ethiopian Airlines');
  assert.equal(parsed.reference, 'ETB77889900');
  assert.equal(parsed.balance, 1868.50);
});

test('Ge\'ez numerals conversion (፩፻ ብር = 100)', () => {
  const converted = convertAmharicNumerals('የ ፻ ብር የአየር ሰዓት ገዝተዋል');
  assert.ok(converted.includes('100'));
});

test('All TELEBIRR_PARSER_SAMPLES pass benchmark criteria', () => {
  for (const s of TELEBIRR_PARSER_SAMPLES) {
    const res = parseBankSms(s.sender, s.raw);
    assert.equal(res.bank, s.expectedBank, `Bank mismatch for ${s.name}`);
    assert.equal(res.type, s.expectedType, `Direction mismatch for ${s.name}`);
    assert.equal(res.category, s.expectedCategory, `Category mismatch for ${s.name}`);
    assert.equal(res.amount, s.expectedAmount, `Amount mismatch for ${s.name}`);
  }
});
