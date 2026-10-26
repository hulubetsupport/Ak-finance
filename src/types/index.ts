export type SyncStatus = 'sent' | 'pending' | 'failed' | 'local';

export type PaymentType = 'received' | 'sent' | 'unknown';

export type PaymentCategory = 
  | 'received' 
  | 'transfer' 
  | 'airtime' 
  | 'data' 
  | 'payment' 
  | 'bill' 
  | 'cash' 
  | 'atm-card' 
  | 'other';

export interface ServerResultRecord {
  smsId: number | string;
  httpCode: number;
  status: 'Saved' | 'Duplicate' | 'Ignored' | 'Unknown';
  ref?: string;
  reason?: string;
  raw?: string;
  at: number;
  resolving?: boolean;
  v2?: string;
  bank?: string;
  type?: string;
  amount?: number;
}

export type BankName = 
  | 'Telebirr'
  | 'CBE'
  | 'Commercial Bank of Ethiopia'
  | 'Awash Bank'
  | 'Dashen Bank'
  | 'Bank of Abyssinia'
  | 'Abay Bank'
  | 'Wegagen Bank'
  | 'Nib Bank'
  | 'Zemen Bank'
  | 'Coop Bank'
  | 'Hibret Bank'
  | string;

export interface PaymentRecord {
  id: string;
  senderAddress: string;
  bank: BankName;
  type: PaymentType;
  category?: PaymentCategory;
  amount: number;
  amountCents?: number;
  amountSantim?: number;
  fee?: number;
  feeCents?: number;
  currency: string;
  counterparty: string;
  reference: string;
  ftNumber?: string;
  v2Code?: string;
  accountNumber?: string;
  balance?: number;
  balanceSantim?: number;
  extractedBalance?: number;
  rawMessage: string;
  timestamp: number;
  date: string;
  syncStatus: SyncStatus;
  retryCount: number;
  lastRetryAt?: number;
  errorMessage?: string;
  serverResponse?: string;
  serverResult?: ServerResultRecord;
  source: 'sms' | 'manual' | 'simulated';
  isDuplicate?: boolean;
  note?: string;
  tag?: string;
  isHidden?: boolean;
  isOverridden?: boolean;
}

export interface SecuritySettings {
  pinEnabled: boolean;
  pinLength: 4 | 6;
  pinSalt: string;
  pinHash: string;
  biometricEnabled: boolean;
  failedAttempts: number;
  lockoutUntil: number;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  app: string;
  messages: any[];
  openingBalances: Record<string, number>;
  overrides: Record<string, any>;
  senderBankMap: Record<string, string>;
  counterpartyTags: Record<string, string>;
  settings: AppSettings;
}

export interface Account {
  id: string;
  name: string;
  bank: string;
  type: 'mobile' | 'operating' | 'shop' | 'other';
  accountNumber: string;
  maskedNumber: string;
  balance: number;
  accent: 'blue' | 'indigo' | 'gold' | 'emerald' | 'amber' | 'cyan' | 'purple' | 'red';
  brandColor?: string;
  receivedThisMonth?: number;
  sentThisMonth?: number;
  openingBalance?: number;
  hasSyncedBalance?: boolean;
}

export interface WithdrawalRecord {
  id: string;
  amount: number;
  date: string;
  timestamp: number;
  bank: string;
  accountId?: string;
  recipient: string;
  note: string;
  reference: string;
}

export type AppMode = 'server' | 'local';
export type HttpMethod = 'POST' | 'GET';
export type Language = 'en' | 'am';

export interface AppSettings {
  serverUrl: string;
  secretKey: string;
  httpMethod: HttpMethod;
  retryIntervalSeconds: number;
  mode: AppMode;
  allowedSenders: string[];
  language: Language;
  hideBalances: boolean;
  soundEnabled: boolean;
  serviceRunning: boolean;
}

export interface SyncLogEntry {
  id: string;
  timestamp: number;
  paymentId: string;
  status: 'success' | 'failed' | 'retrying';
  httpStatus?: number;
  url: string;
  message: string;
  durationMs?: number;
}
