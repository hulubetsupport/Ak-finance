import React, { useState, useMemo } from 'react';
import { Account, AppSettings, PaymentRecord, TimeRange } from '../types/index.ts';
import { 
  Building2, 
  Smartphone, 
  ChevronRight, 
  Plus, 
  Sparkles, 
  Check, 
  X, 
  Edit3, 
  ArrowUpRight, 
  ArrowDownLeft,
  Eye,
  EyeOff
} from 'lucide-react';
import { getBankBrand, BankBrand } from '../constants/bankBrands.ts';
import { BankCardPattern, EmvChip, ContactlessSymbol, HoloSheen } from './BankCardPattern.tsx';
import { MiniSparkline } from './MiniSparkline.tsx';
import { computeSparklinePoints, filterPaymentsByTimeRange } from '../utils/timeRange.ts';

interface AccountsCardStackProps {
  accounts: Account[];
  payments?: PaymentRecord[];
  settings: AppSettings;
  selectedAccountId: string | null;
  timeRange?: TimeRange;
  hiddenBankIds?: string[];
  onSelectAccount: (accountId: string | null) => void;
  onManageAccounts: () => void;
  onSaveOpeningBalance: (bank: string, amount: number) => Promise<void>;
  onToggleHideBank?: (bankId: string) => void;
  onAddCustomBank?: (bankName: string) => Promise<void>;
}

