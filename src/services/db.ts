import { PaymentRecord, Account, WithdrawalRecord, AppSettings, SyncLogEntry, SyncStatus } from '../types/index.ts';
import { parseBankSms, DEFAULT_SENDER_BANK_MAP } from '../utils/smsParser.ts';
import { 
  getNativeSettings, 
  saveNativeSettings, 
  getNativeMessages, 
  deleteNativeMessage, 
  clearAllNativeMessages,
  insertNativeTestSms,
  getNativeOpeningBalances,
  saveNativeOpeningBalance,
  getNativeSmsOverrides,
  saveNativeSmsOverride,
  getNativeSenderBankMap,
  saveNativeSenderBankMap,
  deleteNativeSenderBankMap,
  NativeSmsMessage 
} from '../utils/nativeBridge.ts';

const LOCAL_STORAGE_KEYS = {
  CUSTOM_ACCOUNTS: 'ak_custom_accounts_v2',
  WITHDRAWALS: 'ak_withdrawals_v2',
  LOGS: 'ak_sync_logs_v2',
  UI_PREFS: 'ak_ui_prefs_v2',
};

export const DEFAULT_BANK_ACCOUNTS: Omit<Account, 'balance' | 'receivedThisMonth' | 'sentThisMonth' | 'hasSyncedBalance'>[] = [
  {
    id: 'acc-telebirr',
    name: 'Telebirr',
    bank: 'Telebirr',
    type: 'mobile',
    accountNumber: '127',
    maskedNumber: '127 · Telebirr',
    accent: 'blue',
    brandColor: '#009EDB',
  },
  {
    id: 'acc-cbe',
    name: 'Commercial Bank of Ethiopia',
    bank: 'CBE',
    type: 'operating',
    accountNumber: '1000****4819',
    maskedNumber: 'CBE · 4819',
    accent: 'purple',
    brandColor: '#7A1C5A',
  },
  {
    id: 'acc-awash',
    name: 'Awash Bank',
    bank: 'Awash Bank',
    type: 'operating',
    accountNumber: '0132****3321',
    maskedNumber: 'Awash · 3321',
    accent: 'indigo',
    brandColor: '#005DAA',
  },
  {
    id: 'acc-dashen',
    name: 'Dashen Bank',
    bank: 'Dashen Bank',
    type: 'operating',
    accountNumber: '0021****5510',
    maskedNumber: 'Dashen · 5510',
    accent: 'cyan',
    brandColor: '#0A2558',
  },
  {
    id: 'acc-boa',
    name: 'Bank of Abyssinia',
    bank: 'Bank of Abyssinia',
    type: 'operating',
    accountNumber: '0412****9901',
    maskedNumber: 'BOA · 9901',
    accent: 'gold',
    brandColor: '#C98A00',
  },
];

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

  public async getSenderBankMap(): Promise<Record<string, string>> {
    return getNativeSenderBankMap();
  }

  public async saveSenderBankMapping(sender: string, bankName: string): Promise<void> {
    await saveNativeSenderBankMap(sender, bankName);
    // Also ensure sender is in SharedPreferences "ejeta" senders string
    const settings = await this.getSettings();
    if (!settings.allowedSenders.some(s => s.toLowerCase() === sender.toLowerCase())) {
      const updated = [...settings.allowedSenders, sender];
      await this.saveSettings({ allowedSenders: updated });
    }
  }

  public async deleteSenderBankMapping(sender: string): Promise<void> {
    await deleteNativeSenderBankMap(sender);
  }

  public async getOpeningBalances(): Promise<Record<string, number>> {
    return getNativeOpeningBalances();
  }

  public async saveOpeningBalance(bank: string, amount: number): Promise<void> {
    await saveNativeOpeningBalance(bank, amount);
  }

  public async saveSmsOverride(
    smsId: string,
    override: { counterparty?: string | null; direction?: string | null; note?: string; isHidden?: boolean }
  ): Promise<void> {
    await saveNativeSmsOverride(
      Number(smsId),
      override.counterparty ?? null,
      override.direction ?? null,
      override.note || '',
      !!override.isHidden
    );
  }

  public async getAllPayments(includeHidden = false): Promise<PaymentRecord[]> {
    const [messages, overrides, senderMap] = await Promise.all([
      getNativeMessages(),
      getNativeSmsOverrides(),
      getNativeSenderBankMap(),
    ]);

    // Parse and augment with overrides
    const parsedList: PaymentRecord[] = messages.map(msg => {
      const parsed = parseBankSms(msg.sender || 'Bank', msg.body || '', senderMap);
      let status: SyncStatus = 'pending';
      if (msg.status === 'sent') status = 'sent';
      else if (msg.status === 'local') status = 'local';
      else if (msg.status === 'failed') status = 'failed';
      else status = 'pending';

      const ov = overrides[String(msg.id)];

      const isHidden = ov ? !!ov.isHidden : false;
      const counterparty = ov?.counterparty || parsed.counterparty;
      const type = (ov?.direction as any) || parsed.type;
      const note = ov?.note || undefined;
      const isOverridden = !!(ov && (ov.counterparty || ov.direction || ov.note || ov.isHidden));

      return {
        id: String(msg.id),
        senderAddress: msg.sender || '',
        bank: parsed.bank,
        type,
        amount: parsed.amount,
        currency: 'ETB',
        counterparty,
        reference: parsed.reference || `SMS-${msg.id}`,
        accountNumber: parsed.accountNumber,
        balance: parsed.balance,
        extractedBalance: parsed.balance,
        rawMessage: msg.body || '',
        timestamp: msg.ts || Date.now(),
        date: parsed.date || new Date(msg.ts || Date.now()).toISOString(),
        syncStatus: status,
        retryCount: msg.tries || 0,
        errorMessage: msg.err || (msg.code && msg.code !== 200 ? `HTTP ${msg.code}` : undefined),
        serverResponse: msg.code ? `HTTP ${msg.code}` : undefined,
        source: 'sms',
        isDuplicate: false,
        note,
        isHidden,
        isOverridden,
      };
    });

    // Sort chronologically (oldest to newest) to detect duplicates by Reference
    parsedList.sort((a, b) => a.timestamp - b.timestamp);

    const seenRefs = new Set<string>();
    for (const p of parsedList) {
      if (p.reference && !p.reference.startsWith('SMS-')) {
        const cleanRef = p.reference.toUpperCase().trim();
        if (seenRefs.has(cleanRef)) {
          // Rule 6: DEDUPE by Ref: if same Ref already exists, mark second as duplicate
          p.isDuplicate = true;
        } else {
          seenRefs.add(cleanRef);
          p.isDuplicate = false;
        }
      }
    }

    // Sort descending (newest first) for UI presentation
    parsedList.sort((a, b) => b.timestamp - a.timestamp);

    if (!includeHidden) {
      return parsedList.filter(p => !p.isHidden);
    }
    return parsedList;
  }

  public async getPaymentById(id: string): Promise<PaymentRecord | null> {
    const list = await this.getAllPayments(true);
    return list.find(p => p.id === id) || null;
  }

  public async getAccounts(): Promise<Account[]> {
    const [payments, openingBalances] = await Promise.all([
      this.getAllPayments(false),
      this.getOpeningBalances(),
    ]);

    // Load any user-added bank accounts (e.g. Abay, Wegagen, Nib, Zemen)
    let userAdded: Account[] = [];
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.CUSTOM_ACCOUNTS);
      if (stored) userAdded = JSON.parse(stored);
    } catch {}

    const baseAccounts = [...DEFAULT_BANK_ACCOUNTS, ...userAdded];

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return baseAccounts.map(base => {
      // Find payments matching this bank (case-insensitive)
      const bankNorm = base.bank.trim().toUpperCase();
      const bankPayments = payments.filter(p => {
        const pBankNorm = p.bank.trim().toUpperCase();
        return pBankNorm === bankNorm || (bankNorm === 'CBE' && pBankNorm.includes('COMMERCIAL BANK'));
      });

      // Filter payments that are not duplicate for amounts
      const nonDuplicatePayments = bankPayments.filter(p => !p.isDuplicate);

      // Check this month's received and sent
      let receivedThisMonth = 0;
      let sentThisMonth = 0;
      let totalReceived = 0;
      let totalSent = 0;

      for (const p of nonDuplicatePayments) {
        const d = new Date(p.timestamp);
        const isCurrentMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;

        if (p.type === 'received') {
          totalReceived += p.amount;
          if (isCurrentMonth) receivedThisMonth += p.amount;
        } else if (p.type === 'sent') {
          totalSent += p.amount;
          if (isCurrentMonth) sentThisMonth += p.amount;
        }
      }

      // Check if latest SMS contains explicit "current balance"
      const smsWithBalance = bankPayments.find(p => p.extractedBalance !== undefined && p.extractedBalance !== null);

      let currentBalance = 0;
      let hasSyncedBalance = false;
      const openingBal = openingBalances[base.bank] ?? openingBalances[base.name];

      if (smsWithBalance && smsWithBalance.extractedBalance !== undefined) {
        // True balance from bank SMS
        currentBalance = smsWithBalance.extractedBalance;
        hasSyncedBalance = true;
      } else if (openingBal !== undefined) {
        // Opening balance + received - sent
        currentBalance = openingBal + totalReceived - totalSent;
        hasSyncedBalance = true;
      } else {
        // No explicit balance and no opening balance set yet
        currentBalance = totalReceived - totalSent;
        hasSyncedBalance = false;
      }

      return {
        ...base,
        balance: currentBalance,
        receivedThisMonth,
        sentThisMonth,
        openingBalance: openingBal,
        hasSyncedBalance,
      };
    });
  }

  public async addCustomAccount(newAccount: Omit<Account, 'balance' | 'receivedThisMonth' | 'sentThisMonth' | 'hasSyncedBalance'>): Promise<void> {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.CUSTOM_ACCOUNTS);
      const list: any[] = stored ? JSON.parse(stored) : [];
      list.push(newAccount);
      localStorage.setItem(LOCAL_STORAGE_KEYS.CUSTOM_ACCOUNTS, JSON.stringify(list));
    } catch {}
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
      localStorage.removeItem(LOCAL_STORAGE_KEYS.WITHDRAWALS);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.LOGS);
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

  public async exportPaymentsCsv(): Promise<string> {
    const list = await this.getAllPayments(true);
    const header = ['ID', 'Date', 'Bank', 'Type', 'Amount (ETB)', 'Counterparty', 'Reference', 'Account', 'Sync Status', 'Duplicate', 'Hidden', 'Note', 'Raw SMS'];
    const rows = list.map(p => [
      p.id,
      p.date,
      `"${p.bank}"`,
      p.type,
      p.amount,
      `"${(p.counterparty || '').replace(/"/g, '""')}"`,
      `"${p.reference}"`,
      `"${p.accountNumber || ''}"`,
      p.syncStatus,
      p.isDuplicate ? 'Yes' : 'No',
      p.isHidden ? 'Yes' : 'No',
      `"${(p.note || '').replace(/"/g, '""')}"`,
      `"${p.rawMessage.replace(/"/g, '""')}"`,
    ]);
    return [header.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

export const db = new DatabaseService();
