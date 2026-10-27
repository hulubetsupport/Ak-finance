import React from 'react';
import { 
  Send, 
  Search, 
  Layers, 
  ArrowDownLeft, 
  ArrowUpRight, 
  MessageSquarePlus,
  Sparkles
} from 'lucide-react';
import { translations } from '../utils/i18n.ts';
import { Language } from '../types/index.ts';

interface QuickActionsProps {
  language: Language;
  activeDirection?: 'all' | 'received' | 'sent';
  onFilterDirection?: (dir: 'all' | 'received' | 'sent') => void;
  onOpenTelegram: () => void;
  onOpenSearch: () => void;
  onOpenAccounts: () => void;
  onOpenSimulator?: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  language,
  activeDirection = 'all',
  onFilterDirection,
  onOpenTelegram,
  onOpenSearch,
  onOpenAccounts,
  onOpenSimulator,
}) => {
  const t = translations[language];
  const isAm = language === 'am';

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  };

  return (
    <div className="space-y-2">
      {/* Quick Direction Shortcuts */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            triggerHaptic();
            onFilterDirection?.(activeDirection === 'received' ? 'all' : 'received');
          }}
          className={`p-2.5 rounded-2xl border text-left transition-all duration-200 active:scale-98 flex items-center justify-between shadow-xs ${
            activeDirection === 'received'
              ? 'bg-emerald-900 text-white border-emerald-700 ring-2 ring-emerald-500/50 shadow-md'
              : 'bg-white text-slate-800 border-slate-200/80 hover:border-emerald-300 hover:bg-emerald-50/30'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform ${
              activeDirection === 'received' ? 'bg-emerald-800 text-emerald-200' : 'bg-emerald-100/70 text-emerald-800'
            }`}>
              <ArrowDownLeft size={16} />
            </div>
            <div>
              <div className="text-xs font-bold leading-tight font-['Poppins',sans-serif]">
                {isAm ? 'ገቢ ክፍያዎች' : 'Received (In)'}
              </div>
              <div className={`text-[10px] leading-tight ${activeDirection === 'received' ? 'text-emerald-200' : 'text-slate-400'}`}>
                {isAm ? 'የገቡ ገንዘቦች ብቻ' : 'Incoming money'}
              </div>
            </div>
          </div>
          {activeDirection === 'received' && (
            <span className="text-[10px] font-extrabold bg-white text-emerald-950 px-1.5 py-0.5 rounded-full">
              Active
            </span>
          )}
        </button>

        <button
          onClick={() => {
            triggerHaptic();
            onFilterDirection?.(activeDirection === 'sent' ? 'all' : 'sent');
          }}
          className={`p-2.5 rounded-2xl border text-left transition-all duration-200 active:scale-98 flex items-center justify-between shadow-xs ${
            activeDirection === 'sent'
              ? 'bg-rose-950 text-white border-rose-800 ring-2 ring-rose-500/50 shadow-md'
              : 'bg-white text-slate-800 border-slate-200/80 hover:border-rose-300 hover:bg-rose-50/30'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform ${
              activeDirection === 'sent' ? 'bg-rose-900 text-rose-200' : 'bg-rose-100/70 text-rose-800'
            }`}>
              <ArrowUpRight size={16} />
            </div>
            <div>
              <div className="text-xs font-bold leading-tight font-['Poppins',sans-serif]">
                {isAm ? 'ወጪ ክፍያዎች' : 'Sent (Out)'}
              </div>
              <div className={`text-[10px] leading-tight ${activeDirection === 'sent' ? 'text-rose-200' : 'text-slate-400'}`}>
                {isAm ? 'የተላኩ እና ወጪዎች' : 'Transfers & bills'}
              </div>
            </div>
          </div>
          {activeDirection === 'sent' && (
            <span className="text-[10px] font-extrabold bg-white text-rose-950 px-1.5 py-0.5 rounded-full">
              Active
            </span>
          )}
        </button>
      </div>

      {/* 3 Secondary Action Tiles */}
      <div className="grid grid-cols-3 gap-2">
        {/* Search */}
        <button
          onClick={() => {
            triggerHaptic();
            onOpenSearch();
          }}
          className="bg-white rounded-2xl p-2.5 text-left border border-slate-200/80 shadow-xs hover:border-[#14503F]/40 hover:shadow-sm transition-all duration-150 active:scale-98 group flex flex-col justify-between"
        >
          <div className="w-7 h-7 rounded-xl bg-emerald-50 text-[#14503F] flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
            <Search size={14} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-800 font-['Poppins',sans-serif] truncate">
              {t.quickFind}
            </div>
            <div className="text-[9.5px] text-slate-400 truncate">
              {isAm ? 'ፈልግ እና አጣራ' : 'Search & filter'}
            </div>
          </div>
        </button>

        {/* Bank Accounts */}
        <button
          onClick={() => {
            triggerHaptic();
            onOpenAccounts();
          }}
          className="bg-white rounded-2xl p-2.5 text-left border border-slate-200/80 shadow-xs hover:border-[#14503F]/40 hover:shadow-sm transition-all duration-150 active:scale-98 group flex flex-col justify-between"
        >
          <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
            <Layers size={14} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-800 font-['Poppins',sans-serif] truncate">
              {t.quickAccounts}
            </div>
            <div className="text-[9.5px] text-slate-400 truncate">
              {isAm ? 'ባንክ ጨምር' : 'Add / manage'}
            </div>
          </div>
        </button>

        {/* Test SMS or Telegram */}
        <button
          onClick={() => {
            triggerHaptic();
            if (onOpenSimulator) {
              onOpenSimulator();
            } else {
              onOpenTelegram();
            }
          }}
          className="bg-white rounded-2xl p-2.5 text-left border border-slate-200/80 shadow-xs hover:border-[#14503F]/40 hover:shadow-sm transition-all duration-150 active:scale-98 group flex flex-col justify-between"
        >
          <div className="w-7 h-7 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
            {onOpenSimulator ? <MessageSquarePlus size={14} /> : <Send size={14} />}
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-800 font-['Poppins',sans-serif] truncate">
              {onOpenSimulator ? (isAm ? 'SMS ሞክር' : 'Test SMS') : t.quickTelegram}
            </div>
            <div className="text-[9.5px] text-slate-400 truncate">
              {onOpenSimulator ? (isAm ? 'የሙከራ መልዕክት' : 'Simulate receipt') : (isAm ? 'ቴሌግራም አስተላልፍ' : 'Forward channel')}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
