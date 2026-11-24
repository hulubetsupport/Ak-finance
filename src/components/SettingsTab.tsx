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
  Sparkles,
  CloudUpload,
} from 'lucide-react';
import { AppSettings, AiModelId } from '../types/index.ts';
import {
  AI_CHAT_AND_PARSER_MODELS,
  GOOGLE_GEMINI_SPECIALIZED_MODELS,
  PAID_GEMINI_MODEL_IDS,
  resolveAllowedAiModel,
} from '../constants/aiModels.ts';
import { translations } from '../utils/i18n.ts';
import { db } from '../services/db.ts';
import {
  checkNativePermissions,
  requestNativePermissions,
  openAndroidBatterySettings,
  openAndroidAppSettings,
} from '../utils/nativeBridge.ts';

interface SettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  onTriggerSyncAll?: () => Promise<void>;
}

const COMMON_BANKS = [
  'Telebirr',
  'CBE',
  'Awash Bank',
  'Dashen Bank',
  'Bank of Abyssinia',
  'Zemen Bank',
  'Siinqee Bank',
  'eBirr',
  'ZamZam Bank',
  'CBE Birr',
  'Bunna Bank',
  'Wegagen Bank',
  'M-Pesa',
  'Tsedey Bank',
  'Abay Bank',
  'Nib Bank',
  'Hibret Bank',
  'Coop Bank',
  'Addis Bank',
  'Amhara Bank',
  'Berhan Bank',
  'Enat Bank',
];

