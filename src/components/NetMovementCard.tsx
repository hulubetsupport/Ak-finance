import React, { useMemo } from 'react';
import { Eye, EyeOff, ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { PaymentRecord, AppSettings, TimeRange } from '../types/index.ts';
import { filterPaymentsByTimeRange, getTimeRangeWindow } from '../utils/timeRange.ts';

interface NetMovementCardProps {
  payments: PaymentRecord[];
  accountCount: number;
  settings: AppSettings;
  currentMonth: string;
  timeRange: TimeRange;
  hiddenBankIds?: string[];
  activeDirection?: 'all' | 'received' | 'sent';
  onFilterDirection?: (dir: 'all' | 'received' | 'sent') => void;
  onChangeTimeRange: (range: TimeRange) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToggleHideBalances: () => void;
}

export const NetMovementCard: React.FC<NetMovementCardProps> = ({
  payments,
  accountCount,
  settings,
  currentMonth,
  timeRange,
  hiddenBankIds = [],
  activeDirection = 'all',
  onFilterDirection,
  onChangeTimeRange,
  onPrevMonth,
  onNextMonth,
  onToggleHideBalances,
}) => {
  const isAm = settings.language === 'am';
  const isMasked = settings.hideBalances;

  const filteredPayments = useMemo(() => {
    let list = filterPaymentsByTimeRange(payments, timeRange);
    list = list.filter(p => !p.isDuplicate && !p.isHidden && p.category !== 'alert');

    if (settings.excludeHiddenFromTotal && hiddenBankIds.length > 0) {
      list = list.filter(p => {
        return !hiddenBankIds.some(hId => {
          const lowerH = hId.toLowerCase();
          const lowerBank = (p.bank || '').toLowerCase();
          return lowerH.includes(lowerBank) || lowerBank.includes(lowerH.replace('acc-', ''));
        });
      });
    }

    return list;
  }, [payments, timeRange, settings.excludeHiddenFromTotal, hiddenBankIds]);

  const receivedList = filteredPayments.filter(p => p.type === 'received');
  const sentList = filteredPayments.filter(p => p.type === 'sent');

  const totalReceived = receivedList.reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalSent = sentList.reduce((acc, p) => acc + (p.amount || 0), 0);
  const netAmount = totalReceived - totalSent;

  const rangeButtons: { id: TimeRange; label: string }[] = [
    { id: '1h', label: '1h' },
    { id: '1d', label: '1d' },
    { id: '7d', label: '7d' },
    { id: '1mo', label: '1mo' },
    { id: '1y', label: '1y' },
    { id: 'all', label: isAm ? 'ሁሉም' : 'All' },
  ];

  const rangeWindow = getTimeRangeWindow(timeRange);
  const totalVolume = totalReceived + totalSent;
  const inflowPct = totalVolume > 0 ? Math.round((totalReceived / totalVolume) * 100) : 50;
  const outflowPct = totalVolume > 0 ? 100 - inflowPct : 50;

  return (
    <section aria-label="Net Cashflow Summary" className="w-full space-y-2.5">
      {/* Toolbar: Time Range + Month Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-0.5 bg-slate-200/70 p-1 rounded-xl">
          {rangeButtons.map(btn => (
            <button
              key={btn.id}
              type="button"
              onClick={() => onChangeTimeRange(btn.id)}
              className={`min-h-[32px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                timeRange === btn.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-1.5 py-0.5 shrink-0">
          <button
            type="button"
            onClick={onPrevMonth}
            aria-label="Previous month"
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold text-slate-800 px-1.5 whitespace-nowrap">
            {currentMonth}
          </span>
          <button
            type="button"
            onClick={onNextMonth}
            aria-label="Next month"
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Primary Treasury Panel */}
      <div className="rounded-2xl bg-[#0B3B2E] text-white p-5 border border-[#14503F] space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-emerald-200/90 flex items-center gap-2">
              <span>{isAm ? 'የተጣራ የገንዘብ እንቅስቃሴ' : 'Net Business Movement'}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-100/75">{rangeWindow.label}</span>
            </div>

            <div className="mt-1.5 flex items-baseline gap-2 font-mono tabular-nums">
              <span className={`text-3xl sm:text-4xl font-bold tracking-tight ${netAmount >= 0 ? 'text-white' : 'text-rose-200'}`}>
                {isMasked
                  ? '••••••'
                  : `${netAmount >= 0 ? '+' : '-'}${Math.abs(netAmount).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`}
              </span>
              <span className="text-xs font-semibold text-emerald-200/80">ETB</span>
            </div>

            <div className="text-xs text-emerald-100/75 mt-1 font-mono tabular-nums">
              {filteredPayments.length} {isAm ? 'ግብይቶች' : 'transactions'} · {accountCount} {isAm ? 'ባንኮች' : 'accounts'}
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleHideBalances}
            aria-label={isMasked ? 'Show totals' : 'Hide totals'}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
          >
            {isMasked ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {/* Flow Ratio Bar */}
        {totalVolume > 0 && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono tabular-nums text-emerald-100/80">
              <span>{inflowPct}% Inflow</span>
              <span>{outflowPct}% Outflow</span>
            </div>
            <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden flex">
              <div className="bg-emerald-400 h-full" style={{ width: `${inflowPct}%` }} />
              <div className="bg-rose-400 h-full" style={{ width: `${outflowPct}%` }} />
            </div>
          </div>
        )}

        {/* Total In / Total Out Interactive Filter Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/15">
          <button
            type="button"
            onClick={() => onFilterDirection?.(activeDirection === 'received' ? 'all' : 'received')}
            className={`min-h-[54px] rounded-xl px-3 py-2 flex items-center gap-2.5 text-left transition-colors ${
              activeDirection === 'received'
                ? 'bg-emerald-500/25 ring-1 ring-emerald-300'
                : 'bg-white/8 hover:bg-white/15'
            }`}
          >
            <ArrowDownLeft size={16} className="text-emerald-300 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-emerald-200/85 font-medium">
                {isAm ? 'ጠቅላላ ገቢ' : 'Total In'}
                {activeDirection === 'received' ? ' · Filtered' : ''}
              </div>
              <div className="font-mono text-sm font-bold text-white tabular-nums truncate">
                {isMasked
                  ? '••••••'
                  : `+${totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onFilterDirection?.(activeDirection === 'sent' ? 'all' : 'sent')}
            className={`min-h-[54px] rounded-xl px-3 py-2 flex items-center gap-2.5 text-left transition-colors ${
              activeDirection === 'sent'
                ? 'bg-rose-500/25 ring-1 ring-rose-300'
                : 'bg-white/8 hover:bg-white/15'
            }`}
          >
            <ArrowUpRight size={16} className="text-rose-300 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-rose-200/85 font-medium">
                {isAm ? 'ጠቅላላ ወጪ' : 'Total Out'}
                {activeDirection === 'sent' ? ' · Filtered' : ''}
              </div>
              <div className="font-mono text-sm font-bold text-white tabular-nums truncate">
                {isMasked
                  ? '••••••'
                  : `-${totalSent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
};
