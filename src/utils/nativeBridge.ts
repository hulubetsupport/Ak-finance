/**
 * Native Bridge Interface for Ak Finance
 * Bridges Capacitor Web layer with native Android SharedPreferences, SQLite (ejeta.db), and local browser storage
 */
import { normalizeEpochTimestamp } from './csvImport.ts';

export interface NativeSettings {
  url: string;
  token: string;
  method: 'GET' | 'POST';
  interval: number;
  mode: 'server' | 'local';
  senders: string;
}

export interface NativeSmsMessage {
  id: number;
  sender: string;
  body: string;
  ts: number;
  status: 'sent' | 'pending' | 'failed' | 'local';
  tries: number;
  err: string | null;
  code: number;
  nextRetryAt?: number;
  authError?: boolean;
}

export interface NativeStatus {
  smsGranted: boolean;
  lastSmsAt: number;
  lastSmsSender: string;
  lastCode: number;
  lastCodeAt: number;
  pending: number;
}

export interface StoragePersistenceStatus {
  supported: boolean;
  persisted: boolean;
  usageBytes?: number;
  quotaBytes?: number;
}

export interface AiParsedCacheEntry {
  bank?: string;
  type?: 'received' | 'sent' | 'unknown';
  category?: string;
  amount?: number;
  fee?: number;
  balance?: number;
  counterparty?: string;
  reference?: string;
  receiptUrl?: string;
  updatedAt: number;
}

export const isAndroidNative = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(window as any).AndroidBridge?.isNative?.();
};

export const exitNativeApp = (): void => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.exitApp) {
    (window as any).AndroidBridge.exitApp();
  }
};

const WEB_STORAGE_KEYS = {
  SETTINGS: 'ak_native_settings_sim',
  MESSAGES: 'ak_native_messages_sim',
  STATUS: 'ak_native_status_sim',
  AI_PARSED: 'ak_ai_parsed_cache_v1',
};

const DEFAULT_SENDERS_CSV =
  'CBE,127,Telebirr,AwashBank,Awash,Dashen,DashenBank,BOA,Abyssinia,Zemen,Siinqee,eBirr,ZamZam,Bunna,Wegagen,CBEBirr,M-PESA,AbayBank,NibBank,Hibret,CoopBank,Tsedey';

const DEFAULT_SETTINGS: NativeSettings = {
  url: 'https://verifiy-server.app.aletcloud.com',
  token: '',
  method: 'GET',
  interval: 15,
  mode: 'local',
  senders: DEFAULT_SENDERS_CSV,
};

export const getNativeSettings = async (): Promise<NativeSettings> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.getSettings) {
    try {
      const raw = (window as any).AndroidBridge.getSettings();
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return {
        url: parsed.url || '',
        token: parsed.token || '',
        method: parsed.method === 'POST' ? 'POST' : 'GET',
        interval: Number(parsed.interval) || 15,
        mode: parsed.mode === 'server' ? 'server' : 'local',
        senders: parsed.senders || DEFAULT_SENDERS_CSV,
      };
    } catch (e) {
      console.warn('Failed parsing native settings:', e);
    }
  }

  try {
    const raw = localStorage.getItem(WEB_STORAGE_KEYS.SETTINGS);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
};

export const saveNativeSettings = async (settings: Partial<NativeSettings>): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.saveSettings) {
    try {
      const current = await getNativeSettings();
      const merged = { ...current, ...settings };
      return !!(window as any).AndroidBridge.saveSettings(JSON.stringify(merged));
    } catch (e) {
      console.error('Error saving native settings:', e);
      return false;
    }
  }

  try {
    const current = await getNativeSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(WEB_STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
    return true;
  } catch {
    return false;
  }
};

export const getNativeMessages = async (): Promise<NativeSmsMessage[]> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.getMessages) {
    try {
      const raw = (window as any).AndroidBridge.getMessages();
      const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(list)) return list;
    } catch (e) {
      console.warn('Failed reading native messages:', e);
    }
  }

  try {
    const raw = localStorage.getItem(WEB_STORAGE_KEYS.MESSAGES);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch {}
  return [];
};

