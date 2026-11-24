import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseBankSms,
  OFFICIAL_PARSER_BENCHMARKS,
  convertAmharicNumerals,
  needsFtRecovery,
} from './smsParser.ts';

test('Sample 1: CBE Received with v2 receipt link', () => {
  const s = OFFICIAL_PARSER_BENCHMARKS.find(x => x.sampleNum === 1)!;
  const parsed = parseBankSms(s.sender, s.raw);

  assert.equal(parsed.bank, 'CBE');
  assert.equal(parsed.type, 'received');
  assert.equal(parsed.amount, 10000.0);
  assert.equal(parsed.counterparty, 'Usmeal Abdela Usmeal');
  assert.equal(parsed.balance, 11487.36);
  assert.equal(parsed.v2Code, 'v2-hfHCxHOFHkYg2iE8Cxoo');
  assert.equal(parsed.reference, 'v2-hfHCxHOFHkYg2iE8Cxoo');
  assert.equal(parsed.receiptUrl, 'https://mbreciept.cbe.com.et/v2-hfHCxHOFHkYg2iE8Cxoo');
});

test('Sample 2: CBE Transfer Sent with ETB10000.00 and Bilal Seid Abdu', () => {
  const s = OFFICIAL_PARSER_BENCHMARKS.find(x => x.sampleNum === 2)!;
  const parsed = parseBankSms(s.sender, s.raw);

  assert.equal(parsed.bank, 'CBE');
  assert.equal(parsed.type, 'sent');
  assert.equal(parsed.amount, 10000.0);
  assert.equal(parsed.counterparty, 'Bilal Seid Abdu');
  assert.equal(parsed.balance, 1487.36);
  assert.equal(parsed.v2Code, 'v2-hfHCxHOSAUhicDpLO8l2');
});

test('Sample 3: CBE ATM/Card debit with no link and no to account', () => {
  const s = OFFICIAL_PARSER_BENCHMARKS.find(x => x.sampleNum === 3)!;
  const parsed = parseBankSms(s.sender, s.raw);

  assert.equal(parsed.bank, 'CBE');
  assert.equal(parsed.type, 'sent');
  assert.equal(parsed.category, 'atm-card');
  assert.equal(parsed.amount, 201.15);
  assert.equal(parsed.counterparty, '');
  assert.equal(parsed.reference, '');
  assert.equal(parsed.balance, 1487.36);
});

test('Sample 4: CBE Debit transaction 5980.0. (main amount vs total)', () => {
  const s = OFFICIAL_PARSER_BENCHMARKS.find(x => x.sampleNum === 4)!;
  const parsed = parseBankSms(s.sender, s.raw);

  assert.equal(parsed.bank, 'CBE');
  assert.equal(parsed.type, 'sent');
  assert.equal(parsed.amount, 5980.0);
  assert.equal(parsed.balance, 1625.23);
  assert.equal(parsed.v2Code, 'v2-hfHCxHOjjcsmjYVFI685');
});

test('Sample 5: CBE Credited with FT Number receipt', () => {
  const s = OFFICIAL_PARSER_BENCHMARKS.find(x => x.sampleNum === 5)!;
  const parsed = parseBankSms(s.sender, s.raw);

  assert.equal(parsed.bank, 'CBE');
  assert.equal(parsed.type, 'received');
  assert.equal(parsed.amount, 300.0);
  assert.equal(parsed.ftNumber, 'FT26294BDL5T');
  assert.equal(parsed.reference, 'FT26294BDL5T');
  assert.equal(parsed.balance, 1888.95);
});

test('Sample 6: Telebirr 127 Amharic Received (ከ Nestanet Markos)', () => {
  const s = OFFICIAL_PARSER_BENCHMARKS.find(x => x.sampleNum === 6)!;
  const parsed = parseBankSms(s.sender, s.raw);

  assert.equal(parsed.bank, 'Telebirr');
  assert.equal(parsed.type, 'received');
  assert.equal(parsed.amount, 50.0);
  assert.equal(parsed.counterparty, 'Nestanet Markos');
  assert.equal(parsed.reference, 'DJP8AHMQEE');
  assert.equal(parsed.balance, 2046.06);
  assert.equal(parsed.receiptUrl, 'https://transactioninfo.ethiotelecom.et/receipt/DJP8AHMQEE');
});

