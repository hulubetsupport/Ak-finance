/**
 * Pure CSV & Timestamp Import Utilities for Ak Finance
 * Zero DOM / storage dependencies so it can be unit-tested cleanly with node:test + tsx.
 */

export type ImportedSyncStatus = 'sent' | 'local' | 'pending' | 'failed';
export type ImportedServerStatus = 'Saved' | 'Duplicate' | 'Ignored' | 'Unknown';

export interface ParsedCsvImportRecord {
  id?: number;
  sender: string;
  body: string;
  ts: number;
  status: ImportedSyncStatus;
  bank?: string;
  direction?: 'received' | 'sent' | 'unknown';
  category?: string;
  amount?: number;
  fee?: number;
  balance?: number;
  counterparty?: string;
  tag?: string;
  note?: string;
  reference?: string;
  receiptUrl?: string;
  serverStatus?: ImportedServerStatus;
  serverIgnored?: boolean;
}

export interface CsvImportInspection {
  valid: boolean;
  fileCount: number;
  paymentsCount: number;
  sentCount: number;
  localCount: number;
  pendingOrFailedCount: number;
  serverIgnoredCount: number;
  banksCount: number;
  tagsCount: number;
  minTimestamp?: number;
  maxTimestamp?: number;
  detectedFormat: string;
  records: ParsedCsvImportRecord[];
  error?: string;
}

const MIN_VALID_EPOCH_MS = 946684800000; // 2000-01-01T00:00:00Z

const parseNumericEpoch = (val: unknown): number | null => {
  if (val === null || val === undefined || val === '') return null;
  let num: number | null = null;
  if (typeof val === 'number' && Number.isFinite(val)) {
    num = val;
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
      num = Number(trimmed);
    }
  }
  if (num === null || !Number.isFinite(num) || num <= 0) return null;
  // Seconds (10 digits, e.g. 1795539440) -> convert to milliseconds
  if (num >= 1_000_000_000 && num < 100_000_000_000) {
    num = Math.round(num * 1000);
  } else {
    num = Math.round(num);
  }
  return num >= MIN_VALID_EPOCH_MS ? num : null;
};

const parseDateTimeStringsToEpoch = (dateRaw?: unknown, timeRaw?: unknown): number | null => {
  const dateStr = typeof dateRaw === 'string' ? dateRaw.trim() : '';
  const timeStr = typeof timeRaw === 'string' ? timeRaw.trim() : '';
  if (!dateStr && !timeStr) return null;

  // Check if dateStr itself is numeric epoch
  const numericFromDate = parseNumericEpoch(dateStr);
  if (numericFromDate !== null) return numericFromDate;

  // 1. Separate YYYY-MM-DD + optional HH:mm(:ss)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    if (timeStr) {
      const cleanTime = timeStr.replace(/\s*(AM|PM)$/i, '').trim();
      const ampmMatch = timeStr.match(/\b(AM|PM)\b/i);
      const timeParts = cleanTime.split(':').map(n => parseInt(n, 10));
      if (timeParts.length >= 2 && !Number.isNaN(timeParts[0]) && !Number.isNaN(timeParts[1])) {
        let hours = timeParts[0];
        const mins = timeParts[1];
        const secs = !Number.isNaN(timeParts[2]) ? timeParts[2] : 0;
        if (ampmMatch) {
          const isPm = ampmMatch[1].toUpperCase() === 'PM';
          if (isPm && hours < 12) hours += 12;
          if (!isPm && hours === 12) hours = 0;
        }
        const [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10));
        const constructed = new Date(y, m - 1, d, hours, mins, secs).getTime();
        if (Number.isFinite(constructed) && constructed >= MIN_VALID_EPOCH_MS) return constructed;
      }
    }
    const isoParsed = Date.parse(`${dateStr}T00:00:00Z`);
    if (Number.isFinite(isoParsed) && isoParsed >= MIN_VALID_EPOCH_MS) return isoParsed;
  }

  // 2. DD/MM/YYYY or DD-MM-YYYY (with optional time)
  const dmyMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[,\sT]+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?))?$/i);
  if (dmyMatch) {
    const first = parseInt(dmyMatch[1], 10);
    const second = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const inlineTime = dmyMatch[4] || timeStr;
    // If first > 12 it is definitely DD/MM/YYYY; otherwise default DD/MM unless second > 12 (MM/DD/YYYY)
    const day = second > 12 ? second : first;
    const month = second > 12 ? first : second;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let hours = 12;
      let mins = 0;
      let secs = 0;
      if (inlineTime) {
        const ampmMatch = inlineTime.match(/\b(AM|PM)\b/i);
        const parts = inlineTime.replace(/\s*(AM|PM)\b/i, '').trim().split(':').map(n => parseInt(n, 10));
        if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
          hours = parts[0];
          mins = parts[1];
          secs = !Number.isNaN(parts[2]) ? parts[2] : 0;
          if (ampmMatch) {
            const isPm = ampmMatch[1].toUpperCase() === 'PM';
            if (isPm && hours < 12) hours += 12;
            if (!isPm && hours === 12) hours = 0;
          }
        }
      }
      const constructed = new Date(year, month - 1, day, hours, mins, secs).getTime();
      if (Number.isFinite(constructed) && constructed >= MIN_VALID_EPOCH_MS) return constructed;
    }
  }

  // 3. Combined or direct Date.parse (handles ISO-8601, RFC dates, locale strings)
  const combined = timeStr && !dateStr.includes(':') ? `${dateStr} ${timeStr}` : dateStr;
  const parsed = Date.parse(combined);
  if (Number.isFinite(parsed) && parsed >= MIN_VALID_EPOCH_MS) return parsed;

  if (combined !== dateStr) {
    const fallbackOnlyDate = Date.parse(dateStr);
    if (Number.isFinite(fallbackOnlyDate) && fallbackOnlyDate >= MIN_VALID_EPOCH_MS) return fallbackOnlyDate;
  }

  return null;
};