export const retryNow = async (): Promise<void> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.retryNow) {
    (window as any).AndroidBridge.retryNow();
  }
};

export const startKeepAliveService = async (): Promise<void> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.startService) {
    (window as any).AndroidBridge.startService();
  }
};

export const restartForegroundService = startKeepAliveService;

export const checkNativePermissions = async (): Promise<{ smsGranted: boolean; notificationsGranted: boolean }> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.checkPermissions) {
    try {
      const raw = (window as any).AndroidBridge.checkPermissions();
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {}
  }
  return { smsGranted: true, notificationsGranted: true };
};

export const requestNativePermissions = async (): Promise<void> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.requestPermissions) {
    (window as any).AndroidBridge.requestPermissions();
  }
};

export const openAndroidBatterySettings = (): void => {
  if (typeof window === 'undefined') return;
  if ((window as any).AndroidBridge?.openBattery) {
    (window as any).AndroidBridge.openBattery();
  } else if ((window as any).AndroidBridge?.openAppSettings) {
    (window as any).AndroidBridge.openAppSettings();
  }
};

export const openAndroidAppSettings = (): void => {
  if (typeof window === 'undefined') return;
  if ((window as any).AndroidBridge?.openAppSettings) {
    (window as any).AndroidBridge.openAppSettings();
  } else {
    try {
      window.location.href = 'intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;package=com.akfinance.paymentdesk;end';
    } catch {}
  }
};

export const getStoragePersistenceStatus = async (): Promise<StoragePersistenceStatus> => {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return { supported: false, persisted: false };
  }
  try {
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    const estimate = navigator.storage.estimate ? await navigator.storage.estimate() : undefined;
    return {
      supported: true,
      persisted,
      usageBytes: estimate?.usage,
      quotaBytes: estimate?.quota,
    };
  } catch {
    return { supported: false, persisted: false };
  }
};

export const requestPersistentStorage = async (): Promise<StoragePersistenceStatus> => {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return { supported: false, persisted: false };
  }
  try {
    const persisted = navigator.storage.persist
      ? await navigator.storage.persist()
      : navigator.storage.persisted
        ? await navigator.storage.persisted()
        : false;
    const estimate = navigator.storage.estimate ? await navigator.storage.estimate() : undefined;
    return {
      supported: true,
      persisted,
      usageBytes: estimate?.usage,
      quotaBytes: estimate?.quota,
    };
  } catch {
    return { supported: false, persisted: false };
  }
};

export const getNativeStatus = async (): Promise<NativeStatus> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.getStatus) {
    try {
      const raw = (window as any).AndroidBridge.getStatus();
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return {
        smsGranted: !!parsed.smsGranted,
        lastSmsAt: Number(parsed.lastSmsAt) || 0,
        lastSmsSender: parsed.lastSmsSender || '',
        lastCode: Number(parsed.lastCode) || 0,
        lastCodeAt: Number(parsed.lastCodeAt) || 0,
        pending: Number(parsed.pending) || 0,
      };
    } catch (e) {
      console.warn('Failed parsing native status:', e);
    }
  }

  const messages = await getNativeMessages();
  const pendingCount = messages.filter(m => m.status === 'pending' || m.status === 'failed').length;
  const lastMsg = messages[0];
  return {
    smsGranted: true,
    lastSmsAt: lastMsg ? lastMsg.ts : 0,
    lastSmsSender: lastMsg ? lastMsg.sender : '',
    lastCode: lastMsg?.code || 0,
    lastCodeAt: lastMsg ? lastMsg.ts : 0,
    pending: pendingCount,
  };
};

let uniqueIdCounter = 0;
function generateNumericId(): number {
  uniqueIdCounter = (uniqueIdCounter + 1) % 1000;
  return Date.now() * 1000 + uniqueIdCounter;
}

