import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  Check, 
  BatteryCharging, 
  ShieldCheck, 
  AlertTriangle, 
  Radio, 
  Plus, 
  X, 
  ExternalLink,
  Building2,
  Sparkles
} from 'lucide-react';
import { AppSettings } from '../types/index.ts';
import { translations } from '../utils/i18n.ts';
import { db } from '../services/db.ts';
import { 
  checkNativePermissions, 
  requestNativePermissions, 
  openAndroidBatterySettings, 
  openAndroidAppSettings 
} from '../utils/nativeBridge.ts';

interface SettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  onTriggerSyncAll?: () => Promise<void>;
}

const COMMON_BANKS = [
  'Telebirr',
  'Commercial Bank of Ethiopia',
  'Awash Bank',
  'Dashen Bank',
  'Bank of Abyssinia',
  'Abay Bank',
  'Wegagen Bank',
  'Nib Bank',
  'Zemen Bank',
  'Coop Bank',
  'Hibret Bank',
];

const DRAFT_KEY = 'ak_settings_draft_v2';

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const t = translations[settings.language];
  const isAm = settings.language === 'am';

  // Local draft state initialized from localStorage draft (if any) or prop settings
  const [formData, setFormData] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          serverUrl: parsed.serverUrl ?? settings.serverUrl,
          secretKey: parsed.secretKey ?? settings.secretKey,
          mode: parsed.mode ?? settings.mode,
          httpMethod: parsed.httpMethod ?? settings.httpMethod ?? 'GET',
          retryIntervalSeconds: parsed.retryIntervalSeconds ?? settings.retryIntervalSeconds ?? 15,
          excludeHiddenFromTotal: parsed.excludeHiddenFromTotal ?? settings.excludeHiddenFromTotal ?? false,
          startHiddenAfterUnlock: parsed.startHiddenAfterUnlock ?? settings.startHiddenAfterUnlock ?? false,
        };
      }
    } catch {}
    return {
      serverUrl: settings.serverUrl,
      secretKey: settings.secretKey,
      mode: settings.mode,
      httpMethod: settings.httpMethod || 'GET',
      retryIntervalSeconds: settings.retryIntervalSeconds || 15,
      excludeHiddenFromTotal: settings.excludeHiddenFromTotal ?? false,
      startHiddenAfterUnlock: settings.startHiddenAfterUnlock ?? false,
    };
  });

  const [senderBankMap, setSenderBankMap] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [permissions, setPermissions] = useState<{ smsGranted: boolean; notificationsGranted: boolean }>({
    smsGranted: true,
    notificationsGranted: true,
  });

  // Track if user is actively editing to protect inputs from background polling
  const isDirtyRef = useRef(false);
  const debounceTimerRef = useRef<any>(null);

  // Add Sender Modal state
  const [showAddSenderModal, setShowAddSenderModal] = useState(false);
  const [newSenderCode, setNewSenderCode] = useState('');
  const [newSenderBank, setNewSenderBank] = useState('Telebirr');

  // Load permissions and sender mappings on mount
  useEffect(() => {
    const refreshMeta = async () => {
      const p = await checkNativePermissions();
      setPermissions(p);
      const sMap = await db.getSenderBankMap();
      setSenderBankMap(sMap);
    };
    refreshMeta();
  }, []);

  // Update draft if external settings change, BUT ONLY if user is not actively editing
  useEffect(() => {
    if (!isDirtyRef.current) {
      setFormData(prev => ({
        ...prev,
        serverUrl: settings.serverUrl,
        secretKey: settings.secretKey,
        mode: settings.mode,
        httpMethod: settings.httpMethod || 'GET',
        retryIntervalSeconds: settings.retryIntervalSeconds || 15,
      }));
    }
  }, [settings.serverUrl, settings.secretKey, settings.mode, settings.httpMethod, settings.retryIntervalSeconds]);

  // Persist draft to localStorage on changes
  const saveDraftLocally = (data: typeof formData) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {}
  };

  // Perform actual save to SharedPreferences / db
  const performSave = async (dataToSave: typeof formData) => {
    setSaveStatus('saving');
    try {
      const sendersList = Object.keys(senderBankMap);
      await onUpdateSettings({
        serverUrl: dataToSave.serverUrl.trim(),
        secretKey: dataToSave.secretKey.trim(),
        allowedSenders: sendersList.length > 0 ? sendersList : ['CBE', '127', 'AwashBank', 'Dashen', 'BOA'],
        mode: dataToSave.mode,
        httpMethod: dataToSave.httpMethod,
        retryIntervalSeconds: Number(dataToSave.retryIntervalSeconds) || 15,
      });
      isDirtyRef.current = false;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      setSaveStatus('idle');
    }
  };

  // Trigger debounced autosave 500ms after typing stops
  const triggerDebouncedAutoSave = (updated: typeof formData) => {
    isDirtyRef.current = true;
    saveDraftLocally(updated);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      performSave(updated);
    }, 500);
  };

  const handleFieldChange = (field: keyof typeof formData, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    triggerDebouncedAutoSave(updated);
  };

  const handleBlur = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    performSave(formData);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    performSave(formData);
  };

  const handleAddSender = async () => {
    const code = newSenderCode.trim();
    if (!code) return;
    await db.saveSenderBankMapping(code, newSenderBank);
    const updatedMap = await db.getSenderBankMap();
    setSenderBankMap(updatedMap);

    const sendersList = Object.keys(updatedMap);
    await onUpdateSettings({ allowedSenders: sendersList });

    setNewSenderCode('');
    setShowAddSenderModal(false);
  };

  const handleDeleteSender = async (senderCode: string) => {
    await db.deleteSenderBankMapping(senderCode);
    const updatedMap = await db.getSenderBankMap();
    setSenderBankMap(updatedMap);

    const sendersList = Object.keys(updatedMap);
    await onUpdateSettings({ allowedSenders: sendersList });
  };

  return (
    <div className="space-y-3.5 pb-20">
      {/* Title + Autosave Indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 font-['Poppins',sans-serif]">
            {t.settings}
          </h2>
          <p className="text-xs text-slate-400">
            {isAm ? 'የቀጥታ SMS መቀበያ እና የሰርቨር ማስተካከያዎች' : 'Native SharedPreferences & SQLite pipeline configuration'}
          </p>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all">
          {saveStatus === 'saved' ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[11px] font-semibold animate-in fade-in">
              <Check size={12} className="text-emerald-600 stroke-[3]" />
              <span>Saved ✓</span>
            </span>
          ) : saveStatus === 'saving' ? (
            <span className="text-slate-400 text-[10px] italic">Saving...</span>
          ) : (
            <span className="text-emerald-700/60 text-[10px] font-medium flex items-center gap-1">
              <Sparkles size={11} />
              <span>Autosaves</span>
            </span>
          )}
        </div>
      </div>

      {/* Permissions Check Card */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs space-y-2.5">
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
          <div className={`p-2 rounded-xl border flex items-center justify-between ${
            permissions.smsGranted ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <span className="font-semibold text-[11px]">SMS Permission</span>
            {permissions.smsGranted ? (
              <span className="text-[9.5px] font-bold uppercase bg-emerald-100 px-1.5 py-0.5 rounded">Granted</span>
            ) : (
              <button
                type="button"
                onClick={requestNativePermissions}
                className="text-[9.5px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded shadow-xs"
              >
                Grant
              </button>
            )}
          </div>

          <div className={`p-2 rounded-xl border flex items-center justify-between ${
            permissions.notificationsGranted ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            <span className="font-semibold text-[11px]">Notifications</span>
            <span className="text-[9.5px] font-bold uppercase bg-white/80 px-1.5 py-0.5 rounded">
              {permissions.notificationsGranted ? 'Active' : 'Optional'}
            </span>
          </div>
        </div>

        {!permissions.smsGranted && (
          <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-3 space-y-2 mt-1">
            <div className="flex items-start gap-2 text-amber-900">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-[11.5px]">
                  {isAm ? 'አንድሮይድ 13+ ፍቃድ አሰጣጥ መመሪያ' : 'Android 13+ Permission Guide'}
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  Go to Settings → Apps → Ak Finance. Tap the three dots (⋮) in the top right corner and tap <b>"Allow restricted settings"</b> → confirm screen lock → grant SMS.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openAndroidAppSettings}
              className="w-full py-1.5 px-3 rounded-xl bg-amber-600 text-white text-xs font-bold shadow-xs hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={12} />
              <span>Open App Info (Settings)</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleManualSubmit} className="space-y-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3.5">
          {/* 1. Server URL */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 font-['Poppins',sans-serif]">
              {t.serverUrl}
            </label>
            <input
              type="url"
              value={formData.serverUrl}
              onChange={e => handleFieldChange('serverUrl', e.target.value)}
              onBlur={handleBlur}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#14503F] focus:ring-1 focus:ring-[#14503F]"
              placeholder="https://example.com/api/save_sms"
            />
            <p className="text-[10px] text-slate-400">
              {isAm 
                ? 'የተጻፈው URL ልክ እንዳለ ይጠቀማል (ምንም ተጨማሪ path አይጨመርም)' 
                : 'Exact URL typed is used; parameters action=save_sms, token, sender, message are sent.'}
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
              onChange={e => handleFieldChange('secretKey', e.target.value)}
              onBlur={handleBlur}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#14503F]"
              placeholder="ak_secret_key_..."
            />
          </div>

          {/* 3. SENDER → BANK MAP */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 font-['Poppins',sans-serif]">
                {isAm ? 'የሚነበቡ የባንክ ስሞች (Monitored Senders)' : 'Monitored Senders → Bank Map'}
              </label>
              <button
                type="button"
                onClick={() => setShowAddSenderModal(true)}
                className="text-xs font-bold text-[#14503F] hover:underline flex items-center gap-1"
              >
                <Plus size={13} />
                <span>{isAm ? 'ላኪ ጨምር' : 'Add Sender'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(senderBankMap).map(([senderCode, bankName]) => (
                <div
                  key={senderCode}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-xs text-slate-900 block truncate">
                      {senderCode} · {bankName}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {senderCode === '127' ? 'Telebirr SMS Sender' : 'Bank SMS Sender'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteSender(senderCode)}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-200/60 transition-colors shrink-0 ml-1"
                    title="Remove sender"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-slate-400">
              {isAm 
                ? 'ባንኩ የሚለየው በመጀመሪያ ከላኪው (Sender) ነው (ምሳሌ 127 → Telebirr)' 
                : 'Decide bank from SENDER first (e.g. 127 → Telebirr). Only if unknown, guessed from text.'}
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
                onClick={() => handleFieldChange('mode', 'server')}
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
                onClick={() => handleFieldChange('mode', 'local')}
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

          {/* 5. Privacy & Balance Options (Requirement E) */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-800 font-['Poppins',sans-serif] block">
              {isAm ? 'የግላዊነት እና የሂሳብ አማራጮች' : 'Privacy & Calculation Options'}
            </label>

            {/* Exclude hidden banks from total */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.excludeHiddenFromTotal}
                onChange={e => handleFieldChange('excludeHiddenFromTotal', e.target.checked)}
                className="mt-0.5 rounded text-[#14503F] focus:ring-[#14503F]"
              />
              <div className="text-[11px] leading-tight">
                <span className="font-bold text-slate-800">
                  {isAm ? 'የተደበቁ ባንኮችን ከጠቅላላ ድምር አስቀር' : 'Exclude hidden banks from total'}
                </span>
                <span className="block text-[10px] text-slate-400 mt-0.5">
                  {isAm 
                    ? 'በዓይን ምልክት የተደበቁ ባንኮች ቀሪ ሂሳብ ከNet Movement ካርድ ድምር አይካተትም' 
                    : 'When you hide a bank card, its balances are omitted from the main Net Movement totals'}
                </span>
              </div>
            </label>

            {/* Start hidden after unlock */}
            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.startHiddenAfterUnlock}
                onChange={e => handleFieldChange('startHiddenAfterUnlock', e.target.checked)}
                className="mt-0.5 rounded text-[#14503F] focus:ring-[#14503F]"
              />
              <div className="text-[11px] leading-tight">
                <span className="font-bold text-slate-800">
                  {isAm ? 'ከመቆለፊያ በኋላ በድብቅ ጀምር' : 'Start hidden after unlock'}
                </span>
                <span className="block text-[10px] text-slate-400 mt-0.5">
                  {isAm 
                    ? 'የመተግበሪያውን PIN ከከፈቱ በኋላ መጠኖች በነባሪነት ተደብቀው (••••) ይጀምራሉ' 
                    : 'With app PIN lock on, starts with balances masked (••••) until you tap the eye icon'}
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          className="w-full py-3 rounded-2xl bg-[#14503F] text-white font-bold text-xs shadow-md hover:bg-[#0e3b2e] active:scale-98 transition-all flex items-center justify-center gap-2"
        >
          {saveStatus === 'saved' ? (
            <>
              <Check size={16} className="text-emerald-300" />
              <span>Saved to SharedPreferences "ejeta"!</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>{t.saveSettings}</span>
            </>
          )}
        </button>
      </form>

      {/* Add Sender Dialog */}
      {showAddSenderModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                Add Monitored Sender
              </h3>
              <button
                onClick={() => setShowAddSenderModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800">
                Sender ID / Address
              </label>
              <input
                type="text"
                autoFocus
                value={newSenderCode}
                onChange={e => setNewSenderCode(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-[#14503F]"
                placeholder="e.g. 127, CBE, AwashBank"
              />
              <p className="text-[10px] text-slate-400">
                For Telebirr, the sender is 127.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Building2 size={13} className="text-[#14503F]" />
                <span>Which bank is this?</span>
              </label>
              <select
                value={newSenderBank}
                onChange={e => setNewSenderBank(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#14503F]"
              >
                {COMMON_BANKS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddSender}
                disabled={!newSenderCode.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-md hover:bg-[#0e3b2e] disabled:opacity-50"
              >
                Add Sender Mapping
              </button>
              <button
                type="button"
                onClick={() => setShowAddSenderModal(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