const DRAFT_KEY = 'ak_settings_draft_v3';

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onUpdateSettings,
  onTriggerSyncAll,
}) => {
  const t = translations[settings.language];
  const isAm = settings.language === 'am';

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
          aiEnabled: parsed.aiEnabled ?? settings.aiEnabled ?? true,
          aiAutoParseUnknown: parsed.aiAutoParseUnknown ?? settings.aiAutoParseUnknown ?? false,
          aiModel: resolveAllowedAiModel(parsed.aiModel ?? settings.aiModel),
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
      aiEnabled: settings.aiEnabled ?? true,
      aiAutoParseUnknown: settings.aiAutoParseUnknown ?? false,
      aiModel: resolveAllowedAiModel(settings.aiModel),
    };
  });

  const [senderBankMap, setSenderBankMap] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [syncingAll, setSyncingAll] = useState(false);
  const [permissions, setPermissions] = useState<{ smsGranted: boolean; notificationsGranted: boolean }>({
    smsGranted: true,
    notificationsGranted: true,
  });

  const isDirtyRef = useRef(false);
  const debounceTimerRef = useRef<any>(null);

  const [showAddSenderModal, setShowAddSenderModal] = useState(false);
  const [newSenderCode, setNewSenderCode] = useState('');
  const [newSenderBank, setNewSenderBank] = useState('Telebirr');

  useEffect(() => {
    const refreshMeta = async () => {
      const p = await checkNativePermissions();
      setPermissions(p);
      const sMap = await db.getSenderBankMap();
      setSenderBankMap(sMap);
    };
    refreshMeta();
  }, []);

  useEffect(() => {
    if (!isDirtyRef.current) {
      setFormData(prev => ({
        ...prev,
        serverUrl: settings.serverUrl,
        secretKey: settings.secretKey,
        mode: settings.mode,
        httpMethod: settings.httpMethod || 'GET',
        retryIntervalSeconds: settings.retryIntervalSeconds || 15,
        excludeHiddenFromTotal: settings.excludeHiddenFromTotal ?? false,
        startHiddenAfterUnlock: settings.startHiddenAfterUnlock ?? false,
        aiEnabled: settings.aiEnabled ?? true,
        aiAutoParseUnknown: settings.aiAutoParseUnknown ?? false,
        aiModel: resolveAllowedAiModel(settings.aiModel),
      }));
    }
  }, [
    settings.serverUrl,
    settings.secretKey,
    settings.mode,
    settings.httpMethod,
    settings.retryIntervalSeconds,
    settings.excludeHiddenFromTotal,
    settings.startHiddenAfterUnlock,
    settings.aiEnabled,
    settings.aiAutoParseUnknown,
    settings.aiModel,
  ]);

  const saveDraftLocally = (data: typeof formData) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {}
  };

  const performSave = async (dataToSave: typeof formData) => {
    setSaveStatus('saving');
    try {
      const sendersList = Object.keys(senderBankMap);
      await onUpdateSettings({
        serverUrl: dataToSave.serverUrl.trim(),
        secretKey: dataToSave.secretKey.trim(),
        allowedSenders: sendersList.length > 0 ? sendersList : ['CBE', '127', 'Telebirr', 'AwashBank', 'Dashen', 'BOA'],
        mode: dataToSave.mode,
        httpMethod: dataToSave.httpMethod,
        retryIntervalSeconds: Number(dataToSave.retryIntervalSeconds) || 15,
        excludeHiddenFromTotal: dataToSave.excludeHiddenFromTotal,
        startHiddenAfterUnlock: dataToSave.startHiddenAfterUnlock,
        aiEnabled: dataToSave.aiEnabled,
        aiAutoParseUnknown: dataToSave.aiAutoParseUnknown,
        aiModel: dataToSave.aiModel,
      });
      isDirtyRef.current = false;
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('idle');
    }
  };

  const triggerDebouncedAutoSave = (updated: typeof formData) => {
    isDirtyRef.current = true;
    saveDraftLocally(updated);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      performSave(updated);
    }, 450);
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
    await onUpdateSettings({ allowedSenders: Object.keys(updatedMap) });
    setNewSenderCode('');
    setShowAddSenderModal(false);
  };

  const handleDeleteSender = async (senderCode: string) => {
    await db.deleteSenderBankMapping(senderCode);
    const updatedMap = await db.getSenderBankMap();
    setSenderBankMap(updatedMap);
    await onUpdateSettings({ allowedSenders: Object.keys(updatedMap) });
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Status Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {t.settings}
          </h2>
          <p className="text-xs text-slate-500">
            {isAm ? 'የSMS መቀበያ፣ AI እና የሰርቨር ማስተካከያዎች' : 'Standalone SMS engine, Gemini AI & optional server webhook'}
          </p>
        </div>

        <div className="text-xs font-semibold whitespace-nowrap">
          {saveStatus === 'saved' ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <Check size={13} />
              <span>Saved</span>
            </span>
          ) : saveStatus === 'saving' ? (
            <span className="text-slate-500">Saving...</span>
          ) : (
            <span className="text-slate-400">Autosaves</span>
          )}
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleManualSubmit} className="space-y-4">
        {/* Operating Mode */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
            <Radio size={14} className="text-[#0F4C3A]" />
            <span>{t.appMode}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleFieldChange('mode', 'local')}
              className={`p-3 rounded-lg border text-left transition-colors ${
                formData.mode === 'local'
                  ? 'bg-emerald-50 border-[#0F4C3A] text-slate-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs font-bold">Standalone Local-First</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {isAm ? 'በራሱ በስልክ ብቻ ይሰራል (ሰርቨር አያስፈልግም)' : 'Works independently without servers; all banks parsed locally'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleFieldChange('mode', 'server')}
              className={`p-3 rounded-lg border text-left transition-colors ${
                formData.mode === 'server'
                  ? 'bg-emerald-50 border-[#0F4C3A] text-slate-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs font-bold">Server Sync</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {isAm ? 'ወደ ሰርቨር በራስ-ሰር ይልካል' : 'Parse locally & forward transactions to your webhook URL'}
              </div>
            </button>
          </div>
        </div>

        {/* Gemini AI Configuration (Server Secret Only — NO API Key Input) */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <Sparkles size={14} className="text-[#0F4C3A]" />
              <span>Gemini AI Assistant</span>
            </div>
            <span className="text-[11px] font-medium text-slate-500">Server-side secret</span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="settings-ai-model" className="text-xs font-semibold text-slate-700 block">
              Google &amp; Gemini AI Model ({AI_CHAT_AND_PARSER_MODELS.length} models)
            </label>
            <select
              id="settings-ai-model"
              value={formData.aiModel}
              onChange={e => handleFieldChange('aiModel', e.target.value as AiModelId)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0F4C3A]"
            >
              {(['Gemini 4 Series', 'Gemini 3.1 Series', 'Gemini 2.5 Series'] as const).map(groupName => (
                <optgroup key={groupName} label={groupName}>
                  {AI_CHAT_AND_PARSER_MODELS.filter(m => m.group === groupName).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.label} ({m.id})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {PAID_GEMINI_MODEL_IDS.has(formData.aiModel) && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                Requires a paid-tier GEMINI_API_KEY configured on the server.
              </p>
            )}
            <details className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
              <summary className="cursor-pointer font-semibold text-slate-700">
                All Google &amp; Gemini Specialized Models ({GOOGLE_GEMINI_SPECIALIZED_MODELS.length})
              </summary>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100">
                {GOOGLE_GEMINI_SPECIALIZED_MODELS.map(sm => (
                  <div key={sm.id} className="font-mono text-[11px] text-slate-700">
                    <span className="font-semibold text-slate-900">{sm.id}</span> · {sm.modality}
                  </div>
                ))}
              </div>
            </details>
          </div>

          <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formData.aiEnabled}
              onChange={e => handleFieldChange('aiEnabled', e.target.checked)}
              className="mt-0.5 rounded text-[#0F4C3A]"
            />
            <div className="text-xs leading-tight">
              <span className="font-semibold text-slate-800">Enable AI SMS Extraction & Advisor</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                Allows Ejeta AI chat and fallback AI extraction for unrecognized bank messages.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formData.aiAutoParseUnknown}
              onChange={e => handleFieldChange('aiAutoParseUnknown', e.target.checked)}
              className="mt-0.5 rounded text-[#0F4C3A]"
            />
            <div className="text-xs leading-tight">
              <span className="font-semibold text-slate-800">Auto-analyze unknown captured SMS with AI</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                Automatically falls back to Gemini when local bank patterns return 0 ETB or Unknown bank.
              </span>
            </div>
          </label>
        </div>

        {/* Server Webhook Config */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-900">Server Webhook (Optional)</span>
            {onTriggerSyncAll && (
              <button
                type="button"
                disabled={syncingAll}
                onClick={async () => {
                  setSyncingAll(true);
                  try {
                    await onTriggerSyncAll();
                  } finally {
                    setSyncingAll(false);
                  }
                }}
                className="text-xs font-semibold text-[#0F4C3A] hover:underline flex items-center gap-1 whitespace-nowrap"
              >
                <CloudUpload size={12} />
                <span>{syncingAll ? 'Syncing...' : 'Sync Local to Server'}</span>
              </button>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">{t.serverUrl}</label>
            <input
              type="url"
              value={formData.serverUrl}
              onChange={e => handleFieldChange('serverUrl', e.target.value)}
              onBlur={handleBlur}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0F4C3A]"
              placeholder="https://example.com/api/save_sms"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">{t.secretKey}</label>
              <input
                type="text"
                value={formData.secretKey}
                onChange={e => handleFieldChange('secretKey', e.target.value)}
                onBlur={handleBlur}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0F4C3A]"
                placeholder="ak_secret_key_..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">HTTP Method</label>
                <select
                  value={formData.httpMethod}
                  onChange={e => handleFieldChange('httpMethod', e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Retry (s)</label>
                <input
                  type="number"
                  min={5}
                  value={formData.retryIntervalSeconds}
                  onChange={e => handleFieldChange('retryIntervalSeconds', Number(e.target.value))}
                  onBlur={handleBlur}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Monitored Senders -> Bank Map */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-900">
              Monitored Senders → Ethiopian Banks ({Object.keys(senderBankMap).length})
            </span>
            <button
              type="button"
              onClick={() => setShowAddSenderModal(true)}
              className="text-xs font-semibold text-[#0F4C3A] hover:underline flex items-center gap-1 whitespace-nowrap"
            >
              <Plus size={13} />
              <span>Add Sender</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {Object.entries(senderBankMap).map(([senderCode, bankName]) => (
              <div
                key={senderCode}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <span className="font-mono font-bold text-xs text-slate-900 block truncate">
                    {senderCode} · {bankName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteSender(senderCode)}
                  className="p-1 text-slate-400 hover:text-rose-600 shrink-0"
                  aria-label={`Remove sender ${senderCode}`}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Options */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2">
          <div className="text-xs font-bold text-slate-900">
            {isAm ? 'የግላዊነት እና የሂሳብ አማራጮች' : 'Privacy & Calculation Options'}
          </div>

          <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formData.excludeHiddenFromTotal}
              onChange={e => handleFieldChange('excludeHiddenFromTotal', e.target.checked)}
              className="mt-0.5 rounded text-[#0F4C3A]"
            />
            <div className="text-xs leading-tight">
              <span className="font-semibold text-slate-800">Exclude hidden banks from total</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                Omit hidden bank cards from main Net Movement totals.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formData.startHiddenAfterUnlock}
              onChange={e => handleFieldChange('startHiddenAfterUnlock', e.target.checked)}
              className="mt-0.5 rounded text-[#0F4C3A]"
            />
            <div className="text-xs leading-tight">
              <span className="font-semibold text-slate-800">Start hidden after PIN unlock</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                Masks balances (••••) until tapped after unlocking the app.
              </span>
            </div>
          </label>
        </div>

        {/* Permissions & Battery */}
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <ShieldCheck size={15} className="text-[#0F4C3A]" />
              <span>Android Permissions & Battery</span>
            </div>
            <button
              type="button"
              onClick={openAndroidBatterySettings}
              className="text-xs font-semibold text-[#0F4C3A] hover:underline flex items-center gap-1 whitespace-nowrap"
            >
              <BatteryCharging size={13} />
              <span>Unrestricted Battery</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`p-2 rounded-lg border flex items-center justify-between ${
              permissions.smsGranted ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <span className="font-semibold">SMS Read</span>
              {permissions.smsGranted ? (
                <span className="text-[11px] font-bold">Granted</span>
              ) : (
                <button
                  type="button"
                  onClick={requestNativePermissions}
                  className="text-[11px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded"
                >
                  Grant
                </button>
              )}
            </div>

            <div className={`p-2 rounded-lg border flex items-center justify-between ${
              permissions.notificationsGranted ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-white border-slate-200 text-slate-700'
            }`}>
              <span className="font-semibold">Notifications</span>
              <span className="text-[11px] font-bold">
                {permissions.notificationsGranted ? 'Active' : 'Optional'}
              </span>
            </div>
          </div>

          {!permissions.smsGranted && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2 text-amber-900 text-xs">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  Open App Info → top-right ⋮ → Allow restricted settings → grant SMS permission.
                </span>
              </div>
              <button
                type="button"
                onClick={openAndroidAppSettings}
                className="w-full py-1.5 px-3 rounded-lg bg-amber-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <ExternalLink size={12} />
                <span>Open App Info</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full py-2.5 rounded-lg bg-[#0F4C3A] text-white font-semibold text-xs hover:bg-[#0B3B2E] flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {saveStatus === 'saved' ? (
            <>
              <Check size={14} />
              <span>Settings Saved</span>
            </>
          ) : (
            <>
              <Save size={14} />
              <span>{t.saveSettings}</span>
            </>
          )}
        </button>
      </form>

      {/* Add Sender Dialog */}
      {showAddSenderModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add Monitored Sender</h3>
              <button
                type="button"
                onClick={() => setShowAddSenderModal(false)}
                aria-label="Close add sender"
                className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-800">Sender ID / Address</label>
              <input
                type="text"
                autoFocus
                value={newSenderCode}
                onChange={e => setNewSenderCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-[#0F4C3A]"
                placeholder="e.g. 127, CBE, Zemen, Siinqee"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                <Building2 size={13} className="text-[#0F4C3A]" />
                <span>Ethiopian Bank / Wallet</span>
              </label>
              <select
                value={newSenderBank}
                onChange={e => setNewSenderBank(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#0F4C3A]"
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
                className="flex-1 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold disabled:opacity-50"
              >
                Add Sender
              </button>
              <button
                type="button"
                onClick={() => setShowAddSenderModal(false)}
                className="py-2 px-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold"
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
