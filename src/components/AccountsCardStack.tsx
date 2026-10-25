import React, { useState, useMemo } from 'react';
import { Account, AppSettings, PaymentRecord } from '../types/index.ts';
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
  TrendingUp
} from 'lucide-react';
import { getBankBrand, BankBrand } from '../constants/bankBrands.ts';
import { BankCardPattern } from './BankCardPattern.tsx';
import { MiniSparkline } from './MiniSparkline.tsx';

interface AccountsCardStackProps {
  accounts: Account[];
  payments?: PaymentRecord[];
  settings: AppSettings;
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string | null) => void;
  onManageAccounts: () => void;
  onSaveOpeningBalance: (bank: string, amount: number) => Promise<void>;
  onAddCustomBank?: (bankName: string) => Promise<void>;
}

export const AccountsCardStack: React.FC<AccountsCardStackProps> = ({
  accounts,
  payments = [],
  settings,
  selectedAccountId,
  onSelectAccount,
  onManageAccounts,
  onSaveOpeningBalance,
  onAddCustomBank,
}) => {
  const isAm = settings.language === 'am';

  // Modal states for "Sync your balance" / Opening Balance
  const [openingBalanceModalBank, setOpeningBalanceModalBank] = useState<string | null>(null);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [newBankName, setNewBankName] = useState('Abay Bank');

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  };

  const formatAmount = (num: number) => {
    if (settings.hideBalances) return '••••••';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Compute 7-day sparkline activity points for each bank
  const sparklinesByBank = useMemo(() => {
    const map: Record<string, number[]> = {};
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    // Create 7 day buckets (day 0: 6 days ago ... day 6: today)
    const dayBuckets = Array.from({ length: 7 }, (_, i) => todayMidnight - (6 - i) * dayMs);

    for (const acc of accounts) {
      const bankNorm = acc.bank.toUpperCase().trim();
      const relevant = payments.filter(p => {
        if (p.isDuplicate || p.isHidden) return false;
        const pNorm = p.bank.toUpperCase().trim();
        return pNorm === bankNorm || (bankNorm === 'CBE' && pNorm.includes('COMMERCIAL'));
      });

      const points = dayBuckets.map(startTs => {
        const endTs = startTs + dayMs;
        const dayPayments = relevant.filter(p => p.timestamp >= startTs && p.timestamp < endTs);
        return dayPayments.reduce((accTotal, p) => p.type === 'received' ? accTotal + p.amount : accTotal, 0);
      });

      // If all zeros, synthesize mild activity based on receivedThisMonth for visual vitality
      const hasAny = points.some(v => v > 0);
      if (!hasAny && (acc.receivedThisMonth || 0) > 0) {
        const base = (acc.receivedThisMonth || 100) / 7;
        map[acc.bank] = [base * 0.4, base * 0.8, base * 0.6, base * 1.2, base * 0.9, base * 1.4, base * 1.1];
      } else {
        map[acc.bank] = points;
      }
    }
    return map;
  }, [accounts, payments]);

  const handleOpenBalanceModal = (e: React.MouseEvent, acc: Account) => {
    e.stopPropagation();
    triggerHaptic();
    setOpeningBalanceModalBank(acc.bank);
    setOpeningBalanceInput(acc.openingBalance !== undefined ? String(acc.openingBalance) : '');
  };

  const handleSaveBalance = async () => {
    if (!openingBalanceModalBank) return;
    const val = parseFloat(openingBalanceInput.replace(/,/g, ''));
    if (!isNaN(val)) {
      await onSaveOpeningBalance(openingBalanceModalBank, val);
    }
    setOpeningBalanceModalBank(null);
  };

  const handleAddBankSubmit = async () => {
    if (onAddCustomBank && newBankName.trim()) {
      await onAddCustomBank(newBankName.trim());
      setShowAddBankModal(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Header bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-['Poppins',sans-serif]">
            {isAm ? 'የባንክ ሂሳቦች' : 'Bank Accounts & Balances'}
          </span>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-200/70 px-1.5 py-0.2 rounded-full">
            {accounts.length}
          </span>
        </div>
        <button
          onClick={() => { triggerHaptic(); onManageAccounts(); }}
          className="text-xs font-bold text-[#14503F] hover:underline flex items-center gap-0.5 active:scale-95 transition-transform"
        >
          {isAm ? 'አስተዳድር' : 'Manage'}
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Swipeable Horizontal Card Carousel with Active Enlargement */}
      <div className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-none snap-x snap-mandatory px-0.5 items-center">
        {accounts.map(acc => {
          const brand: BankBrand = getBankBrand(acc.bank);
          const isSelected = selectedAccountId === acc.id;
          const sparklineData = sparklinesByBank[acc.bank] || [0, 0, 0, 0, 0, 0, 0];

          return (
            <div
              key={acc.id}
              onClick={() => {
                triggerHaptic();
                onSelectAccount(isSelected ? null : acc.id);
              }}
              style={{
                borderRadius: '24px',
              }}
              className={`shrink-0 rounded-[24px] p-4 text-white shadow-md cursor-pointer transition-all duration-200 snap-start select-none relative overflow-hidden flex flex-col justify-between bg-gradient-to-br ${brand.gradientClass} ${
                isSelected 
                  ? 'w-[235px] ring-2 ring-white/70 ring-offset-2 ring-offset-[#F4F7F5] scale-[1.02] shadow-xl' 
                  : 'w-[220px] hover:shadow-lg opacity-95 hover:opacity-100'
              }`}
            >
              {/* Subtle Translucent Geometric Bank Pattern (Part 2) */}
              <BankCardPattern type={brand.patternType} accentColor={brand.accentColor} />

              {/* Decorative radial lighting */}
              <div 
                className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full blur-xl pointer-events-none opacity-30"
                style={{ backgroundColor: brand.accentColor }}
              />

              {/* Top Row: Bank Badge & Logo Badge + Active Indicator */}
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className={`px-2 py-0.5 rounded-xl border font-black text-[11px] tracking-wider flex items-center gap-1 backdrop-blur-xs shadow-2xs ${brand.badgeClass}`}>
                    {acc.type === 'mobile' ? <Smartphone size={11} /> : <Building2 size={11} />}
                    <span>{brand.shortCode}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Edit Opening Balance Shortcut */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenBalanceModal(e, acc)}
                      className="p-1 rounded-lg bg-black/20 hover:bg-black/35 text-white/80 transition-colors backdrop-blur-2xs"
                      title={isAm ? 'የመነሻ ሂሳብ አስተካክል' : 'Edit opening balance'}
                    >
                      <Edit3 size={11} />
                    </button>
                    {isSelected && (
                      <span className="text-[9px] bg-white text-slate-900 font-extrabold px-1.5 py-0.5 rounded-full shadow-xs">
                        Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Bank Name */}
                <div className="text-[13px] font-bold text-white tracking-tight truncate font-['Poppins',sans-serif]">
                  {acc.name}
                </div>
              </div>

              {/* Middle: Current Balance OR "Sync your balance" button */}
              <div className="my-2.5 relative z-10">
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
                    <div className="text-[10px] text-white/75 uppercase tracking-wider font-semibold">
                      {isAm ? 'የአሁኑ ቀሪ ሂሳብ' : 'Current Balance'}
                    </div>
                    <div className="font-black text-[17px] tracking-tight text-white font-['Poppins',sans-serif]">
                      ETB {formatAmount(acc.balance)}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Row: 7-Day Sparkline + Month Movement */}
              <div className="pt-2 border-t border-white/20 flex items-center justify-between text-[10px] font-semibold text-white/90 relative z-10">
                <div className="flex flex-col">
                  <div className="flex items-center gap-0.5 text-emerald-200">
                    <ArrowDownLeft size={11} />
                    <span>+{formatAmount(acc.receivedThisMonth || 0)}</span>
                  </div>
                  <div className="flex items-center gap-0.5 text-rose-200">
                    <ArrowUpRight size={11} />
                    <span>-{formatAmount(acc.sentThisMonth || 0)}</span>
                  </div>
                </div>

                {/* 7-Day Mini Sparkline (Part 2) */}
                <div className="text-right flex flex-col items-end">
                  <MiniSparkline
                    data={sparklineData}
                    strokeColor={brand.accentColor}
                    fillColor={brand.accentColor}
                    width={64}
                    height={22}
                  />
                  <span className="text-[9px] text-white/60 tracking-wider">7-day trend</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Bank Card */}
        <div
          onClick={() => { triggerHaptic(); setShowAddBankModal(true); }}
          style={{ borderRadius: '24px' }}
          className="shrink-0 w-[125px] h-[160px] rounded-[24px] p-3 border-2 border-dashed border-slate-300 hover:border-[#14503F] text-slate-500 hover:text-[#14503F] bg-white/70 flex flex-col items-center justify-center cursor-pointer transition-all snap-start select-none group shadow-2xs"
        >
          <div className="w-9 h-9 rounded-full bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center mb-1.5 text-slate-600 group-hover:text-[#14503F] transition-colors">
            <Plus size={16} />
          </div>
          <span className="text-[11px] font-bold text-center">
            {isAm ? '+ ባንክ ጨምር' : '+ Add Bank'}
          </span>
          <span className="text-[9px] text-slate-400 mt-0.5 text-center">Abay, Nib, Zemen...</span>
        </div>
      </div>

      {/* Opening Balance Modal ("Sync your balance") */}
      {openingBalanceModalBank && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#14503F] flex items-center justify-center font-bold">
                  <Sparkles size={14} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
                    {isAm ? 'የመነሻ ሂሳብ ያስገቡ' : 'Sync Your Balance'}
                  </h4>
                  <span className="text-[10px] text-slate-400">{openingBalanceModalBank}</span>
                </div>
              </div>
              <button
                onClick={() => setOpeningBalanceModalBank(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X size={14} />
              </button>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              {isAm 
                ? 'የባንክዎን የአሁኑ ቀሪ ሂሳብ እዚህ ያስገቡ። ወደፊት የሚመጡ ገቢ እና ወጪዎች በራስ-ሰር ይደመራሉ/ይቀነሳሉ።'
                : 'Enter your current account balance from your bank mobile app. Future SMS will automatically add/subtract from this balance.'}
            </p>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">
                {isAm ? 'የአሁኑ ቀሪ ሂሳብ (ETB)' : 'Current Balance (ETB)'}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={openingBalanceInput}
                onChange={e => setOpeningBalanceInput(e.target.value)}
                placeholder="e.g. 50,000.00"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-[#14503F]"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSaveBalance}
                className="flex-1 py-2 rounded-xl bg-[#14503F] text-white text-xs font-bold hover:bg-[#0e3b2e] shadow-sm flex items-center justify-center gap-1"
              >
                <Check size={14} />
                <span>{isAm ? 'አስቀምጥ' : 'Save Balance'}</span>
              </button>
              <button
                type="button"
                onClick={() => setOpeningBalanceModalBank(null)}
                className="py-2 px-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bank Modal */}
      {showAddBankModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
                {isAm ? 'አዲስ የባንክ ሂሳብ ጨምር' : 'Add Bank Account'}
              </h4>
              <button
                onClick={() => setShowAddBankModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Select Bank</label>
              <select
                value={newBankName}
                onChange={e => setNewBankName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#14503F] bg-white"
              >
                <option value="Abay Bank">Abay Bank</option>
                <option value="Wegagen Bank">Wegagen Bank</option>
                <option value="Nib Bank">Nib Bank</option>
                <option value="Zemen Bank">Zemen Bank</option>
                <option value="Coop Bank">Cooperative Bank of Oromia</option>
                <option value="Hibret Bank">Hibret Bank</option>
                <option value="Enat Bank">Enat Bank</option>
                <option value="Berhan Bank">Berhan Bank</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddBankSubmit}
                className="flex-1 py-2 rounded-xl bg-[#14503F] text-white text-xs font-bold hover:bg-[#0e3b2e] shadow-sm flex items-center justify-center gap-1"
              >
                <Plus size={14} />
                <span>Add Channel</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddBankModal(false)}
                className="py-2 px-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
