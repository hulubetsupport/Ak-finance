import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBankSms } from './smsParser.ts';

test('Test case a: sender 127 transferred -> Telebirr, Sent', () => {
  const sms = 'You have transferred ETB 500.00 to Abel (0911000000) on 2026-10-24 10:15:00. Transaction number is 10M9933K1. Your current balance is ETB 4,500.00.';
  const parsed = parseBankSms('127', sms);

  assert.equal(parsed.bank, 'Telebirr');
  assert.equal(parsed.type, 'sent');
  assert.equal(parsed.amount, 500);
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
  assert.equal(parsed.balance, 79120.50);
});

test('Unknown direction does not default to received', () => {
  const sms = 'Notice: Your statement has been prepared. Please visit your branch.';
  const parsed = parseBankSms('CBE', sms);

  assert.equal(parsed.bank, 'CBE');
  assert.equal(parsed.type, 'unknown');
});
