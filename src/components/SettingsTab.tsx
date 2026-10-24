import React, { useState } from 'react';
import { AppSettings, SyncLogEntry } from '../types/index.ts';
import { translations } from '../utils/i18n.ts';
import { db } from '../services/db.ts';
import { 
  Server, 
  Key, 
  RefreshCw, 
  Radio, 
  Plus, 
  Trash2, 
  Save, 
  Check, 
  Shield, 
  HardDrive,
  Activity,
  Download,
  AlertTriangle,
  Settings as SettingsIcon,
  ExternalLink,
  BatteryCharging,
  Play,
  Volume2,
  VolumeX,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { openAndroidAppSettings, openAndroidBatterySettings, restartForegroundService } from '../utils/nativeBridge.ts';

interface SettingsTabProps {
  settings: AppSettings;
  syncLogs: SyncLogEntry[];
  onSaveSettings: (newSettings: AppSettings) => Promise<void>;
  onResetData: () => Promise<void>;
  onTriggerSyncAll: () => Promise<void>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  syncLogs,
  onSaveSettings,
  onResetData,
  onTriggerSyncAll,
}) => {
  const [formData, setFormData] = useState<AppSettings>({ ...settings });
  const [newSender, setNewSender] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Webhook Test State
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; status: number; durationMs: number; message: string } | null>(null);

  // Clear demo data status
  const [clearedDemoSuccess, setClearedDemoSuccess] = useState(false);

  const t = translations[settings.language];
  const isAm = settings.language === 'am';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleAddSender = () => {
    const val = newSender.trim().toUpperCase();
    if (!val || formData.allowedSenders.includes(val)) return;
    setFormData(prev => ({
      ...prev,
      allowedSenders: [...prev.allowedSenders, val],
    }));
    setNewSender('');
  };

  const handleRemoveSender = (s: string) => {
    setFormData(prev => ({
      ...prev,
      allowedSenders: prev.allowedSenders.filter(item => item !== s),
    }));
  };

  const handleManualSyncAll = async () => {
    setIsSyncing(true);
    await onTriggerSyncAll();
    setIsSyncing(false);
  };

  const handleTestWebhook = async () => {
    if (!formData.serverUrl) return;
    setIsTestingWebhook(true);
    setTestResult(null);
    try {
      const res = await db.testWebhook(formData.serverUrl, formData.secretKey);
      setTestResult(res);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleClearDemoData = async () => {
    const msg = isAm 
      ? 'እርግጠኛ ነዎት? ሁሉንም የሙከራ ዳታዎች ያጠፋና ለእውነተኛ የባንክ መልዕክቶች ብቻ ያዘጋጃል።' 
      : 'Clear all demo payments & reset balances to 0? This cleans your desk so only real incoming bank SMS will appear.';
    if (window.confirm(msg)) {
      await db.clearAllDemoData();
      await onTriggerSyncAll();
      setClearedDemoSuccess(true);
      setTimeout(() => setClearedDemoSuccess(false), 3000);
    }
  };

  const handleExportCsv = async () => {
    const csvContent = await db.exportPaymentsCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ak_finance_payments_${new Date().toISOString().slice(0, 10)}.csv`);
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
          {isAm ? 'የአንድሮይድ ፍቃዶች፣ ሰርቨር እና አውቶሜሽን ቅንብሮች' : 'Configure Android OS permissions, webhook destination, and automation'}
        </p>
      </div>

      {/* 1. Android 13+ Restricted Settings Direct Card */}
      <div className="bg-gradient-to-br from-emerald-900 to-[#14503F] text-white rounded-3xl p-5 shadow-lg space-y-3.5 border border-emerald-700/50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300">
              <SettingsIcon size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold font-['Poppins',sans-serif] text-emerald-100">
                {isAm ? 'የተገደቡ ቅንብሮች ፍቃድ (Restricted Settings)' : 'Android 13+ Restricted Settings'}
              </h3>
              <p className="text-[11px] text-emerald-200/80">
                {isAm ? 'Settings → Apps → Ak Finance → (⋮) → Allow restricted settings' : 'Settings → Apps → Ak Finance → (⋮) → Allow restricted settings'}
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
            Android OS
          </span>
        </div>

        <div className="bg-black/20 rounded-2xl p-3 text-[11px] text-emerald-100 leading-relaxed space-y-1.5 border border-white/10">
          <p className="font-semibold text-white">
            {isAm ? 'ፈቃድ ለመስጠት የሚከተሉትን 3 ደረጃዎች ይከተሉ፦' : 'Quick 3-step setup to unlock 24/7 background capture:'}
          </p>
          <ol className="list-decimal pl-4 space-y-1 text-emerald-200 text-[10.5px]">
            <li>{isAm ? 'ከታች ያለውን "ቅንብሮችን ክፈት" ቁልፍ ይጫኑ' : 'Tap the green "Open Ak Finance in Settings" button below'}</li>
            <li>{isAm ? 'ከላይ በቀኝ በኩል የሚታየውን 3 ነጥቦች (⋮) ይንኩ' : 'In the top right corner, tap the three dots (⋮)'}</li>
            <li>{isAm ? '"Allow restricted settings" የሚለውን ይምረጡና በፒን ኮድዎ ያረጋግጡ' : 'Tap "Allow restricted settings" and confirm with your screen lock'}</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={openAndroidAppSettings}
            className="w-full py-2.5 px-3 rounded-xl bg-white text-[#14503F] text-xs font-extrabold shadow-md hover:bg-emerald-50 active:scale-98 transition-all flex items-center justify-center gap-1.5"
          >
            <ExternalLink size={14} />
            <span>{isAm ? 'ቅንብሮችን ክፈት (Open Settings)' : 'Open Ak Finance in Settings'}</span>
          </button>

          <button
            type="button"
            onClick={openAndroidBatterySettings}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-800/80 hover:bg-emerald-800 text-white text-xs font-bold border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5"
          >
            <BatteryCharging size={14} />
            <span>{isAm ? 'ባትሪ ያልተገደበ አድርግ (Battery)' : 'Set Battery to Unrestricted'}</span>
          </button>
        </div>
      </div>

      {/* 2. Webhook & Real-Time Sync Configuration */}
      <form onSubmit={handleSave} className="space-y-4">
        {/* Operating Mode Selector */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-['Poppins',sans-serif]">
            <Radio size={14} className="text-[#14503F]" />
            <span>{t.appMode}</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, mode: 'server' }))}
              className={`p-3 rounded-xl border text-left transition-all ${
                formData.mode === 'server'
                  ? 'bg-emerald-50 border-[#14503F] text-[#14503F]'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs font-bold font-['Poppins',sans-serif]">
                {t.serverMode}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {isAm ? 'መልዕክቶች ወደ ሰርቨር አውቶማቲክ ይላካሉ' : 'Auto-forward to Render/backend webhook'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, mode: 'local' }))}
              className={`p-3 rounded-xl border text-left transition-all ${
                formData.mode === 'local'
                  ? 'bg-emerald-50 border-[#14503F] text-[#14503F]'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs font-bold font-['Poppins',sans-serif]">
                {t.localMode}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {isAm ? 'በስልኩ ላይ ብቻ ይመዘገባል' : 'Stored only inside SQLite/phone'}
              </div>
            </button>
          </div>
        </div>

        {/* Server Webhook Settings */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-['Poppins',sans-serif]">
              <Server size={14} className="text-[#14503F]" />
              <span>{t.serverUrl}</span>
            </label>
            <span className="text-[10px] text-slate-400 font-mono">
              Render / Railway / VPS
            </span>
          </div>

          <input
            type="url"
            value={formData.serverUrl}
            onChange={e => setFormData(prev => ({ ...prev, serverUrl: e.target.value }))}
            placeholder="https://my-backend.onrender.com/api/webhook"
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F] font-mono"
            required={formData.mode === 'server'}
          />

          <div>
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1 font-['Poppins',sans-serif]">
              <Key size={14} className="text-[#14503F]" />
              <span>{t.secretKey}</span>
            </label>
            <input
              type="password"
              value={formData.secretKey}
              onChange={e => setFormData(prev => ({ ...prev, secretKey: e.target.value }))}
              placeholder="Your secure webhook token / Bearer token"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F] font-mono"
            />
          </div>

          {/* Test Webhook Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleTestWebhook}
              disabled={isTestingWebhook || !formData.serverUrl}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={isTestingWebhook ? 'animate-spin' : ''} />
              <span>{isTestingWebhook ? 'Pinging Webhook...' : 'Ping Webhook (Test Connectivity)'}</span>
            </button>

            {testResult && (
              <div
                className={`mt-2 p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <div className="font-bold flex items-center gap-2">
                    <span>{testResult.success ? 'Connected Successfully' : 'Connection Failed'}</span>
                    <span className="text-[10px] font-mono font-normal opacity-80">
                      ({testResult.durationMs}ms)
                    </span>
                  </div>
                  <p className="text-[10.5px] font-mono opacity-90 break-all">
                    {testResult.message}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sound & Notifications Automation */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              formData.soundEnabled ? 'bg-emerald-100 text-[#14503F]' : 'bg-slate-100 text-slate-400'
            }`}>
              {formData.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">
                {isAm ? 'ድምጽ እና ቫይብሬሽን (Audio & Haptics)' : 'Sound & Vibration on SMS Arrival'}
              </div>
              <div className="text-[10px] text-slate-400">
                {isAm ? 'የባንክ ክፍያ ሲገባ የደወል ድምፅ ያሰማል' : 'Play chime & vibrate phone when SMS is captured'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              formData.soundEnabled ? 'bg-[#14503F]' : 'bg-slate-200'
            }`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
              formData.soundEnabled ? 'left-6' : 'left-1'
            }`} />
          </button>
        </div>

        {/* Monitored Bank Senders */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-['Poppins',sans-serif]">
              <Shield size={14} className="text-[#14503F]" />
              <span>{t.allowedSenders}</span>
            </div>
            <span className="text-[10px] text-slate-400">
              Only selected senders will be captured
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {formData.allowedSenders.map(sender => (
              <span
                key={sender}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-[#14503F] text-xs font-bold border border-emerald-200/80"
              >
                <span>{sender}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveSender(sender)}
                  className="hover:text-rose-600 transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newSender}
              onChange={e => setNewSender(e.target.value)}
              placeholder="e.g. 889, Wegagen, Nib, BOA"
              className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F] font-mono"
            />
            <button
              type="button"
              onClick={handleAddSender}
              className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 flex items-center gap-1"
            >
              <Plus size={13} />
              <span>{t.addSender}</span>
            </button>
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-md hover:bg-[#0e3b2e] active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          {savedSuccess ? (
            <>
              <Check size={16} />
              <span>{t.settingsSaved}</span>
            </>
          ) : (
            <>
              <Save size={15} />
              <span>{t.saveSettings}</span>
            </>
          )}
        </button>
      </form>

      {/* 3. Export to CSV for Bookkeeping */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 font-['Poppins',sans-serif]">
            <FileSpreadsheet size={15} className="text-[#14503F]" />
            <span>{isAm ? 'የክፍያ ሪፖርት ወደ Excel/CSV' : 'Export Transactions to Spreadsheet'}</span>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="text-xs font-bold text-[#14503F] hover:underline flex items-center gap-1"
          >
            <Download size={13} />
            <span>Download CSV</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          {isAm ? 'ሁሉንም የተመዘገቡ ክፍያዎች በ CSV ፋይል ለሂሳብ መዝገብ ያውርዱ።' : 'Export all captured CBE, Telebirr & Awash transactions for Excel bookkeeping.'}
        </p>
      </div>

      {/* 4. Sync Operations & Activity Log */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 font-['Poppins',sans-serif]">
            <Activity size={14} className="text-[#14503F]" />
            <span>Recent Webhook Sync Attempts</span>
          </div>
          <button
            onClick={handleManualSyncAll}
            disabled={isSyncing}
            className="text-[11px] font-bold text-[#14503F] hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw size={11} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : t.retrySyncNow}</span>
          </button>
        </div>

        <div className="space-y-1.5 max-h-40 overflow-y-auto font-mono text-[10px]">
          {syncLogs.length === 0 ? (
            <div className="text-slate-400 p-3 text-center bg-slate-50 rounded-xl">
              No recent sync webhook attempts recorded.
            </div>
          ) : (
            syncLogs.slice(0, 8).map(log => (
              <div
                key={log.id}
                className={`p-2 rounded-lg border flex items-start justify-between gap-2 ${
                  log.status === 'success'
                    ? 'bg-emerald-50/50 border-emerald-100 text-emerald-900'
                    : 'bg-rose-50/50 border-rose-100 text-rose-900'
                }`}
              >
                <div>
                  <div className="font-bold flex items-center gap-1">
                    <span>{log.status === 'success' ? '✓ 200 OK' : `✗ Error ${log.httpStatus || ''}`}</span>
                    <span className="text-slate-400 font-normal">
                      · {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-500 truncate max-w-[260px]">
                    {log.message}
                  </div>
                </div>
                {log.durationMs && (
                  <span className="text-[9px] text-slate-400 shrink-0">
                    {log.durationMs}ms
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 5. Clean Slate / Remove Demo Data */}
      <div className="bg-white rounded-2xl p-4 border border-rose-200/80 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-rose-800">
          <Trash2 size={16} />
          <h4 className="text-xs font-bold font-['Poppins',sans-serif]">
            {isAm ? 'የሙከራ ዳታዎችን አጽዳ (Remove Demos)' : 'Clean Slate: Remove Demo Transactions'}
          </h4>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          {isAm 
            ? 'ሁሉንም የሙከራ ክፍያዎች ያጠፋና መተግበሪያውን ለእውነተኛ የባንክ መልዕክቶች ብቻ ዝግጁ ያደርጋል።' 
            : 'Wipes all sample seed payments so your desk displays only genuine, real-time banking SMS as they arrive.'}
        </p>
        <button
          type="button"
          onClick={handleClearDemoData}
          className="w-full py-2.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
        >
          {clearedDemoSuccess ? (
            <>
              <Check size={14} className="text-emerald-700" />
              <span className="text-emerald-700">{isAm ? 'የሙከራ ዳታዎች ጸድተዋል!' : 'All Demo Data Cleared! Desk Clean.'}</span>
            </>
          ) : (
            <>
              <Trash2 size={13} />
              <span>{isAm ? 'ሁሉንም የሙከራ ዳታዎች አጽዳ' : 'Clear All Demo Data & Start Fresh'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
