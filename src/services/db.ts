import { PaymentRecord, Account, WithdrawalRecord, AppSettings, SyncLogEntry, SyncStatus } from '../types/index.ts';
import { parseBankSms } from '../utils/smsParser.ts';
import { 
  getNativeSettings, 
  saveNativeSettings, 
  getNativeMessages, 
  deleteNativeMessage, 
  clearAllNativeMessages,
  insertNativeTestSms,
  NativeSmsMessage 
} from '../utils/nativeBridge.ts';

const LOCAL_STORAGE_KEYS = {
  ACCOUNTS: 'ak_accounts_v1',
  WITHDRAWALS: 'ak_withdrawals_v1',
  LOGS: 'ak_sync_logs_v1',
  UI_PREFS: 'ak_ui_prefs_v1',
};

const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: 'acc-1',
    name: 'Operating Account',
    bank: 'CBE (Commercial Bank)',
    type: 'operating',
    accountNumber: '100028474819',
    maskedNumber: '•••• 4819',
    balance: 0,
    accent: 'indigo',
  },
  {
    id: 'acc-2',
    name: 'Mobile Collections',
    bank: 'Telebirr Merchant',
    type: 'mobile',
    accountNumber: '0911009012',
    maskedNumber: '•••• 9012',
    balance: 0,
    accent: 'blue',
  },
  {
    id: 'acc-3',
    name: 'Shop Collections',
    bank: 'Awash Bank POS',
    type: 'shop',
    accountNumber: '013289003321',
    maskedNumber: '•••• 3321',
    balance: 0,
    accent: 'gold',
  },
];

export function mapSmsToPayment(msg: NativeSmsMessage): PaymentRecord {
  const parsed = parseBankSms(msg.sender || 'Bank', msg.body || '');
  let status: SyncStatus = 'pending';
  if (msg.status === 'sent') status = 'sent';
  else if (msg.status === 'local') status = 'local';
  else if (msg.status === 'failed') status = 'failed';
  else status = 'pending';

  return {
    id: String(msg.id),
    senderAddress: msg.sender || '',
    bank: parsed.bank || msg.sender || 'Bank',
    type: parsed.type || 'received',
    amount: parsed.amount || 0,
    currency: parsed.currency || 'ETB',
    counterparty: parsed.counterparty || msg.sender || 'Customer',
    reference: parsed.reference || `SMS-${msg.id}`,
    accountNumber: parsed.accountNumber,
    balance: parsed.balance,
    rawMessage: msg.body || '',
    timestamp: msg.ts || Date.now(),
    date: new Date(msg.ts || Date.now()).toISOString(),
    syncStatus: status,
    retryCount: msg.tries || 0,
    errorMessage: msg.err || (msg.code && msg.code !== 200 ? `HTTP ${msg.code}` : undefined),
    serverResponse: msg.code ? `HTTP ${msg.code}` : undefined,
    source: 'sms',
  };
}

