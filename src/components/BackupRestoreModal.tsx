import React, { useState, useRef } from 'react';
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
  ShieldAlert,
  Copy,
  FileCheck
} from 'lucide-react';
import { db } from '../services/db.ts';
import { saveNativeFile, shareNativeFile } from '../utils/nativeBridge.ts';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored: () => Promise<void>;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
}) => {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Requirement E3: Secret key off by default
  const [includeSecretKey, setIncludeSecretKey] = useState(false);

  // Helper for real-time filename with exact date and seconds
  const getDetailedTimestamp = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  };

  // Requirement E4: Restore preview & confirmation state
  const [pendingRestore, setPendingRestore] = useState<{
    rawJson: string;
    version: number;
    paymentsCount: number;
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

  if (!isOpen) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  // Requirement E1 & E2: Native SAF/FileProvider export with write-back verification & real-time seconds
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
            `Saved ✓ ${inspection.paymentsCount} payments, ${inspection.banksCount} banks, ${inspection.tagsCount} tags, ${formatFileSize(byteLen)} (Shared as ${filename})`
          );
        } else {
          setErrorMsg('Failed to open system share sheet.');
        }
      } else {
        const res = await saveNativeFile(filename, 'application/json', json);
        if (res.success && res.bytes && res.bytes > 0) {
          setSuccessMsg(
            `Saved ✓ ${inspection.paymentsCount} payments, ${inspection.banksCount} banks, ${inspection.tagsCount} tags, ${formatFileSize(res.bytes)} (${filename})`
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

  // Requirement E5: UTF-8 BOM CSV export with real-time seconds
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
          setSuccessMsg(`CSV Saved ✓ ${formatFileSize(byteLen)} (${filename})`);
        } else {
          setErrorMsg('Failed to open share sheet.');
        }
      } else {
        const res = await saveNativeFile(filename, 'text/csv;charset=utf-8;', csv);
        if (res.success && res.bytes && res.bytes > 0) {
          setSuccessMsg(`CSV Saved ✓ ${formatFileSize(res.bytes)} with UTF-8 BOM (${filename})`);
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

  // Requirement E4: Restore file chosen -> inspect and show summary with real-time details
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
      setErrorMsg('Please type "RESTORE" to confirm full database replacement.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await db.importFullBackupJson(pendingRestore.rawJson, mode);
      if (res.success) {
        await onDataRestored();
        setSuccessMsg(
          `Restored ✓ ${res.count} payments, ${res.banksCount} banks, ${res.tagsCount} tags (${mode === 'merge' ? 'Merged safely' : 'Replaced'})`
        );
        setPendingRestore(null);
        setShowReplaceConfirm(false);
        setConfirmReplaceText('');
        setTimeout(() => setSuccessMsg(null), 5000);
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
      setSuccessMsg('Backup JSON copied to clipboard!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setErrorMsg('Could not copy to clipboard.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 max-h-[90dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#14503F] flex items-center justify-center">
              <Database size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                Backup & Restore Data
              </h3>
              <p className="text-[10px] text-slate-400">
                Safe SQLite export, merge & Android storage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Live Feedback Banners */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
            <Check size={14} className="text-emerald-600 shrink-0" />
            <span className="break-all">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
            <AlertCircle size={14} className="text-rose-600 shrink-0" />
            <span className="break-all">{errorMsg}</span>
          </div>
        )}

        {/* Restore Confirmation Dialog (Requirement E4) */}
        {pendingRestore && (
          <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
              <FileCheck size={16} className="text-amber-700" />
              <span>Backup Summary</span>
            </div>
            <div className="text-xs text-amber-900 space-y-1 bg-white/70 p-3 rounded-xl border border-amber-200">
              <p className="font-semibold text-slate-900">
                Found: <span className="font-bold text-[#14503F]">{pendingRestore.paymentsCount} payments</span>,{' '}
                <span className="font-bold text-[#14503F]">{pendingRestore.banksCount} banks</span>,{' '}
                <span className="font-bold text-[#14503F]">{pendingRestore.tagsCount} tags</span>
              </p>
              {pendingRestore.exportedAt && (
                <p className="text-[11px] text-slate-600 font-mono">
                  Exported: <span className="font-bold text-slate-800">{pendingRestore.exportedAt}</span>
                </p>
              )}
              {pendingRestore.financialSummary && (
                <div className="text-[10.5px] text-emerald-900 font-mono bg-emerald-50/80 p-1.5 rounded-lg border border-emerald-100 flex items-center justify-between">
                  <span>In: +ETB {pendingRestore.financialSummary.totalReceivedETB || '0.00'}</span>
                  <span>Out: -ETB {pendingRestore.financialSummary.totalSentETB || '0.00'}</span>
                  <span className="font-bold">Net: ETB {pendingRestore.financialSummary.netCashETB || '0.00'}</span>
                </div>
              )}
              <p className="text-[11px] text-slate-500">
                Schema Version: {pendingRestore.version} · Secret Key in backup: {pendingRestore.hasSecretKey ? 'Yes' : 'No'}
              </p>
              <div className="text-[10px] text-emerald-800 font-medium pt-1 flex items-center gap-1">
                <span>🛡️ Zero data loss: Auto-snapshot saved before restore.</span>
              </div>
              <p className="text-[11px] text-amber-800 font-medium pt-1">
                Choose how to apply this backup:
              </p>
            </div>

            {!showReplaceConfirm ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleExecuteRestore('merge')}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-xs hover:bg-[#0e3b2e] active:scale-98 transition-all"
                >
                  Merge (Safe)
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setShowReplaceConfirm(true)}
                  className="flex-1 py-2 px-3 rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold active:scale-98 transition-all"
                >
                  Replace All...
                </button>
                <button
                  type="button"
                  onClick={() => setPendingRestore(null)}
                  className="py-2 px-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="space-y-2 pt-1 border-t border-amber-200">
                <p className="text-[11px] font-bold text-rose-800">
                  Type <span className="underline tracking-wider font-mono">RESTORE</span> to overwrite all current data:
                </p>
                <input
                  type="text"
                  value={confirmReplaceText}
                  onChange={e => setConfirmReplaceText(e.target.value)}
                  placeholder="RESTORE"
                  className="w-full px-3 py-1.5 text-xs font-mono border border-rose-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={loading || confirmReplaceText.trim().toUpperCase() !== 'RESTORE'}
                    onClick={() => handleExecuteRestore('replace')}
                    className="flex-1 py-2 px-3 rounded-xl bg-rose-600 disabled:bg-slate-300 text-white text-xs font-bold shadow-xs hover:bg-rose-700 transition-all"
                  >
                    Confirm Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReplaceConfirm(false);
                      setConfirmReplaceText('');
                    }}
                    className="py-2 px-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action 1: Export Full JSON Backup */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive size={16} className="text-[#14503F]" />
              <span className="text-xs font-bold text-slate-900">Full JSON Backup</span>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
              Safe Migration
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Includes SQLite SMS records, server responses, opening balances, tags, overrides, and settings.
          </p>

          {/* Requirement E3: Secret key checkbox off by default */}
          <label className="flex items-start gap-2 p-2 rounded-xl bg-white border border-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeSecretKey}
              onChange={e => setIncludeSecretKey(e.target.checked)}
              className="mt-0.5 rounded text-[#14503F] focus:ring-[#14503F]"
            />
            <div className="text-[11px] leading-tight">
              <span className="font-semibold text-slate-800">
                Include Secret Key in backup
              </span>
              <span className="block text-[10px] text-amber-700 font-medium">
                (Keep file private! If unchecked, key is left blank)
              </span>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleExportBackup(false)}
              className="py-2.5 px-3 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-xs hover:bg-[#0e3b2e] active:scale-98 transition-all flex items-center justify-center gap-1.5"
            >
              {loading ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
              <span>Save (.json)</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleExportBackup(true)}
              className="py-2.5 px-3 rounded-xl border border-emerald-600 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold shadow-xs active:scale-98 transition-all flex items-center justify-center gap-1.5"
            >
              <Share2 size={13} />
              <span>Share Sheet</span>
            </button>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleCopyBackupToClipboard}
            className="w-full text-center text-[10.5px] font-semibold text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1 py-1"
          >
            <Copy size={11} />
            <span>Copy backup JSON to clipboard</span>
          </button>
        </div>

        {/* Action 2: Restore Backup */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-[#14503F]" />
            <span className="text-xs font-bold text-slate-900">Restore on Device</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Select an `ak_finance_backup_*.json` file. You can choose to merge non-duplicate records or replace completely.
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
            className="w-full py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-xs active:scale-98 transition-all flex items-center justify-center gap-1.5"
          >
            <Upload size={13} />
            <span>Select & Inspect Backup File</span>
          </button>
        </div>

        {/* Action 3: CSV Spreadsheet Export */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-emerald-700" />
              <span className="text-xs font-bold text-slate-900">CSV Export (UTF-8 BOM)</span>
            </div>
            <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded-full">
              Excel Ready
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Includes Date, Bank, Direction, Amount, Counterparty, Category, Tag, Note, Ref/FT, Balance, and Server status with UTF-8 BOM for Amharic character support.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleExportCsv(false)}
              className="py-2.5 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-xs active:scale-98 transition-all flex items-center justify-center gap-1.5"
            >
              <Download size={13} />
              <span>Save (.csv)</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleExportCsv(true)}
              className="py-2.5 px-3 rounded-xl border border-emerald-600 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold shadow-xs active:scale-98 transition-all flex items-center justify-center gap-1.5"
            >
              <Share2 size={13} />
              <span>Share (.csv)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