const extractTimestampFromSmsBody = (body?: string): number | null => {
  if (!body) return null;
  // e.g. 2026-11-24 12:46:58 or 2026-11-24T12:46:58
  const isoBody = body.match(/\b(20\d{2}-\d{2}-\d{2})[T\s](\d{2}:\d{2}(?::\d{2})?)\b/);
  if (isoBody) {
    const parsed = parseDateTimeStringsToEpoch(isoBody[1], isoBody[2]);
    if (parsed !== null) return parsed;
  }
  // e.g. on 24/11/2026 at 14:30:10 or 24/11/2026 14:30
  const dmyBody = body.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]20\d{2})(?:\s+(?:at\s+)?(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?))?/i);
  if (dmyBody) {
    const parsed = parseDateTimeStringsToEpoch(dmyBody[1], dmyBody[2] || '');
    if (parsed !== null) return parsed;
  }
  return null;
};

/**
 * Normalizes any timestamp or date/time representation to exact epoch milliseconds.
 * Never replaces an existing historical timestamp with Date.now().
 */
export const normalizeEpochTimestamp = (
  rawTs: unknown,
  fallbackDateStr?: unknown,
  fallbackTimeStr?: unknown,
  fallbackBody?: string,
  defaultNow?: number
): number => {
  const fromNumeric = parseNumericEpoch(rawTs);
  if (fromNumeric !== null) return fromNumeric;

  if (typeof rawTs === 'string') {
    const fromTsString = parseDateTimeStringsToEpoch(rawTs, fallbackTimeStr);
    if (fromTsString !== null) return fromTsString;
  }

  const fromDateAndTime = parseDateTimeStringsToEpoch(fallbackDateStr, fallbackTimeStr);
  if (fromDateAndTime !== null) return fromDateAndTime;

  const fromBody = extractTimestampFromSmsBody(fallbackBody);
  if (fromBody !== null) return fromBody;

  return defaultNow ?? Date.now();
};

const detectDelimiter = (text: string): string => {
  const firstLineParts: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      break;
    } else if (!inQuotes) {
      firstLineParts.push(ch);
    }
  }
  const line = firstLineParts.join('');
  const commas = (line.match(/,/g) || []).length;
  const semis = (line.match(/;/g) || []).length;
  const tabs = (line.match(/\t/g) || []).length;
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas) return ';';
  return ',';
};

