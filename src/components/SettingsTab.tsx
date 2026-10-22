import React, { useState } from 'react';
import { AppSettings, SyncLogEntry } from '../types/index.ts';
import { translations } from '../utils/i18n.ts';
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
  AlertTriangle
} from 'lucide-react';

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

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h2 className="text-lg font-extrabold text-slate-900 font-['Poppins',sans-serif]">
          {t.settings}
        </h2>
        <p className="text-xs text-slate-400">
          {isAm ? 'የሰርቨር፣ የደህንነት እና የባንክ ማጣሪያ ቅንብሮች' : 'Configure Render webhook destination and local offline queue'}
        </p>
      </div>

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
              <div className="text-xs font-bold font-['Poppins',sans-serif]">Server Mode</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Auto-forward to Render backend
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
              <div className="text-xs font-bold font-['Poppins',sans-serif]">Local Mode</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Store in SQLite only (never sends)
              </div>
            </button>
          </div>
        </div>

        {/* Server Webhook & Auth */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 font-['Poppins',sans-serif]">
            <Server size={14} className="text-[#14503F]" />
            <span>Server Webhook & Authentication</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.serverUrl}
            </label>
            <input
              type="url"
              required={formData.mode === 'server'}
              value={formData.serverUrl}
              onChange={e => setFormData(prev => ({ ...prev, serverUrl: e.target.value }))}
              placeholder="https://my-backend.onrender.com/api/webhook"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F] font-mono"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">
              Dispatches: <code className="text-[#14503F]">action=save_sms&token=...&sender=...&message=...</code>
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.secretKey}
            </label>
            <input
              type="password"
              value={formData.secretKey}
              onChange={e => setFormData(prev => ({ ...prev, secretKey: e.target.value }))}
              placeholder="Your secure webhook token"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F] font-mono"
            />
          </div>

          {/* HTTP Method & Retry Interval */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.httpMethod}
              </label>
              <select
                value={formData.httpMethod}
                onChange={e => setFormData(prev => ({ ...prev, httpMethod: e.target.value as any }))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F]"
              >
                <option value="POST">POST (JSON Body)</option>
                <option value="GET">GET (Query Params)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.retryInterval}
              </label>
              <input
                type="number"
                min="5"
                max="300"
                value={formData.retryIntervalSeconds}
                onChange={e => setFormData(prev => ({ ...prev, retryIntervalSeconds: parseInt(e.target.value) || 15 }))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F]"
              />
            </div>
          </div>
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
              placeholder="e.g. 889, Wegagen, Nib"
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

      {/* Sync Operations & Activity Log */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 font-['Poppins',sans-serif]">
            <Activity size={14} className="text-[#14503F]" />
            <span>Recent Server Webhook Logs</span>
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

      {/* Danger Zone / Reset */}
      <div className="pt-2">
        <button
          type="button"
          onClick={async () => {
            if (confirm('Reset test data back to standard Ethiopian bank seed transactions?')) {
              await onResetData();
            }
          }}
          className="w-full py-2.5 rounded-xl border border-rose-200 bg-rose-50/50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition-colors flex items-center justify-center gap-1.5"
        >
          <AlertTriangle size={13} />
          <span>{t.clearDb}</span>
        </button>
      </div>
    </div>
  );
};