class DatabaseService {
  public async getSettings(): Promise<AppSettings> {
    const native = await getNativeSettings();
    let uiPrefs: any = {};
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.UI_PREFS);
      if (stored) uiPrefs = JSON.parse(stored);
    } catch {}

    const sendersArr = (native.senders || 'CBE,127,AwashBank,Dashen,BOA')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    return {
      serverUrl: native.url,
      secretKey: native.token,
      httpMethod: native.method,
      retryIntervalSeconds: native.interval,
      mode: native.mode,
      allowedSenders: sendersArr,
      language: uiPrefs.language === 'am' ? 'am' : 'en',
      hideBalances: !!uiPrefs.hideBalances,
      soundEnabled: uiPrefs.soundEnabled !== false,
      serviceRunning: true,
    };
  }

  public async saveSettings(newSettings: Partial<AppSettings>): Promise<AppSettings> {
    const toNative: any = {};
    if (newSettings.serverUrl !== undefined) toNative.url = newSettings.serverUrl;
    if (newSettings.secretKey !== undefined) toNative.token = newSettings.secretKey;
    if (newSettings.httpMethod !== undefined) toNative.method = newSettings.httpMethod;
    if (newSettings.retryIntervalSeconds !== undefined) toNative.interval = newSettings.retryIntervalSeconds;
    if (newSettings.mode !== undefined) toNative.mode = newSettings.mode;
    if (newSettings.allowedSenders !== undefined) toNative.senders = newSettings.allowedSenders.join(',');

    await saveNativeSettings(toNative);

    let uiPrefs: any = {};
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.UI_PREFS);
      if (stored) uiPrefs = JSON.parse(stored);
    } catch {}

    if (newSettings.language !== undefined) uiPrefs.language = newSettings.language;
    if (newSettings.hideBalances !== undefined) uiPrefs.hideBalances = newSettings.hideBalances;
    if (newSettings.soundEnabled !== undefined) uiPrefs.soundEnabled = newSettings.soundEnabled;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.UI_PREFS, JSON.stringify(uiPrefs));
    } catch {}

    return this.getSettings();
  }

  public async getAllPayments(): Promise<PaymentRecord[]> {
    const messages = await getNativeMessages();
    return messages.map(mapSmsToPayment);
  }

  public async getPaymentById(id: string): Promise<PaymentRecord | null> {
    const list = await this.getAllPayments();
    return list.find(p => p.id === id) || null;
  }

  public async insertTestSms(sender: string, body: string): Promise<boolean> {
    return insertNativeTestSms(sender, body);
  }

  public async deletePayment(id: string): Promise<void> {
    await deleteNativeMessage(Number(id));
  }

  public async clearAllPayments(): Promise<void> {
    await clearAllNativeMessages();
  }

  public async clearAllDemoData(): Promise<void> {
    await clearAllNativeMessages();
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.ACCOUNTS, JSON.stringify(DEFAULT_ACCOUNTS));
      localStorage.removeItem(LOCAL_STORAGE_KEYS.WITHDRAWALS);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.LOGS);
    } catch {}
  }

  public async getAccounts(): Promise<Account[]> {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.ACCOUNTS);
      if (stored) return JSON.parse(stored);
    } catch {}
    return DEFAULT_ACCOUNTS;
  }

  public async saveAccounts(accounts: Account[]): Promise<void> {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    } catch {}
  }

  public async getAllWithdrawals(): Promise<WithdrawalRecord[]> {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.WITHDRAWALS);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  }

  public async addWithdrawal(record: Omit<WithdrawalRecord, 'id' | 'timestamp'>): Promise<WithdrawalRecord> {
    const withdrawals = await this.getAllWithdrawals();
    const newRecord: WithdrawalRecord = {
      ...record,
      id: 'wth-' + Date.now(),
      timestamp: Date.now(),
    };
    withdrawals.unshift(newRecord);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.WITHDRAWALS, JSON.stringify(withdrawals));
    } catch {}
    return newRecord;
  }

  public async getSyncLogs(): Promise<SyncLogEntry[]> {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.LOGS);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  }

  public async addSyncLog(entry: Omit<SyncLogEntry, 'id'>): Promise<SyncLogEntry> {
    const logs = await this.getSyncLogs();
    const newEntry: SyncLogEntry = {
      ...entry,
      id: 'log-' + Date.now(),
    };
    logs.unshift(newEntry);
    if (logs.length > 50) logs.length = 50;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.LOGS, JSON.stringify(logs));
    } catch {}
    return newEntry;
  }

  public async exportPaymentsCsv(): Promise<string> {
    const list = await this.getAllPayments();
    const header = ['ID', 'Date', 'Bank', 'Type', 'Amount (ETB)', 'Counterparty', 'Reference', 'Account', 'Sync Status', 'Raw SMS'];
    const rows = list.map(p => [
      p.id,
      p.date,
      `"${p.bank}"`,
      p.type,
      p.amount,
      `"${p.counterparty.replace(/"/g, '""')}"`,
      `"${p.reference}"`,
      `"${p.accountNumber || ''}"`,
      p.syncStatus,
      `"${p.rawMessage.replace(/"/g, '""')}"`,
    ]);
    return [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

export const db = new DatabaseService();
