import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEpochTimestamp,
  parseCsvMatrix,
  parseSingleAkFinanceCsv,
  parseAkFinanceCsvFiles,
} from './csvImport';

test('normalizeEpochTimestamp preserves historical ms and seconds without turning into today', () => {
  const exactMs = 1795539440945; // 2026-11-24T17:07:20.945Z
  assert.equal(normalizeEpochTimestamp(exactMs), exactMs);
  assert.equal(normalizeEpochTimestamp(String(exactMs)), exactMs);
  assert.equal(normalizeEpochTimestamp(1795539440), 1795539440000);

  // Separate ISO date + time
  const fromDateAndTime = normalizeEpochTimestamp(undefined, '2026-11-24', '14:07:33');
  const d = new Date(fromDateAndTime);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 10); // November
  assert.equal(d.getDate(), 24);
  assert.equal(d.getHours(), 14);
  assert.equal(d.getMinutes(), 7);
  assert.equal(d.getSeconds(), 33);

  // DD/MM/YYYY format
  const fromDmy = normalizeEpochTimestamp(undefined, '24/11/2026', '08:15:00');
  const dmy = new Date(fromDmy);
  assert.equal(dmy.getFullYear(), 2026);
  assert.equal(dmy.getMonth(), 10);
  assert.equal(dmy.getDate(), 24);
  assert.equal(dmy.getHours(), 8);

  // Embedded SMS date fallback
  const fromBody = normalizeEpochTimestamp(
    undefined,
    undefined,
    undefined,
    'Dear Aymen The request to withdraw ETB 100.00 on 2026-11-24 12:46:58 using Awash ATM completed.'
  );
  const b = new Date(fromBody);
  assert.equal(b.getFullYear(), 2026);
  assert.equal(b.getMonth(), 10);
  assert.equal(b.getDate(), 24);
  assert.equal(b.getHours(), 12);
  assert.equal(b.getMinutes(), 46);
});

test('parseCsvMatrix handles UTF-8 BOM, quotes, escaped double quotes, and multiline SMS bodies', () => {
  const csv =
    '\uFEFFDate,Bank,Raw SMS\r\n' +
    '"2026-11-24","CBE","Line 1 ""quoted""\nLine 2 ETB 500.00"\r\n' +
    '"2026-11-23","Telebirr","Simple message"\r\n';

  const matrix = parseCsvMatrix(csv);
  assert.equal(matrix.length, 3);
  assert.deepEqual(matrix[0], ['Date', 'Bank', 'Raw SMS']);
  assert.equal(matrix[1][2], 'Line 1 "quoted"\nLine 2 ETB 500.00');
  assert.equal(matrix[2][1], 'Telebirr');
});

test('parseSingleAkFinanceCsv parses 18-col Ak Finance CSV preserving Timestamp (ms), tags, notes, and sync status', () => {
  const csv =
    '\uFEFFDate,Time,Timestamp (ms),Bank,Sender,Direction,Amount (ETB),Fee (ETB),Counterparty,Category,Tag,Note,Ref/FT,Receipt URL,Balance,Sync Status,Server Ignored,Raw SMS\r\n' +
    '"2026-11-24","20:07:20",1795539440945,"Commercial Bank of Ethiopia","CBE","Sent",100.00,"0.00","Hussen Yimam Hussen","TRANSFER","Supplier","Paid invoice","FT26328TLTQ9","https://mbreciept.cbe.com.et/v2-abc","1233.15","Saved",NO,"Dear Aymen You have transferred ETB 100.00"\r\n' +
    '"2026-11-20","09:15:00",1795166100000,"Telebirr","127","Received",500.00,"","Abebe Kebede","TRANSFER","VIP","Deposit","DK06LG3250","","1785.36","Local",NO,"You have received ETB 500.00 from Abebe Kebede"';

  const res = parseSingleAkFinanceCsv(csv);
  assert.equal(res.valid, true);
  assert.equal(res.paymentsCount, 2);
  assert.equal(res.sentCount, 1);
  assert.equal(res.localCount, 1);
  assert.equal(res.minTimestamp, 1795166100000);
  assert.equal(res.maxTimestamp, 1795539440945);
  assert.equal(res.tagsCount, 2);
  assert.equal(res.records[0].ts, 1795539440945);
  assert.equal(res.records[0].status, 'sent');
  assert.equal(res.records[0].serverStatus, 'Saved');
  assert.equal(res.records[0].tag, 'Supplier');
  assert.equal(res.records[0].note, 'Paid invoice');
  assert.equal(res.records[1].ts, 1795166100000);
  assert.equal(res.records[1].status, 'local');
  assert.equal(res.records[1].counterparty, 'Abebe Kebede');
});

test('parseAkFinanceCsvFiles handles generic CSV without Raw SMS and merges multiple CSV files without duplicates', () => {
  const bankCsv = [
    'Date,Bank,Direction,Amount,Counterparty,Reference,Balance,Note',
    '2026-10-15T10:30:00Z,Awash Bank,Received,2500.50,Selamawit Tadesse,AW998877,15400.50,Shop rent',
  ].join('\n');

  const selectedCsv = [
    'Date,Bank,Sender,Type,Amount ETB,Fee ETB,Counterparty,Reference,Receipt URL,Tag,Raw SMS',
    '"2026-10-16T08:00:00.000Z","Telebirr","127","sent",300.00,1.50,"Dawit","TL123","","Fuel","Transferred ETB 300.00 to Dawit Ref TL123"',
  ].join('\n');

  const combined = parseAkFinanceCsvFiles([bankCsv, selectedCsv, bankCsv]);
  assert.equal(combined.valid, true);
  assert.equal(combined.fileCount, 3);
  assert.equal(combined.paymentsCount, 2);
  assert.equal(combined.records[0].sender, 'AwashBank');
  assert.equal(combined.records[0].ts, Date.parse('2026-10-15T10:30:00Z'));
  assert.match(combined.records[0].body, /2500\.50/);
  assert.equal(combined.records[0].status, 'local');
  assert.equal(combined.records[1].ts, Date.parse('2026-10-16T08:00:00.000Z'));
  assert.equal(combined.records[1].tag, 'Fuel');
});