/**
 * RFC-4180 compliant CSV parser supporting UTF-8 BOM, quoted newlines, escaped quotes (""),
 * and comma / semicolon / tab auto-detection.
 */
export const parseCsvMatrix = (csvText: string): string[][] => {
  const clean = (csvText || '').replace(/^\uFEFF/, '');
  if (!clean.trim()) return [];

  const delimiter = detectDelimiter(clean);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(r => r.some(cell => cell.trim() !== ''));
};

const normalizeHeaderKey = (h: string): string =>
  h.toLowerCase().replace(/[^a-z0-9]/g, '');

const inferSenderFromBank = (bank?: string): string => {
  const b = (bank || '').trim().toLowerCase();
  if (!b) return 'Bank';
  if (b.includes('telebirr')) return '127';
  if (b.includes('cbe birr') || b.includes('cbebirr')) return 'CBEBirr';
  if (b === 'cbe' || b.includes('commercial bank of ethiopia')) return 'CBE';
  if (b.includes('awash')) return 'AwashBank';
  if (b.includes('dashen')) return 'Dashen';
  if (b.includes('abyssinia') || b === 'boa') return 'BOA';
  if (b.includes('zemen')) return 'Zemen';
  if (b.includes('siinqee')) return 'Siinqee';
  if (b.includes('ebirr')) return 'eBirr';
  if (b.includes('zamzam')) return 'ZamZam';
  if (b.includes('bunna')) return 'Bunna';
  if (b.includes('wegagen')) return 'Wegagen';
  if (b.includes('mpesa') || b.includes('m-pesa')) return 'M-PESA';
  if (b.includes('abay')) return 'AbayBank';
  if (b.includes('nib')) return 'NibBank';
  if (b.includes('hibret')) return 'Hibret';
  if (b.includes('coop')) return 'CoopBank';
  if (b.includes('tsedey')) return 'Tsedey';
  return bank!.trim();
};

const parseCleanNumber = (raw: string | undefined): number | undefined => {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
};

const normalizeDirection = (raw: string | undefined, amount?: number): 'received' | 'sent' | 'unknown' | undefined => {
  const v = (raw || '').trim().toLowerCase();
  if (!v) {
    if (typeof amount === 'number' && amount < 0) return 'sent';
    return undefined;
  }
  if (v === 'received' || v === 'in' || v === 'inflow' || v === 'credit' || v === 'credited' || v === 'deposit') {
    return 'received';
  }
  if (v === 'sent' || v === 'out' || v === 'outflow' || v === 'debit' || v === 'debited' || v === 'transfer' || v === 'transferred' || v === 'withdrawal' || v === 'paid') {
    return 'sent';
  }
  if (v === 'alert' || v === 'unknown') return 'unknown';
  return undefined;
};

const normalizeSyncAndServerStatus = (
  rawStatus: string | undefined,
  rawIgnored: string | undefined
): { status: ImportedSyncStatus; serverStatus?: ImportedServerStatus; serverIgnored: boolean } => {
  const s = (rawStatus || '').trim().toLowerCase();
  const ign = (rawIgnored || '').trim().toLowerCase();
  const isIgnored = ign === 'yes' || ign === 'true' || ign === '1' || s === 'ignored';

  if (isIgnored) {
    return { status: 'sent', serverStatus: 'Ignored', serverIgnored: true };
  }
  if (s === 'saved' || s === 'synced' || s === 'sent' || s === 'used' || s === 'unused' || s === 'sent_locked' || s === 'payout_verified') {
    return { status: 'sent', serverStatus: 'Saved', serverIgnored: false };
  }
  if (s === 'duplicate') {
    return { status: 'sent', serverStatus: 'Duplicate', serverIgnored: false };
  }
  if (s === 'pending') {
    return { status: 'pending', serverIgnored: false };
  }
  if (s === 'failed' || s === 'error') {
    return { status: 'failed', serverIgnored: false };
  }
  return { status: 'local', serverIgnored: false };
};

