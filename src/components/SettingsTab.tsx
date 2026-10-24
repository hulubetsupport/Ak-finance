import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Check, 
  ExternalLink, 
  BatteryCharging, 
  ShieldCheck, 
  AlertTriangle, 
  Radio, 
  RotateCcw, 
  Download, 
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { AppSettings } from '../types/index.ts';
import { translations } from '../utils/i18n.ts';
import { db } from '../services/db.ts';
import { 
  checkNativePermissions, 
  requestNativePermissions, 
  openAndroidBatterySettings, 
  openAndroidAppSettings, 
  getNativeStatus, 
  NativeStatus 
} from '../utils/nativeBridge.ts';

interface SettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  onTriggerSyncAll: () => Promise<void>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onUpdateSettings,
  onTriggerSyncAll,
}) => {
  const t = translations[settings.language];
  const isAm = settings.language === 'am';

  const [formData, setFormData] = useState({
    serverUrl: settings.serverUrl,
    secretKey: settings.secretKey,
    monitoredSenders: settings.allowedSenders.join(', '),
    mode: settings.mode,
    httpMethod: settings.httpMethod || 'GET',
    retryIntervalSeconds: settings.retryIntervalSeconds || 15,
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [permissions, setPermissions] = useState<{ smsGranted: boolean; notificationsGranted: boolean }>({
    smsGranted: true,
    notificationsGranted: true,
  });
  const [nativeStatus, setNativeStatus] = useState<NativeStatus | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [clearedNotice, setClearedNotice] = useState(false);

  useEffect(() => {
    setFormData({
      serverUrl: settings.serverUrl,
      secretKey: settings.secretKey,
      monitoredSenders: settings.allowedSenders.join(', '),
      mode: settings.mode,
      httpMethod: settings.httpMethod || 'GET',
      retryIntervalSeconds: settings.retryIntervalSeconds || 15,
    });

    const refreshInfo = async () => {
      const p = await checkNativePermissions();
      setPermissions(p);
      const s = await getNativeStatus();
      setNativeStatus(s);
    };
    refreshInfo();
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const sendersList = formData.monitoredSenders
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    await onUpdateSettings({
      serverUrl: formData.serverUrl.trim(),
      secretKey: formData.secretKey.trim(),
      allowedSenders: sendersList.length > 0 ? sendersList : ['CBE', '127', 'AwashBank', 'Dashen', 'BOA'],
      mode: formData.mode,
      httpMethod: formData.httpMethod,
      retryIntervalSeconds: Number(formData.retryIntervalSeconds) || 15,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleClearAll = async () => {
    const msg = isAm 
      ? 'እርግጠኛ ነዎት? ሁሉንም የተቀረጹ ክፍያዎች ያጠፋል።' 
      : 'Clear all captured SMS payments from local SQLite database?';
    if (window.confirm(msg)) {
      await db.clearAllPayments();
      await onTriggerSyncAll();
      setClearedNotice(true);
      setTimeout(() => setClearedNotice(false), 3000);
    }
  };

  const handleExportCsv = async () => {
    const csv = await db.exportPaymentsCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ak_financial_payments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div>
        <h2 className="text-lg font-extrabold text-slate-900 font-['Poppins',sans-serif]">
          {t.settings}
        </h2>
        <p className="text-xs text-slate-400">
          {isAm ? 'የቀጥታ SMS መቀበያ እና የሰርቨር ማስተካከያዎች' : 'Native SharedPreferences & SQLite pipeline configuration'}
        </p>
      </div>

      {/* Permissions Check Card */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#14503F]" />
            <h3 className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
              {isAm ? 'የፍቃድ ሁኔታ (Permissions)' : 'Permissions & Battery Status'}
            </h3>
          </div>
          <button
            type="button"
            onClick={openAndroidBatterySettings}
            className="text-[11px] font-bold text-[#14503F] hover:underline flex items-center gap-1"
          >
            <BatteryCharging size={13} />
            <span>Battery → Unrestricted</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
            permissions.smsGranted ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <span className="font-semibold">SMS Permission</span>
            {permissions.smsGranted ? (
              <span className="text-[10px] font-bold uppercase bg-emerald-100 px-1.5 py-0.5 rounded">Granted</span>
            ) : (
              <button
                type="button"
                onClick={requestNativePermissions}
                className="text-[10px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded shadow-xs"
              >
                Grant
              </button>
            )}
          </div>

          <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
            permissions.notificationsGranted ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <span className="font-semibold">Notifications</span>
            <span className="text-[10px] font-bold uppercase bg-white/80 px-1.5 py-0.5 rounded">
              {permissions.notificationsGranted ? 'Active' : 'Optional'}
            </span>
          </div>
        </div>

        {/* ONLY IF SMS permission is not granted: Android 13+ Restricted Settings Guide */}
        {!permissions.smsGranted && (
          <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-3.5 space-y-2 mt-2">
            <div className="flex items-start gap-2 text-amber-900">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">
                  {isAm ? 'አንድሮይድ 13+ ፍቃድ አሰጣጥ መመሪያ' : 'Android 13+ Permission Guide'}
                </p>
                <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                  {isAm ? (
                    <>
                      1. ከታች ያለውን <b>"Open App Info"</b> ይጫኑ<br />
                      2. ከላይ በቀኝ በኩል የሚታየውን <b>3 ነጥቦች (⋮)</b> ይንኩ<br />
                      3. <b>"Allow restricted settings"</b> የሚለውን ይምረጡ<br />
                      4. የስልክ መቆለፊያ ፒን/የጣት አሻራ ያረጋግጡና የ SMS ፍቃድ ይስጡ
                    </>
                  ) : (
                    <>
                      Open App info (ACTION_APPLICATION_DETAILS_SETTINGS) → ⋮ top right → <b>"Allow restricted settings"</b> → confirm screen lock → grant SMS permission.
                    </>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openAndroidAppSettings}
              className="w-full py-2 px-3 rounded-xl bg-amber-600 text-white text-xs font-bold shadow-xs hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={13} />
              <span>Open App Info (Settings)</span>
            </button>
          </div>
        )}
      </div>

      {/* Main 4 Visible Settings Form */}
      <form onSubmit={handleSave} className="space-y-3.5">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3.5">
          {/* 1. Server URL */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 font-['Poppins',sans-serif]">
              {t.serverUrl}
            </label>
            <input
              type="url"
              value={formData.serverUrl}
              onChange={e => setFormData({ ...formData, serverUrl: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#14503F] focus:ring-1 focus:ring-[#14503F]"
              placeholder="https://example.com/api/save_sms"
            />
            <p className="text-[10px] text-slate-400">
              {isAm 
                ? 'የተጻፈው URL ልክ እንዳለ ይጠቀማል (ምንም ተጨማሪ path አይጨመርም)' 
                : 'Exact URL typed is used; query parameters action=save_sms, token, sender, message are sent.'}
            </p>
          </div>

          {/* 2. Secret Key */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 font-['Poppins',sans-serif]">
              {t.secretKey}
            </label>
            <input
              type="text"
              value={formData.secretKey}
              onChange={e => setFormData({ ...formData, secretKey: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#14503F] focus:ring-1 focus:ring-[#14503F]"
              placeholder="ak_secret_key_..."
            />
          </div>

          {/* 3. Monitored Senders */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 font-['Poppins',sans-serif]">
              {isAm ? 'የሚነበቡ የባንክ ስሞች (Monitored Senders)' : 'Monitored Senders'}
            </label>
            <input
              type="text"
              value={formData.monitoredSenders}
              onChange={e => setFormData({ ...formData, monitoredSenders: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#14503F] focus:ring-1 focus:ring-[#14503F]"
              placeholder="CBE, 127, AwashBank, Dashen, BOA"
            />
            <p className="text-[10px] text-slate-400">
              {isAm ? 'በኮማ የተለዩ የላኪ ስሞች (default: CBE, 127, AwashBank, Dashen, BOA)' : 'Comma-separated exact senders (case-insensitive)'}
            </p>
          </div>

          {/* 4. Mode: Server / Local */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-slate-800 font-['Poppins',sans-serif] flex items-center gap-1.5">
              <Radio size={14} className="text-[#14503F]" />
              <span>{t.appMode}</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, mode: 'server' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  formData.mode === 'server'
                    ? 'bg-emerald-50 border-[#14503F] text-[#14503F]'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="text-xs font-bold font-['Poppins',sans-serif]">
                  Server Mode
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {isAm ? 'ወደ ሰርቨር አውቶማቲክ ይላካል' : 'Auto-forward to Server URL'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, mode: 'local' })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  formData.mode === 'local'
                    ? 'bg-emerald-50 border-[#14503F] text-[#14503F]'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="text-xs font-bold font-['Poppins',sans-serif]">
                  Local Mode
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {isAm ? 'በስልክ SQLite ብቻ ይቀመጣል' : 'Store only in SQLite, do not send'}
                </div>
              </button>
            </div>
          </div>

          {/* Optional / Collapsible: Advanced Network Options (Method & Interval) */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              <span>Network Protocol Options (Method: {formData.httpMethod}, Interval: {formData.retryIntervalSeconds}s)</span>
              {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3 pt-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">HTTP Method</label>
                  <select
                    value={formData.httpMethod}
                    onChange={e => setFormData({ ...formData, httpMethod: e.target.value as 'GET' | 'POST' })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#14503F]"
                  >
                    <option value="GET">GET (Default)</option>
                    <option value="POST">POST (Form-encoded)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Retry Interval (s)</label>
                  <input
                    type="number"
                    min={5}
                    max={3600}
                    value={formData.retryIntervalSeconds}
                    onChange={e => setFormData({ ...formData, retryIntervalSeconds: Number(e.target.value) || 15 })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:border-[#14503F]"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          className="w-full py-3 rounded-2xl bg-[#14503F] text-white font-bold text-xs shadow-md hover:bg-[#0e3b2e] active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          {saveSuccess ? (
            <>
              <Check size={16} className="text-emerald-300" />
              <span>{isAm ? 'ቅንብሮች በ SharedPreferences "ejeta" ተመዝግበዋል!' : 'Saved to SharedPreferences "ejeta"!'}</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>{t.saveSettings}</span>
            </>
          )}
        </button>
      </form>

      {/* Utility Actions */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2">
        <h3 className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
          {isAm ? 'የዳታ አስተዳደር' : 'Data Management & CSV Export'}
        </h3>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={handleExportCsv}
            className="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
          >
            <Download size={14} />
            <span>{t.exportCsv}</span>
          </button>

          <button
            type="button"
            onClick={handleClearAll}
            className="py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
          >
            <Trash2 size={14} />
            <span>{clearedNotice ? 'Cleared!' : 'Clear All Payments'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
