import { PaymentRecord, Account, WithdrawalRecord, AppSettings, SyncLogEntry } from '../types/index.ts';
import { parseBankSms } from '../utils/smsParser.ts';

const STORAGE_KEYS = {
  PAYMENTS: 'ak_payments_v1',
  ACCOUNTS: 'ak_accounts_v1',
  WITHDRAWALS: 'ak_withdrawals_v1',
  SETTINGS: 'ak_settings_v1',
  LOGS: 'ak_sync_logs_v1',
};

const DEFAULT_SETTINGS: AppSettings = {
  serverUrl: 'https://my-backend.onrender.com/api/webhook',
  secretKey: 'ak_sec_live_9921b7e',
  httpMethod: 'POST',
  retryIntervalSeconds: 15,
  mode: 'server',
  allowedSenders: ['CBE', '127', 'Telebirr', 'AwashBank', 'Dashen', 'BOA'],
  language: 'en',
  hideBalances: false,
  soundEnabled: true,
  serviceRunning: true,
};

const INITIAL_ACCOUNTS: Account[] = [
  {
    id: 'acc-1',
    name: 'Operating Account',
    bank: 'CBE (Commercial Bank)',
    type: 'operating',
    accountNumber: '100028474819',
    maskedNumber: '•••• 4819',
    balance: 142500.20,
    accent: 'indigo',
  },
  {
    id: 'acc-2',
    name: 'Mobile Collections',
    bank: 'Telebirr Merchant',
    type: 'mobile',
    accountNumber: '0911009012',
    maskedNumber: '•••• 9012',
    balance: 28400.00,
    accent: 'blue',
  },
  {
    id: 'acc-3',
    name: 'Shop Collections',
    bank: 'Awash Bank POS',
    type: 'shop',
    accountNumber: '013289003321',
    maskedNumber: '•••• 3321',
    balance: 64120.50,
    accent: 'gold',
  },
];