export const insertNativeTestSmsWithId = async (sender: string, body: string): Promise<number | null> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.insertTestSms) {
    const ok = !!(window as any).AndroidBridge.insertTestSms(sender, body);
    return ok ? generateNumericId() : null;
  }

  try {
    const list = await getNativeMessages();
    const settings = await getNativeSettings();
    const isServer = settings.mode === 'server' && Boolean(settings.url?.trim());
    const id = generateNumericId();
    const newMsg: NativeSmsMessage = {
      id,
      sender,
      body,
      ts: Date.now(),
      status: isServer ? 'pending' : 'local',
      tries: 0,
      err: null,
      code: 0,
    };
    list.unshift(newMsg);
    localStorage.setItem(WEB_STORAGE_KEYS.MESSAGES, JSON.stringify(list));
    return id;
  } catch {
    return null;
  }
};

export const insertNativeTestSms = async (sender: string, body: string): Promise<boolean> => {
  const id = await insertNativeTestSmsWithId(sender, body);
  return id !== null;
};

export const insertNativeSmsWithMeta = async (msg: {
  id?: number;
  sender: string;
  body: string;
  ts?: number;
  status?: NativeSmsMessage['status'];
  tries?: number;
  err?: string | null;
  code?: number;
}): Promise<number | null> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.insertTestSms) {
    const ok = !!(window as any).AndroidBridge.insertTestSms(msg.sender, msg.body);
    return ok ? (msg.id || generateNumericId()) : null;
  }

  try {
    const list = await getNativeMessages();
    const id = typeof msg.id === 'number' && !list.some(m => m.id === msg.id) ? msg.id : generateNumericId();
    const entry: NativeSmsMessage = {
      id,
      sender: msg.sender,
      body: msg.body,
      ts: typeof msg.ts === 'number' && msg.ts > 0 ? msg.ts : Date.now(),
      status: msg.status || 'local',
      tries: msg.tries || 0,
      err: msg.err ?? null,
      code: msg.code || 0,
    };
    list.unshift(entry);
    localStorage.setItem(WEB_STORAGE_KEYS.MESSAGES, JSON.stringify(list));
    return id;
  } catch {
    return null;
  }
};

