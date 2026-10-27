import { PaymentRecord, TimeRange } from '../types/index.ts';

export interface TimeRangeWindow {
  startTime: number;
  endTime: number;
  bucketCount: number;
  bucketDurationMs: number;
  label: string;
}

export function getTimeRangeWindow(
  range: TimeRange,
  customStart?: number,
  customEnd?: number
): TimeRangeWindow {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;

  switch (range) {
    case '1h':
      return {
        startTime: now - hourMs,
        endTime: now,
        bucketCount: 6,
        bucketDurationMs: 10 * 60 * 1000, // 10 min buckets
        label: 'Last 1 Hour',
      };
    case '1d':
      return {
        startTime: now - dayMs,
        endTime: now,
        bucketCount: 6,
        bucketDurationMs: 4 * hourMs, // 4 hour buckets
        label: 'Last 24 Hours',
      };
    case '7d':
      return {
        startTime: now - 7 * dayMs,
        endTime: now,
        bucketCount: 7,
        bucketDurationMs: dayMs, // 1 day buckets
        label: 'Last 7 Days',
      };
    case '1mo': {
      // 30 days window
      return {
        startTime: now - 30 * dayMs,
        endTime: now,
        bucketCount: 6,
        bucketDurationMs: 5 * dayMs,
        label: 'Last 30 Days',
      };
    }
    case '1y':
      return {
        startTime: now - 365 * dayMs,
        endTime: now,
        bucketCount: 12,
        bucketDurationMs: 30 * dayMs,
        label: 'Last 1 Year',
      };
    case 'custom': {
      const s = customStart || now - 7 * dayMs;
      const e = customEnd || now;
      const duration = Math.max(e - s, 1000);
      return {
        startTime: s,
        endTime: e,
        bucketCount: 6,
        bucketDurationMs: duration / 6,
        label: 'Custom Range',
      };
    }
    case 'all':
    default:
      return {
        startTime: 0,
        endTime: now + dayMs,
        bucketCount: 7,
        bucketDurationMs: dayMs,
        label: 'All Time',
      };
  }
}

export function filterPaymentsByTimeRange(
  payments: PaymentRecord[],
  range: TimeRange,
  customStart?: number,
  customEnd?: number
): PaymentRecord[] {
  if (range === 'all') return payments;
  const window = getTimeRangeWindow(range, customStart, customEnd);
  return payments.filter(p => p.timestamp >= window.startTime && p.timestamp <= window.endTime);
}

export function computeSparklinePoints(
  payments: PaymentRecord[],
  range: TimeRange,
  customStart?: number,
  customEnd?: number
): number[] {
  const window = getTimeRangeWindow(range, customStart, customEnd);
  const buckets: number[] = new Array(window.bucketCount).fill(0);

  if (range === 'all') {
    if (payments.length === 0) return [0, 0, 0, 0, 0, 0, 0];
    const minTs = payments.reduce((min, p) => Math.min(min, p.timestamp), payments[0].timestamp);
    const maxTs = payments.reduce((max, p) => Math.max(max, p.timestamp), Date.now());
    const step = Math.max((maxTs - minTs) / window.bucketCount, 1);
    for (const p of payments) {
      if (p.isDuplicate || p.isHidden) continue;
      const idx = Math.min(Math.floor((p.timestamp - minTs) / step), window.bucketCount - 1);
      if (idx >= 0 && idx < window.bucketCount) {
        buckets[idx] += p.amount;
      }
    }
    return buckets;
  }

  for (const p of payments) {
    if (p.isDuplicate || p.isHidden) continue;
    if (p.timestamp < window.startTime || p.timestamp > window.endTime) continue;
    const offset = p.timestamp - window.startTime;
    const idx = Math.min(Math.floor(offset / window.bucketDurationMs), window.bucketCount - 1);
    if (idx >= 0 && idx < window.bucketCount) {
      buckets[idx] += p.amount;
    }
  }

  return buckets;
}
