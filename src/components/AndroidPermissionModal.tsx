import React from 'react';
import { X, ShieldCheck, BatteryCharging, BellRing, Smartphone, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { translations } from '../utils/i18n.ts';
import { Language } from '../types/index.ts';

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
      <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#14503F] flex items-center justify-center">
              <ShieldCheck size={18} />
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
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Overview banner */}
        <div className="bg-[#14503F]/5 border border-[#14503F]/20 rounded-2xl p-3.5 text-xs text-slate-700 leading-relaxed space-y-1">
          <div className="font-bold text-[#14503F] flex items-center gap-1.5">
            <Smartphone size={14} />
            <span>{isAm ? 'የቀጥታ APK ጭነት (Sideload APK)' : 'Direct APK Installation Guide'}</span>
          </div>
          <p className="text-[11px] text-slate-600">
            {isAm
              ? 'ይህ መተግበሪያ ከ Play Store ውጪ በቀጥታ በ APK ስለሚጫን የባንክ መልዕክቶችን ያለማቋረጥ እንዲያነብ የሚከተሉትን 3 ደረጃዎች ያጠናቁ።'
              : 'Because Ak Finance captures banking SMS without requiring Play Store restrictions, complete these 3 Android OS settings for 100% uptime:'}
          </p>
        </div>

        {/* Step 1: Restricted Settings Android 13/14 */}
        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#14503F] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <span className="text-xs font-bold text-slate-900">
              {isAm ? 'የተገደቡ ፈቃዶችን ክፈት (Allow Restricted Settings)' : 'Android 13+ "Allow Restricted Settings"'}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed pl-7">
            {isAm ? (
              <>
                ስልክዎ ላይ <b>Settings → Apps → Ak Finance</b> ይክፈቱ። ከላይ በቀኝ በኩል የሚታየውን <b>3 ነጥቦች (⋮)</b> በመንካት <b>"Allow restricted settings"</b> የሚለውን ይምረጡ።
              </>
            ) : (
              <>
                Go to <b>Settings → Apps → Ak Finance</b>. Tap the <b>three dots (⋮)</b> in the top right corner and tap <b>"Allow restricted settings"</b>.
              </>
            )}
          </p>
        </div>

        {/* Step 2: Unrestricted Battery */}
        <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#14503F] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <span className="text-xs font-bold text-slate-900">
              {isAm ? 'ባትሪ ያልተገደበ አድርግ (Battery → Unrestricted)' : 'Battery Optimization: Set to Unrestricted'}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed pl-7">
            {isAm ? (
              <>
                <b>App Info → Battery</b> ውስጥ በመግባት <b>"Unrestricted"</b> ይምረጡ። ይሄ አንድሮይድ ሲስተም የጀርባ አገልግሎቱን እንዳያቋርጠው ያደርጋል።
              </>
            ) : (
              <>
                In <b>App Info → Battery</b>, change from "Optimized" to <b>"Unrestricted"</b>. This ensures background service and boot receiver run continuously.
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
                መተግበሪያው ሲከፈት <b>"Allow SMS"</b> እና <b>"Allow Notifications"</b> ሲጠይቅ <b>"Allow"</b> ይበሉ። አንድሮይድ አስተማማኝ Foreground Service ይጀምራል።
              </>
            ) : (
              <>
                When prompted, grant <b>READ_SMS</b> and <b>RECEIVE_SMS</b> permissions. A small persistent status indicator "Ak Finance monitoring payments" will remain active.
              </>
            )}
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-md hover:bg-[#0e3b2e] transition-all"
        >
          {isAm ? 'ተረድቻለሁ · ዝጋ' : 'Got it, everything is ready'}
        </button>
      </div>
    </div>
  );
};
