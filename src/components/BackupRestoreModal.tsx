import React, { useState, useRef, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  X,
  RefreshCw,
  HardDrive,
  Share2,
  Copy,
  FileCheck,
  CloudUpload,
  ShieldCheck,
} from 'lucide-react';
import { db } from '../services/db.ts';
import {
  saveNativeFile,
  shareNativeFile,
  getStoragePersistenceStatus,
  requestPersistentStorage,
  StoragePersistenceStatus,
} from '../utils/nativeBridge.ts';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored: () => Promise<void>;
  onTriggerBulkSync?: () => Promise<{ synced: number; ignored: number; failed: number; error?: string }>;
  serverUrlConfigured?: boolean;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
  onTriggerBulkSync,
  serverUrlConfigured,
}) => {
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [includeSecretKey, setIncludeSecretKey] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StoragePersistenceStatus>({
    supported: false,
    persisted: false,
  });

  const [pendingRestore, setPendingRestore] = useState<{
    rawJson: string;
    version: number;
    paymentsCount: number;
    sentCount: number;
    localCount: number;
    pendingOrFailedCount: number;
    serverIgnoredCount: number;
    banksCount: number;
    tagsCount: number;
    hasSecretKey: boolean;
    exportedAt?: string;
    financialSummary?: {
      totalReceivedETB?: string;
      totalSentETB?: string;
      netCashETB?: string;
      currency?: string;
    };
  } | null>(null);

  const [confirmReplaceText, setConfirmReplaceText] = useState('');
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    getStoragePersistenceStatus().then(setStorageStatus);
  }, [isOpen]);

  if (!isOpen) return null;

  const getDetailedTimestamp = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const formatMb = (bytes?: number) => {
    if (bytes === undefined) return 'N/A';
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleRequestPersistence = async () => {
    setErrorMsg(null);
    const updated = await requestPersistentStorage();
    setStorageStatus(updated);
    if (updated.persisted) {
      setSuccessMsg('Persistent local storage granted by device browser.');
    } else {
      setSuccessMsg('Storage active (localStorage & device storage checked).');
    }
  };

  const handleExportBackup = async (shareDirectly: boolean = false) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const json = await db.exportFullBackupJson(includeSecretKey);
      const filename = `ak_finance_backup_${getDetailedTimestamp()}.json`;
      const inspection = db.inspectBackupJson(json);

      if (shareDirectly) {
        const shared = await shareNativeFile(filename, 'application/json', json);
        if (shared) {
          const byteLen = new Blob([json]).size;
          setSuccessMsg(
            `Shared ${inspection.paymentsCount} payments, ${inspection.banksCount} banks, ${inspection.tagsCount} tags (${formatFileSize(byteLen)} · ${filename})`
          );
        } else {
          setErrorMsg('Failed to open system share sheet.');
        }
      } else {
        const res = await saveNativeFile(filename, 'application/json', json);
        if (res.success && res.bytes && res.bytes > 0) {
          setSuccessMsg(
            `Saved ${inspection.paymentsCount} payments, ${inspection.banksCount} banks, ${inspection.tagsCount} tags (${formatFileSize(res.bytes)} · ${filename})`
          );
        } else {
          setErrorMsg(res.error || 'Export failed: written file was 0 bytes.');
        }
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to export backup.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async (shareDirectly: boolean = false) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const csv = await db.exportPaymentsCsv();
      const filename = `ak_finance_payments_${getDetailedTimestamp()}.csv`;

      if (shareDirectly) {
        const shared = await shareNativeFile(filename, 'text/csv;charset=utf-8;', csv);
        if (shared) {
          const byteLen = new Blob([csv]).size;
          setSuccessMsg(`CSV shared (${formatFileSize(byteLen)} · ${filename})`);
        } else {
          setErrorMsg('Failed to open share sheet.');
        }
      } else {
        const res = await saveNativeFile(filename, 'text/csv;charset=utf-8;', csv);
        if (res.success && res.bytes && res.bytes > 0) {
          setSuccessMsg(`CSV saved (${formatFileSize(res.bytes)} UTF-8 BOM · ${filename})`);
        } else {
          setErrorMsg(res.error || 'CSV export failed (0 bytes).');
        }
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to export CSV.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const text = await file.text();
      const inspection = db.inspectBackupJson(text);

      if (!inspection.valid) {
        setErrorMsg(inspection.error || 'Invalid backup file.');
        return;
      }

      const data = inspection.data || {};
      setPendingRestore({
        rawJson: text,
        version: inspection.version || 1,
        paymentsCount: inspection.paymentsCount,
        sentCount: inspection.sentCount,
        localCount: inspection.localCount,
        pendingOrFailedCount: inspection.pendingOrFailedCount,
        serverIgnoredCount: inspection.serverIgnoredCount,
        banksCount: inspection.banksCount,
        tagsCount: inspection.tagsCount,
        hasSecretKey: inspection.hasSecretKey,
        exportedAt: data.exportedAtLocal || data.exportedAt || undefined,
        financialSummary: data.financialSummary,
      });
      setShowReplaceConfirm(false);
      setConfirmReplaceText('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed reading selected file.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExecuteRestore = async (mode: 'merge' | 'replace') => {
    if (!pendingRestore) return;
    if (mode === 'replace' && confirmReplaceText.trim().toUpperCase() !== 'RESTORE') {
      setErrorMsg('Type "RESTORE" to confirm full replacement.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await db.importFullBackupJson(pendingRestore.rawJson, mode);
      if (res.success) {
        await onDataRestored();
        setSuccessMsg(
          `Restored to original places: ${res.count} records (${res.localCount} local kept offline without auto-sync), ${res.banksCount} banks, ${res.tagsCount} tags (${mode === 'merge' ? 'Installed safely' : 'Replaced all'})`
        );
        setPendingRestore(null);
        setShowReplaceConfirm(false);
        setConfirmReplaceText('');
      } else {
        setErrorMsg(res.error || 'Failed to restore backup.');
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Restore error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBackupToClipboard = async () => {
    try {
      const json = await db.exportFullBackupJson(includeSecretKey);
      await navigator.clipboard.writeText(json);
      setSuccessMsg('Backup JSON copied to clipboard.');
    } catch {
      setErrorMsg('Could not copy to clipboard.');
    }
  };

  const handleBulkSync = async () => {
    setSyncLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = onTriggerBulkSync ? await onTriggerBulkSync() : await db.syncAllLocalToServer();
      await onDataRestored();
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg(
          `Sync finished: ${res.synced} saved · ${res.ignored} server ignored (preserved locally) · ${res.failed} failed`
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Bulk sync failed.');
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl p-5 border border-slate-200 space-y-4 max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0F4C3A] text-white flex items-center justify-center">
              <Database size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Backup, Storage & Server Sync
              </h3>
              <p className="text-xs text-slate-500">
                Timestamped JSON/CSV exports, persistent storage & original-place restore
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close backup modal"
            className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-900"
          >
            <X size={15} />
          </button>
        </div>

        {/* Live Feedback Banners */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-xl text-xs font-semibold flex items-start gap-2">
            <Check size={14} className="text-emerald-700 shrink-0 mt-0.5" />
            <span className="break-words">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 p-3 rounded-xl text-xs font-semibold flex items-start gap-2">
            <AlertCircle size={14} className="text-rose-700 shrink-0 mt-0.5" />
            <span className="break-words">{errorMsg}</span>
          </div>
        )}

        {/* Restore Preview */}
        {pendingRestore && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
              <FileCheck size={15} className="text-amber-700" />
              <span>Backup Inspection Summary</span>
            </div>
            <div className="text-xs space-y-1.5 bg-white p-3 rounded-lg border border-amber-200">
              <div className="font-semibold text-slate-900">
                {pendingRestore.paymentsCount} payments · {pendingRestore.banksCount} banks · {pendingRestore.tagsCount} tags
              </div>
              <div className="text-xs text-slate-700 font-medium">
                {pendingRestore.sentCount} Sent · {pendingRestore.localCount} Local Unsent · {pendingRestore.serverIgnoredCount} Server Ignored
                {pendingRestore.pendingOrFailedCount > 0 ? ` · ${pendingRestore.pendingOrFailedCount} Pending/Failed` : ''}
              </div>
              {pendingRestore.exportedAt && (
                <div className="text-xs text-slate-600 font-mono">
                  Exported: {pendingRestore.exportedAt}
                </div>
              )}
              {pendingRestore.financialSummary && (
                <div className="text-xs text-emerald-900 font-mono tabular-nums pt-1 border-t border-slate-100">
                  In: +{pendingRestore.financialSummary.totalReceivedETB || '0.00'} · Out: -{pendingRestore.financialSummary.totalSentETB || '0.00'} · Net: {pendingRestore.financialSummary.netCashETB || '0.00'} ETB
                </div>
              )}
              <div className="text-[11px] text-slate-500">
                Schema v{pendingRestore.version} · Secret Key included: {pendingRestore.hasSecretKey ? 'Yes' : 'No'}
              </div>
              <div className="text-[11px] font-semibold text-[#0F4C3A] bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
                Imported local/unsent records will NOT be auto-synced to the server — select and sync them manually when ready.
              </div>
            </div>

            {!showReplaceConfirm ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleExecuteRestore('merge')}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold whitespace-nowrap flex items-center justify-center gap-1.5"
                >
                  <Check size={13} />
                  <span>Install Update (Never Delete)</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowReplaceConfirm(true)}
                  className="py-2 px-3 rounded-lg border border-rose-300 bg-white text-rose-700 text-xs font-semibold whitespace-nowrap"
                >
                  Replace All...
                </button>
                <button
                  type="button"
                  onClick={() => setPendingRestore(null)}
                  className="py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold whitespace-nowrap"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-2 border-t border-amber-200">
                <p className="text-xs font-bold text-rose-900">
                  Type <span className="underline font-mono">RESTORE</span> to replace all stored records:
                </p>
                <input
                  type="text"
                  value={confirmReplaceText}
                  onChange={e => setConfirmReplaceText(e.target.value)}
                  placeholder="RESTORE"
                  className="w-full px-3 py-2 text-xs font-mono border border-rose-300 rounded-lg bg-white"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={loading || confirmReplaceText.trim().toUpperCase() !== 'RESTORE'}
                    onClick={() => handleExecuteRestore('replace')}
                    className="flex-1 py-2 px-3 rounded-lg bg-rose-600 disabled:bg-slate-300 text-white text-xs font-semibold whitespace-nowrap"
                  >
                    Confirm Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReplaceConfirm(false);
                      setConfirmReplaceText('');
                    }}
                    className="py-2 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold whitespace-nowrap"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 1: Persistent Local Storage */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-[#0F4C3A]" />
              <span className="text-xs font-bold text-slate-900">Device Storage Permission</span>
            </div>
            <span className={`text-xs font-semibold whitespace-nowrap ${
              storageStatus.persisted ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              {storageStatus.persisted ? 'Persistent Granted' : 'Standard Browser Storage'}
            </span>
          </div>
          <div className="text-xs text-slate-600 flex items-center justify-between gap-2">
            <span>Usage: {formatMb(storageStatus.usageBytes)} · Quota: {formatMb(storageStatus.quotaBytes)}</span>
            {storageStatus.supported && !storageStatus.persisted && (
              <button
                type="button"
                onClick={handleRequestPersistence}
                className="px-2.5 py-1 rounded-md bg-white border border-slate-300 hover:border-[#0F4C3A] text-xs font-semibold text-slate-800 whitespace-nowrap"
              >
                Allow Persistent Storage
              </button>
            )}
          </div>
        </div>

        {/* Section 2: Export Full Timestamped JSON Backup */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive size={15} className="text-[#0F4C3A]" />
              <span className="text-xs font-bold text-slate-900">Timestamped JSON Backup (v5)</span>
            </div>
            <span className="text-xs font-semibold text-emerald-700">Original Places</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Saves all messages with exact timestamps, server results, opening balances, tags, overrides, budgets, custom banks, and settings.
          </p>

          <label className="flex items-start gap-2 p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSecretKey}
              onChange={e => setIncludeSecretKey(e.target.checked)}
              className="mt-0.5 rounded text-[#0F4C3A]"
            />
            <div className="text-xs leading-tight">
              <span className="font-semibold text-slate-800">Include Server Secret Key in export</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                Off by default so exported files stay safe to archive.
              </span>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleExportBackup(false)}
              className="py-2.5 px-3 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold hover:bg-[#0B3B2E] whitespace-nowrap flex items-center justify-center gap-1.5"
            >
              {loading ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
              <span>Download (.json)</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleExportBackup(true)}
              className="py-2.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold whitespace-nowrap flex items-center justify-center gap-1.5"
            >
              <Share2 size={13} />
              <span>Share File</span>
            </button>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleCopyBackupToClipboard}
            className="w-full text-center text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1 py-1"
          >
            <Copy size={12} />
            <span>Copy backup JSON to clipboard</span>
          </button>
        </div>

        {/* Section 3: Import & Restore to Original Places */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload size={15} className="text-[#0F4C3A]" />
              <span className="text-xs font-bold text-slate-900">Import Backup to Original Places</span>
            </div>
            <span className="text-xs font-semibold text-emerald-700">Non-destructive Merge</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Restores every message ID, timestamp, bank, tag, override, budget, and setting back into its original store.
          </p>
          <input
            type="file"
            ref={fileInputRef}
            accept=".json,application/json"
            onChange={handleFileSelected}
            className="hidden"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-2.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold whitespace-nowrap flex items-center justify-center gap-1.5"
          >
            <Upload size={13} className="text-[#0F4C3A]" />
            <span>Select Backup JSON File</span>
          </button>
        </div>

        {/* Section 4: CSV Export */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={15} className="text-emerald-700" />
              <span className="text-xs font-bold text-slate-900">CSV Ledger Export (UTF-8 BOM)</span>
            </div>
            <span className="text-xs font-semibold text-slate-600">Date & Time Columns</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleExportCsv(false)}
              className="py-2.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold whitespace-nowrap flex items-center justify-center gap-1.5"
            >
              <Download size={13} />
              <span>Download (.csv)</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleExportCsv(true)}
              className="py-2.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold whitespace-nowrap flex items-center justify-center gap-1.5"
            >
              <Share2 size={13} />
              <span>Share (.csv)</span>
            </button>
          </div>
        </div>

        {/* Section 5: Sync Local Storage to Server */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CloudUpload size={15} className="text-[#0F4C3A]" />
              <span className="text-xs font-bold text-slate-900">Sync Local Storage to Server</span>
            </div>
            <span className="text-xs font-semibold text-slate-600">
              {serverUrlConfigured ? 'Webhook Set' : 'Optional'}
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Forward locally saved transactions to your server webhook. Records rejected by legacy servers remain preserved locally.
          </p>
          <button
            type="button"
            disabled={syncLoading}
            onClick={handleBulkSync}
            className="w-full py-2.5 px-3 rounded-lg border border-[#0F4C3A] bg-white hover:bg-emerald-50 text-[#0F4C3A] text-xs font-semibold whitespace-nowrap flex items-center justify-center gap-1.5"
          >
            {syncLoading ? <RefreshCw size={13} className="animate-spin" /> : <CloudUpload size={13} />}
            <span>{syncLoading ? 'Syncing Local Records...' : 'Sync All Local Transactions to Server'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