export const updateNativeMessageStatus = async (
  id: number,
  status: NativeSmsMessage['status'],
  code: number,
  err: string | null = null,
  options?: {
    incrementTries?: boolean;
    nextRetryAt?: number;
    authError?: boolean;
  }
): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.updateMessageStatus) {
    try {
      return !!(window as any).AndroidBridge.updateMessageStatus(id, status, code, err || '');
    } catch {}
  }

  try {
    const list = await getNativeMessages();
    const idx = list.findIndex(m => m.id === id);
    if (idx < 0) return false;
    const shouldIncrement = options?.incrementTries !== false;
    list[idx] = {
      ...list[idx],
      status,
      code,
      err,
      tries: shouldIncrement ? (list[idx].tries || 0) + 1 : list[idx].tries || 0,
      nextRetryAt: options?.nextRetryAt,
      authError: options?.authError,
    };
    localStorage.setItem(WEB_STORAGE_KEYS.MESSAGES, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
};

export const deleteNativeMessage = async (id: number): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.deleteMessage) {
    return !!(window as any).AndroidBridge.deleteMessage(id);
  }

  try {
    const list = await getNativeMessages();
    const filtered = list.filter(m => m.id !== id);
    localStorage.setItem(WEB_STORAGE_KEYS.MESSAGES, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
};

export const importNativeMessagesBatch = async (
  incoming: Array<{
    id?: number;
    sender: string;
    body: string;
    ts?: number | string;
    status?: NativeSmsMessage['status'];
    tries?: number;
    err?: string | null;
    code?: number;
  }>,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ importedCount: number; idRemap: Record<string, number>; assignedIds: number[] }> => {
  const idRemap: Record<string, number> = {};
  const assignedIds: number[] = [];

  const normalizedIncoming = incoming.map(m => {
    if (!m || !m.sender || !m.body) return null;
    const ts = normalizeEpochTimestamp(m.ts, undefined, undefined, m.body);
    const allowedStatus: NativeSmsMessage['status'] =
      m.status === 'sent' || m.status === 'pending' || m.status === 'failed' || m.status === 'local'
        ? m.status
        : 'local';
    return {
      id: typeof m.id === 'number' && Number.isFinite(m.id) && m.id > 0 ? Math.trunc(m.id) : undefined,
      sender: String(m.sender).trim(),
      body: String(m.body),
      ts,
      status: allowedStatus,
      tries: Number(m.tries) || 0,
      err: m.err ?? null,
      code: Number(m.code) || 0,
    };
  });

  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.importMessagesBatch) {
    try {
      const payload = normalizedIncoming.map(m => m || {});
      const raw = (window as any).AndroidBridge.importMessagesBatch(JSON.stringify(payload), mode);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return {
        importedCount: Number(parsed?.importedCount) || 0,
        idRemap: (parsed?.idRemap && typeof parsed.idRemap === 'object' ? parsed.idRemap : {}) as Record<string, number>,
        assignedIds: Array.isArray(parsed?.assignedIds) ? parsed.assignedIds.map((x: any) => Number(x) || 0) : [],
      };
    } catch (e) {
      console.warn('AndroidBridge.importMessagesBatch failed, falling back:', e);
    }
  }

  const existing = mode === 'replace' ? [] : await getNativeMessages();
  const usedIds = new Set<number>(existing.map(m => m.id));
  const exactKeyToId = new Map<string, number>();
  for (const m of existing) {
    exactKeyToId.set(`${(m.sender || '').toLowerCase()}|${(m.body || '').trim()}|${m.ts}`, m.id);
  }

  const result: NativeSmsMessage[] = [...existing];
  let importedCount = 0;

  for (const m of normalizedIncoming) {
    if (!m) {
      assignedIds.push(0);
      continue;
    }
    const exactKey = `${m.sender.toLowerCase()}|${m.body.trim()}|${m.ts}`;
    const existingMatchedId = exactKeyToId.get(exactKey);
    if (mode === 'merge' && existingMatchedId !== undefined) {
      assignedIds.push(existingMatchedId);
      continue;
    }

    let finalId: number;
    if (typeof m.id === 'number' && Number.isFinite(m.id) && !usedIds.has(m.id)) {
      finalId = m.id;
    } else {
      finalId = generateNumericId();
      while (usedIds.has(finalId)) {
        finalId = generateNumericId() + 1;
      }
      if (typeof m.id === 'number') {
        idRemap[String(m.id)] = finalId;
      }
    }
    usedIds.add(finalId);
    exactKeyToId.set(exactKey, finalId);
    assignedIds.push(finalId);

    result.push({
      id: finalId,
      sender: m.sender,
      body: m.body,
      ts: m.ts,
      status: m.status,
      tries: m.tries,
      err: m.err,
      code: m.code,
    });
    importedCount++;
  }

  result.sort((a, b) => b.ts - a.ts || b.id - a.id);
  localStorage.setItem(WEB_STORAGE_KEYS.MESSAGES, JSON.stringify(result));
  return { importedCount, idRemap, assignedIds };
};

export const clearAllNativeMessages = async (): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.clearAll) {
    return !!(window as any).AndroidBridge.clearAll();
  }

  try {
    localStorage.removeItem(WEB_STORAGE_KEYS.MESSAGES);
    localStorage.removeItem('ak_server_results_sim');
    return true;
  } catch {
    return false;
  }
};

export const clearAllNativeState = async (): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.clearAllState) {
    try {
      (window as any).AndroidBridge.clearAllState();
    } catch {}
  } else {
    await clearAllNativeMessages();
  }
  try {
    localStorage.removeItem(WEB_STORAGE_KEYS.MESSAGES);
    localStorage.removeItem('ak_server_results_sim');
    localStorage.removeItem('ak_sms_overrides_sim');
    localStorage.removeItem('ak_opening_balances_sim');
    localStorage.removeItem('ak_counterparty_tags_sim');
    localStorage.removeItem(WEB_STORAGE_KEYS.AI_PARSED);
    return true;
  } catch {
    return false;
  }
};

