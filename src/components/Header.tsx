import React from 'react';
import { Bell, Eye, EyeOff, Globe } from 'lucide-react';
import { AppSettings } from '../types/index.ts';
import { NativeStatus } from '../utils/nativeBridge.ts';
import { translations } from '../utils/i18n.ts';

interface HeaderProps {
  settings: AppSettings;
  nativeStatus: NativeStatus;
  onToggleHideBalances: () => void;
  onToggleLanguage: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  nativeStatus,
  onToggleHideBalances,
  onToggleLanguage,
  onOpenNotifications,
  onOpenSettings,
}) => {
  const t = translations[settings.language];
  const isAm = settings.language === 'am';

  // Header pill rule:
  // "Connected" (green) ONLY if smsGranted && url set && pending==0 && lastCode==200;
  // amber "n pending"; red "Not set up" if permission or URL missing; grey in Local mode.
  const getStatusDisplay = () => {
    if (settings.mode === 'local') {
      return {
        label: t.localMode,
        dotClass: 'bg-slate-400',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    }

    const hasUrl = !!settings.serverUrl?.trim();
    if (!nativeStatus.smsGranted || !hasUrl) {
      return {
        label: isAm ? 'አልተዋቀረም' : 'Not set up',
        dotClass: 'bg-rose-500',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    }

    if (nativeStatus.pending > 0) {
      return {
        label: `${nativeStatus.pending} ${isAm ? 'በመጠባበቅ' : 'pending'}`,
        dotClass: 'bg-amber-500 animate-pulse',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }

    if (nativeStatus.smsGranted && hasUrl && nativeStatus.pending === 0 && nativeStatus.lastCode === 200) {
      return {
        label: t.connected,
        dotClass: 'bg-emerald-500',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
      };
    }

    // Server configured, permissions granted, waiting for first SMS / response
    if (nativeStatus.lastCode > 0 && nativeStatus.lastCode !== 200) {
      return {
        label: `HTTP ${nativeStatus.lastCode}`,
        dotClass: 'bg-rose-500',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    }

    return {
      label: isAm ? 'ተዘጋጅቷል' : 'Ready',
      dotClass: 'bg-amber-400',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    };
  };

  const status = getStatusDisplay();

  return (
    <header className="sticky top-0 z-30 bg-[#F4F7F5]/95 backdrop-blur-md px-4 pt-3 pb-2 border-b border-slate-200/60">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Brand Logo & Tagline */}
        <div className="flex flex-col cursor-pointer" onClick={onOpenSettings}>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-2xl tracking-tight text-[#14503F] font-['Poppins',sans-serif]">
              Ak Financial
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#14503F] mt-1"></span>
          </div>
          <span className="text-[9px] font-semibold tracking-widest text-slate-400 uppercase">
            {t.tagline}
          </span>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-2">
          {/* Status Pill */}
          <button
            onClick={onOpenSettings}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border shadow-xs transition-colors ${status.badgeClass}`}
            title="Click to view connection & queue settings"
          >
            <span className={`w-2 h-2 rounded-full ${status.dotClass}`} />
            <span>{status.label}</span>
          </button>

          {/* Privacy Eye Toggle */}
          <button
            onClick={onToggleHideBalances}
            aria-label={settings.hideBalances ? 'Show balances' : 'Hide balances'}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-xs transition-all active:scale-95"
            title={settings.hideBalances ? 'Show amounts' : 'Hide amounts'}
          >
            {settings.hideBalances ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>

          {/* Language Toggle */}
          <button
            onClick={onToggleLanguage}
            aria-label="Toggle language"
            className="px-2 py-1 rounded-lg bg-white border border-slate-200 flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 shadow-xs transition-all active:scale-95"
            title="Toggle Amharic / English"
          >
            <Globe size={13} className="text-slate-400" />
            <span>{settings.language === 'en' ? 'EN' : 'አማ'}</span>
          </button>

          {/* Notification Bell */}
          <button
            onClick={onOpenNotifications}
            aria-label="Notifications"
            className="relative w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-xs transition-all active:scale-95"
          >
            <Bell size={16} />
            {nativeStatus.pending > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
