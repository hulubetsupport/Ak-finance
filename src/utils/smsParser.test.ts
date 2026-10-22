import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBankSms } from './smsParser.ts';

test('parses CBE received payment SMS correctly', () => {
  const sms = 'Dear Customer, your account 1000****4819 has been credited with ETB 8,400.00 on 19-10-2026 22:33:14 by Tadesse Girma with txn id FT2629391038. Your current balance is ETB 142,500.20. Thank you for banking with CBE!';
  const parsed = parseBankSms('CBE', sms);

  assert.equal(parsed.bank, 'CBE');
  assert.equal(parsed.type, 'received');
  assert.equal(parsed.amount, 8400);
  assert.equal(parsed.counterparty, 'Tadesse Girma');
  assert.equal(parsed.reference, 'FT2629391038');
  assert.equal(parsed.currency, 'ETB');
  assert.equal(parsed.balance, 142500.20);
});

test('parses CBE sent / debited SMS correctly', () => {
  const sms = 'Dear Customer, your account 1000****4819 has been debited with ETB 3,300.00 on 19-10-2026 21:10:02 to Alemayehu Mengistu with txn id FT2629390012. Your current balance is ETB 139,200.20.';
  const parsed = parseBankSms('127', sms);

  assert.equal(parsed.bank, 'CBE');
  assert.equal(parsed.type, 'sent');
  assert.equal(parsed.amount, 3300);
  assert.equal(parsed.counterparty, 'Alemayehu Mengistu');
  assert.equal(parsed.reference, 'FT2629390012');
  assert.equal(parsed.currency, 'ETB');
});

test('parses Telebirr received SMS correctly', () => {
  const sms = 'You have received ETB 1,500.00 from Abebe Kebede (0911223344) on 2026-10-19 18:20:10. Transaction ID: 10A8829F2. Your current balance is ETB 15,200.00.';
  const parsed = parseBankSms('Telebirr', sms);

  assert.equal(parsed.bank, 'Telebirr');
  assert.equal(parsed.type, 'received');
  assert.equal(parsed.amount, 1500);
  assert.equal(parsed.counterparty, 'Abebe Kebede');
  assert.equal(parsed.reference, '10A8829F2');
});

test('parses Awash bank SMS correctly', () => {
  const sms = 'Awash Bank: Your account 0132****3321 has been credited with ETB 12,000.00 on 19/10/2026 14:15:00 from Binyam Worku with ref FT991002. Balance is ETB 85,000.00.';
  const parsed = parseBankSms('AwashBank', sms);

  assert.equal(parsed.bank, 'Awash Bank');
  assert.equal(parsed.type, 'received');
  assert.equal(parsed.amount, 12000);
  assert.equal(parsed.counterparty, 'Binyam Worku');
  assert.equal(parsed.reference, 'FT991002');
});