export interface SmsOverride {
  counterparty: string | null;
  direction: 'received' | 'sent' | 'unknown' | null;
  note: string;
  tag?: string;
  isHidden: boolean;
  reference?: string;
  category?: string;
}

export type SmsOverridesMap = Record<string, SmsOverride>;
export type OpeningBalancesMap = Record<string, number>;
export type SenderBankMap = Record<string, string>;
export type CounterpartyTagsMap = Record<string, string>;

export const getNativeOpeningBalances = async (): Promise<OpeningBalancesMap> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.getOpeningBalances) {
    try {
      const raw = (window as any).AndroidBridge.getOpeningBalances();
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      console.warn('Failed reading opening balances:', e);
    }
  }

  try {
    const raw = localStorage.getItem('ak_opening_balances_sim');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
};

export const saveNativeOpeningBalance = async (bank: string, amount: number): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.saveOpeningBalance) {
    return !!(window as any).AndroidBridge.saveOpeningBalance(bank, amount);
  }

  try {
    const current = await getNativeOpeningBalances();
    current[bank] = amount;
    localStorage.setItem('ak_opening_balances_sim', JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
};

export const getNativeSmsOverrides = async (): Promise<SmsOverridesMap> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.getSmsOverrides) {
    try {
      const raw = (window as any).AndroidBridge.getSmsOverrides();
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      console.warn('Failed reading sms overrides:', e);
    }
  }

  try {
    const raw = localStorage.getItem('ak_sms_overrides_sim');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
};

export const saveNativeSmsOverride = async (
  smsId: number,
  counterparty: string | null,
  direction: string | null,
  note: string,
  isHidden: boolean,
  tag: string = '',
  reference: string = '',
  category?: string
): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.saveSmsOverrideWithTag) {
    try {
      (window as any).AndroidBridge.saveSmsOverrideWithTag(smsId, counterparty, direction, note, isHidden, tag);
    } catch {}
  } else if (typeof window !== 'undefined' && (window as any).AndroidBridge?.saveSmsOverride) {
    try {
      (window as any).AndroidBridge.saveSmsOverride(smsId, counterparty, direction, note, isHidden);
    } catch {}
  }

  try {
    const current = await getNativeSmsOverrides();
    const prev = current[String(smsId)] || {};
    current[String(smsId)] = {
      ...prev,
      counterparty,
      direction: direction as any,
      note,
      tag: tag || '',
      isHidden,
      reference: reference || prev.reference || undefined,
      category: category || prev.category || undefined,
    };
    localStorage.setItem('ak_sms_overrides_sim', JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
};

export const getAiParsedCache = (): Record<string, AiParsedCacheEntry> => {
  try {
    const raw = localStorage.getItem(WEB_STORAGE_KEYS.AI_PARSED);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
};

export const saveAiParsedCacheEntry = (smsId: string, entry: AiParsedCacheEntry): void => {
  try {
    const current = getAiParsedCache();
    current[String(smsId)] = entry;
    localStorage.setItem(WEB_STORAGE_KEYS.AI_PARSED, JSON.stringify(current));
  } catch {}
};

export const getNativeCounterpartyTags = async (): Promise<CounterpartyTagsMap> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.getCounterpartyTags) {
    try {
      const raw = (window as any).AndroidBridge.getCounterpartyTags();
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      console.warn('Failed reading counterparty tags:', e);
    }
  }

  try {
    const raw = localStorage.getItem('ak_counterparty_tags_sim');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
};

export const saveNativeCounterpartyTag = async (counterparty: string, tag: string): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.saveCounterpartyTag) {
    return !!(window as any).AndroidBridge.saveCounterpartyTag(counterparty, tag);
  }

  try {
    const current = await getNativeCounterpartyTags();
    current[counterparty.trim()] = tag.trim();
    localStorage.setItem('ak_counterparty_tags_sim', JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
};

export const getNativeSenderBankMap = async (): Promise<SenderBankMap> => {
  const defaults: SenderBankMap = {
    '127': 'Telebirr',
    'Telebirr': 'Telebirr',
    'CBE': 'CBE',
    'CBEBirr': 'CBE Birr',
    'AwashBank': 'Awash Bank',
    'Awash': 'Awash Bank',
    'Dashen': 'Dashen Bank',
    'DashenBank': 'Dashen Bank',
    'BOA': 'Bank of Abyssinia',
    'Abyssinia': 'Bank of Abyssinia',
    'Zemen': 'Zemen Bank',
    'Siinqee': 'Siinqee Bank',
    'eBirr': 'eBirr',
    'ZamZam': 'ZamZam Bank',
    'Bunna': 'Bunna Bank',
    'Wegagen': 'Wegagen Bank',
    'M-PESA': 'M-Pesa',
    'AbayBank': 'Abay Bank',
    'NibBank': 'Nib Bank',
    'Hibret': 'Hibret Bank',
    'CoopBank': 'Coop Bank',
    'Tsedey': 'Tsedey Bank',
  };

  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.getSenderBankMap) {
    try {
      const raw = (window as any).AndroidBridge.getSenderBankMap();
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed && Object.keys(parsed).length > 0) {
        return { ...defaults, ...parsed };
      }
    } catch (e) {
      console.warn('Failed reading sender bank map:', e);
    }
  }

  try {
    const raw = localStorage.getItem('ak_sender_bank_map_sim');
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return defaults;
};

