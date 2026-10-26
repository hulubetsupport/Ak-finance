import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBankSms, OFFICIAL_PARSER_BENCHMARKS, convertAmharicNumerals } from './smsParser.ts';

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

test('Sample 8: Telebirr English Received and Transferred', () => {
  const s = OFFICIAL_PARSER_BENCHMARKS.find(x => x.sampleNum === 8)!;
  const parsedRec = parseBankSms(s.sender, s.raw);

  assert.equal(parsedRec.bank, 'Telebirr');
  assert.equal(parsedRec.type, 'received');
  assert.equal(parsedRec.amount, 2800.0);
  assert.equal(parsedRec.counterparty, 'Dawit Haile');
  assert.equal(parsedRec.reference, '10E9944P1X');

  const sentSms = 'You have transferred ETB 500.00 to Abel Trading on 24/10/2026. Transaction number is TXN882991.';
  const parsedSent = parseBankSms('127', sentSms);
  assert.equal(parsedSent.bank, 'Telebirr');
  assert.equal(parsedSent.type, 'sent');
  assert.equal(parsedSent.amount, 500.0);
  assert.equal(parsedSent.counterparty, 'Abel Trading');
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