const buildSyntheticBody = (params: {
  bank?: string;
  direction?: 'received' | 'sent' | 'unknown';
  category?: string;
  amount?: number;
  fee?: number;
  balance?: number;
  counterparty?: string;
  reference?: string;
  dateStr?: string;
  timeStr?: string;
  receiptUrl?: string;
}): string => {
  const bankLabel = params.bank || 'Bank';
  const amtStr = (typeof params.amount === 'number' ? Math.abs(params.amount) : 0).toFixed(2);
  const cp = params.counterparty?.trim() || 'Account';
  const ref = params.reference?.trim() || '';
  const verb =
    params.category?.toLowerCase() === 'alert'
      ? 'service alert'
      : params.direction === 'received'
        ? `credited/received ETB ${amtStr} from ${cp}`
        : params.direction === 'sent'
          ? `transferred/sent ETB ${amtStr} to ${cp}`
          : `transaction ETB ${amtStr} with ${cp}`;
  const parts = [`${bankLabel}: ${verb}`];
  if (typeof params.fee === 'number' && params.fee > 0) {
    parts.push(`Service fee is ETB ${params.fee.toFixed(2)}`);
  }
  if (ref) {
    parts.push(`Ref ${ref}`);
  }
  if (typeof params.balance === 'number') {
    parts.push(`Your current balance is ETB ${params.balance.toFixed(2)}`);
  }
  if (params.dateStr) {
    parts.push(`on ${params.dateStr}${params.timeStr ? ` ${params.timeStr}` : ''}`);
  }
  if (params.receiptUrl) {
    parts.push(params.receiptUrl);
  }
  return parts.join('. ') + '.';
};