export const saveNativeSenderBankMap = async (sender: string, bankName: string): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.saveSenderBankMap) {
    return !!(window as any).AndroidBridge.saveSenderBankMap(sender, bankName);
  }

  try {
    const current = await getNativeSenderBankMap();
    current[sender] = bankName;
    localStorage.setItem('ak_sender_bank_map_sim', JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
};

export const deleteNativeSenderBankMap = async (sender: string): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.deleteSenderBankMap) {
    return !!(window as any).AndroidBridge.deleteSenderBankMap(sender);
  }

  try {
    const current = await getNativeSenderBankMap();
    delete current[sender];
    localStorage.setItem('ak_sender_bank_map_sim', JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
};

export interface NativeServerResult {
  smsId: number;
  httpCode: number;
  status: 'Saved' | 'Duplicate' | 'Ignored' | 'Unknown';
  ref?: string;
  reason?: string;
  raw?: string;
  at: number;
  bank?: string;
  type?: string;
  amount?: number;
  balance?: number;
  agent?: string;
  usage?: 'Unused' | 'Used' | 'Sent_Locked' | 'Payout_Verified';
  claimed_by?: string;
  claimed_txn_id?: string;
  needsReview?: boolean;
  needsReviewReason?: string;
  lastCheckedAt?: number;
}

export const getNativeServerResults = async (): Promise<Record<string, NativeServerResult>> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.getServerResults) {
    try {
      const raw = (window as any).AndroidBridge.getServerResults();
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      console.warn('Failed reading native server results:', e);
    }
  }

  try {
    const raw = localStorage.getItem('ak_server_results_sim');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
};

