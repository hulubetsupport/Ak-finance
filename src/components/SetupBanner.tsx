import React from 'react';
import { Smartphone, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { translations } from '../utils/i18n.ts';
import { Language } from '../types/index.ts';

interface SetupBannerProps {
  language: Language;
  onOpenSetup: () => void;
  serviceRunning: boolean;
}

export const SetupBanner: React.FC<SetupBannerProps> = ({
  language,
  onOpenSetup,
  serviceRunning,
}) => {
  const t = translations[language];

  return (
    <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/60 rounded-2xl p-4 border border-emerald-200/80 shadow-xs flex items-center justify-between gap-3 relative overflow-hidden">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#14503F] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
          <Smartphone size={20} />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
              {t.setupTitle}
            </span>
            <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold bg-emerald-600 text-white px-1.5 py-0.2 rounded-full">
              <Sparkles size={8} /> Auto
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
            {t.setupSub}
          </p>
          <button
            onClick={onOpenSetup}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-[#14503F] hover:text-emerald-800 transition-colors"
          >
            {t.setupButton}
          </button>
        </div>
      </div>

      {/* Floating green Enable button */}
      <button
        onClick={onOpenSetup}
        className={`px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition-all duration-150 active:scale-95 shrink-0 flex items-center gap-1.5 ${
          serviceRunning
            ? 'bg-emerald-100 text-[#14503F] border border-emerald-300'
            : 'bg-[#14503F] text-white hover:bg-[#0f3d30]'
        }`}
      >
        <ShieldCheck size={14} />
        <span>{serviceRunning ? (language === 'am' ? 'ነቅቷል' : 'Active') : t.enable}</span>
      </button>
    </div>
  );
};