test('Sample 7: Telebirr 127 Data Package Purchase (ለ 996910607)', () => {
  const s = OFFICIAL_PARSER_BENCHMARKS.find(x => x.sampleNum === 7)!;
  const parsed = parseBankSms(s.sender, s.raw);

  assert.equal(parsed.bank, 'Telebirr');
  assert.equal(parsed.type, 'sent');
  assert.equal(parsed.category, 'data');
  assert.equal(parsed.amount, 500.0);
  assert.equal(parsed.counterparty, '996910607');
  assert.equal(parsed.reference, 'DJO19S1SYB');
  assert.equal(parsed.balance, 1946.06);
});

test('Screenshot 184622: Telebirr Completed ATM Withdrawal is parsed as sent/atm-card (not alert)', () => {
  const sms =
    'Dear Aymen The request to withdraw ETB 100.00 from your telebirr account 251996910607 via secret code 215822 on 2026-11-24 12:46:58 using Awash International Bank S C ATM with transaction number DK06LG3250 is successfully completed. The service fee (including 15% VAT) is ETB 0.57. Your current Account balance is ETB 1,785.36.To download your payment information please click this link: https://transactioninfo.ethiotelecom.et/receipt/DK06LG3250';
  const parsed = parseBankSms('127', sms);

  assert.equal(parsed.bank, 'Telebirr');
  assert.equal(parsed.type, 'sent');
  assert.equal(parsed.category, 'atm-card');
  assert.equal(parsed.amount, 100.0);
  assert.equal(parsed.fee, 0.57);
  assert.equal(parsed.balance, 1785.36);
  assert.equal(parsed.reference, 'DK06LG3250');
  assert.equal(parsed.counterparty, 'Awash International Bank S C ATM');
  assert.equal(parsed.receiptUrl, 'https://transactioninfo.ethiotelecom.et/receipt/DK06LG3250');
});

test('Screenshot 184631: Telebirr ATM Withdrawal Secret Code OTP stays informational alert (amount = 0)', () => {
  const sms =
    'Dear Customer, Your ATM withdrawal secret code is 215822 for an amount of ETB 100.00. Please use this code before 2026-11-24 13:16:29 at an ATM of any one of these banks: Addis, Awash, BoA, Hibret or Nib. For more information, please call 127 or visit www.ethiotelecom.et. Thank you for using telebirr. Ethio telecom';
  const parsed = parseBankSms('127', sms);

  assert.equal(parsed.bank, 'Telebirr');
  assert.equal(parsed.category, 'alert');
  assert.equal(parsed.type, 'unknown');
  assert.equal(parsed.amount, 0);
  assert.equal(parsed.receiptUrl, undefined);
  assert.match(parsed.counterparty, /ATM Secret Code.*215822/);
});

test('CBE-only FT rule: needsFtRecovery is true ONLY for CBE transfers missing FT/v2', () => {
  assert.equal(needsFtRecovery({ bank: 'CBE', category: 'transfer', reference: 'SMS-12' }), true);
  assert.equal(needsFtRecovery({ bank: 'CBE', category: 'transfer', reference: 'TXN9821' }), true);
  assert.equal(needsFtRecovery({ bank: 'CBE', category: 'transfer', ftNumber: 'FT26301G31YR', reference: 'FT26301G31YR' }), false);
  assert.equal(needsFtRecovery({ bank: 'CBE', category: 'transfer', v2Code: 'v2-hfHCxHOFHkYg2iE8Cxoo' }), false);
  assert.equal(needsFtRecovery({ bank: 'CBE', category: 'atm-card', reference: '' }), false);
  assert.equal(needsFtRecovery({ bank: 'Telebirr', category: 'atm-card', reference: 'DK06LG3250' }), false);
  assert.equal(needsFtRecovery({ bank: 'Telebirr', category: 'transfer', reference: '' }), false);
  assert.equal(needsFtRecovery({ bank: 'Awash Bank', category: 'transfer', reference: '' }), false);
  assert.equal(needsFtRecovery({ bank: 'Bank of Abyssinia', category: 'transfer', reference: '' }), false);
  assert.equal(needsFtRecovery({ bank: 'Dashen Bank', category: 'transfer', reference: '' }), false);
});

