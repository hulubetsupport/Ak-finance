import React from 'react';
import { Send, Search, Layers } from 'lucide-react';
import { translations } from '../utils/i18n.ts';
import { Language } from '../types/index.ts';

interface QuickActionsProps {
  language: Language;
  onOpenTelegram: () => void;
  onOpenSearch: () => void;
  onOpenAccounts: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  language,
  onOpenTelegram,
  onOpenSearch,
  onOpenAccounts,
}) => {
  const t = translations[language];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {/* Telegram Tile */}
      <button
        onClick={onOpenTelegram}
        className="bg-white rounded-2xl p-3 text-left border border-slate-200/80 shadow-xs hover:border-[#14503F]/40 hover:shadow-sm transition-all duration-150 active:scale-98 group flex flex-col justify-between"
      >
        <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
          <Send size={16} />
        </div>
        <div>
          <div className="text-xs font-bold text-slate-800 font-['Poppins',sans-serif]">
            {t.quickTelegram}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
            {t.quickTelegramSub}
          </div>
        </div>
      </button>

      {/* Find Payment Tile */}
      <button
        onClick={onOpenSearch}
        className="bg-white rounded-2xl p-3 text-left border border-slate-200/80 shadow-xs hover:border-[#14503F]/40 hover:shadow-sm transition-all duration-150 active:scale-98 group flex flex-col justify-between"
      >
        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#14503F] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
          <Search size={16} />
        </div>
        <div>
          <div className="text-xs font-bold text-slate-800 font-['Poppins',sans-serif]">
            {t.quickFind}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
            {t.quickFindSub}
          </div>
        </div>
      </button>

      {/* Accounts Tile */}
      <button
        onClick={onOpenAccounts}
        className="bg-white rounded-2xl p-3 text-left border border-slate-200/80 shadow-xs hover:border-[#14503F]/40 hover:shadow-sm transition-all duration-150 active:scale-98 group flex flex-col justify-between"
      >
        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
          <Layers size={16} />
        </div>
        <div>
          <div className="text-xs font-bold text-slate-800 font-['Poppins',sans-serif]">
            {t.quickAccounts}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
            {t.quickAccountsSub}
          </div>
        </div>
      </button>
    </div>
  );
};
