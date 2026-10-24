/**
 * Native Bridge Interface for Ak Financial
 * Bridges Capacitor Web layer with native Android SharedPreferences, SQLite (ejeta.db), and Sync Job
 */

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
}

export interface NativeStatus {
  smsGranted: boolean;
  lastSmsAt: number;
  lastSmsSender: string;
  lastCode: number;
  lastCodeAt: number;
  pending: number;
}

export const isAndroidNative = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(window as any).AndroidBridge?.isNative?.();
};

const WEB_STORAGE_KEYS = {
  SETTINGS: 'ak_native_settings_sim',
  MESSAGES: 'ak_native_messages_sim',
  STATUS: 'ak_native_status_sim',
};

const DEFAULT_SETTINGS: NativeSettings = {
  url: '',
  token: '',
  method: 'GET',
  interval: 15,
  mode: 'server',
  senders: 'CBE,127,AwashBank,Dashen,BOA',
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
        mode: parsed.mode === 'local' ? 'local' : 'server',
        senders: parsed.senders || 'CBE,127,AwashBank,Dashen,BOA',
      };
    } catch (e) {
      console.warn('Failed parsing native settings:', e);
    }
  }

  // Web simulator fallback
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

  // Web simulator fallback
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

  // Web simulator fallback
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
  // Browser preview default
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

  // Web simulator fallback
  const messages = await getNativeMessages();
  const pendingCount = messages.filter(m => m.status === 'pending' || m.status === 'failed').length;
  const lastMsg = messages[0];
  return {
    smsGranted: true,
    lastSmsAt: lastMsg ? lastMsg.ts : 0,
    lastSmsSender: lastMsg ? lastMsg.sender : '',
    lastCode: 200,
    lastCodeAt: Date.now(),
    pending: pendingCount,
  };
};

export const insertNativeTestSms = async (sender: string, body: string): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.insertTestSms) {
    return !!(window as any).AndroidBridge.insertTestSms(sender, body);
  }

  // Web simulator fallback: insert into simulated messages store
  try {
    const list = await getNativeMessages();
    const settings = await getNativeSettings();
    const isServer = settings.mode === 'server';
    const newMsg: NativeSmsMessage = {
      id: Date.now(),
      sender,
      body,
      ts: Date.now(),
      status: isServer ? (settings.url ? 'sent' : 'pending') : 'local',
      tries: isServer ? 1 : 0,
      err: isServer && !settings.url ? 'Server URL not configured' : null,
      code: isServer ? (settings.url ? 200 : 0) : 0,
    };
    list.unshift(newMsg);
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

export const clearAllNativeMessages = async (): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.clearAll) {
    return !!(window as any).AndroidBridge.clearAll();
  }

  try {
    localStorage.removeItem(WEB_STORAGE_KEYS.MESSAGES);
    return true;
  } catch {
    return false;
  }
};

export interface SmsOverride {
  counterparty: string | null;
  direction: 'received' | 'sent' | 'unknown' | null;
  note: string;
  isHidden: boolean;
}

export type SmsOverridesMap = Record<string, SmsOverride>;
export type OpeningBalancesMap = Record<string, number>;
export type SenderBankMap = Record<string, string>;

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
  isHidden: boolean
): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).AndroidBridge?.saveSmsOverride) {
    return !!(window as any).AndroidBridge.saveSmsOverride(smsId, counterparty, direction, note, isHidden);
  }

  try {
    const current = await getNativeSmsOverrides();
    current[String(smsId)] = {
      counterparty,
      direction: direction as any,
      note,
      isHidden,
    };
    localStorage.setItem('ak_sms_overrides_sim', JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
};

export const getNativeSenderBankMap = async (): Promise<SenderBankMap> => {
  const defaults: SenderBankMap = {
    '127': 'Telebirr',
    'CBE': 'Commercial Bank of Ethiopia',
    'AwashBank': 'Awash Bank',
    'Awash': 'Awash Bank',
    'Dashen': 'Dashen Bank',
    'BOA': 'Bank of Abyssinia',
    'Abyssinia': 'Bank of Abyssinia',
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