test('Multi-bank Ethiopian SMS parsing: Dashen, Awash, BOA, Zemen, Siinqee, Wegagen, M-Pesa', () => {
  const dashen = parseBankSms(
    'Dashen',
    'Dear customer, your account has been credited with ETB 750.25 from FastPay PLC. Receipt: https://receipts.dashenbanksc.com/receipt/387ETAP2522000WK. Current balance is ETB 4,200.00.'
  );
  assert.equal(dashen.bank, 'Dashen Bank');
  assert.equal(dashen.type, 'received');
  assert.equal(dashen.amount, 750.25);
  assert.equal(dashen.reference, '387ETAP2522000WK');
  assert.equal(dashen.receiptUrl, 'https://receipts.dashenbanksc.com/receipt/387ETAP2522000WK');

  const awash = parseBankSms(
    'AwashBank',
    'Awash Bank: Your account 0132****3321 has been credited with ETB 15,000.00 from Yohannes Girma. https://awashpay.awashbank.com:8225/-AW25220099888 Balance is ETB 79,120.50.'
  );
  assert.equal(awash.bank, 'Awash Bank');
  assert.equal(awash.type, 'received');
  assert.equal(awash.amount, 15000);
  assert.equal(awash.counterparty, 'Yohannes Girma');
  assert.equal(awash.receiptUrl, 'https://awashpay.awashbank.com:8225/-AW25220099888');

  const siinqee = parseBankSms(
    'Siinqee',
    'Your Siinqee account has been debited with ETB 1,200.00 transferred to Abebe Bikila. Ref: SNQ98765abc. https://receipts.siinqeebank.com:871/generate/SNQ98765abc Balance is ETB 8,300.00.'
  );
  assert.equal(siinqee.bank, 'Siinqee Bank');
  assert.equal(siinqee.type, 'sent');
  assert.equal(siinqee.amount, 1200);
  assert.equal(siinqee.reference, 'SNQ98765abc');

  const wegagen = parseBankSms(
    'Wegagen',
    'Wegagen Bank: Your account has been credited with ETB 2,400.00 by Sara Tadesse. https://transinfo.wegagenbanksc.com.et:8183/?id=WGG123456789012345678901'
  );
  assert.equal(wegagen.bank, 'Wegagen Bank');
  assert.equal(wegagen.type, 'received');
  assert.equal(wegagen.amount, 2400);
  assert.equal(wegagen.reference, 'WGG123456789012345678901');
});

test('Ge\'ez numerals conversion (፩፻ ብር = 100)', () => {
  assert.equal(convertAmharicNumerals('የ ፩፻ ብር'), 'የ 100 ብር');
  assert.equal(convertAmharicNumerals('፭፻'), '500');
});

test('All 8 OFFICIAL_PARSER_BENCHMARKS execute cleanly without error', () => {
  for (const sample of OFFICIAL_PARSER_BENCHMARKS) {
    const res = parseBankSms(sample.sender, sample.raw);
    assert.equal(res.bank, sample.expectedBank);
    assert.equal(res.type, sample.expectedType);
    assert.equal(res.amount, sample.expectedAmount);
  }
});

test('CBE Received: extracts sender name from "by <NAME> with txn id"', () => {
  const sms = 'Dear Customer, your account 10001199 has been Credited with ETB 3,700.00 on 28-OCT-2026 by MERON TESHOME with txn id FT26301G31YR. Your current balance is ETB 12,500.00.';
  const parsed = parseBankSms('CBE', sms);
  assert.equal(parsed.bank, 'CBE');
  assert.equal(parsed.type, 'received');
  assert.equal(parsed.amount, 3700.0);
  assert.equal(parsed.counterparty, 'MERON TESHOME');
  assert.equal(parsed.ftNumber, 'FT26301G31YR');
});