export const saveNativeServerResultsBatch = async (
  incoming: Record<string, any>,
  mode: 'merge' | 'replace' = 'merge',
  idRemap: Record<string, number> = {}
): Promise<boolean> => {
  try {
    const current = mode === 'replace' ? {} : await getNativeServerResults();
    const hasNative = typeof window !== 'undefined' && !!(window as any).AndroidBridge?.saveServerResult;
    for (const [key, sr] of Object.entries(incoming)) {
      if (!sr || typeof sr !== 'object') continue;
      const origId = String(sr.smsId ?? key);
      const targetId = idRemap[origId] ?? Number(origId);
      if (!Number.isFinite(targetId)) continue;
      const targetKey = String(targetId);
      if (mode === 'merge' && current[targetKey]) continue;
      const entry: NativeServerResult = {
        smsId: targetId,
        httpCode: Number(sr.httpCode || 200),
        status: (sr.status as any) || 'Unknown',
        ref: sr.ref || '',
        reason: sr.reason || '',
        raw: sr.raw || '',
        at: Number(sr.at) || Date.now(),
        bank: sr.bank,
        type: sr.type,
        amount: sr.amount,
        balance: sr.balance,
        agent: sr.agent,
        usage: sr.usage,
        claimed_by: sr.claimed_by,
        claimed_txn_id: sr.claimed_txn_id,
      };
      current[targetKey] = entry;
      if (hasNative) {
        try {
          (window as any).AndroidBridge.saveServerResult(
            targetId,
            entry.httpCode,
            entry.status,
            entry.ref || '',
            entry.reason || '',
            entry.raw || ''
          );
        } catch {}
      }
    }
    localStorage.setItem('ak_server_results_sim', JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
};

export const saveNativeSmsOverridesBatch = async (
  incoming: Record<string, any>,
  mode: 'merge' | 'replace' = 'merge',
  idRemap: Record<string, number> = {}
): Promise<boolean> => {
  try {
    const current = mode === 'replace' ? {} : await getNativeSmsOverrides();
    const hasNativeWithTag = typeof window !== 'undefined' && !!(window as any).AndroidBridge?.saveSmsOverrideWithTag;
    const hasNativeBasic = typeof window !== 'undefined' && !!(window as any).AndroidBridge?.saveSmsOverride;
    for (const [key, ov] of Object.entries(incoming)) {
      if (!ov || typeof ov !== 'object') continue;
      const targetId = idRemap[key] ?? Number(key);
      const targetKey = String(Number.isFinite(targetId) ? targetId : key);
      if (mode === 'merge' && current[targetKey]) continue;
      const entry: SmsOverride = {
        counterparty: ov.counterparty ?? null,
        direction: (ov.direction as any) ?? null,
        note: ov.note || '',
        tag: ov.tag || '',
        isHidden: !!ov.isHidden,
        reference: ov.reference || undefined,
        category: ov.category || undefined,
      };
      current[targetKey] = entry;
      const numId = Number(targetKey);
      if (Number.isFinite(numId)) {
        if (hasNativeWithTag) {
          try {
            (window as any).AndroidBridge.saveSmsOverrideWithTag(
              numId,
              entry.counterparty,
              entry.direction,
              entry.note,
              entry.isHidden,
              entry.tag || ''
            );
          } catch {}
        } else if (hasNativeBasic) {
          try {
            (window as any).AndroidBridge.saveSmsOverride(
              numId,
              entry.counterparty,
              entry.direction,
              entry.note,
              entry.isHidden
            );
          } catch {}
        }
      }
    }
    localStorage.setItem('ak_sms_overrides_sim', JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
};

export const saveNativeOpeningBalancesBatch = async (
  incoming: Record<string, number>,
  mode: 'merge' | 'replace' = 'merge'
): Promise<boolean> => {
  try {
    const current = mode === 'replace' ? {} : await getNativeOpeningBalances();
    const hasNative = typeof window !== 'undefined' && !!(window as any).AndroidBridge?.saveOpeningBalance;
    for (const [bank, amount] of Object.entries(incoming)) {
      if (typeof amount === 'number' && Number.isFinite(amount)) {
        if (mode === 'replace' || current[bank] === undefined) {
          current[bank] = amount;
          if (hasNative) {
            try {
              (window as any).AndroidBridge.saveOpeningBalance(bank, amount);
            } catch {}
          }
        }
      }
    }
    localStorage.setItem('ak_opening_balances_sim', JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
};

export const saveNativeCounterpartyTagsBatch = async (
  incoming: Record<string, string>,
  mode: 'merge' | 'replace' = 'merge'
): Promise<boolean> => {
  try {
    const current = mode === 'replace' ? {} : await getNativeCounterpartyTags();
    const hasNative = typeof window !== 'undefined' && !!(window as any).AndroidBridge?.saveCounterpartyTag;
    for (const [cp, tag] of Object.entries(incoming)) {
      if (typeof tag === 'string' && tag.trim()) {
        const cleanCp = cp.trim();
        if (mode === 'replace' || !current[cleanCp]) {
          current[cleanCp] = tag.trim();
          if (hasNative) {
            try {
              (window as any).AndroidBridge.saveCounterpartyTag(cleanCp, tag.trim());
            } catch {}
          }
        }
      }
    }
    localStorage.setItem('ak_counterparty_tags_sim', JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
};

export const saveNativeSenderBankMapBatch = async (
  incoming: Record<string, string>,
  mode: 'merge' | 'replace' = 'merge'
): Promise<boolean> => {
  try {
    const current = mode === 'replace' ? {} : await getNativeSenderBankMap();
    const hasNative = typeof window !== 'undefined' && !!(window as any).AndroidBridge?.saveSenderBankMap;
    for (const [sender, bank] of Object.entries(incoming)) {
      if (typeof bank === 'string' && bank.trim()) {
        current[sender] = bank.trim();
        if (hasNative) {
          try {
            (window as any).AndroidBridge.saveSenderBankMap(sender, bank.trim());
          } catch {}
        }
      }
    }
    localStorage.setItem('ak_sender_bank_map_sim', JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
};

export const saveNativeServerResult = async (
  smsId: number,
  httpCode: number,
  status: string,
  ref: string,
  reason: string,
  raw: string,
  extra?: Partial<NativeServerResult>
): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.saveServerResult) {
    try {
      (window as any).AndroidBridge.saveServerResult(smsId, httpCode, status, ref, reason, raw);
    } catch {}
  }

  try {
    const current = await getNativeServerResults();
    const prev = current[String(smsId)] || ({} as Partial<NativeServerResult>);
    current[String(smsId)] = {
      ...prev,
      ...(extra || {}),
      smsId,
      httpCode,
      status: status as any,
      ref: ref || prev.ref || '',
      reason,
      raw,
      at: Date.now(),
    };
    localStorage.setItem('ak_server_results_sim', JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
};

export const mergeNativeServerResult = async (
  smsId: number,
  patch: Partial<NativeServerResult>
): Promise<boolean> => {
  try {
    const current = await getNativeServerResults();
    const key = String(smsId);
    const prev = current[key] || {
      smsId,
      httpCode: 200,
      status: 'Saved' as const,
      at: Date.now(),
    };
    current[key] = {
      ...prev,
      ...patch,
      smsId,
      at: patch.at ?? prev.at ?? Date.now(),
    };
    localStorage.setItem('ak_server_results_sim', JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
};

export interface NativeFileSaveResult {
  success: boolean;
  path?: string;
  bytes?: number;
  error?: string;
}

export const saveNativeFile = async (
  filename: string,
  mimeType: string,
  content: string
): Promise<NativeFileSaveResult> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.saveFileNative) {
    try {
      const raw = (window as any).AndroidBridge.saveFileNative(filename, mimeType, content);
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e: any) {
      return { success: false, error: e?.message || 'Native save failed' };
    }
  }

  try {
    const blob = new Blob([content], { type: mimeType });
    if (blob.size === 0) {
      return { success: false, error: 'Generated empty file (0 bytes)' };
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return { success: true, path: filename, bytes: blob.size };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Download failed' };
  }
};

export const shareNativeFile = async (
  filename: string,
  mimeType: string,
  content: string
): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.shareFileNative) {
    try {
      return !!(window as any).AndroidBridge.shareFileNative(filename, mimeType, content);
    } catch {
      return false;
    }
  }

  try {
    if (navigator.share) {
      const file = new File([content], filename, { type: mimeType });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return true;
      }
    }
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
};
