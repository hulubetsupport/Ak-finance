import React, { useEffect, useRef } from 'react';
import {
  Settings,
  Shield,
  Database,
  CheckCircle2,
  HelpCircle,
  X,
} from 'lucide-react';

interface HeaderMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onOpenSecurity: () => void;
  onOpenBackup: () => void;
  onOpenVerify: () => void;
  onOpenAbout: () => void;
  isPinEnabled: boolean;
}

export const HeaderMenu: React.FC<HeaderMenuProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  onOpenSecurity,
  onOpenBackup,
  onOpenVerify,
  onOpenAbout,
  isPinEnabled,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex justify-end p-3">
      <div
        ref={menuRef}
        className="bg-white rounded-2xl w-64 border border-slate-200 shadow-xl p-2 space-y-1 mt-12 h-fit"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-900">Tools &amp; Preferences</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
          >
            <X size={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => { onClose(); onOpenBackup(); }}
          className="w-full min-h-[42px] flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors text-left"
        >
          <Database size={15} className="text-[#0F4C3A]" />
          <span>Backup, Storage &amp; Sync</span>
        </button>

        <button
          type="button"
          onClick={() => { onClose(); onOpenVerify(); }}
          className="w-full min-h-[42px] flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors text-left"
        >
          <CheckCircle2 size={15} className="text-[#0F4C3A]" />
          <span>Receipt &amp; Local Verify</span>
        </button>

        <button
          type="button"
          onClick={() => { onClose(); onOpenSettings(); }}
          className="w-full min-h-[42px] flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors text-left"
        >
          <Settings size={15} className="text-slate-600" />
          <span>Settings &amp; Sync Server</span>
        </button>

        <button
          type="button"
          onClick={() => { onClose(); onOpenSecurity(); }}
          className="w-full min-h-[42px] flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors text-left"
        >
          <span className="flex items-center gap-2.5">
            <Shield size={15} className="text-slate-600" />
            <span>App PIN Security</span>
          </span>
          <span className={`text-[11px] font-mono ${isPinEnabled ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>
            {isPinEnabled ? 'PIN On' : 'Off'}
          </span>
        </button>

        <div className="border-t border-slate-100 my-1" />

        <button
          type="button"
          onClick={() => { onClose(); onOpenAbout(); }}
          className="w-full min-h-[42px] flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors text-left"
        >
          <HelpCircle size={15} />
          <span>About Ak Finance</span>
        </button>
      </div>
    </div>
  );
};
