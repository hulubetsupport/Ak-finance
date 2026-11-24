import {
  PaymentRecord,
  Account,
  WithdrawalRecord,
  AppSettings,
  SyncLogEntry,
  SyncStatus,
  ServerResultRecord,
  MonthlyBudget,
  PaymentCategory,
  PaymentType,
} from '../types/index.ts';
import {
  parseBankSms,
  buildOfficialReceiptUrl,
  isCbeBank,
} from '../utils/smsParser.ts';
import {
  resolveAllowedAiModel,
} from '../constants/aiModels.ts';
import {
  getNativeSettings,
  saveNativeSettings,
  getNativeMessages,
  deleteNativeMessage,
  clearAllNativeMessages,
  clearAllNativeState,
  insertNativeTestSms,
  importNativeMessagesBatch,
  updateNativeMessageStatus,
  getNativeOpeningBalances,
  saveNativeOpeningBalance,
  saveNativeOpeningBalancesBatch,
  getNativeSmsOverrides,
  saveNativeSmsOverride,
  saveNativeSmsOverridesBatch,
  getNativeSenderBankMap,
  saveNativeSenderBankMap,
  saveNativeSenderBankMapBatch,
  deleteNativeSenderBankMap,
  getNativeCounterpartyTags,
  saveNativeCounterpartyTag,
  saveNativeCounterpartyTagsBatch,
  getNativeServerResults,
  saveNativeServerResult,
  saveNativeServerResultsBatch,
  getAiParsedCache,
  saveAiParsedCacheEntry,
} from '../utils/nativeBridge.ts';

const LOCAL_STORAGE_KEYS = {
  CUSTOM_ACCOUNTS: 'ak_custom_accounts_v2',
  ARCHIVED_ACCOUNTS: 'ak_archived_accounts_v2',
  HIDDEN_BANKS: 'ak_hidden_banks_v2',
  ACCOUNT_ORDER: 'ak_account_order_v2',
  WITHDRAWALS: 'ak_withdrawals_v2',
  LOGS: 'ak_sync_logs_v2',
  UI_PREFS: 'ak_ui_prefs_v2',
  BUDGETS: 'ak_monthly_budgets_v2',
};

export const DEFAULT_BANK_ACCOUNTS: Omit<Account, 'balance' | 'receivedThisMonth' | 'sentThisMonth' | 'hasSyncedBalance'>[] = [
  {
    id: 'acc-telebirr',
    name: 'Telebirr',
    bank: 'Telebirr',
    shortCode: 'TLB',
    senderIds: ['127', 'Telebirr'],
    type: 'mobile',
    accountNumber: '127',
    maskedNumber: '127 · Telebirr',
    accent: 'blue',
    brandColor: '#009EDB',
    logoUrl: '/assets/aistudio/unnamed__2__485a8cc8.jpg',
    orderIndex: 0,
  },
  {
    id: 'acc-cbe',
    name: 'Commercial Bank of Ethiopia',
    bank: 'CBE',
    shortCode: 'CBE',
    senderIds: ['CBE'],
    type: 'operating',
    accountNumber: '1000****4819',
    maskedNumber: 'CBE · 4819',
    accent: 'purple',
    brandColor: '#7A1C5A',
    logoUrl: '/assets/aistudio/images__1__1__5e8bafae.jpg',
    orderIndex: 1,
  },
  {
    id: 'acc-awash',
    name: 'Awash Bank',
    bank: 'Awash Bank',
    shortCode: 'AWH',
    senderIds: ['AwashBank', 'Awash'],
    type: 'operating',
    accountNumber: '0132****3321',
    maskedNumber: 'Awash · 3321',
    accent: 'amber',
    brandColor: '#E67300',
    logoUrl: '/assets/aistudio/images__1__3__de75fa72.jpg',
    orderIndex: 2,
  },
  {
    id: 'acc-dashen',
    name: 'Dashen Bank',
    bank: 'Dashen Bank',
    shortCode: 'DSH',
    senderIds: ['Dashen', 'DashenBank'],
    type: 'operating',
    accountNumber: '0021****5510',
    maskedNumber: 'Dashen · 5510',
    accent: 'cyan',
    brandColor: '#0B2055',
    logoUrl: '/assets/aistudio/images__1__2__b5cc990f.jpg',
    orderIndex: 3,
  },
  {
    id: 'acc-boa',
    name: 'Bank of Abyssinia',
    bank: 'Bank of Abyssinia',
    shortCode: 'BOA',
    senderIds: ['BOA', 'Abyssinia'],
    type: 'operating',
    accountNumber: '0412****9901',
    maskedNumber: 'BOA · 9901',
    accent: 'gold',
    brandColor: '#E49600',
    logoUrl: '/assets/aistudio/images__1__4__6fad4b0d.jpg',
    orderIndex: 4,
  },
];