export const parseSingleAkFinanceCsv = (csvText: string): Omit<CsvImportInspection, 'fileCount'> => {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length < 2) {
    return {
      valid: false,
      paymentsCount: 0,
      sentCount: 0,
      localCount: 0,
      pendingOrFailedCount: 0,
      serverIgnoredCount: 0,
      banksCount: 0,
      tagsCount: 0,
      detectedFormat: 'Empty CSV',
      records: [],
      error: 'CSV file must include a header row and at least one transaction row.',
    };
  }

  const rawHeaders = matrix[0].map(h => h.trim());
  const normHeaders = rawHeaders.map(normalizeHeaderKey);

  const findCol = (...candidates: string[]): number => {
    for (const c of candidates) {
      const idx = normHeaders.indexOf(c);
      if (idx >= 0) return idx;
    }
    for (const c of candidates) {
      const idx = normHeaders.findIndex(h => h.includes(c));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const col = {
    id: findCol('id', 'smsid', 'txnid'),
    ts: findCol('timestampms', 'timestamp', 'ts', 'epoch', 'unixtime'),
    date: findCol('date', 'txndate', 'transactiondate', 'createdat', 'datetime'),
    time: findCol('time', 'txntime'),
    bank: findCol('bank', 'bankname', 'institution', 'provider', 'account'),
    sender: findCol('senderaddress', 'sender', 'from', 'address', 'source'),
    direction: findCol('direction', 'type', 'txntype', 'flow'),
    amount: findCol('amountetb', 'amount', 'value', 'total', 'birr', 'etb'),
    fee: findCol('feeetb', 'fee', 'charge', 'vat', 'commission'),
    counterparty: findCol('counterparty', 'party', 'recipient', 'payer', 'name', 'merchant', 'tofrom'),
    category: findCol('category', 'kind'),
    tag: findCol('tag', 'tags', 'label'),
    note: findCol('note', 'notes', 'memo', 'remark', 'comment'),
    reference: findCol('refft', 'reference', 'ftnumber', 'ref', 'ft', 'txnref', 'transactionid'),
    receiptUrl: findCol('receipturl', 'receipt', 'url', 'link'),
    balance: findCol('balance', 'runningbalance', 'currentbalance'),
    syncStatus: findCol('syncstatus', 'serverstatus', 'status'),
    serverIgnored: findCol('serverignored', 'ignored'),
    rawMessage: findCol('rawsms', 'rawmessage', 'sms', 'body', 'message', 'text', 'description'),
  };

  const hasAnyRecognizedField =
    col.rawMessage >= 0 || col.amount >= 0 || col.date >= 0 || col.ts >= 0 || col.reference >= 0;

  if (!hasAnyRecognizedField) {
    return {
      valid: false,
      paymentsCount: 0,
      sentCount: 0,
      localCount: 0,
      pendingOrFailedCount: 0,
      serverIgnoredCount: 0,
      banksCount: 0,
      tagsCount: 0,
      detectedFormat: 'Unrecognized CSV',
      records: [],
      error: `Unrecognized CSV columns (${rawHeaders.slice(0, 6).join(', ')}). Expected Ak Finance or transaction columns like Date, Bank, Amount, Raw SMS.`,
    };
  }

  let detectedFormat = 'Bank / Generic CSV';
  if (col.ts >= 0 && col.rawMessage >= 0 && col.syncStatus >= 0) {
    detectedFormat = 'Ak Finance Full CSV (18-col)';
  } else if (col.rawMessage >= 0 && col.receiptUrl >= 0 && col.tag >= 0) {
    detectedFormat = 'Ak Finance Selected CSV';
  } else if (col.id >= 0 && col.rawMessage >= 0 && col.reference >= 0) {
    detectedFormat = 'Ak Finance Standard CSV';
  }

  const records: ParsedCsvImportRecord[] = [];
  const bankSet = new Set<string>();
  const tagSet = new Set<string>();
  let sentCount = 0;
  let localCount = 0;
  let pendingOrFailedCount = 0;
  let serverIgnoredCount = 0;
  let minTimestamp: number | undefined;
  let maxTimestamp: number | undefined;

  const getCell = (row: string[], idx: number): string => (idx >= 0 && idx < row.length ? (row[idx] ?? '').trim() : '');

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.every(c => !c.trim())) continue;

    const rawBody = getCell(row, col.rawMessage);
    const dateCell = getCell(row, col.date);
    const timeCell = getCell(row, col.time);
    const tsCell = getCell(row, col.ts);
    const bankCell = getCell(row, col.bank);
    const senderCell = getCell(row, col.sender);
    const dirCell = getCell(row, col.direction);
    const rawAmount = parseCleanNumber(getCell(row, col.amount));
    const fee = parseCleanNumber(getCell(row, col.fee));
    const balance = parseCleanNumber(getCell(row, col.balance));
    const counterparty = getCell(row, col.counterparty) || undefined;
    const categoryCell = getCell(row, col.category).toLowerCase() || undefined;
    const tag = getCell(row, col.tag) || undefined;
    const note = getCell(row, col.note) || undefined;
    const reference = getCell(row, col.reference) || undefined;
    const receiptUrl = getCell(row, col.receiptUrl) || undefined;
    const statusCell = getCell(row, col.syncStatus);
    const ignoredCell = getCell(row, col.serverIgnored);
    const idNum = parseCleanNumber(getCell(row, col.id));

    const direction = normalizeDirection(dirCell, rawAmount);
    const amount = typeof rawAmount === 'number' ? Math.abs(rawAmount) : undefined;

    const body =
      rawBody ||
      buildSyntheticBody({
        bank: bankCell || 'Bank',
        direction,
        category: categoryCell,
        amount,
        fee,
        balance,
        counterparty,
        reference,
        dateStr: dateCell,
        timeStr: timeCell,
        receiptUrl,
      });

    if (!body.trim()) continue;

    const sender = senderCell || inferSenderFromBank(bankCell);
    const ts = normalizeEpochTimestamp(tsCell, dateCell, timeCell, body);
    const { status, serverStatus, serverIgnored } = normalizeSyncAndServerStatus(statusCell, ignoredCell);

    if (status === 'sent') sentCount++;
    else if (status === 'local') localCount++;
    else pendingOrFailedCount++;
    if (serverIgnored) serverIgnoredCount++;

    if (bankCell) bankSet.add(bankCell);
    if (tag) tagSet.add(tag);

    if (minTimestamp === undefined || ts < minTimestamp) minTimestamp = ts;
    if (maxTimestamp === undefined || ts > maxTimestamp) maxTimestamp = ts;

    records.push({
      id: typeof idNum === 'number' && Number.isFinite(idNum) && idNum > 0 ? Math.trunc(idNum) : undefined,
      sender,
      body,
      ts,
      status,
      bank: bankCell || undefined,
      direction,
      category: categoryCell || (dirCell.toLowerCase() === 'alert' ? 'alert' : undefined),
      amount,
      fee,
      balance,
      counterparty,
      tag,
      note,
      reference,
      receiptUrl,
      serverStatus,
      serverIgnored,
    });
  }

  if (records.length === 0) {
    return {
      valid: false,
      paymentsCount: 0,
      sentCount: 0,
      localCount: 0,
      pendingOrFailedCount: 0,
      serverIgnoredCount: 0,
      banksCount: 0,
      tagsCount: 0,
      detectedFormat,
      records: [],
      error: 'No valid transaction rows were found in the selected CSV file.',
    };
  }

  return {
    valid: true,
    paymentsCount: records.length,
    sentCount,
    localCount,
    pendingOrFailedCount,
    serverIgnoredCount,
    banksCount: bankSet.size || 1,
    tagsCount: tagSet.size,
    minTimestamp,
    maxTimestamp,
    detectedFormat,
    records,
  };
};

