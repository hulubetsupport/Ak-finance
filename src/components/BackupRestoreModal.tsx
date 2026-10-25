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
  HardDrive
} from 'lucide-react';
import { db } from '../services/db.ts';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExportBackup = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const json = await db.exportFullBackupJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ak_finance_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccessMsg('Backup exported successfully! Keep this file in a safe place.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to export backup.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const csv = await db.exportPaymentsCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ak_finance_payments_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setSuccessMsg('Payments CSV downloaded.');
      setTimeout(() => setSuccessMsg(null), 3000);
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
      const res = await db.importFullBackupJson(text);
      if (res.success) {
        await onDataRestored();
        setSuccessMsg(`Backup restored successfully! (${res.count} records processed)`);
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setErrorMsg(res.error || 'Failed to restore backup.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Invalid backup file content.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
                Safely transfer database, notes, tags & balances
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
          >
            <X size={15} />
          </button>
        </div>

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
            <Check size={14} className="text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
            <AlertCircle size={14} className="text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action 1: Export Full JSON Backup */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive size={16} className="text-[#14503F]" />
              <span className="text-xs font-bold text-slate-900">Full JSON Backup</span>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
              Complete
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Includes all captured SMS messages, bank opening balances, counterparty tags, notes, and monitored sender rules.
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={handleExportBackup}
            className="w-full py-2.5 px-3 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-sm hover:bg-[#0e3b2e] active:scale-98 transition-all flex items-center justify-center gap-1.5"
          >
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
            <span>Download Backup (.json)</span>
          </button>
        </div>

        {/* Action 2: Restore Backup */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-[#14503F]" />
            <span className="text-xs font-bold text-slate-900">Restore on New Device</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Select an `ak_finance_backup_*.json` file to restore your settings, opening balances, and tag memories safely.
          </p>
          <input
            type="file"
            ref={fileInputRef}
            accept=".json"
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
            <span>Select & Restore Backup File</span>
          </button>
        </div>

        {/* Action 3: CSV Spreadsheet Export */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-emerald-700" />
            <span className="text-xs font-bold text-slate-900">Spreadsheet Export</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Download an Excel/CSV spreadsheet with columns: Date, Bank, Amount, Direction, Counterparty, Tag, and Ref.
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={handleExportCsv}
            className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-xs active:scale-98 transition-all flex items-center justify-center gap-1.5"
          >
            <Download size={13} />
            <span>Export Payments (.csv)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