test('BOA Alert: non-financial SMS marked as category "alert" and type "unknown"', () => {
  const sms = 'Dear Customer, your Internet Banking account has been logged in on 28-OCT-2026 13:47 from IP 196.188.12.4. If this was not you, please call 8335 immediately.';
  const parsed = parseBankSms('BOA', sms);
  assert.equal(parsed.bank, 'Bank of Abyssinia');
  assert.equal(parsed.category, 'alert');
  assert.equal(parsed.type, 'unknown');
  assert.equal(parsed.amount, 0);
});

test('Real backup #147: Awash negative-prefixed debit and "balance now is"', () => {
  const sms =
    'Dear Customer, your Account 01425xxxxxx5001 has been Debited with ETB -100.00 on 2026-11-05 14:26:09. Your balance now is ETB 54.40. For any complaint or enquiry, please call 8980.';
  const parsed = parseBankSms('Awash Bank', sms);
  assert.equal(parsed.bank, 'Awash Bank');
  assert.equal(parsed.type, 'sent');
  assert.equal(parsed.amount, 100.0);
  assert.equal(parsed.balance, 54.4);
});

test('Real backup #139: Awash counterparty before "an amount of" with normalized whitespace', () => {
  const sms =
    'Dear Cashier, You have Received a payment from NEIMA  HASSEN  SEID   an amount of 100.00 ETB from XXXX369 on 2026-11-05 10:10:06 with reason (N) with Tip of 0.00 ETB credited to your wallet account. by REF 261105101069150 .Download your receipt by link: https://awashpay.awashbank.com:8225/-2KJY0ZN4V2-6F362K.';
  const parsed = parseBankSms('Awash Bank', sms);
  assert.equal(parsed.bank, 'Awash Bank');
  assert.equal(parsed.type, 'received');
  assert.equal(parsed.amount, 100.0);
  assert.equal(parsed.counterparty, 'NEIMA HASSEN SEID');

  const shortForm = parseBankSms('Awash Bank', 'Received a payment from NEIMA  HASSEN  SEID   an amount of 100.00 ETB.');
  assert.equal(shortForm.type, 'received');
  assert.equal(shortForm.counterparty, 'NEIMA HASSEN SEID');
});

test('Real backup #167: BOA maintenance fee extracts clean counterparty label', () => {
  const sms =
    'Dear Aymen, your account 1******77 was debited with ETB 3.01 for the Mobile Banking Monthly Maintenance Fee, including 15% VAT and 5% Disaster Fund. Available balance: ETB 32.24. Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT26311RQYGN72477';
  const parsed = parseBankSms('BOA', sms);
  assert.equal(parsed.bank, 'Bank of Abyssinia');
  assert.equal(parsed.type, 'sent');
  assert.equal(parsed.amount, 3.01);
  assert.equal(parsed.balance, 32.24);
  assert.match(parsed.counterparty, /Mobile Banking Monthly Maintenance Fee/i);
});

test('Full regression against all 405 messages in attached real backup JSON', () => {
  const jsonPath = path.resolve(process.cwd(), 'public/assets/aistudio/ak_finance_backup_2026-11-24_20-07-33_44c11e10.json');
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const backup = JSON.parse(raw);
  assert.equal(backup.messages.length, 405);

  let nonAlertCount = 0;
  let alertCount = 0;
  for (const m of backup.messages) {
    const parsed = parseBankSms(m.sender, m.body, backup.senderBankMap);
    assert.ok(parsed.bank && parsed.bank !== 'Unknown', `Expected bank for message #${m.id}, got ${parsed.bank}`);
    if (parsed.category !== 'alert') {
      nonAlertCount++;
      assert.ok(parsed.amount > 0, `Expected amount > 0 for non-alert #${m.id}: ${m.body}`);
    } else {
      alertCount++;
    }
  }
  assert.equal(nonAlertCount, 383);
  assert.equal(alertCount, 22);
});
