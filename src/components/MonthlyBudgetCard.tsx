import React, { useState } from 'react';
import { PaymentRecord, WithdrawalRecord, MonthlyBudget, AppSettings } from '../types/index.ts';
import {
  PieChart,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  X,
  ShieldAlert,
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

  const now = new Date();
  const currentMonthIdx = now.getMonth();
  const currentYear = now.getFullYear();

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
    <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
            isExceeded
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : isWarning
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-[#0F4C3A] border-emerald-200'
          }`}>
            <PieChart size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900">
              {isAm ? `${currentMonthName} ወርሃዊ በጀት` : `${currentMonthName} ${currentYear} Monthly Budget`}
            </h3>
            <p className="text-[11px] text-slate-500">
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
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
        >
          <Edit3 size={12} className="text-[#0F4C3A]" />
          <span>{isAm ? 'በጀት ቀይር' : 'Edit Cap'}</span>
        </button>
      </div>

      {/* Figures Row */}
      <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
        <div>
          <span className="text-[11px] font-semibold text-slate-500 block">
            {isAm ? 'የተወጣ' : 'Spent'}
          </span>
          <span className="text-sm font-bold text-slate-900 tabular-nums block truncate">
            {settings.hideBalances ? '••••' : `${totalSpent.toLocaleString()} ETB`}
          </span>
        </div>

        <div className="text-center">
          <span className="text-[11px] font-semibold text-slate-500 block">
            {isAm ? 'የበጀት ገደብ' : 'Cap Limit'}
          </span>
          <span className="text-sm font-bold text-slate-900 tabular-nums block truncate">
            {settings.hideBalances ? '••••' : `${overallLimit.toLocaleString()} ETB`}
          </span>
        </div>

        <div className="text-right">
          <span className="text-[11px] font-semibold text-slate-500 block">
            {isExceeded ? (isAm ? 'ትርፍ ወጪ' : 'Exceeded') : (isAm ? 'የቀረ' : 'Remaining')}
          </span>
          <span className={`text-sm font-bold tabular-nums block truncate ${
            isExceeded ? 'text-rose-700' : 'text-emerald-700'
          }`}>
            {settings.hideBalances ? '••••' : isExceeded ? `+${(totalSpent - overallLimit).toLocaleString()} ETB` : `${remainingBudget.toLocaleString()} ETB`}
          </span>
        </div>
      </div>

      {/* Progress Bar & Status */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-600 tabular-nums">
            {percentUsed}% {isAm ? 'ተጠቅሟል' : 'utilized'}
          </span>
          {isExceeded ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
              <ShieldAlert size={13} />
              <span>{isAm ? 'የበጀት ገደብ አልፏል' : 'Budget Exceeded'}</span>
            </span>
          ) : isWarning ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
              <AlertTriangle size={13} />
              <span>{isAm ? '80%+ ደርሷል' : '80%+ of Budget'}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 size={13} />
              <span>{isAm ? 'በበጀት ውስጥ' : 'On Track'}</span>
            </span>
          )}
        </div>

        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isExceeded ? 'bg-rose-600' : isWarning ? 'bg-amber-500' : 'bg-[#0F4C3A]'
            }`}
            style={{ width: `${Math.min(100, Math.max(4, percentUsed))}%` }}
          />
        </div>
      </div>

      {/* Inline Category Breakdown (No pills) */}
      {Object.keys(categorySpent).length > 0 && (
        <div className="pt-2.5 border-t border-slate-100 text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
          {Object.entries(categorySpent).map(([cat, amount]) => (
            <div key={cat} className="flex items-center gap-1.5">
              <span className="font-medium text-slate-500">{cat}:</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {settings.hideBalances ? '••••' : `${amount.toLocaleString()} ETB`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Edit Budget Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-[#0F4C3A]" />
                <h3 className="text-sm font-bold text-slate-900">
                  {isAm ? 'ወርሃዊ የበጀት ገደብ ማስተካከያ' : 'Set Monthly Outflow Budget'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                aria-label="Close edit budget"
                className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={14} />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                {isAm ? 'የወጪ ገደብ መጠን (ETB)' : 'Total Monthly Outflow Cap (ETB)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  autoFocus
                  value={limitInput}
                  onChange={e => setLimitInput(e.target.value)}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 pr-12 rounded-lg border border-slate-300 text-sm font-bold tabular-nums focus:outline-none focus:border-[#0F4C3A]"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                  ETB
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500">
                {isAm ? 'ፈጣን ምርጫዎች' : 'Quick Presets'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_LIMITS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLimitInput(String(preset))}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap ${
                      limitInput === String(preset)
                        ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
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
                className="flex-1 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600"
              >
                {isAm ? 'ይቅር' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={saving || !limitInput}
                onClick={handleSaveBudget}
                className="flex-1 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold hover:bg-[#0B3B2E] disabled:opacity-50"
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
