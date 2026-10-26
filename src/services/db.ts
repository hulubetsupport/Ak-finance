import { PaymentRecord, Account, WithdrawalRecord, AppSettings, SyncLogEntry, SyncStatus, ServerResultRecord } from '../types/index.ts';
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
  getNativeCounterpartyTags,
  saveNativeCounterpartyTag,
  getNativeServerResults,
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
    override: { counterparty?: string | null; direction?: string | null; note?: string; tag?: string; isHidden?: boolean }
  ): Promise<void> {
    await saveNativeSmsOverride(
      Number(smsId),
      override.counterparty ?? null,
      override.direction ?? null,
      override.note || '',
      !!override.isHidden,
      override.tag || ''
    );
    // If tag is set and counterparty is non-empty, remember it
    if (override.tag && override.counterparty) {
      await saveNativeCounterpartyTag(override.counterparty.trim(), override.tag.trim());
    }
  }

  public async getCounterpartyTags(): Promise<Record<string, string>> {
    return getNativeCounterpartyTags();
  }

  public async saveCounterpartyTag(counterparty: string, tag: string): Promise<void> {
    await saveNativeCounterpartyTag(counterparty, tag);
  }

  public async getAllPayments(includeHidden = false): Promise<PaymentRecord[]> {
    const [messages, overrides, senderMap, counterpartyTags, serverResults] = await Promise.all([
      getNativeMessages(),
      getNativeSmsOverrides(),
      getNativeSenderBankMap(),
      getNativeCounterpartyTags(),
      getNativeServerResults(),
    ]);

    // Parse and augment with overrides and server results
    const parsedList: PaymentRecord[] = messages.map(msg => {
      const parsed = parseBankSms(msg.sender || 'Bank', msg.body || '', senderMap);
      let status: SyncStatus = 'pending';
      if (msg.status === 'sent') status = 'sent';
      else if (msg.status === 'local') status = 'local';
      else if (msg.status === 'failed') status = 'failed';
      else status = 'pending';

      const ov = overrides[String(msg.id)];
      const sr = serverResults[String(msg.id)];

      let serverResultObj: ServerResultRecord | undefined = undefined;
      let ftNumber = parsed.ftNumber;
      let v2Code = parsed.v2Code;
      let reference = parsed.reference || `SMS-${msg.id}`;

      if (sr) {
        let parsedRaw: any = {};
        if (sr.raw) {
          try {
            parsedRaw = JSON.parse(sr.raw);
          } catch {}
        }
        serverResultObj = {
          smsId: sr.smsId,
          httpCode: sr.httpCode,
          status: (sr.status as any) || 'Unknown',
          ref: sr.ref || parsedRaw.ref,
          reason: sr.reason || parsedRaw.reason,
          raw: sr.raw,
          at: sr.at,
          resolving: !!parsedRaw.resolving,
          v2: parsedRaw.v2,
          bank: parsedRaw.bank,
          type: parsedRaw.type,
          amount: parsedRaw.amount,
        };

        // When the server returns a ref, save it as the FT
        if (serverResultObj.ref) {
          ftNumber = serverResultObj.ref;
          reference = serverResultObj.ref;
        }
        if (serverResultObj.v2 && !v2Code) {
          v2Code = serverResultObj.v2;
        }
      }

      const isHidden = ov ? !!ov.isHidden : false;
      const counterparty = ov?.counterparty || parsed.counterparty;
      const type = (ov?.direction as any) || parsed.type;
      const note = ov?.note || undefined;
      const rememberedTag = counterpartyTags[counterparty.trim()] || counterpartyTags[counterparty.toLowerCase().trim()];
      const tag = ov?.tag || rememberedTag || undefined;
      const isOverridden = !!(ov && (ov.counterparty || ov.direction || ov.note || ov.tag || ov.isHidden));

      return {
        id: String(msg.id),
        senderAddress: msg.sender || '',
        bank: parsed.bank,
        type,
        category: parsed.category,
        amount: parsed.amount,
        amountCents: parsed.amountCents,
        amountSantim: parsed.amountSantim ?? parsed.amountCents,
        fee: parsed.fee,
        feeCents: parsed.feeCents,
        currency: 'ETB',
        counterparty,
        reference,
        ftNumber,
        v2Code,
        accountNumber: parsed.accountNumber,
        balance: parsed.balance,
        balanceSantim: parsed.balanceSantim,
        extractedBalance: parsed.balance,
        rawMessage: msg.body || '',
        timestamp: msg.ts || Date.now(),
        date: parsed.date || new Date(msg.ts || Date.now()).toISOString(),
        syncStatus: status,
        retryCount: msg.tries || 0,
        errorMessage: msg.err || (msg.code && msg.code !== 200 ? `HTTP ${msg.code}` : undefined),
        serverResponse: msg.code ? `HTTP ${msg.code}` : undefined,
        serverResult: serverResultObj,
        source: 'sms',
        isDuplicate: false,
        note,
        tag,
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

      // Check this month's received and sent using integer cents
      let receivedCentsThisMonth = 0;
      let sentCentsThisMonth = 0;
      let totalReceivedCents = 0;
      let totalSentCents = 0;

      for (const p of nonDuplicatePayments) {
        const d = new Date(p.timestamp);
        const isCurrentMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        const pCents = p.amountCents ?? Math.round(p.amount * 100);

        if (p.type === 'received') {
          totalReceivedCents += pCents;
          if (isCurrentMonth) receivedCentsThisMonth += pCents;
        } else if (p.type === 'sent') {
          totalSentCents += pCents;
          if (isCurrentMonth) sentCentsThisMonth += pCents;
        }
      }

      const receivedThisMonth = receivedCentsThisMonth / 100;
      const sentThisMonth = sentCentsThisMonth / 100;

      // Check if latest SMS contains explicit "current balance" (Telebirr ቀሪ ሂሳብ too)
      const sortedByTimeDesc = [...bankPayments].sort((a, b) => b.timestamp - a.timestamp);
      const latestSmsWithBalance = sortedByTimeDesc.find(p => p.extractedBalance !== undefined && p.extractedBalance !== null);

      let currentBalance = 0;
      let hasSyncedBalance = false;
      const openingBal = openingBalances[base.bank] ?? openingBalances[base.name];

      if (latestSmsWithBalance && latestSmsWithBalance.extractedBalance !== undefined) {
        // True balance from latest bank SMS (CBE or Telebirr ቀሪ ሂሳብ)
        currentBalance = latestSmsWithBalance.extractedBalance;
        hasSyncedBalance = true;
      } else if (openingBal !== undefined) {
        // Opening balance + received - sent (calculated in integer cents)
        const openCents = Math.round(openingBal * 100);
        currentBalance = (openCents + totalReceivedCents - totalSentCents) / 100;
        hasSyncedBalance = true;
      } else {
        // No explicit balance and no opening balance set yet
        currentBalance = (totalReceivedCents - totalSentCents) / 100;
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
    // Requirement E5: UTF-8 BOM (\uFEFF) so Excel opens Amharic correctly
    const header = [
      'Date',
      'Bank',
      'Direction',
      'Amount (ETB)',
      'Counterparty',
      'Category',
      'Tag',
      'Note',
      'Ref/FT',
      'Balance',
      'Server status',
      'Raw SMS',
    ];

    const rows = list.map(p => {
      const direction = p.type === 'received' ? 'Received' : 'Sent';
      const ref = p.ftNumber || p.v2Code || p.reference || '';
      const balanceStr = p.balance !== undefined ? p.balance.toFixed(2) : '';
      const serverStatus = p.serverResult?.status || (p.syncStatus === 'sent' ? 'Saved' : p.syncStatus === 'pending' ? 'Pending' : 'Failed');
      const category = p.category ? p.category.toUpperCase() : (p.type === 'received' ? 'RECEIVED' : 'TRANSFER');

      return [
        `"${p.date}"`,
        `"${p.bank}"`,
        `"${direction}"`,
        p.amount.toFixed(2),
        `"${(p.counterparty || '').replace(/"/g, '""')}"`,
        `"${category}"`,
        `"${(p.tag || '').replace(/"/g, '""')}"`,
        `"${(p.note || '').replace(/"/g, '""')}"`,
        `"${ref.replace(/"/g, '""')}"`,
        `"${balanceStr}"`,
        `"${serverStatus}"`,
        `"${p.rawMessage.replace(/"/g, '""')}"`,
      ].join(',');
    });

    return '\uFEFF' + [header.join(','), ...rows].join('\r\n');
  }

  public async exportFullBackupJson(includeSecretKey: boolean = false): Promise<string> {
    const [messages, serverResults, openingBalances, overrides, senderBankMap, counterpartyTags, withdrawals, settings] = await Promise.all([
      getNativeMessages(),
      getNativeServerResults(),
      getNativeOpeningBalances(),
      getNativeSmsOverrides(),
      getNativeSenderBankMap(),
      getNativeCounterpartyTags(),
      this.getAllWithdrawals(),
      this.getSettings(),
    ]);

    let customAccounts: any[] = [];
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.CUSTOM_ACCOUNTS);
      if (stored) customAccounts = JSON.parse(stored);
    } catch {}

    const backup = {
      app: 'Ak Finance',
      version: 4,
      appVersion: '2.0.0',
      exportedAt: new Date().toISOString(),
      stats: {
        paymentsCount: messages.length,
        banksCount: Object.keys(openingBalances).length || 5,
        tagsCount: Object.keys(counterpartyTags).length,
      },
      settings: {
        ...settings,
        // Requirement E3: Secret key off by default; replace with "" if not requested
        secretKey: includeSecretKey ? (settings.secretKey || '') : '',
      },
      messages,
      serverResults,
      openingBalances,
      overrides,
      senderBankMap,
      counterpartyTags,
      customAccounts,
      withdrawals,
    };

    return JSON.stringify(backup, null, 2);
  }

  public inspectBackupJson(jsonString: string): {
    valid: boolean;
    version?: number;
    paymentsCount: number;
    banksCount: number;
    tagsCount: number;
    hasSecretKey: boolean;
    error?: string;
    data?: any;
  } {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        return { valid: false, paymentsCount: 0, banksCount: 0, tagsCount: 0, hasSecretKey: false, error: 'File is not a valid JSON object.' };
      }

      const version = data.version || 1;
      // Requirement E4: Check schema version, reject unknown future versions
      if (typeof version === 'number' && version > 4) {
        return {
          valid: false,
          version,
          paymentsCount: 0,
          banksCount: 0,
          tagsCount: 0,
          hasSecretKey: false,
          error: `Unsupported backup version (${version}). Please update Ak Finance first.`,
        };
      }

      const paymentsCount = Array.isArray(data.messages) ? data.messages.length : 0;
      const banksCount = data.openingBalances && typeof data.openingBalances === 'object'
        ? Object.keys(data.openingBalances).length
        : (data.senderBankMap ? Object.keys(data.senderBankMap).length : 5);
      const tagsCount = data.counterpartyTags && typeof data.counterpartyTags === 'object'
        ? Object.keys(data.counterpartyTags).length
        : 0;
      const hasSecretKey = Boolean(data.settings && data.settings.secretKey && data.settings.secretKey.trim().length > 0);

      return {
        valid: true,
        version,
        paymentsCount,
        banksCount,
        tagsCount,
        hasSecretKey,
        data,
      };
    } catch (e: any) {
      return {
        valid: false,
        paymentsCount: 0,
        banksCount: 0,
        tagsCount: 0,
        hasSecretKey: false,
        error: e?.message || 'Failed to parse JSON file.',
      };
    }
  }

  public async importFullBackupJson(
    jsonString: string,
    mode: 'merge' | 'replace' = 'merge'
  ): Promise<{ success: boolean; count: number; banksCount: number; tagsCount: number; error?: string }> {
    const inspection = this.inspectBackupJson(jsonString);
    if (!inspection.valid || !inspection.data) {
      return { success: false, count: 0, banksCount: 0, tagsCount: 0, error: inspection.error || 'Invalid backup file.' };
    }

    const data = inspection.data;
    let restoredPaymentsCount = 0;

    try {
      // 1. Opening Balances
      if (data.openingBalances && typeof data.openingBalances === 'object') {
        for (const [bank, amount] of Object.entries(data.openingBalances)) {
          if (typeof amount === 'number') {
            await this.saveOpeningBalance(bank, amount);
          }
        }
      }

      // 2. Sender Bank Map
      if (data.senderBankMap && typeof data.senderBankMap === 'object') {
        for (const [sender, bankName] of Object.entries(data.senderBankMap)) {
          if (typeof bankName === 'string') {
            await this.saveSenderBankMapping(sender, bankName);
          }
        }
      }

      // 3. Counterparty Tags
      if (data.counterpartyTags && typeof data.counterpartyTags === 'object') {
        for (const [cp, tg] of Object.entries(data.counterpartyTags)) {
          if (typeof tg === 'string') {
            await this.saveCounterpartyTag(cp, tg);
          }
        }
      }

      // 4. Overrides
      if (data.overrides && typeof data.overrides === 'object') {
        for (const [smsId, ov] of Object.entries(data.overrides as Record<string, any>)) {
          if (ov && typeof ov === 'object') {
            await this.saveSmsOverride(smsId, {
              counterparty: ov.counterparty,
              direction: ov.direction,
              note: ov.note,
              tag: ov.tag,
              isHidden: !!ov.isHidden,
            });
          }
        }
      }

      // 5. Settings
      if (data.settings && typeof data.settings === 'object') {
        const currentSettings = await this.getSettings();
        const settingsToSave: Partial<AppSettings> = {
          serverUrl: data.settings.serverUrl || currentSettings.serverUrl,
          httpMethod: data.settings.httpMethod || currentSettings.httpMethod,
          retryIntervalSeconds: data.settings.retryIntervalSeconds || currentSettings.retryIntervalSeconds,
          mode: data.settings.mode || currentSettings.mode,
          allowedSenders: Array.isArray(data.settings.allowedSenders) ? data.settings.allowedSenders : currentSettings.allowedSenders,
        };

        // If backup contained a non-empty secretKey, or if in replace mode and key is present
        if (data.settings.secretKey && data.settings.secretKey.trim().length > 0) {
          settingsToSave.secretKey = data.settings.secretKey;
        } else if (mode === 'replace' && (!data.settings.secretKey || data.settings.secretKey === '')) {
          // If backup omitted secret key, preserve existing local key to prevent accidental key wipeout
          settingsToSave.secretKey = currentSettings.secretKey;
        }

        await this.saveSettings(settingsToSave);
      }

      // 6. Custom Accounts & Withdrawals
      if (Array.isArray(data.customAccounts)) {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEYS.CUSTOM_ACCOUNTS, JSON.stringify(data.customAccounts));
        } catch {}
      }

      if (Array.isArray(data.withdrawals)) {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEYS.WITHDRAWALS, JSON.stringify(data.withdrawals));
        } catch {}
      }

      // 7. Messages: Requirement E4 "Merge" adds new rows without overwriting existing (skip duplicates: same sender + body + timestamp)
      if (Array.isArray(data.messages) && data.messages.length > 0) {
        const existingMessages = await getNativeMessages();

        // Create deduplication set for fast lookup
        const existingKeySet = new Set<string>();
        for (const em of existingMessages) {
          const bodyNorm = (em.body || '').trim();
          existingKeySet.add(`${(em.sender || '').toLowerCase()}|${bodyNorm}`);
        }

        for (const m of data.messages) {
          if (!m || !m.sender || !m.body) continue;
          const key = `${(m.sender || '').toLowerCase()}|${(m.body || '').trim()}`;

          if (mode === 'merge' && existingKeySet.has(key)) {
            // Duplicate row, skip
            continue;
          }

          await this.insertTestSms(m.sender, m.body);
          existingKeySet.add(key);
          restoredPaymentsCount++;
        }
      }

      return {
        success: true,
        count: restoredPaymentsCount || inspection.paymentsCount,
        banksCount: inspection.banksCount,
        tagsCount: inspection.tagsCount,
      };
    } catch (e: any) {
      return {
        success: false,
        count: 0,
        banksCount: 0,
        tagsCount: 0,
        error: e?.message || 'Failed restoring backup data',
      };
    }
  }
}

export const db = new DatabaseService();