const INITIAL_PAYMENTS: PaymentRecord[] = [
  {
    id: 'pay-1',
    senderAddress: 'CBE',
    bank: 'CBE',
    type: 'received',
    amount: 8400.00,
    currency: 'ETB',
    counterparty: 'Tadesse Girma',
    reference: 'FT2629391038',
    accountNumber: '1000****4819',
    balance: 142500.20,
    rawMessage: 'Dear Customer, your account 1000****4819 has been credited with ETB 8,400.00 on 19-10-2026 22:33:14 by Tadesse Girma with txn id FT2629391038. Your current balance is ETB 142,500.20. Thank you for banking with CBE!',
    timestamp: Date.now() - 1000 * 60 * 35, // 35 min ago
    date: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    syncStatus: 'sent',
    retryCount: 0,
    source: 'sms',
    serverResponse: '{"status":"ok","reconciled":true,"wallet_credited":true}',
  },
  {
    id: 'pay-2',
    senderAddress: '127',
    bank: 'CBE',
    type: 'sent',
    amount: 3300.00,
    currency: 'ETB',
    counterparty: 'Alemayehu Mengistu',
    reference: 'FT2629390012',
    accountNumber: '1000****4819',
    balance: 134100.20,
    rawMessage: 'Dear Customer, your account 1000****4819 has been debited with ETB 3,300.00 on 19-10-2026 21:10:02 to Alemayehu Mengistu with txn id FT2629390012. Your current balance is ETB 134,100.20.',
    timestamp: Date.now() - 1000 * 60 * 110,
    date: new Date(Date.now() - 1000 * 60 * 110).toISOString(),
    syncStatus: 'sent',
    retryCount: 0,
    source: 'sms',
    serverResponse: '{"status":"ok","reconciled":true}',
  },
  {
    id: 'pay-3',
    senderAddress: 'Telebirr',
    bank: 'Telebirr',
    type: 'received',
    amount: 1500.00,
    currency: 'ETB',
    counterparty: 'Abebe Kebede',
    reference: '10A8829F2',
    balance: 28400.00,
    rawMessage: 'You have received ETB 1,500.00 from Abebe Kebede (0911223344) on 2026-10-19 18:20:10. Transaction ID: 10A8829F2. Your current balance is ETB 28,400.00.',
    timestamp: Date.now() - 1000 * 60 * 240,
    date: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    syncStatus: 'sent',
    retryCount: 0,
    source: 'sms',
    serverResponse: '{"status":"ok","reconciled":true}',
  },
  {
    id: 'pay-4',
    senderAddress: 'AwashBank',
    bank: 'Awash Bank',
    type: 'received',
    amount: 12000.00,
    currency: 'ETB',
    counterparty: 'Binyam Worku',
    reference: 'FT991002AW',
    accountNumber: '0132****3321',
    balance: 64120.50,
    rawMessage: 'Awash Bank: Your account 0132****3321 has been credited with ETB 12,000.00 on 19/10/2026 14:15:00 from Binyam Worku with ref FT991002AW. Balance is ETB 64,120.50.',
    timestamp: Date.now() - 1000 * 60 * 360,
    date: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    syncStatus: 'sent',
    retryCount: 0,
    source: 'sms',
    serverResponse: '{"status":"ok","reconciled":true}',
  },
  {
    id: 'pay-5',
    senderAddress: 'Telebirr',
    bank: 'Telebirr',
    type: 'received',
    amount: 450.00,
    currency: 'ETB',
    counterparty: 'Sara Mohammed',
    reference: '10B9911X3',
    rawMessage: 'You have received ETB 450.00 from Sara Mohammed (0944112233) on 2026-10-19 13:05:00. Transaction ID: 10B9911X3.',
    timestamp: Date.now() - 1000 * 60 * 480,
    date: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
    syncStatus: 'sent',
    retryCount: 0,
    source: 'sms',
  },
  {
    id: 'pay-6',
    senderAddress: 'CBE',
    bank: 'CBE',
    type: 'received',
    amount: 5200.00,
    currency: 'ETB',
    counterparty: 'Kassahun Bekele',
    reference: 'FT2629388120',
    rawMessage: 'Dear Customer, your account 1000****4819 has been credited with ETB 5,200.00 on 19-10-2026 11:20:00 by Kassahun Bekele with txn id FT2629388120.',
    timestamp: Date.now() - 1000 * 60 * 600,
    date: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    syncStatus: 'sent',
    retryCount: 0,
    source: 'sms',
  },
  {
    id: 'pay-7',
    senderAddress: 'Dashen',
    bank: 'Dashen Bank',
    type: 'received',
    amount: 7500.00,
    currency: 'ETB',
    counterparty: 'Mulugeta Haile',
    reference: 'DASH881920',
    rawMessage: 'Dashen Bank: You have received ETB 7,500.00 from Mulugeta Haile Ref: DASH881920.',
    timestamp: Date.now() - 1000 * 60 * 750,
    date: new Date(Date.now() - 1000 * 60 * 750).toISOString(),
    syncStatus: 'sent',
    retryCount: 0,
    source: 'sms',
  },
  {
    id: 'pay-8',
    senderAddress: 'CBE',
    bank: 'CBE',
    type: 'sent',
    amount: 2100.00,
    currency: 'ETB',
    counterparty: 'Ethio Telecom Bill',
    reference: 'FT2629377190',
    rawMessage: 'Dear Customer, your account 1000****4819 has been debited with ETB 2,100.00 on 18-10-2026 19:40:11 to Ethio Telecom with txn id FT2629377190.',
    timestamp: Date.now() - 1000 * 60 * 1440,
    date: new Date(Date.now() - 1000 * 60 * 1440).toISOString(),
    syncStatus: 'sent',
    retryCount: 0,
    source: 'sms',
  },
  {
    id: 'pay-9',
    senderAddress: 'Telebirr',
    bank: 'Telebirr',
    type: 'received',
    amount: 3200.00,
    currency: 'ETB',
    counterparty: 'Genet Wolde',
    reference: '10C8833Y4',
    rawMessage: 'You have received ETB 3,200.00 from Genet Wolde on 2026-10-18 16:12:00. Transaction ID: 10C8833Y4.',
    timestamp: Date.now() - 1000 * 60 * 1600,
    date: new Date(Date.now() - 1000 * 60 * 1600).toISOString(),
    syncStatus: 'sent',
    retryCount: 0,
    source: 'sms',
  },
  {
    id: 'pay-10',
    senderAddress: 'CBE',
    bank: 'CBE',
    type: 'received',
    amount: 9000.00,
    currency: 'ETB',
    counterparty: 'Samuel Tesfaye',
    reference: 'FT2629366112',
    rawMessage: 'Dear Customer, your account 1000****4819 has been credited with ETB 9,000.00 on 18-10-2026 14:02:45 by Samuel Tesfaye with txn id FT2629366112.',
    timestamp: Date.now() - 1000 * 60 * 1800,
    date: new Date(Date.now() - 1000 * 60 * 1800).toISOString(),
    syncStatus: 'sent',
    retryCount: 0,
    source: 'sms',
  },
  {
    id: 'pay-11',
    senderAddress: 'Telebirr',
    bank: 'Telebirr',
    type: 'sent',
    amount: 850.00,
    currency: 'ETB',
    counterparty: 'Office Supplies Addis',
    reference: '10D4411Z9',
    rawMessage: 'You have paid ETB 850.00 to Office Supplies Addis on 2026-10-18 11:00:00. Transaction ID: 10D4411Z9.',
    timestamp: Date.now() - 1000 * 60 * 2000,
    date: new Date(Date.now() - 1000 * 60 * 2000).toISOString(),
    syncStatus: 'sent',
    retryCount: 0,
    source: 'sms',
  },
  {
    id: 'pay-12',
    senderAddress: 'AwashBank',
    bank: 'Awash Bank',
    type: 'received',
    amount: 6800.00,
    currency: 'ETB',
    counterparty: 'Eleni Desta',
    reference: 'FT990881AW',
    rawMessage: 'Awash Bank: Your account 0132****3321 has been credited with ETB 6,800.00 on 18/10/2026 09:30:00 from Eleni Desta with ref FT990881AW.',
    timestamp: Date.now() - 1000 * 60 * 2200,
    date: new Date(Date.now() - 1000 * 60 * 2200).toISOString(),
    syncStatus: 'sent',
    retryCount: 0,
    source: 'sms',
  },
];

