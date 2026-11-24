import React, { useState, useMemo } from 'react';
import { Account, AppSettings, PaymentRecord, TimeRange } from '../types/index.ts';
import {
  Building2,
  Smartphone,
  ChevronRight,
  Plus,
  X,
  Edit3,
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  EyeOff,
} from 'lucide-react';
import { getBankBrand, BankBrand } from '../constants/bankBrands.ts';
import { BankCardPattern } from './BankCardPattern.tsx';
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
}) => {
  const isAm = settings.language === 'am';

  const [openingBalanceModalBank, setOpeningBalanceModalBank] = useState<string | null>(null);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [savingBalance, setSavingBalance] = useState(false);

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

  const rangePayments = useMemo(() => {
    return filterPaymentsByTimeRange(payments, timeRange);
  }, [payments, timeRange]);

  const sparklinesByBank = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const acc of accounts) {
      const bankNorm = acc.bank.toUpperCase().trim();
      const relevant = rangePayments.filter(p => {
        if (p.isDuplicate || p.isHidden || p.category === 'alert') return false;
        const pNorm = p.bank.toUpperCase().trim();
        return pNorm === bankNorm || (bankNorm === 'CBE' && pNorm.includes('COMMERCIAL'));
      });
      const points = computeSparklinePoints(relevant, timeRange);
      map[acc.bank] = points;
    }
    return map;
  }, [accounts, rangePayments, timeRange]);

  const totalsByBank = useMemo(() => {
    const map: Record<string, { received: number; sent: number }> = {};
    for (const acc of accounts) {
      const bankNorm = acc.bank.toUpperCase().trim();
      const bankPayments = rangePayments.filter(p => {
        if (p.isDuplicate || p.isHidden || p.category === 'alert') return false;
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

  const handleOpenBalanceModal = (acc: Account) => {
    setOpeningBalanceModalBank(acc.bank);
    setOpeningBalanceInput(acc.openingBalance !== undefined ? String(acc.openingBalance) : '');
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
    <section aria-label="Bank Accounts" className="w-full max-w-full space-y-3">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="font-display text-sm font-semibold text-slate-900 truncate">
            {isAm ? 'የባንክ ሂሳቦች' : 'Accounts & Balances'}
          </h2>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {accounts.length} {isAm ? 'ሂሳቦች' : 'banks'}
          </span>
        </div>

        <button
          type="button"
          onClick={onManageAccounts}
          className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-semibold text-[#0F4C3A] hover:bg-emerald-50 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus size={14} />
          <span>{isAm ? 'ባንኮችን አስተዳድር' : 'Manage Banks'}</span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Bank Filter Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <button
          type="button"
          onClick={() => onSelectAccount(null)}
          className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors border ${
            !selectedAccountId
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          {isAm ? 'ሁሉም ባንኮች' : 'All Banks'}
        </button>

        {accounts.map(acc => {
          const brand = getBankBrand(acc.bank);
          const isSelected = selectedAccountId === acc.id;
          const logo = acc.logoUrl || brand.logoUrl;

          return (
            <button
              key={acc.id}
              type="button"
              onClick={() => onSelectAccount(isSelected ? null : acc.id)}
              className={`min-h-[34px] flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors border ${
                isSelected
                  ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {logo && (
                <img
                  src={logo}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-3.5 h-3.5 object-contain rounded-sm bg-white"
                />
              )}
              <span>{acc.shortCode || brand.shortCode || acc.name}</span>
            </button>
          );
        })}
      </div>

      {/* Cards Grid on Desktop / Snap Carousel on Mobile */}
      <div className="flex md:grid md:grid-cols-2 2xl:grid-cols-3 gap-3 overflow-x-auto md:overflow-visible pb-1 scroll-smooth snap-x snap-mandatory no-scrollbar">
        {accounts.map(acc => {
          const brand: BankBrand = getBankBrand(acc.bank);
          const isSelected = selectedAccountId === acc.id;
          const masked = isBankMasked(acc.id);
          const sparklineData = sparklinesByBank[acc.bank] || [0, 0, 0, 0, 0, 0, 0];
          const totals = totalsByBank[acc.id] || {
            received: acc.receivedThisMonth || 0,
            sent: acc.sentThisMonth || 0,
          };
          const logo = acc.logoUrl || brand.logoUrl;

          return (
            <article
              key={acc.id}
              className={`w-[84%] sm:w-[320px] md:w-full shrink-0 snap-center rounded-2xl p-4 text-white relative overflow-hidden flex flex-col justify-between min-h-[168px] bg-gradient-to-br ${brand.gradientClass} border transition-all ${
                isSelected
                  ? 'border-white ring-2 ring-[#0F4C3A] ring-offset-2 ring-offset-[#F7F8F6]'
                  : 'border-black/10'
              }`}
            >
              <BankCardPattern type={brand.patternType} accentColor={brand.accentColor} />

              {/* Top Row */}
              <div className="relative z-10 flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectAccount(isSelected ? null : acc.id)}
                  aria-label={`Filter by ${acc.name}`}
                  className="flex items-center gap-2.5 min-w-0 text-left flex-1 focus:outline-none"
                >
                  {logo ? (
                    <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      <img
                        src={logo}
                        alt={brand.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                        onError={e => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0 font-mono font-bold text-xs">
                      {acc.type === 'mobile' ? <Smartphone size={15} /> : <Building2 size={15} />}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="font-display text-sm font-semibold text-white truncate">
                      {acc.name}
                    </div>
                    <div className="text-[11px] text-white/75 font-mono truncate">
                      {acc.maskedNumber}
                      {isSelected ? ' · Active filter' : ''}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggleHideBank?.(acc.id)}
                    aria-label={masked ? `Reveal ${acc.name} balance` : `Hide ${acc.name} balance`}
                    className="w-8 h-8 rounded-lg bg-black/20 hover:bg-black/35 text-white/90 flex items-center justify-center transition-colors"
                  >
                    {masked ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenBalanceModal(acc)}
                    aria-label={`Edit ${acc.name} opening balance`}
                    className="w-8 h-8 rounded-lg bg-black/20 hover:bg-black/35 text-white/90 flex items-center justify-center transition-colors"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>

              {/* Balance Row */}
              <div className="relative z-10 my-2.5">
                {!acc.hasSyncedBalance && acc.balance === 0 ? (
                  <button
                    type="button"
                    onClick={() => handleOpenBalanceModal(acc)}
                    className="py-1.5 px-3 rounded-lg bg-white/95 text-slate-900 font-semibold text-xs hover:bg-white transition-colors whitespace-nowrap"
                  >
                    {isAm ? 'የመነሻ ሂሳብ አስገባ' : 'Set opening balance'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectAccount(isSelected ? null : acc.id)}
                    className="text-left focus:outline-none w-full"
                  >
                    <div className="text-[11px] text-white/75 font-medium">
                      {acc.hasSyncedBalance
                        ? isAm
                          ? 'ቀሪ ሂሳብ'
                          : 'Current Balance'
                        : isAm
                          ? 'የተሰላ እንቅስቃሴ'
                          : 'Tracked Net Activity'}
                    </div>
                    <div className="font-mono text-2xl font-bold text-white tracking-tight tabular-nums leading-tight mt-0.5">
                      {formatAmount(acc.balance, masked)}{' '}
                      <span className="text-xs font-medium text-white/80">ETB</span>
                    </div>
                  </button>
                )}
              </div>

              {/* Bottom Flow + Sparkline */}
              <div className="relative z-10 pt-2 border-t border-white/15 flex items-end justify-between gap-2">
                <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                  <span className="inline-flex items-center gap-1 text-emerald-200">
                    <ArrowDownLeft size={12} />
                    <span>{masked ? '••••' : totals.received.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-white/85">
                    <ArrowUpRight size={12} />
                    <span>{masked ? '••••' : totals.sent.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                  </span>
                </div>

                <div className="w-20 h-5 shrink-0">
                  <MiniSparkline data={sparklineData} strokeColor={brand.accentColor} />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Active Bank Filter Notice */}
      {selectedAccountId && (() => {
        const activeAcc = accounts.find(a => a.id === selectedAccountId);
        if (!activeAcc) return null;
        return (
          <div className="flex items-center justify-between bg-emerald-50 text-emerald-950 px-3 py-2 rounded-xl text-xs border border-emerald-200">
            <span className="font-medium truncate">
              {isAm ? `እየታዩ ያሉት: ${activeAcc.name}` : `Filtered by bank: ${activeAcc.name}`}
            </span>
            <button
              type="button"
              onClick={() => onSelectAccount(null)}
              className="text-xs font-semibold text-[#0F4C3A] hover:underline shrink-0 ml-2"
            >
              {isAm ? 'ሁሉንም አሳይ' : 'Clear filter'}
            </button>
          </div>
        );
      })()}

      {/* Opening Balance Modal */}
      {openingBalanceModalBank && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                {openingBalanceModalBank} · {isAm ? 'የመነሻ ሂሳብ' : 'Opening Balance'}
              </h3>
              <button
                type="button"
                onClick={() => setOpeningBalanceModalBank(null)}
                aria-label="Close balance modal"
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isAm
                ? 'የባንክ SMS ቀሪ ሂሳብ እስኪመጣ ድረስ፣ መነሻ + ገቢ - ወጪ በራስ-ሰር ይሰላል።'
                : 'Until a bank SMS includes your updated account balance, balance is tracked as Opening + Received - Sent.'}
            </p>

            <div className="space-y-1.5">
              <label htmlFor="opening-balance-input" className="text-xs font-semibold text-slate-700 block">
                {isAm ? 'የመነሻ ሂሳብ (ETB)' : 'Starting Balance (ETB)'}
              </label>
              <div className="relative">
                <input
                  id="opening-balance-input"
                  type="number"
                  step="0.01"
                  value={openingBalanceInput}
                  onChange={e => setOpeningBalanceInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#0F4C3A]"
                />
                <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">
                  ETB
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpeningBalanceModalBank(null)}
                className="flex-1 min-h-[40px] py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {isAm ? 'ይቅር' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={savingBalance}
                onClick={handleSaveOpening}
                className="flex-1 min-h-[40px] py-2 rounded-xl bg-[#0F4C3A] text-white text-xs font-semibold hover:bg-[#0B3A2C] disabled:opacity-50"
              >
                {savingBalance ? 'Saving...' : isAm ? 'አስቀምጥ' : 'Save Balance'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
