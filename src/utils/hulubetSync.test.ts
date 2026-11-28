import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HULUBET_SERVER_URL,
  resolveHuluBetEndpointUrl,
  isTelebirrOrCbeSms,
  classifyHuluBetWebhookResponse,
  computeExponentialBackoffMs,
  isQueueItemDueForRetry,
  normalizeHuluBetServerRecord,
  extractRecentArrayFromPayload,
  computeHuluBetOverviewStats,
  isInvalidHealthcheckSyncResult,
} from './hulubetSync.ts';
import type { PaymentRecord } from '../types/index.ts';

test('resolveHuluBetEndpointUrl normalizes base URL and path overrides cleanly', () => {
  assert.equal(
    resolveHuluBetEndpointUrl(DEFAULT_HULUBET_SERVER_URL, '/webhook/sms'),
    'https://verifiy-server.app.aletcloud.com/webhook/sms'
  );
  assert.equal(
    resolveHuluBetEndpointUrl('https://verifiy-server.app.aletcloud.com/webhook/sms?foo=1', '/api/recent'),
    'https://verifiy-server.app.aletcloud.com/api/recent'
  );
  assert.equal(
    resolveHuluBetEndpointUrl('https://verifiy-server.app.aletcloud.com/', '/api/check'),
    'https://verifiy-server.app.aletcloud.com/api/check'
  );
});

test('isTelebirrOrCbeSms matches both incoming and outgoing Telebirr (127) and CBE messages', () => {
  assert.equal(isTelebirrOrCbeSms('127', 'You have received ETB 500.00 from Abebe'), true);
  assert.equal(isTelebirrOrCbeSms('127', 'Dear Aymen The request to withdraw ETB 100.00 ...'), true);
  assert.equal(isTelebirrOrCbeSms('CBE', 'Your account 1000****4819 has been credited with ETB 2,000.00'), true);
  assert.equal(isTelebirrOrCbeSms('CBE', 'Your account 1000****4819 has been debited ETB 1,500.00'), true);
  assert.equal(isTelebirrOrCbeSms('AwashBank', 'Your Awash Bank account was credited with ETB 300.00'), false);
});

test('classifyHuluBetWebhookResponse implements Saved, Duplicate, Ignored, 401, and 500 rules', () => {
  const saved = classifyHuluBetWebhookResponse(200, 'Saved');
  assert.equal(saved.outcome, 'synced');
  assert.equal(saved.serverStatus, 'Saved');
  assert.equal(saved.needsReview, false);

  const dup = classifyHuluBetWebhookResponse(200, 'Duplicate');
  assert.equal(dup.outcome, 'synced');
  assert.equal(dup.serverStatus, 'Duplicate');

  const notPayment = classifyHuluBetWebhookResponse(200, 'Ignored', 'Not a payment SMS');
  assert.equal(notPayment.outcome, 'silent_skip');
  assert.equal(notPayment.silentSkip, true);
  assert.equal(notPayment.needsReview, false);
  assert.equal(notPayment.noAutoRetry, true);

  const missingRef = classifyHuluBetWebhookResponse(200, 'Ignored', 'Missing Ref');
  assert.equal(missingRef.outcome, 'needs_review');
  assert.equal(missingRef.needsReview, true);
  assert.equal(missingRef.needsReviewReason, 'Missing Ref');
  assert.equal(missingRef.noAutoRetry, true);

  const missingAmt = classifyHuluBetWebhookResponse(200, 'Ignored', 'Missing Amount');
  assert.equal(missingAmt.outcome, 'needs_review');
  assert.equal(missingAmt.needsReview, true);

  const wrongToken = classifyHuluBetWebhookResponse(401, 'Unknown', '', 'Invalid token');
  assert.equal(wrongToken.outcome, 'auth_error');
  assert.equal(wrongToken.noAutoRetry, true);

  const srv500 = classifyHuluBetWebhookResponse(500, 'Unknown', '', 'Internal Server Error');
  assert.equal(srv500.outcome, 'retry');
  assert.equal(srv500.noAutoRetry, false);
});

test('computeExponentialBackoffMs follows 15s, 30s, 60s ... capped at 5 min (300s)', () => {
  assert.equal(computeExponentialBackoffMs(1), 15_000);
  assert.equal(computeExponentialBackoffMs(2), 30_000);
  assert.equal(computeExponentialBackoffMs(3), 60_000);
  assert.equal(computeExponentialBackoffMs(4), 120_000);
  assert.equal(computeExponentialBackoffMs(5), 240_000);
  assert.equal(computeExponentialBackoffMs(6), 300_000);
  assert.equal(computeExponentialBackoffMs(10), 300_000);
});

test('isQueueItemDueForRetry blocks auth errors and respects nextRetryAt timestamp', () => {
  const now = 1_000_000;
  assert.equal(isQueueItemDueForRetry({ status: 'failed', authError: true, nextRetryAt: 0 }, now), false);
  assert.equal(isQueueItemDueForRetry({ status: 'sent', nextRetryAt: 0 }, now), false);
  assert.equal(isQueueItemDueForRetry({ status: 'failed', nextRetryAt: now + 5000 }, now), false);
  assert.equal(isQueueItemDueForRetry({ status: 'failed', nextRetryAt: now }, now), true);
  assert.equal(isQueueItemDueForRetry({ status: 'pending' }, now), true);
});