export const AccountsCardStack: React.FC<AccountsCardStackProps> = ({
  accounts,
  payments = [],
  settings,
  selectedAccountId,
  timeRange = '7d',
  hiddenBankIds = [],
  onSelectAccount,
  onManageAccounts,
  onSaveOpeningBalance,
  onToggleHideBank,
  onAddCustomBank,
}) => {
  const isAm = settings.language === 'am';

  // Opening Balance Modal State
  const [openingBalanceModalBank, setOpeningBalanceModalBank] = useState<string | null>(null);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [savingBalance, setSavingBalance] = useState(false);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  };

  const isBankMasked = (accountId: string) => {
    return settings.hideBalances || hiddenBankIds.includes(accountId);
  };

  const formatAmount = (num: number, isMasked: boolean) => {
    if (isMasked) return '••••••';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Filter payments by current time range for sparklines & cards
  const rangePayments = useMemo(() => {
    return filterPaymentsByTimeRange(payments, timeRange);
  }, [payments, timeRange]);

  // Compute dynamic sparklines adapting to selected timeRange
  const sparklinesByBank = useMemo(() => {
    const map: Record<string, number[]> = {};

    for (const acc of accounts) {
      const bankNorm = acc.bank.toUpperCase().trim();
      const relevant = rangePayments.filter(p => {
        if (p.isDuplicate || p.isHidden) return false;
        const pNorm = p.bank.toUpperCase().trim();
        return pNorm === bankNorm || (bankNorm === 'CBE' && pNorm.includes('COMMERCIAL'));
      });

      const points = computeSparklinePoints(relevant, timeRange);
      const hasAny = points.some(v => v > 0);
      if (!hasAny && (acc.receivedThisMonth || 0) > 0) {
        const base = (acc.receivedThisMonth || 100) / points.length;
        map[acc.bank] = points.map((_, i) => base * (0.6 + (i % 3) * 0.4));
      } else {
        map[acc.bank] = points;
      }
    }
    return map;
  }, [accounts, rangePayments, timeRange]);

  // Compute received/sent within current time range per bank
  const totalsByBank = useMemo(() => {
    const map: Record<string, { received: number; sent: number }> = {};
    for (const acc of accounts) {
      const bankNorm = acc.bank.toUpperCase().trim();
      const bankPayments = rangePayments.filter(p => {
        if (p.isDuplicate || p.isHidden) return false;
        const pNorm = p.bank.toUpperCase().trim();
        return pNorm === bankNorm || (bankNorm === 'CBE' && pNorm.includes('COMMERCIAL'));
      });

      let rCents = 0;
      let sCents = 0;
      for (const p of bankPayments) {
        const c = p.amountCents ?? Math.round(p.amount * 100);
        if (p.type === 'received') rCents += c;
        else if (p.type === 'sent') sCents += c;
      }
      map[acc.id] = { received: rCents / 100, sent: sCents / 100 };
    }
    return map;
  }, [accounts, rangePayments]);

  const handleOpenBalanceModal = (e: React.MouseEvent, acc: Account) => {
    e.stopPropagation();
    triggerHaptic();
    setOpeningBalanceModalBank(acc.bank);
    setOpeningBalanceInput(acc.openingBalance ? String(acc.openingBalance) : '');
  };

  const handleSaveOpening = async () => {
    if (!openingBalanceModalBank) return;
    const num = parseFloat(openingBalanceInput) || 0;
    setSavingBalance(true);
    try {
      await onSaveOpeningBalance(openingBalanceModalBank, num);
      setOpeningBalanceModalBank(null);
    } finally {
      setSavingBalance(false);
    }
  };

  return (
    <div className="w-full max-w-full overflow-hidden box-border space-y-2">
      {/* Title Row */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-['Poppins',sans-serif] truncate">
            {isAm ? 'የባንክ ሂሳቦች' : 'Bank Accounts & Balances'}
          </span>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-200/70 px-1.5 py-0.2 rounded-full shrink-0">
            {accounts.length}
          </span>
        </div>
        <button
          onClick={() => { triggerHaptic(); onManageAccounts(); }}
          className="text-xs font-bold text-[#14503F] hover:underline flex items-center gap-0.5 active:scale-95 transition-transform shrink-0"
        >
          {isAm ? 'አስተዳድር' : 'Manage'}
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Bank Quick Shortcuts Selector Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 no-scrollbar">
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            onSelectAccount(null);
          }}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
            !selectedAccountId
              ? 'bg-[#14503F] text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>{isAm ? 'ሁሉም ባንኮች' : 'All Banks'}</span>
        </button>

        {accounts.map(acc => {
          const brand = getBankBrand(acc.bank);
          const isSelected = selectedAccountId === acc.id;
          const logo = acc.logoUrl || brand.logoUrl;

          return (
            <button
              key={acc.id}
              type="button"
              onClick={() => {
                triggerHaptic();
                onSelectAccount(isSelected ? null : acc.id);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-xs ring-2 ring-slate-900 ring-offset-1'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {logo ? (
                <img src={logo} alt={acc.name} className="w-3.5 h-3.5 object-contain rounded-full" />
              ) : (
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: brand.accentColor }} />
              )}
              <span>{acc.shortCode || brand.shortCode || acc.name}</span>
            </button>
          );
        })}
      </div>

      {/* Requirement A1: Bank cards in a scroll-snap carousel where each card is 85% wide so the next one peeks */}
      <div className="flex gap-3.5 overflow-x-auto pb-2.5 pt-1 scroll-smooth snap-x snap-mandatory scrollbar-none px-4 -mx-4 items-center">
        {accounts.map(acc => {
          const brand: BankBrand = getBankBrand(acc.bank);
          const isSelected = selectedAccountId === acc.id;
          const masked = isBankMasked(acc.id);
          const sparklineData = sparklinesByBank[acc.bank] || [0, 0, 0, 0, 0, 0, 0];
          const totals = totalsByBank[acc.id] || { received: acc.receivedThisMonth || 0, sent: acc.sentThisMonth || 0 };
          const logo = acc.logoUrl || brand.logoUrl;

          return (
            <div
              key={acc.id}
              onClick={() => {
                triggerHaptic();
                onSelectAccount(isSelected ? null : acc.id);
              }}
              style={{
                borderRadius: '24px',
                boxSizing: 'border-box',
              }}
              className={`group w-[85%] max-w-[340px] shrink-0 snap-center rounded-[24px] p-4 text-white shadow-md cursor-pointer transition-all duration-300 select-none relative overflow-hidden flex flex-col justify-between min-h-[180px] bg-gradient-to-br ${brand.gradientClass} ${
                isSelected 
                  ? 'ring-2 ring-white/90 ring-offset-2 ring-offset-[#F4F7F5] scale-[1.02] -translate-y-0.5 shadow-2xl' 
                  : 'hover:shadow-xl opacity-98 hover:opacity-100'
              }`}
            >
              {/* Geometric Bank Card Pattern */}
              <BankCardPattern type={brand.patternType} accentColor={brand.accentColor} />

              {/* Holographic Shimmer Effect */}
              <HoloSheen />

              {/* Decorative radial lighting */}
              <div 
                className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full blur-xl pointer-events-none opacity-30"
                style={{ backgroundColor: brand.accentColor }}
              />

              {/* Top Row: Bank Badge with Logo Image & Action Buttons */}
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Bank Logo Image or Monogram */}
                    {logo ? (
                      <div className="w-8 h-8 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-xs border border-white/40 overflow-hidden">
                        <img 
                          src={logo} 
                          alt={brand.name} 
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    ) : (
                      <div className={`px-2 py-0.5 rounded-xl border font-black text-[11px] tracking-wider flex items-center gap-1 backdrop-blur-xs shadow-2xs ${brand.badgeClass}`}>
                        {acc.type === 'mobile' ? <Smartphone size={11} /> : <Building2 size={11} />}
                        <span>{acc.shortCode || brand.shortCode}</span>
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-white tracking-tight truncate font-['Poppins',sans-serif]">
                        {acc.name}
                      </div>
                      <div className="text-[10px] text-white/70 font-mono truncate">
                        {acc.maskedNumber}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Requirement E: Per-bank eye toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic();
                        onToggleHideBank?.(acc.id);
                      }}
                      className="p-1.5 rounded-lg bg-black/20 hover:bg-black/35 text-white/90 transition-colors backdrop-blur-2xs"
                      title={masked ? 'Reveal balance' : 'Hide balance'}
                    >
                      {masked ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>

                    {/* Edit Opening Balance Shortcut */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenBalanceModal(e, acc)}
                      className="p-1.5 rounded-lg bg-black/20 hover:bg-black/35 text-white/90 transition-colors backdrop-blur-2xs"
                      title={isAm ? 'የመነሻ ሂሳብ አስተካክል' : 'Edit opening balance'}
                    >
                      <Edit3 size={13} />
                    </button>

                    {isSelected && (
                      <span className="text-[9px] bg-white text-slate-900 font-extrabold px-1.5 py-0.5 rounded-full shadow-xs animate-pulse">
                        Active
                      </span>
                    )}
                  </div>
                </div>

                {/* EMV Microchip Graphic & Contactless Wave */}
                <div className="flex items-center gap-2 mt-1">
                  <EmvChip className="w-6 h-4 shadow-xs" />
                  <ContactlessSymbol className="w-3.5 h-3.5 text-white/60" />
                </div>
              </div>

              {/* Middle: Current Balance OR "Sync your balance" button */}
              <div className="my-1.5 relative z-10">
                {!acc.hasSyncedBalance ? (
                  <button
                    type="button"
                    onClick={(e) => handleOpenBalanceModal(e, acc)}
                    className="w-full py-1.5 px-2 rounded-xl bg-white text-slate-900 font-extrabold text-[11px] shadow-sm hover:bg-emerald-50 active:scale-95 transition-all flex items-center justify-center gap-1"
                  >
                    <Sparkles size={12} className="text-amber-500 animate-pulse" />
                    <span>{isAm ? 'ሂሳብህን አስተካክል (Sync)' : 'Sync your balance'}</span>
                  </button>
                ) : (
                  <div>
                    <div className="text-[10px] uppercase font-semibold text-white/70 tracking-wider">
                      {isAm ? 'የአሁኑ ቀሪ ሂሳብ' : 'Current Balance'}
                    </div>
                    <div className="text-2xl font-black text-white tracking-tight font-['Poppins',sans-serif] leading-tight">
                      {formatAmount(acc.balance, masked)}{' '}
                      <span className="text-xs font-semibold text-white/80">ETB</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom: Sparkline + Period In/Out Totals */}
              <div className="pt-2 border-t border-white/15 flex items-end justify-between relative z-10">
                <div className="flex items-center gap-3 text-[11px]">
                  <div className="flex items-center gap-1">
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-400/30 text-emerald-200 flex items-center justify-center">
                      <ArrowDownLeft size={10} />
                    </span>
                    <span className="font-bold text-white font-mono">
                      {masked ? '••••' : totals.received.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3.5 h-3.5 rounded-full bg-white/20 text-white/80 flex items-center justify-center">
                      <ArrowUpRight size={10} />
                    </span>
                    <span className="font-bold text-white font-mono">
                      {masked ? '••••' : totals.sent.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Adaptive Sparkline */}
                <div className="w-20 h-6">
                  <MiniSparkline data={sparklineData} strokeColor={brand.accentColor} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Bank Filter Pill Banner */}
      {selectedAccountId && (() => {
        const activeAcc = accounts.find(a => a.id === selectedAccountId);
        if (!activeAcc) return null;
        const brand = getBankBrand(activeAcc.bank);
        return (
          <div className="flex items-center justify-between bg-emerald-950 text-emerald-100 px-3 py-1.5 rounded-xl text-xs font-medium border border-emerald-800/80 shadow-xs">
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="truncate">
                {isAm ? `${activeAcc.name} ክፍያዎች ብቻ እየታዩ ነው` : `Filtering: ${activeAcc.name}`}
              </span>
            </div>
            <button
              onClick={() => {
                triggerHaptic();
                onSelectAccount(null);
              }}
              className="text-[11px] font-bold text-emerald-300 hover:text-white px-2 py-0.5 rounded-lg bg-emerald-900/80 hover:bg-emerald-800 shrink-0"
            >
              {isAm ? 'አጽዳ ✕' : 'Clear ✕'}
            </button>
          </div>
        );
      })()}

      {/* Opening Balance Modal */}
      {openingBalanceModalBank && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                {openingBalanceModalBank} · {isAm ? 'የመነሻ ሂሳብ' : 'Opening Balance'}
              </h3>
              <button
                onClick={() => setOpeningBalanceModalBank(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              {isAm 
                ? 'የባንክ SMS ቀሪ ሂሳብን እስኪያገኝ ድረስ፣ ይህ የመነሻ ሂሳብ ተደምሮ እና ተቀንሶ ትክክለኛውን ሂሳብ ያሰላል።' 
                : 'Until an official bank SMS with current balance arrives, your balance will calculate automatically as: Opening + Received - Sent.'}
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">
                {isAm ? 'የመነሻ ሂሳብ መጠን (ETB)' : 'Starting Balance (ETB)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  value={openingBalanceInput}
                  onChange={e => setOpeningBalanceInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#14503F]"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                  ETB
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpeningBalanceModalBank(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingBalance}
                onClick={handleSaveOpening}
                className="flex-1 py-2 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-xs hover:bg-[#0e3b2e]"
              >
                {savingBalance ? 'Saving...' : 'Save Balance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
