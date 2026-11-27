import type { PaymentRecord } from '../types/index.ts';
import { isCbeBank, parseBankSms } from './smsParser.ts';

export const DEFAULT_HULUBET_SERVER_URL = 'https://verifiy-server.app.aletcloud.com';

export type DeviceRole = 'owner' | 'agent';

export type HuluBetUsageStatus = 'Unused' | 'Used' | 'Sent_Locked' | 'Payout_Verified';

export type HuluBetSendOutcome =
  | 'synced'
  | 'needs_review'
  | 'silent_skip'
  | 'auth_error'
  | 'retry';

export interface HuluBetWebhookClassification {
  outcome: HuluBetSendOutcome;
  serverStatus: 'Saved' | 'Duplicate' | 'Ignored' | 'Unknown';
  needsReview: boolean;
  needsReviewReason?: string;
  silentSkip: boolean;
  noAutoRetry: boolean;
  errorMessage?: string;
}

export interface HuluBetNormalizedRecord {
  ref?: string;
  bank?: string;
  type?: string;
  amount?: number;
  balance?: number;
  agent?: string;
  usage?: HuluBetUsageStatus;
  claimed_by?: string;
  claimed_txn_id?: string;
  reason?: string;
  status?: 'Saved' | 'Duplicate' | 'Ignored' | 'Unknown';
}

export interface HuluBetOverviewStats {
  depositsClaimedEtb: number;
  depositsClaimedCount: number;
  withdrawalsVerifiedEtb: number;
  withdrawalsVerifiedCount: number;
  pendingUnclaimedCount: number;
  pendingUnclaimedEtb: number;
  needsReviewCount: number;
  syncErrorsCount: number;
  latestTelebirrBalance: number | null;
  latestCbeBalance: number | null;
}

/**
 * Resolve exact HuluBet endpoint URL regardless of whether the user entered the bare origin
 * (`https://verifiy-server.app.aletcloud.com`) or a full path (`/webhook/sms`).
 */