test('normalizeHuluBetServerRecord omits empty fields and preserves valid ones', () => {
  const rec = normalizeHuluBetServerRecord({
    ref: 'DK06LG3250',
    bank: 'Telebirr',
    type: 'deposit',
    usage: 'Used',
    claimed_by: '@player12',
    claimed_txn_id: '',
    agent: 'Owner',
  });
  assert.deepEqual(rec, {
    ref: 'DK06LG3250',
    bank: 'Telebirr',
    type: 'deposit',
    usage: 'Used',
    claimed_by: '@player12',
    agent: 'Owner',
  });
  assert.equal('claimed_txn_id' in rec!, false);
});

test('extractRecentArrayFromPayload supports array or wrapped object payloads', () => {
  const fromArray = extractRecentArrayFromPayload([{ ref: 'R1', usage: 'Unused' }]);
  assert.equal(fromArray.length, 1);
  assert.equal(fromArray[0].usage, 'Unused');

  const fromWrapped = extractRecentArrayFromPayload({
    items: [{ ref: 'FT123', usage: 'Payout_Verified', claimed_txn_id: 'WD-99' }],
  });
  assert.equal(fromWrapped.length, 1);
  assert.equal(fromWrapped[0].claimed_txn_id, 'WD-99');
});

test('computeHuluBetOverviewStats aggregates claimed deposits, verified withdrawals, pending, needs review, and latest balances', () => {
  const sample: PaymentRecord[] = [
    {
      id: '1',
      senderAddress: '127',
      bank: 'Telebirr',
      type: 'received',
      category: 'received',
      amount: 1200,
      currency: 'ETB',
      counterparty: 'Abebe',
      reference: 'TLB1',
      balance: 4500,
      rawMessage: 'r1',
      timestamp: 2000,
      date: '',
      syncStatus: 'sent',
      retryCount: 0,
      source: 'sms',
      serverResult: { smsId: '1', httpCode: 200, status: 'Saved', usage: 'Used', claimed_by: 'alex', at: 2000 },
    },
    {
      id: '2',
      senderAddress: 'CBE',
      bank: 'CBE',
      type: 'sent',
      category: 'transfer',
      amount: 800,
      currency: 'ETB',
      counterparty: 'Bekele',
      reference: 'FT2',
      balance: 19200,
      rawMessage: 'r2',
      timestamp: 3000,
      date: '',
      syncStatus: 'sent',
      retryCount: 0,
      source: 'sms',
      serverResult: { smsId: '2', httpCode: 200, status: 'Saved', usage: 'Payout_Verified', claimed_txn_id: 'W7', at: 3000 },
    },
    {
      id: '3',
      senderAddress: '127',
      bank: 'Telebirr',
      type: 'received',
      category: 'received',
      amount: 500,
      currency: 'ETB',
      counterparty: 'Chala',
      reference: 'TLB3',
      rawMessage: 'r3',
      timestamp: 1000,
      date: '',
      syncStatus: 'sent',
      retryCount: 0,
      source: 'sms',
      serverResult: { smsId: '3', httpCode: 200, status: 'Saved', usage: 'Unused', at: 1000 },
    },
    {
      id: '4',
      senderAddress: 'CBE',
      bank: 'CBE',
      type: 'received',
      category: 'received',
      amount: 300,
      currency: 'ETB',
      counterparty: 'Unknown',
      reference: 'SMS-4',
      rawMessage: 'r4',
      timestamp: 4000,
      date: '',
      syncStatus: 'sent',
      needsReview: true,
      needsReviewReason: 'Missing Ref',
      retryCount: 0,
      source: 'sms',
    },
    {
      id: '5',
      senderAddress: 'CBE',
      bank: 'CBE',
      type: 'sent',
      category: 'transfer',
      amount: 100,
      currency: 'ETB',
      counterparty: 'Demo',
      reference: 'FT5',
      rawMessage: 'r5',
      timestamp: 500,
      date: '',
      syncStatus: 'failed',
      retryCount: 2,
      source: 'sms',
    },
  ];

  const stats = computeHuluBetOverviewStats(sample);
  assert.equal(stats.depositsClaimedEtb, 1200);
  assert.equal(stats.depositsClaimedCount, 1);
  assert.equal(stats.withdrawalsVerifiedEtb, 800);
  assert.equal(stats.withdrawalsVerifiedCount, 1);
  assert.equal(stats.pendingUnclaimedCount, 1);
  assert.equal(stats.pendingUnclaimedEtb, 500);
  assert.equal(stats.needsReviewCount, 1);
  assert.equal(stats.syncErrorsCount, 1);
  assert.equal(stats.latestTelebirrBalance, 4500);
  assert.equal(stats.latestCbeBalance, 19200);
});

test('isInvalidHealthcheckSyncResult flags sent rows whose server reply was root {"status":"ok"}', () => {
  assert.equal(
    isInvalidHealthcheckSyncResult('sent', { status: 'Unknown', raw: '{"status":"ok"}' }),
    true
  );
  assert.equal(
    isInvalidHealthcheckSyncResult('sent', { status: 'ok', raw: '{"status": "ok"}' }),
    true
  );
  assert.equal(
    isInvalidHealthcheckSyncResult('sent', {
      status: 'Saved',
      ref: 'DKS1RXM2ZH',
      bank: 'Telebirr',
      raw: '{"status":"Saved","bank":"Telebirr","ref":"DKS1RXM2ZH"}',
    }),
    false
  );
  assert.equal(
    isInvalidHealthcheckSyncResult('sent', {
      status: 'Ignored',
      raw: '{"status":"Ignored","reason":"Not a payment SMS"}',
    }),
    false
  );
});
