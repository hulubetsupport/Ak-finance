import React from 'react';
import { Eye, EyeOff, Globe, Search, MoreVertical, MessageSquarePlus } from 'lucide-react';
import { AppSettings } from '../types/index.ts';
import { translations } from '../utils/i18n.ts';

interface HeaderProps {
  settings: AppSettings;
  pageTitle: string;
  onToggleHideBalances: () => void;
  onToggleLanguage: () => void;
  onOpenSearch: () => void;
  onOpenSimulator: () => void;
  onOpenMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  pageTitle,
  onToggleHideBalances,
  onToggleLanguage,
  onOpenSearch,
  onOpenSimulator,
  onOpenMenu,
}) => {
  const t = translations[settings.language];
  const isAm = settings.language === 'am';

  return (
    <header className="sticky top-0 z-30 h-13 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sm:gap-4">
      {/* Zone 1: Brand on Mobile / Page Title on Desktop */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <span className="lg:hidden font-display font-bold text-[15px] sm:text-base tracking-tight text-[#0F4C3A] whitespace-nowrap shrink-0">
          {t.appTitle}
        </span>
        <h1 className="hidden lg:block font-display font-semibold text-base text-slate-900 truncate">
          {pageTitle}
        </h1>
      </div>

      {/* Zone 2: Minimal Utility Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Search transactions"
          className="min-h-[40px] min-w-[34px] sm:min-w-[40px] px-1.5 sm:px-2.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
          title="Search"
        >
          <Search size={16} />
          <span className="hidden md:inline">{isAm ? 'ፈልግ' : 'Search'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleHideBalances}
          aria-label={settings.hideBalances ? 'Show balances' : 'Hide balances'}
          className="min-h-[40px] min-w-[34px] sm:min-w-[40px] rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0"
          title={settings.hideBalances ? 'Show balances' : 'Hide balances'}
        >
          {settings.hideBalances ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>

        <button
          type="button"
          onClick={onToggleLanguage}
          aria-label="Toggle language"
          className="min-h-[40px] px-2 sm:px-2.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          title="Switch English / Amharic"
        >
          <Globe size={14} className="hidden sm:block text-slate-400" />
          <span>{settings.language === 'en' ? 'EN' : 'አማ'}</span>
        </button>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={onOpenSimulator}
          className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#0F4C3A] text-white hover:bg-[#0B3A2C] text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          <MessageSquarePlus size={14} />
          <span className="sm:hidden">{isAm ? 'SMS' : 'SMS'}</span>
          <span className="hidden sm:inline">{t.simulateSms}</span>
        </button>

        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="More options"
          className="lg:hidden min-h-[40px] min-w-[34px] sm:min-w-[40px] rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0"
        >
          <MoreVertical size={17} />
        </button>
      </div>
    </header>
  );
};
