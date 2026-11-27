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
  | 'alert'
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
  balance?: number;
  agent?: string;
  usage?: 'Unused' | 'Used' | 'Sent_Locked' | 'Payout_Verified';
  claimed_by?: string;
  claimed_txn_id?: string;
  needsReview?: boolean;
  needsReviewReason?: string;
  lastCheckedAt?: number;
}

export type BankName =
  | 'Telebirr'
  | 'CBE'
  | 'Commercial Bank of Ethiopia'
  | 'Awash Bank'
  | 'Dashen Bank'
  | 'Bank of Abyssinia'
  | 'Zemen Bank'
  | 'Siinqee Bank'
  | 'eBirr'
  | 'ZamZam Bank'
  | 'CBE Birr'
  | 'Bunna Bank'
  | 'Wegagen Bank'
  | 'M-Pesa'
  | 'Abay Bank'
  | 'Nib Bank'
  | 'Coop Bank'
  | 'Hibret Bank'
  | 'Tsedey Bank'
  | string;

export type TimeRange = '1h' | '1d' | '7d' | '1mo' | '1y' | 'all' | 'custom';

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
  receiptUrl?: string;
  accountNumber?: string;
  balance?: number;
  balanceSantim?: number;
  extractedBalance?: number;
  rawMessage: string;
  timestamp: number;
  date: string;
  syncStatus: SyncStatus;
  serverIgnored?: boolean;
  serverIgnoredReason?: string;
  needsReview?: boolean;
  needsReviewReason?: string;
  authError?: boolean;
  nextRetryAt?: number;
  retryCount: number;
  lastRetryAt?: number;
  errorMessage?: string;
  serverResponse?: string;
  serverResult?: ServerResultRecord;
  source: 'sms' | 'manual' | 'simulated';
  isDuplicate?: boolean;
  note?: string;
  tag?: string;
  suggestedTag?: string;
  isHidden?: boolean;
  isOverridden?: boolean;
  aiParsed?: boolean;
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

export interface MonthlyBudget {
  id: string;
  month: string; // 'YYYY-MM'
  overallLimit: number;
  categoryLimits?: Record<string, number>;
  updatedAt: number;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  app: string;
  messages: any[];
  serverResults?: Record<string, any>;
  openingBalances: Record<string, number>;
  overrides: Record<string, any>;
  senderBankMap: Record<string, string>;
  counterpartyTags: Record<string, string>;
  settings: AppSettings;
  budgets?: MonthlyBudget[];
  customAccounts?: Account[];
  withdrawals?: WithdrawalRecord[];
  hiddenBanks?: string[];
  archivedAccounts?: string[];
  accountOrder?: string[];
  uiPrefs?: Record<string, any>;
}

export interface Account {
  id: string;
  name: string;
  bank: string;
  shortCode?: string;
  senderIds?: string[];
  type: 'mobile' | 'operating' | 'shop' | 'other';
  accountNumber: string;
  maskedNumber: string;
  balance: number;
  accent: 'blue' | 'indigo' | 'gold' | 'emerald' | 'amber' | 'cyan' | 'purple' | 'red';
  brandColor?: string;
  logoUrl?: string;
  isArchived?: boolean;
  orderIndex?: number;
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

import type { AiChatModelId } from '../constants/aiModels.ts';

export type AppMode = 'server' | 'local';
export type HttpMethod = 'POST' | 'GET';
export type Language = 'en' | 'am';
export type AiModelId = AiChatModelId;
export type DeviceRoleType = 'owner' | 'agent';

export interface AppSettings {
  serverUrl: string;
  secretKey: string;
  httpMethod: HttpMethod;
  retryIntervalSeconds: number;
  mode: AppMode;
  deviceRole?: DeviceRoleType;
  deviceLabel?: string;
  roleTokens?: {
    owner?: string;
    agent?: string;
  };
  allowedSenders: string[];
  language: Language;
  hideBalances: boolean;
  soundEnabled: boolean;
  serviceRunning: boolean;
  excludeHiddenFromTotal?: boolean;
  startHiddenAfterUnlock?: boolean;
  timeRange?: TimeRange;
  aiEnabled?: boolean;
  aiAutoParseUnknown?: boolean;
  aiModel?: AiModelId;
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