export function resolveHuluBetEndpointUrl(
  baseOrFullUrl: string,
  endpointPath: '/webhook/sms' | '/api/recent' | '/api/check'
): string {
  const cleaned = (baseOrFullUrl || '').trim();
  const parsed = new URL(cleaned);
  // Strip any known trailing HuluBet path before appending requested endpoint
  const basePath = parsed.pathname
    .replace(/\/+(webhook\/sms|api\/recent|api\/check)\/?$/i, '')
    .replace(/\/+$/, '');
  parsed.pathname = `${basePath}${endpointPath}`;
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

/**
 * Determine whether an SMS is eligible for automatic forwarding to HuluBet in Server Sync mode.
 * Rule: Send every Telebirr (127) and CBE SMS, incoming AND outgoing.
 */
export function isTelebirrOrCbeSms(
  sender: string,
  body: string,
  senderMap?: Record<string, string>
): boolean {
  const s = (sender || '').trim().toLowerCase();
  const b = (body || '').trim().toLowerCase();

  if (
    s === '127' ||
    s.includes('telebirr') ||
    s === 'cbe' ||
    s.includes('commercial bank') ||
    b.includes('telebirr') ||
    b.includes('commercial bank of ethiopia') ||
    b.includes('mbreciept.cbe.com.et') ||
    b.includes('apps.cbe.com.et') ||
    b.includes('transactioninfo.ethiotelecom.et')
  ) {
    return true;
  }

  const parsed = parseBankSms(sender || 'Bank', body || '', senderMap);
  return parsed.bank === 'Telebirr' || isCbeBank(parsed.bank);
}

/**
 * Classify `/webhook/sms` HTTP + JSON response according to HuluBet rules:
 * - Saved or Duplicate -> synced (never ignored/failed)
 * - Ignored "Not a payment SMS" -> skip silently (remove from retry queue)
 * - Ignored "Missing Ref" or "Missing Amount" -> mark "Needs review" with reason (remove from retry queue)
 * - 401 -> wrong-token error, NO auto-retry
 * - 400 / 500 / 502 / 0 / network error -> retry with exponential backoff
 */
export function classifyHuluBetWebhookResponse(
  httpCode: number,
  rawStatus?: string,
  reason?: string,
  networkOrHttpError?: string
): HuluBetWebhookClassification {
  if (httpCode === 401) {
    return {
      outcome: 'auth_error',
      serverStatus: 'Unknown',
      needsReview: false,
      silentSkip: false,
      noAutoRetry: true,
      errorMessage: networkOrHttpError || 'Wrong or invalid token (HTTP 401). Check your role token in Settings.',
    };
  }

  const normalizedStatus = (rawStatus || '').trim().toLowerCase();
  const cleanReason = (reason || '').trim();

  if (httpCode >= 200 && httpCode < 300) {
    if (normalizedStatus === 'saved' || normalizedStatus.includes('save') || normalizedStatus === 'ok' || normalizedStatus === 'success') {
      return {
        outcome: 'synced',
        serverStatus: 'Saved',
        needsReview: false,
        silentSkip: false,
        noAutoRetry: true,
      };
    }

    if (normalizedStatus === 'duplicate' || normalizedStatus.includes('dup')) {
      return {
        outcome: 'synced',
        serverStatus: 'Duplicate',
        needsReview: false,
        silentSkip: false,
        noAutoRetry: true,
      };
    }

    if (normalizedStatus === 'ignored' || normalizedStatus.includes('ignor')) {
      if (/missing\s*(ref|amount)/i.test(cleanReason)) {
        return {
          outcome: 'needs_review',
          serverStatus: 'Ignored',
          needsReview: true,
          needsReviewReason: cleanReason || 'Missing Ref or Amount',
          silentSkip: false,
          noAutoRetry: true,
        };
      }

      if (/not\s*a\s*payment/i.test(cleanReason) || cleanReason === '') {
        return {
          outcome: 'silent_skip',
          serverStatus: 'Ignored',
          needsReview: false,
          silentSkip: true,
          noAutoRetry: true,
          needsReviewReason: cleanReason || 'Not a payment SMS',
        };
      }

      // Any other explicit Ignored reason defaults to Needs review so nothing gets lost silently
      return {
        outcome: 'needs_review',
        serverStatus: 'Ignored',
        needsReview: true,
        needsReviewReason: cleanReason,
        silentSkip: false,
        noAutoRetry: true,
      };
    }

    // 2xx OK without explicit Ignored wording counts as Saved
    return {
      outcome: 'synced',
      serverStatus: 'Saved',
      needsReview: false,
      silentSkip: false,
      noAutoRetry: true,
    };
  }

  return {
    outcome: 'retry',
    serverStatus: 'Unknown',
    needsReview: false,
    silentSkip: false,
    noAutoRetry: false,
    errorMessage: networkOrHttpError || (httpCode > 0 ? `HTTP ${httpCode}` : 'Network error reaching HuluBet server'),
  };
}

/**
 * Exponential backoff delay in ms for HuluBet offline queue:
 * 15s -> 30s -> 60s -> 120s -> 240s -> 300s (max 5 minutes)
 */
export function computeExponentialBackoffMs(failedTries: number): number {
  const safeTries = Math.max(1, Math.floor(failedTries || 1));
  const seconds = Math.min(300, 15 * Math.pow(2, safeTries - 1));
  return seconds * 1000;
}

export function isQueueItemDueForRetry(
  item: { status: string; tries?: number; nextRetryAt?: number; authError?: boolean },
  now: number = Date.now()
): boolean {
  if (item.authError) return false;
  if (item.status !== 'pending' && item.status !== 'failed') return false;
  if (!item.nextRetryAt || item.nextRetryAt <= 0) return true;
  return now >= item.nextRetryAt;
}

export function normalizeUsageStatus(raw?: unknown): HuluBetUsageStatus | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (v === 'unused') return 'Unused';
  if (v === 'used' || v === 'claimed') return 'Used';
  if (v === 'sent_locked' || v === 'locked') return 'Sent_Locked';
  if (v === 'payout_verified' || v === 'verified') return 'Payout_Verified';
  return undefined;
}

/**
 * Sanitize optional HuluBet server record payload: preserve non-empty fields only.
 */