export const parseAkFinanceCsvFiles = (csvTexts: string[]): CsvImportInspection => {
  if (!Array.isArray(csvTexts) || csvTexts.length === 0) {
    return {
      valid: false,
      fileCount: 0,
      paymentsCount: 0,
      sentCount: 0,
      localCount: 0,
      pendingOrFailedCount: 0,
      serverIgnoredCount: 0,
      banksCount: 0,
      tagsCount: 0,
      detectedFormat: 'None',
      records: [],
      error: 'No CSV files selected.',
    };
  }

  const allRecords: ParsedCsvImportRecord[] = [];
  const seenKeys = new Set<string>();
  const formats = new Set<string>();
  const errors: string[] = [];
  let sentCount = 0;
  let localCount = 0;
  let pendingOrFailedCount = 0;
  let serverIgnoredCount = 0;
  let minTimestamp: number | undefined;
  let maxTimestamp: number | undefined;
  const banks = new Set<string>();
  const tags = new Set<string>();

  for (const csvText of csvTexts) {
    const parsed = parseSingleAkFinanceCsv(csvText);
    if (!parsed.valid) {
      if (parsed.error) errors.push(parsed.error);
      continue;
    }
    formats.add(parsed.detectedFormat);
    for (const r of parsed.records) {
      const dedupeKey = `${r.sender.toLowerCase()}|${r.body.trim()}|${r.ts}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);
      allRecords.push(r);

      if (r.status === 'sent') sentCount++;
      else if (r.status === 'local') localCount++;
      else pendingOrFailedCount++;
      if (r.serverIgnored) serverIgnoredCount++;
      if (r.bank) banks.add(r.bank);
      if (r.tag) tags.add(r.tag);
      if (minTimestamp === undefined || r.ts < minTimestamp) minTimestamp = r.ts;
      if (maxTimestamp === undefined || r.ts > maxTimestamp) maxTimestamp = r.ts;
    }
  }

  if (allRecords.length === 0) {
    return {
      valid: false,
      fileCount: csvTexts.length,
      paymentsCount: 0,
      sentCount: 0,
      localCount: 0,
      pendingOrFailedCount: 0,
      serverIgnoredCount: 0,
      banksCount: 0,
      tagsCount: 0,
      detectedFormat: Array.from(formats)[0] || 'Invalid CSV',
      records: [],
      error: errors[0] || 'No valid rows found in the selected CSV file(s).',
    };
  }

  return {
    valid: true,
    fileCount: csvTexts.length,
    paymentsCount: allRecords.length,
    sentCount,
    localCount,
    pendingOrFailedCount,
    serverIgnoredCount,
    banksCount: banks.size || 1,
    tagsCount: tags.size,
    minTimestamp,
    maxTimestamp,
    detectedFormat: Array.from(formats).join(' + '),
    records: allRecords,
  };
};
