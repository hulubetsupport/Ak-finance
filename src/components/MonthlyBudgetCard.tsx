import React, { useState } from 'react';
import { PaymentRecord, WithdrawalRecord, MonthlyBudget, AppSettings } from '../types/index.ts';
import { 
  PieChart, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Edit3, 
  X, 
  Check, 
  Sparkles,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';

interface MonthlyBudgetCardProps {
  payments: PaymentRecord[];
  withdrawals: WithdrawalRecord[];
  budget: MonthlyBudget;
  settings: AppSettings;
  onUpdateBudget: (budget: MonthlyBudget) => Promise<void>;
}

export const MonthlyBudgetCard: React.FC<MonthlyBudgetCardProps> = ({
  payments,
  withdrawals,
  budget,
  settings,
  onUpdateBudget,
}) => {
  const isAm = settings.language === 'am';
  const [showEditModal, setShowEditModal] = useState(false);
  const [limitInput, setLimitInput] = useState(String(budget.overallLimit));
  const [saving, setSaving] = useState(false);

  // Current month bounds
  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();

  // Outflow calculation for current month (sent payments + withdrawals)
  const currentMonthSent = payments
    .filter(p => {
      if (p.isDuplicate || p.isHidden || p.type !== 'sent' || p.category === 'alert') return false;
      const d = new Date(p.timestamp);
      return d.getMonth() === currentMonthIdx && d.getFullYear() === currentYear;
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const currentMonthWithdrawals = withdrawals
    .filter(w => {
      const d = new Date(w.timestamp);
      return d.getMonth() === currentMonthIdx && d.getFullYear() === currentYear;
    })
    .reduce((sum, w) => sum + (w.amount || 0), 0);

  const totalSpent = currentMonthSent + currentMonthWithdrawals;
  const overallLimit = budget.overallLimit || 50000;
  const percentUsed = Math.min(100, Math.round((totalSpent / overallLimit) * 100));
  const remainingBudget = Math.max(0, overallLimit - totalSpent);
  const isExceeded = totalSpent > overallLimit;
  const isWarning = !isExceeded && percentUsed >= 80;

  // Category breakdown for current month outflows
  const categorySpent: Record<string, number> = {};
  payments.forEach(p => {
    if (p.isDuplicate || p.isHidden || p.type !== 'sent' || p.category === 'alert') return;
    const d = new Date(p.timestamp);
    if (d.getMonth() === currentMonthIdx && d.getFullYear() === currentYear) {
      const cat = p.category ? p.category.toUpperCase() : 'TRANSFER';
      categorySpent[cat] = (categorySpent[cat] || 0) + (p.amount || 0);
    }
  });

  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNamesAm = ['ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ'];
  const currentMonthName = isAm ? monthNamesAm[currentMonthIdx] : monthNamesEn[currentMonthIdx];

  const handleSaveBudget = async () => {
    const val = parseFloat(limitInput.replace(/,/g, ''));
    if (isNaN(val) || val <= 0) return;
    setSaving(true);
    try {
      await onUpdateBudget({
        ...budget,
        overallLimit: val,
        updatedAt: Date.now(),
      });
      setShowEditModal(false);
    } finally {
      setSaving(false);
    }
  };

  const PRESET_LIMITS = [15000, 30000, 50000, 100000, 200000];

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3.5 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            isExceeded 
              ? 'bg-rose-50 text-rose-600' 
              : isWarning 
                ? 'bg-amber-50 text-amber-600' 
                : 'bg-emerald-50 text-[#14503F]'
          }`}>
            <PieChart size={17} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
                {isAm ? `${currentMonthName} ወርሃዊ በጀት` : `${currentMonthName} Monthly Budget`}
              </h3>
              <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600">
                2026
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {isAm ? 'የወጪ ገደብ እና ክትትል' : 'Expense cap & live outflow tracking'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setLimitInput(String(overallLimit));
            setShowEditModal(true);
          }}
          className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1 shadow-2xs active:scale-95 transition-all"
        >
          <Edit3 size={12} className="text-[#14503F]" />
          <span>{isAm ? 'በጀት ቀይር' : 'Edit Cap'}</span>
        </button>
      </div>

      {/* Figures Row */}
      <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50/80 border border-slate-100">
        <div>
          <span className="text-[9.5px] uppercase font-bold text-slate-400 block">
            {isAm ? 'የተወጣ' : 'Spent'}
          </span>
          <span className="text-sm sm:text-base font-black font-['Poppins',sans-serif] text-slate-900 block truncate">
            {settings.hideBalances ? '••••' : `${totalSpent.toLocaleString()} ETB`}
          </span>
        </div>

        <div className="text-center">
          <span className="text-[9.5px] uppercase font-bold text-slate-400 block">
            {isAm ? 'የበጀት ገደብ' : 'Cap Limit'}
          </span>
          <span className="text-sm sm:text-base font-black font-['Poppins',sans-serif] text-slate-900 block truncate">
            {settings.hideBalances ? '••••' : `${overallLimit.toLocaleString()} ETB`}
          </span>
        </div>

        <div className="text-right">
          <span className="text-[9.5px] uppercase font-bold text-slate-400 block">
            {isExceeded ? (isAm ? 'ትርፍ ወጪ' : 'Exceeded') : (isAm ? 'የቀረ' : 'Remaining')}
          </span>
          <span className={`text-sm sm:text-base font-black font-['Poppins',sans-serif] block truncate ${
            isExceeded ? 'text-rose-600' : 'text-emerald-700'
          }`}>
            {settings.hideBalances ? '••••' : isExceeded ? `+${(totalSpent - overallLimit).toLocaleString()} ETB` : `${remainingBudget.toLocaleString()} ETB`}
          </span>
        </div>
      </div>

      {/* Progress Bar & Status */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-600">
            {percentUsed}% {isAm ? 'ተጠቅሟል' : 'utilized'}
          </span>
          {isExceeded ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
              <ShieldAlert size={11} />
              <span>{isAm ? 'የበጀት ገደብ አልፏል!' : 'Budget Exceeded!'}</span>
            </span>
          ) : isWarning ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <AlertTriangle size={11} />
              <span>{isAm ? '80%+ ደርሷል' : '80%+ of Budget'}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 size={11} />
              <span>{isAm ? 'በበጀት ውስጥ' : 'On Track'}</span>
            </span>
          )}
        </div>

        <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isExceeded
                ? 'bg-rose-500'
                : isWarning
                  ? 'bg-amber-500'
                  : 'bg-[#14503F]'
            }`}
            style={{ width: `${Math.min(100, Math.max(4, percentUsed))}%` }}
          />
        </div>
      </div>

      {/* Category Pills */}
      {Object.keys(categorySpent).length > 0 && (
        <div className="pt-1 border-t border-slate-100 flex flex-wrap gap-1.5">
          {Object.entries(categorySpent).map(([cat, amount]) => (
            <div key={cat} className="px-2 py-1 rounded-xl bg-slate-100/90 text-slate-700 text-[10px] font-semibold flex items-center gap-1">
              <span className="text-slate-500">{cat}:</span>
              <span className="font-bold text-slate-900">
                {settings.hideBalances ? '••••' : `${amount.toLocaleString()} ETB`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Edit Budget Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#14503F]" />
                <h3 className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
                  {isAm ? 'ወርሃዊ የበጀት ገደብ ማስተካከያ' : 'Set Monthly Outflow Budget'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                {isAm ? 'የወጪ ገደብ መጠን (ETB)' : 'Total Monthly Outflow Cap (ETB)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  autoFocus
                  value={limitInput}
                  onChange={e => setLimitInput(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 pr-12 rounded-xl border border-slate-300 text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-[#14503F]"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                  ETB
                </span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {isAm ? 'ፈጣን ምርጫዎች' : 'Quick Presets'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_LIMITS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLimitInput(String(preset))}
                    className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                      limitInput === String(preset)
                        ? 'bg-[#14503F] text-white border-[#14503F]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset.toLocaleString()} ETB
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
              >
                {isAm ? 'ይቅር' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={saving || !limitInput}
                onClick={handleSaveBudget}
                className="flex-1 py-2 rounded-xl bg-[#14503F] text-white text-xs font-bold hover:bg-[#0e3b2e] shadow-xs disabled:opacity-50"
              >
                {saving ? (isAm ? 'በማስቀመጥ ላይ...' : 'Saving...') : (isAm ? 'አስቀምጥ' : 'Save Budget')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
