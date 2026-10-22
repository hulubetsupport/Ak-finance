import React from 'react';
import { Account, AppSettings } from '../types/index.ts';
import { Smartphone, Building2, Store, CreditCard, ChevronRight } from 'lucide-react';

interface AccountsCardStackProps {
  accounts: Account[];
  settings: AppSettings;
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string | null) => void;
  onManageAccounts: () => void;
}

export const AccountsCardStack: React.FC<AccountsCardStackProps> = ({
  accounts,
  settings,
  selectedAccountId,
  onSelectAccount,
  onManageAccounts,
}) => {
  const formatAmount = (num: number) => {
    if (settings.hideBalances) return '••••••';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getAccentConfig = (accent: Account['accent']) => {
    switch (accent) {
      case 'blue':
        return {
          bg: 'bg-gradient-to-br from-[#1E3A8A] to-[#2563EB]',
          border: 'border-blue-400/30',
          badgeBg: 'bg-blue-400/20 text-blue-100',
          icon: <Smartphone className="w-4 h-4 text-blue-200" />,
        };
      case 'indigo':
        return {
          bg: 'bg-gradient-to-br from-[#312E81] to-[#4F46E5]',
          border: 'border-indigo-400/30',
          badgeBg: 'bg-indigo-400/20 text-indigo-100',
          icon: <Building2 className="w-4 h-4 text-indigo-200" />,
        };
      case 'gold':
        return {
          bg: 'bg-gradient-to-br from-[#78350F] to-[#D97706]',
          border: 'border-amber-400/30',
          badgeBg: 'bg-amber-400/20 text-amber-100',
          icon: <Store className="w-4 h-4 text-amber-200" />,
        };
      default:
        return {
          bg: 'bg-gradient-to-br from-[#14503F] to-[#1F7A60]',
          border: 'border-emerald-400/30',
          badgeBg: 'bg-emerald-400/20 text-emerald-100',
          icon: <CreditCard className="w-4 h-4 text-emerald-200" />,
        };
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {settings.language === 'am' ? 'የንግድ ሂሳቦች' : 'Active Accounts'}
        </span>
        <button
          onClick={onManageAccounts}
          className="text-xs font-medium text-[#14503F] hover:underline flex items-center gap-0.5"
        >
          {settings.language === 'am' ? 'አስተዳድር' : 'Manage'}
          <ChevronRight size={13} />
        </button>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none snap-x snap-mandatory">
        {accounts.map(acc => {
          const cfg = getAccentConfig(acc.accent);
          const isSelected = selectedAccountId === acc.id;

          return (
            <div
              key={acc.id}
              onClick={() => onSelectAccount(isSelected ? null : acc.id)}
              className={`shrink-0 w-[190px] rounded-2xl p-3.5 text-white shadow-sm cursor-pointer transition-all duration-200 snap-start select-none relative overflow-hidden ${cfg.bg} ${
                isSelected ? 'ring-2 ring-[#14503F] ring-offset-2 scale-[1.02]' : 'hover:opacity-95'
              }`}
            >
              {/* Subtle background glow */}
              <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-white/10 blur-xl pointer-events-none" />

              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-white/15 backdrop-blur-xs">
                  {cfg.icon}
                </div>
                <span className="text-[11px] font-mono tracking-wider opacity-85">
                  {acc.maskedNumber}
                </span>
              </div>

              <div className="text-[12px] font-medium text-white/90 truncate">
                {acc.name}
              </div>

              <div className="mt-1 font-bold text-base tracking-tight text-white font-['Poppins',sans-serif]">
                +ETB {formatAmount(acc.balance)}
              </div>

              <div className="mt-1 flex items-center justify-between text-[10px] text-white/75">
                <span className="truncate">{acc.bank}</span>
                {isSelected && (
                  <span className="text-[9px] bg-white text-slate-900 font-bold px-1.5 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