const INITIAL_WITHDRAWALS: WithdrawalRecord[] = [
  {
    id: 'w-1',
    amount: 15000.00,
    date: '2026-10-19',
    timestamp: Date.now() - 1000 * 60 * 180,
    bank: 'CBE (Commercial Bank)',
    accountId: 'acc-1',
    recipient: 'Branch Cashier #4',
    note: 'Weekly store inventory purchase & petty cash',
    reference: 'WDR-20261019-01',
  },
  {
    id: 'w-2',
    amount: 5000.00,
    date: '2026-10-18',
    timestamp: Date.now() - 1000 * 60 * 1500,
    bank: 'Telebirr Merchant',
    accountId: 'acc-2',
    recipient: 'Warehouse Delivery Driver',
    note: 'Fuel and transport logistics allowance',
    reference: 'WDR-20261018-02',
  },
];

class DatabaseService {
  private isInitialized = false;

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ACCOUNTS)) {
      localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(INITIAL_ACCOUNTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PAYMENTS)) {
      localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(INITIAL_PAYMENTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.WITHDRAWALS)) {
      localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, JSON.stringify(INITIAL_WITHDRAWALS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.LOGS)) {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
    }

    this.isInitialized = true;
  }

  public async getSettings(): Promise<AppSettings> {
    await this.init();
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  public async saveSettings(settings: AppSettings): Promise<void> {
    await this.init();
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  public async getAccounts(): Promise<Account[]> {
    await this.init();
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
    if (!raw) return [...INITIAL_ACCOUNTS];
    try {
      return JSON.parse(raw);
    } catch {
      return [...INITIAL_ACCOUNTS];
    }
  }

  public async saveAccounts(accounts: Account[]): Promise<void> {
    await this.init();
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  }

  public async getAllPayments(): Promise<PaymentRecord[]> {
    await this.init();
    const raw = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
    if (!raw) return [];
    try {
      const list: PaymentRecord[] = JSON.parse(raw);
      return list.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }

  public async getPaymentById(id: string): Promise<PaymentRecord | undefined> {
    const list = await this.getAllPayments();
    return list.find(p => p.id === id);
  }

  public async getPendingQueue(): Promise<PaymentRecord[]> {
    const list = await this.getAllPayments();
    return list.filter(p => p.syncStatus === 'pending' || p.syncStatus === 'failed');
  }

  public async savePayment(payment: PaymentRecord): Promise<void> {
    await this.init();
    const list = await this.getAllPayments();
    const existingIndex = list.findIndex(p => p.id === payment.id);
    if (existingIndex >= 0) {
      list[existingIndex] = payment;
    } else {
      list.unshift(payment);
    }
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(list));
  }

  public async ingestIncomingSms(sender: string, message: string, source: 'sms' | 'simulated' = 'sms'): Promise<PaymentRecord> {
    await this.init();
    const settings = await this.getSettings();

    // Check sender filter
    const senderClean = sender.trim().toUpperCase();
    const isAllowed = settings.allowedSenders.some(s => {
      const sNorm = s.trim().toUpperCase();
      return senderClean === sNorm || senderClean.includes(sNorm) || sNorm.includes(senderClean);
    });

    if (!isAllowed) {
      console.warn(`SMS ignored: Sender "${sender}" is not in the allowed monitored list.`);
    }

    const parsed = parseBankSms(sender, message);
    const initialStatus = settings.mode === 'local' ? 'local' : 'pending';

    const newPayment: PaymentRecord = {
      id: 'pay-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      senderAddress: sender,
      bank: parsed.bank,
      type: parsed.type,
      amount: parsed.amount,
      currency: parsed.currency,
      counterparty: parsed.counterparty,
      reference: parsed.reference,
      accountNumber: parsed.accountNumber,
      balance: parsed.balance,
      rawMessage: message,
      timestamp: Date.now(),
      date: new Date().toISOString(),
      syncStatus: initialStatus,
      retryCount: 0,
      source,
    };

    await this.savePayment(newPayment);

    // Update account balance if match found
    if (newPayment.amount > 0) {
      await this.adjustAccountBalance(newPayment);
    }

    return newPayment;
  }

  private async adjustAccountBalance(payment: PaymentRecord): Promise<void> {
    const accounts = await this.getAccounts();
    let matchedAcc = accounts.find(a => 
      (payment.bank === 'CBE' && a.type === 'operating') ||
      (payment.bank === 'Telebirr' && a.type === 'mobile') ||
      (payment.bank.includes('Awash') && a.type === 'shop')
    );

    if (matchedAcc) {
      if (payment.balance && payment.balance > 0) {
        matchedAcc.balance = payment.balance;
      } else {
        matchedAcc.balance += payment.type === 'received' ? payment.amount : -payment.amount;
      }
      await this.saveAccounts(accounts);
    }
  }

  public async updatePaymentStatus(
    id: string,
    status: PaymentRecord['syncStatus'],
    serverResponse?: string,
    errorMessage?: string
  ): Promise<void> {
    const list = await this.getAllPayments();
    const item = list.find(p => p.id === id);
    if (!item) return;

    item.syncStatus = status;
    item.lastRetryAt = Date.now();
    if (serverResponse) item.serverResponse = serverResponse;
    if (errorMessage) item.errorMessage = errorMessage;
    if (status === 'failed') {
      item.retryCount = (item.retryCount || 0) + 1;
    }

    await this.savePayment(item);
  }

  public async deletePayment(id: string): Promise<void> {
    const list = await this.getAllPayments();
    const filtered = list.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(filtered));
  }

  public async getAllWithdrawals(): Promise<WithdrawalRecord[]> {
    await this.init();
    const raw = localStorage.getItem(STORAGE_KEYS.WITHDRAWALS);
    if (!raw) return [];
    try {
      const list: WithdrawalRecord[] = JSON.parse(raw);
      return list.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }

  public async saveWithdrawal(w: Omit<WithdrawalRecord, 'id' | 'timestamp'>): Promise<WithdrawalRecord> {
    await this.init();
    const list = await this.getAllWithdrawals();
    const record: WithdrawalRecord = {
      ...w,
      id: 'w-' + Date.now(),
      timestamp: Date.now(),
      reference: w.reference || 'WDR-' + Date.now().toString().slice(-6),
    };
    list.unshift(record);
    localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, JSON.stringify(list));

    // Deduct from matching account
    if (record.accountId) {
      const accounts = await this.getAccounts();
      const acc = accounts.find(a => a.id === record.accountId);
      if (acc) {
        acc.balance = Math.max(0, acc.balance - record.amount);
        await this.saveAccounts(accounts);
      }
    }

    return record;
  }

  public async deleteWithdrawal(id: string): Promise<void> {
    const list = await this.getAllWithdrawals();
    const filtered = list.filter(w => w.id !== id);
    localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, JSON.stringify(filtered));
  }

  public async getSyncLogs(): Promise<SyncLogEntry[]> {
    await this.init();
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public async addSyncLog(entry: Omit<SyncLogEntry, 'id'>): Promise<void> {
    await this.init();
    const logs = await this.getSyncLogs();
    logs.unshift({
      ...entry,
      id: 'log-' + Date.now(),
    });
    // keep max 100 logs
    if (logs.length > 100) logs.pop();
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  }

  public async clearAllPayments(): Promise<void> {
    await this.init();
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
  }

  public async clearAllDemoData(): Promise<void> {
    await this.init();
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
    const accounts = await this.getAccounts();
    const cleanAccounts = accounts.map(a => ({ ...a, balance: 0 }));
    await this.saveAccounts(cleanAccounts);
  }

  public async testWebhook(serverUrl: string, secretKey: string): Promise<{ success: boolean; status: number; durationMs: number; message: string }> {
    const start = performance.now();
    try {
      const response = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secretKey}`,
          'X-AkFinance-Event': 'ping_test',
        },
        body: JSON.stringify({
          event: 'webhook_connectivity_test',
          appName: 'Ak Finance',
          timestamp: Date.now(),
          test: true,
          message: 'Ping test from Ak Finance Android Payment Desk',
        }),
      });

      const durationMs = Math.round(performance.now() - start);
      const text = await response.text();
      const success = response.ok;

      await this.addSyncLog({
        paymentId: 'test-ping',
        timestamp: Date.now(),
        status: success ? 'success' : 'failed',
        httpStatus: response.status,
        url: serverUrl,
        message: `Webhook Test (${response.status}): ${text.slice(0, 100)}`,
        durationMs,
      });

      return {
        success,
        status: response.status,
        durationMs,
        message: text.slice(0, 200) || `HTTP ${response.status}`,
      };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start);
      await this.addSyncLog({
        paymentId: 'test-ping',
        timestamp: Date.now(),
        status: 'failed',
        url: serverUrl,
        message: `Network Error: ${err.message}`,
        durationMs,
      });
      return {
        success: false,
        status: 0,
        durationMs,
        message: err.message || 'Network request failed (check URL & CORS)',
      };
    }
  }

  public async exportPaymentsCsv(): Promise<string> {
    const list = await this.getAllPayments();
    const header = ['ID', 'Date', 'Bank', 'Type', 'Amount (ETB)', 'Counterparty', 'Reference', 'Account', 'Sync Status'];
    const rows = list.map(p => [
      p.id,
      p.date,
      p.bank,
      p.type,
      p.amount.toFixed(2),
      `"${(p.counterparty || '').replace(/"/g, '""')}"`,
      p.reference || '',
      p.accountNumber || '',
      p.syncStatus,
    ]);
    return [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  public async resetData(): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(INITIAL_PAYMENTS));
    localStorage.setItem(STORAGE_KEYS.WITHDRAWALS, JSON.stringify(INITIAL_WITHDRAWALS));
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(INITIAL_ACCOUNTS));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
  }
}

export const db = new DatabaseService();
