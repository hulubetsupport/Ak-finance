import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Eye, EyeOff, ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight, Calendar, Filter } from 'lucide-react';
import { PaymentRecord, AppSettings, TimeRange } from '../types/index.ts';
import { BankCardPattern } from './BankCardPattern.tsx';
import { filterPaymentsByTimeRange, getTimeRangeWindow } from '../utils/timeRange.ts';

interface NetMovementCardProps {
  payments: PaymentRecord[];
  accountCount: number;
  settings: AppSettings;
  currentMonth: string; // e.g. "October 2026"
  timeRange: TimeRange;
  hiddenBankIds?: string[];
  activeDirection?: 'all' | 'received' | 'sent';
  onFilterDirection?: (dir: 'all' | 'received' | 'sent') => void;
  onChangeTimeRange: (range: TimeRange) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToggleHideBalances: () => void;
}

// Lightweight animated number count-up component using requestAnimationFrame
const AnimatedCounter: React.FC<{ value: number; prefix?: string; hidden?: boolean }> = ({
  value,
  prefix = '',
  hidden = false,
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (hidden) return;
    const startValue = prevValueRef.current;
    const endValue = value;
    prevValueRef.current = value;

    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }

    const duration = 400; // ms
    const startTime = performance.now();

    let animationFrameId: number;
    const updateNumber = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * easeProgress;
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateNumber);
      } else {
        setDisplayValue(endValue);
      }
    };

    animationFrameId = requestAnimationFrame(updateNumber);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, hidden]);

  if (hidden) return <span>••••••</span>;

  const formatted = Math.abs(displayValue).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <span>
      {prefix}
      {formatted}
    </span>
  );
};

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

  // Filter valid payments by time range & exclude hidden banks if requested
  const filteredPayments = useMemo(() => {
    let list = filterPaymentsByTimeRange(payments, timeRange);
    list = list.filter(p => !p.isDuplicate && !p.isHidden);

    // Requirement E: Option "Exclude hidden banks from total"
    if (settings.excludeHiddenFromTotal && hiddenBankIds.length > 0) {
      list = list.filter(p => {
        // If bank matches any hiddenBankId, exclude
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

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  };

  const handlePrev = () => {
    triggerHaptic();
    onPrevMonth();
  };

  const handleNext = () => {
    triggerHaptic();
    onNextMonth();
  };

  const rangeButtons: { id: TimeRange; label: string }[] = [
    { id: '1h', label: '1h' },
    { id: '1d', label: '1d' },
    { id: '7d', label: '7d' },
    { id: '1mo', label: '1mo' },
    { id: '1y', label: '1y' },
    { id: 'all', label: isAm ? 'ሁሉም' : 'All' },
  ];

  const rangeWindow = getTimeRangeWindow(timeRange);

  return (
    <div className="w-full max-w-full box-border space-y-2">
      {/* Time Range Selector Chips (Requirement D) */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 scrollbar-none px-0.5">
        <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl">
          {rangeButtons.map(btn => (
            <button
              key={btn.id}
              onClick={() => {
                triggerHaptic();
                onChangeTimeRange(btn.id);
              }}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                timeRange === btn.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Month Switcher Controls */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-1.5 py-1 shadow-2xs shrink-0">
          <button
            onClick={handlePrev}
            className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-[11px] font-bold text-slate-700 font-['Poppins',sans-serif] px-1 truncate max-w-[90px]">
            {currentMonth.split(' ')[0]}
          </span>
          <button
            onClick={handleNext}
            className="w-6 h-6 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Main Net Movement Card */}
      <div 
        style={{ borderRadius: '24px', boxSizing: 'border-box' }}
        className="w-full rounded-[24px] bg-gradient-to-br from-[#07241C] via-[#103D30] to-[#185342] text-white p-5 shadow-lg relative overflow-hidden flex flex-col justify-between"
      >
        {/* Geometric Background Texture */}
        <BankCardPattern type="guilloche" accentColor="#34D399" />

        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-0 w-44 h-44 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header: Label + Eye Toggle */}
        <div className="relative z-10 flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-300/90 font-['Poppins',sans-serif]">
              {isAm ? 'የተጣራ የገንዘብ እንቅስቃሴ' : 'Net Business Movement'}
            </span>
            <span className="text-[9.5px] bg-white/15 text-white/90 font-semibold px-2 py-0.5 rounded-full">
              {rangeWindow.label}
            </span>
          </div>

          <button
            onClick={() => {
              triggerHaptic();
              onToggleHideBalances();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors active:scale-95"
            title={isMasked ? 'Reveal balances' : 'Hide balances'}
          >
            {isMasked ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        {/* Middle: Net Amount (Huge & Bold) */}
        <div className="relative z-10 mb-4">
          <div className="text-3xl sm:text-4xl font-black text-white tracking-tight font-['Poppins',sans-serif] flex items-baseline gap-1.5">
            <span className={netAmount >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
              {netAmount >= 0 ? '+' : '-'}
            </span>
            <AnimatedCounter
              value={Math.abs(netAmount)}
              hidden={isMasked}
            />
            <span className="text-sm font-bold text-emerald-100/70 ml-1">ETB</span>
          </div>
          <div className="text-[11px] text-emerald-100/70 mt-1">
            {filteredPayments.length} {isAm ? 'ግብይቶች ተመዝግበዋል' : 'transactions recorded'} across {accountCount} banks
            {settings.excludeHiddenFromTotal && hiddenBankIds.length > 0 && (
              <span className="ml-1 text-amber-200 text-[10px]">({hiddenBankIds.length} hidden excluded)</span>
            )}
          </div>
        </div>

        {/* Visual Cash Flow Ratio Bar */}
        {(totalReceived > 0 || totalSent > 0) && (
          <div className="relative z-10 mb-3 space-y-1">
            <div className="flex justify-between text-[10px] text-emerald-200/80 font-mono">
              <span>{Math.round((totalReceived / (totalReceived + totalSent || 1)) * 100)}% Inflow</span>
              <span>{Math.round((totalSent / (totalReceived + totalSent || 1)) * 100)}% Outflow</span>
            </div>
            <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden flex">
              <div 
                className="bg-emerald-400 h-full transition-all duration-500" 
                style={{ width: `${(totalReceived / (totalReceived + totalSent || 1)) * 100}%` }}
              />
              <div 
                className="bg-rose-400 h-full transition-all duration-500" 
                style={{ width: `${(totalSent / (totalReceived + totalSent || 1)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Bottom Split: Total In (Received) and Total Out (Sent) - Tappable to filter */}
        <div className="relative z-10 grid grid-cols-2 gap-3 pt-3 border-t border-white/15">
          {/* Total In */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              onFilterDirection?.(activeDirection === 'received' ? 'all' : 'received');
            }}
            className={`rounded-xl p-2.5 flex items-center gap-2.5 text-left transition-all active:scale-95 ${
              activeDirection === 'received'
                ? 'bg-emerald-500/30 ring-2 ring-emerald-400 shadow-md'
                : 'bg-white/10 hover:bg-white/15'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
              <ArrowDownLeft size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-[9.5px] font-semibold text-emerald-200/80 uppercase flex items-center gap-1">
                <span>{isAm ? 'ጠቅላላ ገቢ' : 'Total In'}</span>
                {activeDirection === 'received' && <span className="text-[9px] bg-emerald-400 text-slate-900 font-extrabold px-1 rounded-sm">ON</span>}
              </div>
              <div className="text-sm font-bold text-white truncate font-mono">
                {isMasked ? '••••••' : `+${totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
            </div>
          </button>

          {/* Total Out */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              onFilterDirection?.(activeDirection === 'sent' ? 'all' : 'sent');
            }}
            className={`rounded-xl p-2.5 flex items-center gap-2.5 text-left transition-all active:scale-95 ${
              activeDirection === 'sent'
                ? 'bg-rose-500/30 ring-2 ring-rose-400 shadow-md'
                : 'bg-white/10 hover:bg-white/15'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0">
              <ArrowUpRight size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-[9.5px] font-semibold text-rose-200/80 uppercase flex items-center gap-1">
                <span>{isAm ? 'ጠቅላላ ወጪ' : 'Total Out'}</span>
                {activeDirection === 'sent' && <span className="text-[9px] bg-rose-400 text-slate-900 font-extrabold px-1 rounded-sm">ON</span>}
              </div>
              <div className="text-sm font-bold text-white truncate font-mono">
                {isMasked ? '••••••' : `-${totalSent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
