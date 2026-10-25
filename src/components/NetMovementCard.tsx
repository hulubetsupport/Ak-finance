import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { PaymentRecord, AppSettings } from '../types/index.ts';
import { BankCardPattern } from './BankCardPattern.tsx';

interface NetMovementCardProps {
  payments: PaymentRecord[];
  accountCount: number;
  settings: AppSettings;
  currentMonth: string; // e.g. "October 2026"
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

    const duration = 450; // ms
    const startTime = performance.now();

    let animationFrameId: number;
    const updateNumber = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
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
  onPrevMonth,
  onNextMonth,
  onToggleHideBalances,
}) => {
  const validPayments = payments.filter(p => !p.isDuplicate && !p.isHidden);
  const receivedList = validPayments.filter(p => p.type === 'received');
  const sentList = validPayments.filter(p => p.type === 'sent');

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

  const handleToggle = () => {
    triggerHaptic();
    onToggleHideBalances();
  };

  const isAm = settings.language === 'am';

  return (
    <div className="bg-[#14503F] text-white rounded-[24px] p-5 shadow-lg relative overflow-hidden transition-all duration-300 border border-emerald-800/50">
      {/* Subtle Guilloche Bank Pattern Overlay */}
      <BankCardPattern type="guilloche" accentColor="#34D399" />

      {/* Decorative gradient accents */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-52 h-52 rounded-full bg-emerald-500/15 blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-52 h-52 rounded-full bg-[#1E3A8A]/25 blur-2xl pointer-events-none" />

      {/* Top row: Label + Eye toggle + Month switcher */}
      <div className="relative z-10 flex items-center justify-between border-b border-emerald-800/60 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-widest text-emerald-200 uppercase font-mono">
            {isAm ? 'የተጣራ እንቅስቃሴ · ETB' : 'NET MOVEMENT · ETB'}
          </span>
          <button
            onClick={handleToggle}
            className="text-emerald-300 hover:text-white transition-colors p-1"
            title={settings.hideBalances ? 'Show balances' : 'Hide balances'}
            aria-label="Toggle amount visibility"
          >
            {settings.hideBalances ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        {/* Month switcher */}
        <div className="flex items-center gap-1.5 bg-emerald-900/60 backdrop-blur-xs px-2.5 py-1 rounded-full border border-emerald-700/50 text-[11px] text-emerald-100">
          <button
            onClick={handlePrev}
            className="hover:text-white transition-colors active:scale-90"
            aria-label="Previous month"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="font-semibold select-none font-['Poppins',sans-serif]">{currentMonth}</span>
          <button
            onClick={handleNext}
            className="hover:text-white transition-colors active:scale-90"
            aria-label="Next month"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Big Net Figure with Animated Count-up */}
      <div className="relative z-10 mb-4">
        <div className="text-3xl md:text-4xl font-extrabold tracking-tight text-white font-['Poppins',sans-serif]">
          {settings.hideBalances ? (
            'ETB ••••••••'
          ) : (
            <>
              <span className="text-xl md:text-2xl text-emerald-300 font-medium mr-1.5">ETB</span>
              <AnimatedCounter
                value={netAmount}
                prefix={netAmount >= 0 ? '+' : '-'}
                hidden={settings.hideBalances}
              />
            </>
          )}
        </div>
        <p className="text-[11px] text-emerald-200/80 mt-0.5 font-['Poppins',sans-serif]">
          {isAm ? 'የገቢ እና የወጪ ልዩነት ድምር' : 'Net cash movement across all monitored accounts'}
        </p>
      </div>

      {/* Sent vs. Received Breakdown Grid */}
      <div className="relative z-10 grid grid-cols-2 gap-3 pt-3 border-t border-emerald-800/60 font-['Poppins',sans-serif]">
        {/* Received */}
        <div className="bg-emerald-900/40 rounded-xl p-3 border border-emerald-800/50">
          <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-semibold mb-1">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-300">
              <ArrowDownLeft size={13} />
            </div>
            <span>{isAm ? 'የገባ (Received)' : 'Received'}</span>
          </div>
          <div className="font-bold text-base md:text-lg text-white">
            {settings.hideBalances ? (
              '••••'
            ) : (
              <AnimatedCounter value={totalReceived} prefix="+" hidden={settings.hideBalances} />
            )}
          </div>
          <div className="text-[10px] text-emerald-300/70 mt-0.5">
            {receivedList.length} {isAm ? 'ግብይቶች' : 'captured payments'}
          </div>
        </div>

        {/* Sent */}
        <div className="bg-emerald-900/40 rounded-xl p-3 border border-emerald-800/50">
          <div className="flex items-center gap-1.5 text-rose-300 text-xs font-semibold mb-1">
            <div className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-300">
              <ArrowUpRight size={13} />
            </div>
            <span>{isAm ? 'የተላከ (Sent)' : 'Sent'}</span>
          </div>
          <div className="font-bold text-base md:text-lg text-white">
            {settings.hideBalances ? (
              '••••'
            ) : (
              <AnimatedCounter value={totalSent} prefix="-" hidden={settings.hideBalances} />
            )}
          </div>
          <div className="text-[10px] text-rose-300/70 mt-0.5">
            {sentList.length} {isAm ? 'ወጪዎች' : 'transfers/bills'}
          </div>
        </div>
      </div>

      {/* Footer count indicator: "12 captured payments · 3 accounts" */}
      <div className="relative z-10 mt-4 pt-2.5 border-t border-emerald-800/40 flex items-center justify-between text-[11px] text-emerald-200/90 font-medium">
        <div className="flex items-center gap-2">
          <span>{payments.length} {isAm ? 'የተመዘገቡ ክፍያዎች' : 'captured payments'}</span>
          <span>·</span>
          <span>{accountCount} {isAm ? 'ሂሳቦች' : 'accounts'}</span>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
          SQLite Active
        </span>
      </div>
    </div>
  );
};
