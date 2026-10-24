export type SyncStatus = 'sent' | 'pending' | 'failed' | 'local';

export type PaymentType = 'received' | 'sent' | 'unknown';

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
  amount: number;
  currency: string;
  counterparty: string;
  reference: string;
  accountNumber?: string;
  balance?: number;
  extractedBalance?: number;
  rawMessage: string;
  timestamp: number;
  date: string;
  syncStatus: SyncStatus;
  retryCount: number;
  lastRetryAt?: number;
  errorMessage?: string;
  serverResponse?: string;
  source: 'sms' | 'manual' | 'simulated';
  isDuplicate?: boolean;
  note?: string;
  isHidden?: boolean;
  isOverridden?: boolean;
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
