import React from 'react';
import { X, ShieldCheck, BatteryCharging, BellRing, Smartphone, Check, AlertCircle, ExternalLink, Settings, Play } from 'lucide-react';
import { translations } from '../utils/i18n.ts';
import { Language } from '../types/index.ts';
import { openAndroidAppSettings, openAndroidBatterySettings, restartForegroundService } from '../utils/nativeBridge.ts';

interface AndroidPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const AndroidPermissionModal: React.FC<AndroidPermissionModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  if (!isOpen) return null;

  const isAm = language === 'am';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-[#14503F] flex items-center justify-center shadow-xs">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                {isAm ? 'የአንድሮይድ ፍቃዶች እና ቅንብሮች' : 'Android 13+ Permissions & Setup'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isAm ? 'MacroDroid ሳይፈልጉ በራሱ እንዲሠራ' : 'Reliable 24/7 background SMS capture guide'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Primary Action Button: Open Settings Directly */}
        <div className="bg-emerald-50 border-2 border-[#14503F] rounded-2xl p-4 space-y-2.5">
          <div className="flex items-start gap-2 text-xs font-bold text-[#14503F]">
            <Settings size={16} className="shrink-0 mt-0.5 animate-spin-slow" />
            <div>
              <p>{isAm ? 'የስልክ ቅንብርን በቀጥታ ለመክፈት ይጫኑ' : 'Tap Below to Open App Settings Directly'}</p>
              <p className="text-[10px] font-normal text-emerald-800 mt-0.5">
                {isAm
                  ? 'Settings → Apps → Ak Finance መፈለግ ሳያስፈልግህ በቀጥታ ይከፍትልሃል'
                  : 'Opens Settings → Apps → Ak Finance without having to search manual menus'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openAndroidAppSettings}
            className="w-full py-2.5 px-3 rounded-xl bg-[#14503F] text-white text-xs font-extrabold shadow-md hover:bg-[#0e3b2e] active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink size={14} />
            <span>{isAm ? 'የመተግበሪያ ቅንብሮችን ክፈት (Open Settings)' : 'Open Ak Finance in Settings'}</span>
          </button>
        </div>

        {/* Step 1: Restricted Settings Android 13/14 */}
        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#14503F] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <span className="text-xs font-bold text-slate-900">
              {isAm ? '3 ነጥቦችን በመንካት "Allow restricted settings" ይጫኑ' : 'Tap (⋮) & "Allow Restricted Settings"'}
            </span>
          </div>
          <div className="text-[11px] text-slate-600 leading-relaxed pl-7 space-y-1">
            <p>
              {isAm ? (
                <>
                  ቅንብሩ ሲከፈት ከላይ በቀኝ በኩል የሚታየውን <b>3 ነጥቦች (⋮)</b> በመንካት <b>"Allow restricted settings"</b> የሚለውን ይምረጡና የስልክዎን ፒን ኮድ ወይም የጣት አሻራ ያረጋግጡ።
                </>
              ) : (
                <>
                  In the top-right corner of the App Info page, tap the <b>three dots (⋮)</b> and tap <b>"Allow restricted settings"</b>. Confirm with your PIN or fingerprint.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Step 2: Unrestricted Battery */}
        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#14503F] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                2
              </span>
              <span className="text-xs font-bold text-slate-900">
                {isAm ? 'ባትሪ ያልተገደበ አድርግ (Battery → Unrestricted)' : 'Battery Optimization: Set to Unrestricted'}
              </span>
            </div>
            <button
              onClick={openAndroidBatterySettings}
              className="text-[10px] text-[#14503F] font-bold hover:underline flex items-center gap-0.5"
            >
              <BatteryCharging size={12} />
              <span>{isAm ? 'ባትሪ ክፈት' : 'Open Battery'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed pl-7">
            {isAm ? (
              <>
                <b>Battery</b> ውስጥ በመግባት <b>"Unrestricted"</b> ይምረጡ። ይሄ አንድሮይድ ሲስተም የጀርባ SMS አድማጩን እንዳያጠፋው ያደርጋል።
              </>
            ) : (
              <>
                In <b>Battery</b>, select <b>"Unrestricted"</b> so Android never kills the background SMS forwarder when the phone is sleeping.
              </>
            )}
          </p>
        </div>

        {/* Step 3: Foreground Notification */}
        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#14503F] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              3
            </span>
            <span className="text-xs font-bold text-slate-900">
              {isAm ? 'የማስታወቂያ ፈቃድ (Notification & SMS)' : 'Persistent Foreground Notification'}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed pl-7">
            {isAm ? (
              <>
                <b>SMS</b> እና <b>Notifications</b> ፈቃዶችን ያብሩ። አፕሊኬሽኑ በቋሚነት ከበስተጀርባ ዝግጁ ሆኖ ይቀመጣል።
              </>
            ) : (
              <>
                Enable <b>SMS</b> and <b>Notifications</b>. A persistent system service will listen for incoming CBE, Telebirr, and Awash messages 24/7.
              </>
            )}
          </p>
        </div>

        {/* Re-trigger background service button */}
        <button
          type="button"
          onClick={restartForegroundService}
          className="w-full py-2 px-3 rounded-xl border border-[#14503F]/30 bg-emerald-50/50 text-[#14503F] text-xs font-bold hover:bg-emerald-100/50 transition-colors flex items-center justify-center gap-1.5"
        >
          <Play size={13} />
          <span>{isAm ? 'የጀርባ አገልግሎቱን ዳግም አስጀምር (Start Service)' : 'Restart 24/7 Foreground Service'}</span>
        </button>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-md hover:bg-slate-800 transition-all"
        >
          {isAm ? 'ተረድቻለሁ · ዝጋ' : 'Done & Return to App'}
        </button>
      </div>
    </div>
  );
};