class DatabaseService {
  private getUiPrefs(): Record<string, any> {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.UI_PREFS);
      if (stored) return JSON.parse(stored);
    } catch {}
    return {};
  }

  private saveUiPrefs(prefs: Record<string, any>): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.UI_PREFS, JSON.stringify(prefs));
    } catch {}
  }

  public async getSettings(): Promise<AppSettings> {
    const native = await getNativeSettings();
    const uiPrefs = this.getUiPrefs();

    const sendersArr = (native.senders || 'CBE,127,Telebirr,AwashBank,Dashen,BOA')
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
      excludeHiddenFromTotal: !!uiPrefs.excludeHiddenFromTotal,
      startHiddenAfterUnlock: !!uiPrefs.startHiddenAfterUnlock,
      serviceRunning: true,
      aiEnabled: uiPrefs.aiEnabled !== false,
      aiAutoParseUnknown: !!uiPrefs.aiAutoParseUnknown,
      aiModel: resolveAllowedAiModel(uiPrefs.aiModel),
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

    const uiPrefs = this.getUiPrefs();
    if (newSettings.language !== undefined) uiPrefs.language = newSettings.language;
    if (newSettings.hideBalances !== undefined) uiPrefs.hideBalances = newSettings.hideBalances;
    if (newSettings.soundEnabled !== undefined) uiPrefs.soundEnabled = newSettings.soundEnabled;
    if (newSettings.excludeHiddenFromTotal !== undefined) uiPrefs.excludeHiddenFromTotal = newSettings.excludeHiddenFromTotal;
    if (newSettings.startHiddenAfterUnlock !== undefined) uiPrefs.startHiddenAfterUnlock = newSettings.startHiddenAfterUnlock;
    if (newSettings.aiEnabled !== undefined) uiPrefs.aiEnabled = newSettings.aiEnabled;
    if (newSettings.aiAutoParseUnknown !== undefined) uiPrefs.aiAutoParseUnknown = newSettings.aiAutoParseUnknown;
    if (newSettings.aiModel !== undefined) uiPrefs.aiModel = resolveAllowedAiModel(newSettings.aiModel);
    this.saveUiPrefs(uiPrefs);

    return this.getSettings();
  }

  public async getSenderBankMap(): Promise<Record<string, string>> {
    return getNativeSenderBankMap();
  }

  public async saveSenderBankMapping(sender: string, bankName: string): Promise<void> {
    await saveNativeSenderBankMap(sender, bankName);
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
    override: {
      counterparty?: string | null;
      direction?: string | null;
      note?: string;
      tag?: string;
      isHidden?: boolean;
      reference?: string;
      category?: string;
    }
  ): Promise<void> {
    await saveNativeSmsOverride(
      Number(smsId),
      override.counterparty ?? null,
      override.direction ?? null,
      override.note || '',
      !!override.isHidden,
      override.tag || '',
      override.reference || '',
      override.category
    );
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
    const aiCache = getAiParsedCache();

    const parsedList: PaymentRecord[] = messages.map(msg => {
      const parsed = parseBankSms(msg.sender || 'Bank', msg.body || '', senderMap);
      const aiEntry = aiCache[String(msg.id)];

      let status: SyncStatus = 'local';
      if (msg.status === 'sent') status = 'sent';
      else if (msg.status === 'local') status = 'local';
      else if (msg.status === 'failed') status = 'failed';
      else status = 'pending';

      const ov = overrides[String(msg.id)];
      const sr = serverResults[String(msg.id)];

      // Merge AI cached extraction only when local deterministic parser could not extract amount or bank
      let bank = parsed.bank;
      let amount = parsed.amount;
      let amountCents = parsed.amountCents;
      let amountSantim = parsed.amountSantim ?? parsed.amountCents;
      let fee = parsed.fee;
      let feeCents = parsed.feeCents;
      let balance = parsed.balance;
      let balanceSantim = parsed.balanceSantim;
      let counterparty = parsed.counterparty;
      let type: PaymentType = parsed.type;
      let category: PaymentCategory = parsed.category;
      let ftNumber = parsed.ftNumber;
      let v2Code = parsed.v2Code;
      let reference = parsed.reference || `SMS-${msg.id}`;
      let receiptUrl = parsed.receiptUrl;
      let aiParsed = false;

      if (aiEntry && (parsed.amount === 0 || parsed.bank === 'Unknown' || parsed.category === 'alert')) {
        if (aiEntry.bank && (parsed.bank === 'Unknown' || !parsed.bank)) bank = aiEntry.bank;
        if (typeof aiEntry.amount === 'number' && aiEntry.amount > 0 && parsed.amount === 0) {
          amount = aiEntry.amount;
          amountCents = Math.round(aiEntry.amount * 100);
          amountSantim = amountCents;
        }
        if (typeof aiEntry.fee === 'number' && aiEntry.fee > 0 && fee === undefined) {
          fee = aiEntry.fee;
          feeCents = Math.round(aiEntry.fee * 100);
        }
        if (typeof aiEntry.balance === 'number' && balance === undefined) {
          balance = aiEntry.balance;
          balanceSantim = Math.round(aiEntry.balance * 100);
        }
        if (aiEntry.counterparty && !counterparty) counterparty = aiEntry.counterparty;
        if (aiEntry.type && type === 'unknown') type = aiEntry.type;
        if (aiEntry.category && (category === 'other' || category === 'alert')) {
          category = aiEntry.category as PaymentCategory;
        }
        if (aiEntry.reference && reference.startsWith('SMS-')) reference = aiEntry.reference;
        if (aiEntry.receiptUrl && !receiptUrl) receiptUrl = aiEntry.receiptUrl;
        aiParsed = true;
      }

      let serverResultObj: ServerResultRecord | undefined = undefined;
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

        if (serverResultObj.ref) {
          if (isCbeBank(bank)) ftNumber = serverResultObj.ref;
          reference = serverResultObj.ref;
        }
        if (serverResultObj.v2 && !v2Code) {
          v2Code = serverResultObj.v2;
        }
      }

      if (ov?.reference) {
        if (isCbeBank(bank)) ftNumber = ov.reference;
        reference = ov.reference;
      }

      const isHidden = ov ? !!ov.isHidden : false;
      if (ov?.counterparty) counterparty = ov.counterparty;
      if (ov?.direction) type = ov.direction as PaymentType;
      if (ov?.category) category = ov.category as PaymentCategory;
      const note = ov?.note || undefined;

      // CRITICAL BUG FIX (#6 & #8):
      // If the legacy server only supports CBE/Telebirr and replies `Ignored`, NEVER erase a valid local parse
      // (such as Telebirr ATM Withdrawal screenshot 184622, Awash, Dashen, BOA, Zemen, Siinqee, etc.)!
      // Only treat as an informational `alert` when the LOCAL parser itself identified it as a non-financial alert/OTP.
      const serverIgnored = Boolean(
        serverResultObj &&
          (serverResultObj.status === 'Ignored' ||
            (serverResultObj.reason && /not\s*a\s*payment|not\s*financial|ignored|unsupported/i.test(serverResultObj.reason)))
      );
      const serverIgnoredReason = serverIgnored
        ? serverResultObj?.reason || 'Server ignored this SMS; parsed & saved locally by Ak Finance'
        : undefined;

      const localIsAlert = (category === 'alert' || amount === 0) && !ov?.direction;
      if (localIsAlert) {
        category = 'alert';
        type = 'unknown';
        receiptUrl = undefined;
        if (!counterparty || counterparty.toLowerCase().includes('unknown')) {
          counterparty = bank === 'Bank of Abyssinia' || bank === 'BOA' ? 'BOA Service Alert' : `${bank} Service Alert`;
        }
      }

      if (!receiptUrl && !localIsAlert && category !== 'alert') {
        receiptUrl = buildOfficialReceiptUrl(bank, v2Code || reference, parsed.accountNumber);
      }

      const hasRealName = Boolean(counterparty && counterparty.trim().length > 0);
      const cleanCp = hasRealName ? counterparty.trim() : '';
      const rememberedTag = cleanCp
        ? counterpartyTags[cleanCp] || counterpartyTags[cleanCp.toLowerCase()]
        : undefined;

      let tag: string | undefined = undefined;
      if (ov?.tag && (hasRealName || (parsed.accountNumber && parsed.accountNumber.length > 0))) {
        tag = ov.tag;
      }
      const suggestedTag = !tag && rememberedTag ? rememberedTag : undefined;
      const isOverridden = !!(ov && (ov.counterparty || ov.direction || ov.note || ov.tag || ov.isHidden || ov.reference));

      return {
        id: String(msg.id),
        senderAddress: msg.sender || '',
        bank,
        type,
        category,
        amount,
        amountCents,
        amountSantim,
        fee,
        feeCents,
        currency: 'ETB',
        counterparty,
        reference,
        ftNumber,
        v2Code,
        receiptUrl,
        accountNumber: parsed.accountNumber,
        balance,
        balanceSantim,
        extractedBalance: balance,
        rawMessage: msg.body || '',
        timestamp: msg.ts || Date.now(),
        date: parsed.date || new Date(msg.ts || Date.now()).toISOString(),
        syncStatus: status,
        serverIgnored,
        serverIgnoredReason,
        retryCount: msg.tries || 0,
        errorMessage: msg.err || (msg.code && msg.code !== 200 ? `HTTP ${msg.code}` : undefined),
        serverResponse: msg.code ? `HTTP ${msg.code}` : undefined,
        serverResult: serverResultObj,
        source: 'sms',
        isDuplicate: false,
        note,
        tag,
        suggestedTag,
        isHidden,
        isOverridden,
        aiParsed,
      };
    });

    parsedList.sort((a, b) => a.timestamp - b.timestamp);

    const seenRefs = new Set<string>();
    for (const p of parsedList) {
      if (p.reference && !p.reference.startsWith('SMS-')) {
        const cleanRef = p.reference.toUpperCase().trim();
        if (seenRefs.has(cleanRef)) {
          p.isDuplicate = true;
        } else {
          seenRefs.add(cleanRef);
          p.isDuplicate = false;
        }
      }
    }

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

  /**
   * Sync a locally-saved SMS record to the user's configured webhook server via `/api/sync/forward`.
   * Preserves local parsing even if the server replies `Ignored` or errors.
   */
  public async syncPaymentToServer(paymentId: string): Promise<{ ok: boolean; status: string; message: string }> {
    const [settings, messages] = await Promise.all([this.getSettings(), getNativeMessages()]);
    const msg = messages.find(m => String(m.id) === String(paymentId));
    if (!msg) return { ok: false, status: 'Error', message: 'Record not found in local storage.' };

    const targetUrl = (settings.serverUrl || '').trim();
    if (!targetUrl) {
      return {
        ok: false,
        status: 'NoServer',
        message: 'No webhook server URL configured in Settings. Saved locally.',
      };
    }

    try {
      const response = await fetch('/api/sync/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          serverUrl: targetUrl,
          method: settings.httpMethod || 'GET',
          token: settings.secretKey || '',
          sender: msg.sender || '',
          message: msg.body || '',
          ts: msg.ts || Date.now(),
        }),
      });
      const data = await response.json();
      const httpCode = Number(data?.httpCode || response.status || 0);
      const parsedReply = data?.parsed || {};
      const replyStatus = parsedReply.status || data?.status || (response.ok && data?.ok ? 'Saved' : 'Unknown');
      const reason = parsedReply.reason || data?.reason || data?.error || '';
      const ref = parsedReply.ref || data?.ref || '';
      const rawBody = typeof data?.raw === 'string' ? data.raw : JSON.stringify(data);

      await saveNativeServerResult(msg.id, httpCode, replyStatus, ref, reason, rawBody);

      if (data?.ok) {
        await updateNativeMessageStatus(msg.id, 'sent', httpCode || 200, null);
        return {
          ok: true,
          status: replyStatus,
          message:
            replyStatus === 'Ignored'
              ? `Server replied Ignored (${reason || 'unsupported by server'}); local record preserved.`
              : `Synced to server (${replyStatus}${ref ? ` · ${ref}` : ''}).`,
        };
      } else {
        const errMsg = data?.error || `HTTP ${httpCode || 500}`;
        await updateNativeMessageStatus(msg.id, 'failed', httpCode || 500, errMsg);
        return { ok: false, status: 'Failed', message: errMsg };
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Network sync failed';
      await updateNativeMessageStatus(msg.id, 'failed', 0, errMsg);
      return { ok: false, status: 'Failed', message: errMsg };
    }
  }

  public async syncAllLocalToServer(): Promise<{ synced: number; ignored: number; failed: number; error?: string }> {
    const settings = await this.getSettings();
    if (!settings.serverUrl?.trim()) {
      return { synced: 0, ignored: 0, failed: 0, error: 'Server webhook URL is not configured in Settings.' };
    }
    const payments = await this.getAllPayments(true);
    const unsynced = payments.filter(p => p.syncStatus === 'local' || p.syncStatus === 'pending' || p.syncStatus === 'failed');
    let synced = 0;
    let ignored = 0;
    let failed = 0;

    for (const p of unsynced) {
      const res = await this.syncPaymentToServer(p.id);
      if (res.ok) {
        if (res.status === 'Ignored') ignored++;
        else synced++;
      } else {
        failed++;
      }
    }
    return { synced, ignored, failed };
  }

  /**
   * Invoke server-side Gemini AI (`/api/ai/parse-sms`) to extract structured fields for an unrecognized SMS
   */
  public async parseUnknownSmsWithAi(paymentId: string): Promise<{ ok: boolean; error?: string }> {
    const [settings, messages] = await Promise.all([this.getSettings(), getNativeMessages()]);
    const msg = messages.find(m => String(m.id) === String(paymentId));
    if (!msg) return { ok: false, error: 'Message not found' };

    try {
      const resp = await fetch('/api/ai/parse-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: msg.sender,
          message: msg.body,
          model: settings.aiModel || 'gemini-4-hydrogen',
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok || !data?.parsed) {
        return { ok: false, error: data?.error || 'AI parsing unavailable' };
      }
      saveAiParsedCacheEntry(String(msg.id), {
        ...data.parsed,
        updatedAt: Date.now(),
      });
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'AI request failed' };
    }
  }

  public async analyzeRawSmsWithAi(sender: string, message: string): Promise<{ ok: boolean; parsed?: any; error?: string }> {
    const settings = await this.getSettings();
    try {
      const resp = await fetch('/api/ai/parse-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender,
          message,
          model: settings.aiModel || 'gemini-4-hydrogen',
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok || !data?.parsed) {
        return { ok: false, error: data?.error || 'AI parsing unavailable' };
      }
      return { ok: true, parsed: data.parsed };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'AI request failed' };
    }
  }

  public getHiddenBankIds(): string[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.HIDDEN_BANKS);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) return arr;
      }
    } catch {}
    return [];
  }

  public isBankHidden(bankId: string): boolean {
    return this.getHiddenBankIds().includes(bankId);
  }

  public async toggleBankHidden(bankId: string): Promise<boolean> {
    const list = this.getHiddenBankIds();
    const index = list.indexOf(bankId);
    let isHiddenNow = false;
    if (index >= 0) {
      list.splice(index, 1);
      isHiddenNow = false;
    } else {
      list.push(bankId);
      isHiddenNow = true;
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.HIDDEN_BANKS, JSON.stringify(list));
    } catch {}
    return isHiddenNow;
  }

  public getArchivedBankIds(): string[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.ARCHIVED_ACCOUNTS);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) return arr;
      }
    } catch {}
    return [];
  }

  public async archiveAccount(id: string): Promise<void> {
    const list = this.getArchivedBankIds();
    if (!list.includes(id)) {
      list.push(id);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEYS.ARCHIVED_ACCOUNTS, JSON.stringify(list));
      } catch {}
    }

    const accounts = await this.getAccounts(true);
    const target = accounts.find(a => a.id === id);
    if (target && target.senderIds && target.senderIds.length > 0) {
      const settings = await this.getSettings();
      const sendersToRemove = new Set(target.senderIds.map(s => s.toLowerCase().trim()));
      const updatedSenders = settings.allowedSenders.filter(s => !sendersToRemove.has(s.toLowerCase().trim()));
      await this.saveSettings({ allowedSenders: updatedSenders });
    }
  }

  public async restoreAccount(id: string): Promise<void> {
    let list = this.getArchivedBankIds();
    list = list.filter(item => item !== id);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.ARCHIVED_ACCOUNTS, JSON.stringify(list));
    } catch {}

    const accounts = await this.getAccounts(true);
    const target = accounts.find(a => a.id === id);
    if (target && target.senderIds && target.senderIds.length > 0) {
      const settings = await this.getSettings();
      const existing = new Set(settings.allowedSenders.map(s => s.toLowerCase().trim()));
      const toAdd = target.senderIds.filter(s => !existing.has(s.toLowerCase().trim()));
      if (toAdd.length > 0) {
        await this.saveSettings({ allowedSenders: [...settings.allowedSenders, ...toAdd] });
      }
    }
  }

  public async reorderAccounts(accountIds: string[]): Promise<void> {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.ACCOUNT_ORDER, JSON.stringify(accountIds));
    } catch {}
  }

  public async saveAccount(account: Account): Promise<void> {
    if (account.openingBalance !== undefined) {
      await this.saveOpeningBalance(account.bank, account.openingBalance);
    }

    let userAdded: Account[] = [];
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.CUSTOM_ACCOUNTS);
      if (stored) userAdded = JSON.parse(stored);
    } catch {}

    const index = userAdded.findIndex(a => a.id === account.id);
    if (index >= 0) {
      userAdded[index] = { ...userAdded[index], ...account };
    } else {
      userAdded.push(account);
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.CUSTOM_ACCOUNTS, JSON.stringify(userAdded));
    } catch {}

    if (account.senderIds && account.senderIds.length > 0) {
      for (const s of account.senderIds) {
        const cleanS = s.trim();
        if (cleanS) await this.saveSenderBankMapping(cleanS, account.bank);
      }
      const settings = await this.getSettings();
      const existing = new Set(settings.allowedSenders.map(s => s.toLowerCase().trim()));
      const toAdd = account.senderIds.filter(s => s.trim() && !existing.has(s.toLowerCase().trim()));
      if (toAdd.length > 0) {
        await this.saveSettings({ allowedSenders: [...settings.allowedSenders, ...toAdd] });
      }
    }
  }

  public async getAccounts(includeArchived: boolean = false): Promise<Account[]> {
    const [payments, openingBalances] = await Promise.all([
      this.getAllPayments(false),
      this.getOpeningBalances(),
    ]);

    let userAdded: Account[] = [];
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.CUSTOM_ACCOUNTS);
      if (stored) userAdded = JSON.parse(stored);
    } catch {}

    const baseMap = new Map<string, any>();
    for (const d of DEFAULT_BANK_ACCOUNTS) {
      baseMap.set(d.id, { ...d });
    }
    for (const u of userAdded) {
      baseMap.set(u.id, { ...(baseMap.get(u.id) || {}), ...u });
    }

    let baseAccounts = Array.from(baseMap.values());

    const archivedIds = new Set(this.getArchivedBankIds());
    if (!includeArchived) {
      baseAccounts = baseAccounts.filter(a => !archivedIds.has(a.id));
    } else {
      baseAccounts = baseAccounts.map(a => ({
        ...a,
        isArchived: archivedIds.has(a.id),
      }));
    }

    try {
      const storedOrder = localStorage.getItem(LOCAL_STORAGE_KEYS.ACCOUNT_ORDER);
      if (storedOrder) {
        const orderArr: string[] = JSON.parse(storedOrder);
        const orderMap = new Map<string, number>();
        orderArr.forEach((id, idx) => orderMap.set(id, idx));
        baseAccounts.sort((a, b) => {
          const aIdx = orderMap.has(a.id) ? orderMap.get(a.id)! : 999;
          const bIdx = orderMap.has(b.id) ? orderMap.get(b.id)! : 999;
          return aIdx - bIdx;
        });
      }
    } catch {}

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return baseAccounts.map(base => {
      const bankNorm = base.bank.trim().toUpperCase();
      const bankPayments = payments.filter(p => {
        const pBankNorm = p.bank.trim().toUpperCase();
        return pBankNorm === bankNorm || (bankNorm === 'CBE' && pBankNorm.includes('COMMERCIAL BANK'));
      });

      const nonDuplicatePayments = bankPayments.filter(p => !p.isDuplicate && p.category !== 'alert');

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

      const sortedByTimeDesc = [...bankPayments].sort((a, b) => b.timestamp - a.timestamp);
      const latestSmsWithBalance = sortedByTimeDesc.find(
        p => p.extractedBalance !== undefined && p.extractedBalance !== null && p.category !== 'alert'
      );

      let currentBalance = 0;
      let hasSyncedBalance = false;
      const openingBal = openingBalances[base.bank] ?? openingBalances[base.name];

      if (latestSmsWithBalance && latestSmsWithBalance.extractedBalance !== undefined) {
        currentBalance = latestSmsWithBalance.extractedBalance;
        hasSyncedBalance = true;
      } else if (openingBal !== undefined) {
        const openCents = Math.round(openingBal * 100);
        currentBalance = (openCents + totalReceivedCents - totalSentCents) / 100;
        hasSyncedBalance = true;
      } else {
        currentBalance = (totalReceivedCents - totalSentCents) / 100;
        hasSyncedBalance = false;
      }

      return {
        ...base,
        isArchived: archivedIds.has(base.id),
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

    if (newAccount.senderIds && newAccount.senderIds.length > 0) {
      for (const s of newAccount.senderIds) {
        if (s.trim()) await this.saveSenderBankMapping(s.trim(), newAccount.bank);
      }
      const settings = await this.getSettings();
      const existing = new Set(settings.allowedSenders.map(s => s.toLowerCase().trim()));
      const toAdd = newAccount.senderIds.filter(s => s.trim() && !existing.has(s.toLowerCase().trim()));
      if (toAdd.length > 0) {
        await this.saveSettings({ allowedSenders: [...settings.allowedSenders, ...toAdd] });
      }
    }
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

  public async deleteWithdrawal(id: string): Promise<void> {
    const withdrawals = await this.getAllWithdrawals();
    const filtered = withdrawals.filter(w => w.id !== id);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.WITHDRAWALS, JSON.stringify(filtered));
    } catch {}
  }

  public async getMonthlyBudgets(): Promise<MonthlyBudget[]> {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.BUDGETS);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  }

  public async getMonthlyBudget(monthStr?: string): Promise<MonthlyBudget> {
    const targetMonth = monthStr || new Date().toISOString().slice(0, 7);
    const budgets = await this.getMonthlyBudgets();
    const existing = budgets.find(b => b.month === targetMonth);
    if (existing) return existing;

    return {
      id: `budget-${targetMonth}`,
      month: targetMonth,
      overallLimit: 50000,
      categoryLimits: {
        Transfer: 25000,
        Supplies: 12000,
        Rent: 8000,
        Airtime: 3000,
        Personal: 2000,
      },
      updatedAt: Date.now(),
    };
  }

  public async saveMonthlyBudget(budget: MonthlyBudget): Promise<void> {
    const list = await this.getMonthlyBudgets();
    const filtered = list.filter(b => b.month !== budget.month);
    filtered.push({ ...budget, updatedAt: Date.now() });
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.BUDGETS, JSON.stringify(filtered));
    } catch {}
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
    const header = [
      'Date',
      'Time',
      'Timestamp (ms)',
      'Bank',
      'Sender',
      'Direction',
      'Amount (ETB)',
      'Fee (ETB)',
      'Counterparty',
      'Category',
      'Tag',
      'Note',
      'Ref/FT',
      'Receipt URL',
      'Balance',
      'Sync Status',
      'Server Ignored',
      'Raw SMS',
    ];

    const rows = list.map(p => {
      const d = new Date(p.timestamp);
      const direction = p.category === 'alert' ? 'Alert' : p.type === 'received' ? 'Received' : p.type === 'sent' ? 'Sent' : 'Unknown';
      const ref = p.ftNumber || p.v2Code || p.reference || '';
      const balanceStr = p.balance !== undefined ? p.balance.toFixed(2) : '';
      const feeStr = p.fee !== undefined ? p.fee.toFixed(2) : '';
      const serverStatus = p.serverResult?.status || (p.syncStatus === 'sent' ? 'Synced' : p.syncStatus === 'local' ? 'Local' : p.syncStatus);
      const category = p.category ? p.category.toUpperCase() : 'TRANSFER';

      return [
        `"${d.toISOString().slice(0, 10)}"`,
        `"${d.toTimeString().slice(0, 8)}"`,
        p.timestamp,
        `"${p.bank}"`,
        `"${p.senderAddress || ''}"`,
        `"${direction}"`,
        p.amount.toFixed(2),
        `"${feeStr}"`,
        `"${(p.counterparty || '').replace(/"/g, '""')}"`,
        `"${category}"`,
        `"${(p.tag || '').replace(/"/g, '""')}"`,
        `"${(p.note || '').replace(/"/g, '""')}"`,
        `"${ref.replace(/"/g, '""')}"`,
        `"${(p.receiptUrl || '').replace(/"/g, '""')}"`,
        `"${balanceStr}"`,
        `"${serverStatus}"`,
        p.serverIgnored ? 'YES' : 'NO',
        `"${p.rawMessage.replace(/"/g, '""')}"`,
      ].join(',');
    });

    return '\uFEFF' + [header.join(','), ...rows].join('\r\n');
  }

  public async exportFullBackupJson(includeSecretKey: boolean = false): Promise<string> {
    const [
      messages,
      serverResults,
      openingBalances,
      overrides,
      senderBankMap,
      counterpartyTags,
      withdrawals,
      settings,
      allPayments,
      budgets,
    ] = await Promise.all([
      getNativeMessages(),
      getNativeServerResults(),
      getNativeOpeningBalances(),
      getNativeSmsOverrides(),
      getNativeSenderBankMap(),
      getNativeCounterpartyTags(),
      this.getAllWithdrawals(),
      this.getSettings(),
      this.getAllPayments(true),
      this.getMonthlyBudgets(),
    ]);

    let customAccounts: any[] = [];
    let hiddenBanks: string[] = [];
    let archivedAccounts: string[] = [];
    let accountOrder: string[] = [];
    try {
      const ca = localStorage.getItem(LOCAL_STORAGE_KEYS.CUSTOM_ACCOUNTS);
      if (ca) customAccounts = JSON.parse(ca);
      hiddenBanks = this.getHiddenBankIds();
      archivedAccounts = this.getArchivedBankIds();
      const ao = localStorage.getItem(LOCAL_STORAGE_KEYS.ACCOUNT_ORDER);
      if (ao) accountOrder = JSON.parse(ao);
    } catch {}

    let totalReceivedCents = 0;
    let totalSentCents = 0;
    for (const p of allPayments) {
      if (p.isDuplicate || p.isHidden || p.category === 'alert') continue;
      const c = p.amountCents ?? Math.round(p.amount * 100);
      if (p.type === 'received') totalReceivedCents += c;
      else if (p.type === 'sent') totalSentCents += c;
    }

    const now = new Date();
    const backup = {
      app: 'Ak Finance',
      version: 5,
      appVersion: '3.0.0',
      exportedAt: now.toISOString(),
      exportedAtISO: now.toISOString(),
      exportedAtLocal: now.toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'long',
      }),
      exportedTimestamp: now.getTime(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Addis_Ababa',
      deviceTimeFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      financialSummary: {
        totalTransactions: allPayments.length,
        nonDuplicateCount: allPayments.filter(p => !p.isDuplicate).length,
        totalReceivedETB: (totalReceivedCents / 100).toFixed(2),
        totalSentETB: (totalSentCents / 100).toFixed(2),
        netCashETB: ((totalReceivedCents - totalSentCents) / 100).toFixed(2),
        currency: 'ETB',
        activeBanksCount: Object.keys(openingBalances).length || 5,
      },
      stats: {
        paymentsCount: messages.length || allPayments.length,
        banksCount: customAccounts.length + 5,
        tagsCount: Object.keys(counterpartyTags).length,
        withdrawalsCount: withdrawals.length,
        budgetsCount: budgets.length,
      },
      settings: {
        ...settings,
        secretKey: includeSecretKey ? settings.secretKey || '' : '',
      },
      payments: allPayments.map(p => ({
        id: p.id,
        sender: p.senderAddress,
        body: p.rawMessage,
        timestamp: p.timestamp,
        dateFormatted: p.date,
        bank: p.bank,
        direction: p.type,
        amount: p.amount,
        amountFormatted: p.amount.toFixed(2),
        fee: p.fee,
        currency: p.currency || 'ETB',
        counterparty: p.counterparty || '',
        category: p.category,
        reference: p.reference,
        ftNumber: p.ftNumber,
        v2Code: p.v2Code,
        receiptUrl: p.receiptUrl,
        balance: p.balance,
        extractedBalance: p.extractedBalance,
        syncStatus: p.syncStatus,
        serverStatus: p.serverResult?.status || (p.syncStatus === 'sent' ? 'Saved' : p.syncStatus === 'local' ? 'Local' : 'Pending'),
        serverIgnored: Boolean(p.serverIgnored),
        serverResult: p.serverResult || null,
        tag: p.tag || '',
        note: p.note || '',
        isDuplicate: Boolean(p.isDuplicate),
        isHidden: Boolean(p.isHidden),
        isOverridden: Boolean(p.isOverridden),
      })),
      messages,
      serverResults,
      openingBalances,
      overrides,
      senderBankMap,
      counterpartyTags,
      customAccounts,
      withdrawals,
      budgets,
      hiddenBanks,
      archivedAccounts,
      accountOrder,
      uiPrefs: this.getUiPrefs(),
    };

    return JSON.stringify(backup, null, 2);
  }

  public inspectBackupJson(jsonString: string): {
    valid: boolean;
    version?: number;
    paymentsCount: number;
    sentCount: number;
    localCount: number;
    pendingOrFailedCount: number;
    serverIgnoredCount: number;
    banksCount: number;
    tagsCount: number;
    hasSecretKey: boolean;
    error?: string;
    data?: any;
  } {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        return {
          valid: false,
          paymentsCount: 0,
          sentCount: 0,
          localCount: 0,
          pendingOrFailedCount: 0,
          serverIgnoredCount: 0,
          banksCount: 0,
          tagsCount: 0,
          hasSecretKey: false,
          error: 'File is not a valid JSON object.',
        };
      }

      const version = data.version || 1;
      if (typeof version === 'number' && version > 5) {
        return {
          valid: false,
          version,
          paymentsCount: 0,
          sentCount: 0,
          localCount: 0,
          pendingOrFailedCount: 0,
          serverIgnoredCount: 0,
          banksCount: 0,
          tagsCount: 0,
          hasSecretKey: false,
          error: `Unsupported backup version (${version}). Please update Ak Finance first.`,
        };
      }

      const rawRecords: any[] =
        Array.isArray(data.messages) && data.messages.length > 0
          ? data.messages
          : Array.isArray(data.payments)
            ? data.payments
            : [];

      const paymentsCount = rawRecords.length;
      let sentCount = 0;
      let localCount = 0;
      let pendingOrFailedCount = 0;

      for (const item of rawRecords) {
        const st = item?.status || item?.syncStatus || 'local';
        if (st === 'sent') sentCount++;
        else if (st === 'local') localCount++;
        else if (st === 'pending' || st === 'failed') pendingOrFailedCount++;
        else localCount++;
      }

      let serverIgnoredCount = 0;
      if (data.serverResults && typeof data.serverResults === 'object') {
        for (const sr of Object.values(data.serverResults as Record<string, any>)) {
          if (!sr) continue;
          if (
            sr.status === 'Ignored' ||
            (sr.reason && /not\s*a\s*payment|not\s*financial|ignored|unsupported/i.test(String(sr.reason)))
          ) {
            serverIgnoredCount++;
          }
        }
      } else if (Array.isArray(data.payments)) {
        serverIgnoredCount = data.payments.filter(
          (p: any) => p?.serverIgnored || p?.serverResult?.status === 'Ignored'
        ).length;
      }

      const banksCount =
        data.openingBalances && typeof data.openingBalances === 'object'
          ? Object.keys(data.openingBalances).length
          : data.senderBankMap
            ? Object.keys(data.senderBankMap).length
            : 5;
      const tagsCount =
        data.counterpartyTags && typeof data.counterpartyTags === 'object'
          ? Object.keys(data.counterpartyTags).length
          : 0;
      const hasSecretKey = Boolean(data.settings && data.settings.secretKey && data.settings.secretKey.trim().length > 0);

      return {
        valid: true,
        version,
        paymentsCount,
        sentCount,
        localCount,
        pendingOrFailedCount,
        serverIgnoredCount,
        banksCount,
        tagsCount,
        hasSecretKey,
        data,
      };
    } catch (e: any) {
      return {
        valid: false,
        paymentsCount: 0,
        sentCount: 0,
        localCount: 0,
        pendingOrFailedCount: 0,
        serverIgnoredCount: 0,
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
  ): Promise<{ success: boolean; count: number; localCount: number; banksCount: number; tagsCount: number; error?: string }> {
    const inspection = this.inspectBackupJson(jsonString);
    if (!inspection.valid || !inspection.data) {
      return {
        success: false,
        count: 0,
        localCount: 0,
        banksCount: 0,
        tagsCount: 0,
        error: inspection.error || 'Invalid backup file.',
      };
    }

    const data = inspection.data;
    let restoredPaymentsCount = 0;

    try {
      // Safety snapshot before mutating anything
      try {
        const safetySnapshot = await this.exportFullBackupJson(true);
        localStorage.setItem('ak_finance_safety_snapshot', safetySnapshot);
        localStorage.setItem('ak_finance_safety_snapshot_time', new Date().toISOString());
      } catch {}

      if (mode === 'replace') {
        await clearAllNativeState();
        try {
          localStorage.removeItem(LOCAL_STORAGE_KEYS.CUSTOM_ACCOUNTS);
          localStorage.removeItem(LOCAL_STORAGE_KEYS.HIDDEN_BANKS);
          localStorage.removeItem(LOCAL_STORAGE_KEYS.ARCHIVED_ACCOUNTS);
          localStorage.removeItem(LOCAL_STORAGE_KEYS.ACCOUNT_ORDER);
          localStorage.removeItem(LOCAL_STORAGE_KEYS.WITHDRAWALS);
          localStorage.removeItem(LOCAL_STORAGE_KEYS.BUDGETS);
        } catch {}
      }

      // 1. Messages FIRST (preserve exact original IDs, timestamps & statuses without altering local/sent)
      const msgSource: Array<{
        id?: number;
        sender: string;
        body: string;
        ts?: number;
        status?: 'sent' | 'pending' | 'failed' | 'local';
        tries?: number;
        err?: string | null;
        code?: number;
      }> =
        Array.isArray(data.messages) && data.messages.length > 0
          ? data.messages
          : Array.isArray(data.payments) && data.payments.length > 0
            ? data.payments.map((p: any) => ({
                id: Number(p.id) || undefined,
                sender: p.sender || 'UNKNOWN',
                body: p.body || p.rawMessage || '',
                ts: p.timestamp || undefined,
                status: p.syncStatus || 'local',
              }))
            : [];

      let idRemap: Record<string, number> = {};
      if (msgSource.length > 0) {
        const batchRes = await importNativeMessagesBatch(msgSource, mode);
        restoredPaymentsCount = batchRes.importedCount;
        idRemap = batchRes.idRemap;
      }

      // 2. Server Results (mapped with idRemap so each result stays linked to its exact message)
      if (data.serverResults && typeof data.serverResults === 'object') {
        await saveNativeServerResultsBatch(data.serverResults, mode, idRemap);
      } else if (Array.isArray(data.payments)) {
        const fallbackResults: Record<string, any> = {};
        for (const p of data.payments) {
          if (p?.id && p?.serverResult) {
            fallbackResults[String(p.id)] = { ...p.serverResult, smsId: Number(p.id) || p.id };
          }
        }
        if (Object.keys(fallbackResults).length > 0) {
          await saveNativeServerResultsBatch(fallbackResults, mode, idRemap);
        }
      }

      // 3. Overrides (custom counterparties, tags, notes, hidden flags, categories, references)
      if (data.overrides && typeof data.overrides === 'object') {
        await saveNativeSmsOverridesBatch(data.overrides, mode, idRemap);
      } else if (Array.isArray(data.payments)) {
        const fallbackOverrides: Record<string, any> = {};
        for (const p of data.payments) {
          if (p?.id && (p.isOverridden || p.isHidden || p.tag || p.note)) {
            fallbackOverrides[String(p.id)] = {
              counterparty: p.counterparty ?? null,
              direction: p.direction ?? null,
              note: p.note || '',
              tag: p.tag || '',
              isHidden: !!p.isHidden,
              reference: p.reference,
              category: p.category,
            };
          }
        }
        if (Object.keys(fallbackOverrides).length > 0) {
          await saveNativeSmsOverridesBatch(fallbackOverrides, mode, idRemap);
        }
      }

      // 4. Opening Balances, Sender Bank Map & Counterparty Tags
      if (data.openingBalances && typeof data.openingBalances === 'object') {
        await saveNativeOpeningBalancesBatch(data.openingBalances, mode);
      }
      if (data.senderBankMap && typeof data.senderBankMap === 'object') {
        await saveNativeSenderBankMapBatch(data.senderBankMap, mode);
      }
      if (data.counterpartyTags && typeof data.counterpartyTags === 'object') {
        await saveNativeCounterpartyTagsBatch(data.counterpartyTags, mode);
      }

      // 5. UI Prefs & Settings
      if (data.uiPrefs && typeof data.uiPrefs === 'object') {
        const existingUi = this.getUiPrefs();
        const mergedUi = mode === 'replace' ? { ...data.uiPrefs } : { ...data.uiPrefs, ...existingUi };
        if (mergedUi.aiModel) mergedUi.aiModel = resolveAllowedAiModel(mergedUi.aiModel);
        this.saveUiPrefs(mergedUi);
      }

      const senderMapKeys =
        data.senderBankMap && typeof data.senderBankMap === 'object' ? Object.keys(data.senderBankMap) : [];
      const currentSettings = await this.getSettings();
      const incomingSettings = data.settings && typeof data.settings === 'object' ? data.settings : {};

      // CRITICAL: Never auto-sync imported local SMS records to the server.
      // Preserve webhook URL/method/senders so the user can manually choose and sync records,
      // while forcing mode: 'local' on import.
      const settingsToSave: Partial<AppSettings> = {
        serverUrl: incomingSettings.serverUrl || currentSettings.serverUrl,
        httpMethod: incomingSettings.httpMethod || currentSettings.httpMethod,
        retryIntervalSeconds: incomingSettings.retryIntervalSeconds || currentSettings.retryIntervalSeconds,
        mode: 'local',
        allowedSenders: Array.from(
          new Set([
            ...(currentSettings.allowedSenders || []),
            ...(Array.isArray(incomingSettings.allowedSenders) ? incomingSettings.allowedSenders : []),
            ...senderMapKeys,
          ])
        ),
        aiEnabled: incomingSettings.aiEnabled ?? currentSettings.aiEnabled,
        aiAutoParseUnknown: incomingSettings.aiAutoParseUnknown ?? currentSettings.aiAutoParseUnknown,
        aiModel: resolveAllowedAiModel(incomingSettings.aiModel || currentSettings.aiModel),
      };

      if (incomingSettings.secretKey && String(incomingSettings.secretKey).trim().length > 0) {
        settingsToSave.secretKey = incomingSettings.secretKey;
      } else if (mode === 'replace') {
        settingsToSave.secretKey = currentSettings.secretKey;
      }

      await this.saveSettings(settingsToSave);
      try {
        localStorage.removeItem('ak_settings_draft_v3');
      } catch {}

      // 6. Custom Accounts, Hidden Banks, Archived Accounts, Account Order
      if (Array.isArray(data.customAccounts)) {
        try {
          if (mode === 'replace') {
            localStorage.setItem(LOCAL_STORAGE_KEYS.CUSTOM_ACCOUNTS, JSON.stringify(data.customAccounts));
          } else {
            const existingRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.CUSTOM_ACCOUNTS);
            const existing: Account[] = existingRaw ? JSON.parse(existingRaw) : [];
            const accMap = new Map<string, Account>();
            for (const a of existing) accMap.set(a.id, a);
            for (const a of data.customAccounts) {
              if (a && a.id && !accMap.has(a.id)) accMap.set(a.id, a);
            }
            localStorage.setItem(LOCAL_STORAGE_KEYS.CUSTOM_ACCOUNTS, JSON.stringify(Array.from(accMap.values())));
          }
        } catch {}
      }

      if (Array.isArray(data.hiddenBanks)) {
        try {
          const merged =
            mode === 'replace' ? data.hiddenBanks : Array.from(new Set([...this.getHiddenBankIds(), ...data.hiddenBanks]));
          localStorage.setItem(LOCAL_STORAGE_KEYS.HIDDEN_BANKS, JSON.stringify(merged));
        } catch {}
      }

      if (Array.isArray(data.archivedAccounts)) {
        try {
          const merged =
            mode === 'replace'
              ? data.archivedAccounts
              : Array.from(new Set([...this.getArchivedBankIds(), ...data.archivedAccounts]));
          localStorage.setItem(LOCAL_STORAGE_KEYS.ARCHIVED_ACCOUNTS, JSON.stringify(merged));
        } catch {}
      }

      if (Array.isArray(data.accountOrder)) {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEYS.ACCOUNT_ORDER, JSON.stringify(data.accountOrder));
        } catch {}
      }

      // 7. Withdrawals (merge or replace without duplicates)
      if (Array.isArray(data.withdrawals)) {
        try {
          if (mode === 'replace') {
            localStorage.setItem(LOCAL_STORAGE_KEYS.WITHDRAWALS, JSON.stringify(data.withdrawals));
          } else {
            const currentW = await this.getAllWithdrawals();
            const wMap = new Map<string, WithdrawalRecord>();
            for (const w of currentW) wMap.set(w.id, w);
            for (const w of data.withdrawals) {
              if (w && w.id && !wMap.has(w.id)) wMap.set(w.id, w);
            }
            localStorage.setItem(LOCAL_STORAGE_KEYS.WITHDRAWALS, JSON.stringify(Array.from(wMap.values())));
          }
        } catch {}
      }

      // 8. Monthly Budgets
      if (Array.isArray(data.budgets)) {
        try {
          const currentBudgets = await this.getMonthlyBudgets();
          const budgetMap = new Map<string, MonthlyBudget>();
          if (mode !== 'replace') {
            for (const b of currentBudgets) budgetMap.set(b.month, b);
          }
          for (const b of data.budgets) {
            if (b && b.month && typeof b.overallLimit === 'number') {
              if (mode === 'replace' || !budgetMap.has(b.month)) {
                budgetMap.set(b.month, b);
              }
            }
          }
          localStorage.setItem(LOCAL_STORAGE_KEYS.BUDGETS, JSON.stringify(Array.from(budgetMap.values())));
        } catch {}
      }

      return {
        success: true,
        count: restoredPaymentsCount || inspection.paymentsCount,
        localCount: inspection.localCount,
        banksCount: inspection.banksCount,
        tagsCount: inspection.tagsCount,
      };
    } catch (e: any) {
      return {
        success: false,
        count: 0,
        localCount: 0,
        banksCount: 0,
        tagsCount: 0,
        error: e?.message || 'Failed restoring backup data',
      };
    }
  }
}

export const db = new DatabaseService();