export function normalizeHuluBetServerRecord(raw: unknown): HuluBetNormalizedRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const pickStr = (val: unknown): string | undefined =>
    typeof val === 'string' && val.trim() ? val.trim() : undefined;
  const pickNum = (val: unknown): number | undefined => {
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    if (typeof val === 'string' && val.trim() && Number.isFinite(Number(val))) return Number(val);
    return undefined;
  };

  const ref = pickStr(r.ref ?? r.reference);
  const bank = pickStr(r.bank);
  const type = pickStr(r.type);
  const amount = pickNum(r.amount);
  const balance = pickNum(r.balance);
  const agent = pickStr(r.agent);
  const usage = normalizeUsageStatus(r.usage);
  const claimedBy = pickStr(r.claimed_by ?? r.claimedBy);
  const claimedTxnId = pickStr(r.claimed_txn_id ?? r.claimedTxnId);
  const reason = pickStr(r.reason);

  const rawStatus = pickStr(r.status)?.toLowerCase();
  let status: 'Saved' | 'Duplicate' | 'Ignored' | 'Unknown' | undefined;
  if (rawStatus === 'saved' || rawStatus === 'ok' || rawStatus === 'success') status = 'Saved';
  else if (rawStatus === 'duplicate') status = 'Duplicate';
  else if (rawStatus === 'ignored') status = 'Ignored';

  return {
    ...(ref ? { ref } : {}),
    ...(bank ? { bank } : {}),
    ...(type ? { type } : {}),
    ...(amount !== undefined ? { amount } : {}),
    ...(balance !== undefined ? { balance } : {}),
    ...(agent ? { agent } : {}),
    ...(usage ? { usage } : {}),
    ...(claimedBy ? { claimed_by: claimedBy } : {}),
    ...(claimedTxnId ? { claimed_txn_id: claimedTxnId } : {}),
    ...(reason ? { reason } : {}),
    ...(status ? { status } : {}),
  };
}

export function normalizeRefKey(ref?: string | null): string {
  return (ref || '').trim().toUpperCase();
}

export function extractRecentArrayFromPayload(payload: unknown): HuluBetNormalizedRecord[] {
  let rawItems: unknown[] = [];
  if (Array.isArray(payload)) {
    rawItems = payload;
  } else if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    const candidate = obj.items ?? obj.rows ?? obj.transactions ?? obj.records ?? obj.recent ?? obj.data;
    if (Array.isArray(candidate)) {
      rawItems = candidate;
    }
  }
  return rawItems
    .map(normalizeHuluBetServerRecord)
    .filter((item): item is HuluBetNormalizedRecord => Boolean(item));
}

export function computeHuluBetOverviewStats(payments: PaymentRecord[]): HuluBetOverviewStats {
  let depositsClaimedEtb = 0;
  let depositsClaimedCount = 0;
  let withdrawalsVerifiedEtb = 0;
  let withdrawalsVerifiedCount = 0;
  let pendingUnclaimedCount = 0;
  let pendingUnclaimedEtb = 0;
  let needsReviewCount = 0;
  let syncErrorsCount = 0;
  let latestTelebirrBalance: number | null = null;
  let latestTelebirrTs = -1;
  let latestCbeBalance: number | null = null;
  let latestCbeTs = -1;

  for (const p of payments) {
    if (p.isHidden) continue;

    if (p.needsReview) {
      needsReviewCount++;
    }
    if (p.syncStatus === 'failed' || p.authError) {
      syncErrorsCount++;
    }

    const usage = p.serverResult?.usage;
    const isDup = Boolean(p.isDuplicate);
    const amt = Number(p.amount) || 0;

    if (!isDup && p.category !== 'alert') {
      if (usage === 'Used') {
        depositsClaimedEtb += amt;
        depositsClaimedCount++;
      } else if (usage === 'Payout_Verified') {
        withdrawalsVerifiedEtb += amt;
        withdrawalsVerifiedCount++;
      } else if (usage === 'Unused' || usage === 'Sent_Locked') {
        pendingUnclaimedCount++;
        pendingUnclaimedEtb += amt;
      } else if (p.syncStatus === 'pending') {
        pendingUnclaimedCount++;
        pendingUnclaimedEtb += amt;
      }
    }

    const bal = p.balance ?? p.extractedBalance;
    if (bal !== undefined && Number.isFinite(bal) && p.category !== 'alert') {
      const bankLower = (p.bank || '').toLowerCase();
      if (bankLower.includes('telebirr') && p.timestamp > latestTelebirrTs) {
        latestTelebirrTs = p.timestamp;
        latestTelebirrBalance = bal;
      } else if (isCbeBank(p.bank) && p.timestamp > latestCbeTs) {
        latestCbeTs = p.timestamp;
        latestCbeBalance = bal;
      }
    }
  }

  return {
    depositsClaimedEtb,
    depositsClaimedCount,
    withdrawalsVerifiedEtb,
    withdrawalsVerifiedCount,
    pendingUnclaimedCount,
    pendingUnclaimedEtb,
    needsReviewCount,
    syncErrorsCount,
    latestTelebirrBalance,
    latestCbeBalance,
  };
}
