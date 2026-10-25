import React, { useEffect, useRef } from 'react';
import { 
  Settings, 
  Shield, 
  Database, 
  CheckCircle, 
  HelpCircle, 
  X,
  Lock
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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex justify-end p-3 animate-in fade-in">
      <div 
        ref={menuRef}
        className="bg-white rounded-3xl w-64 shadow-2xl border border-slate-100 p-2 space-y-1 mt-12 mr-1 animate-in slide-in-from-top-4 duration-200"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
          <span className="text-xs font-black text-[#14503F] font-['Poppins',sans-serif] tracking-wider uppercase">
            Menu
          </span>
          <button 
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
          >
            <X size={13} />
          </button>
        </div>

        <button
          onClick={() => { onClose(); onOpenSettings(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-xs font-bold text-slate-700 hover:bg-emerald-50/70 hover:text-[#14503F] transition-all text-left"
        >
          <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Settings size={14} />
          </div>
          <span>Settings</span>
        </button>

        <button
          onClick={() => { onClose(); onOpenSecurity(); }}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold text-slate-700 hover:bg-emerald-50/70 hover:text-[#14503F] transition-all text-left"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Shield size={14} />
            </div>
            <span>App Security</span>
          </div>
          {isPinEnabled ? (
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Lock size={10} /> PIN
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">Off</span>
          )}
        </button>

        <button
          onClick={() => { onClose(); onOpenVerify(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-xs font-bold text-slate-700 hover:bg-emerald-50/70 hover:text-[#14503F] transition-all text-left"
        >
          <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <CheckCircle size={14} />
          </div>
          <div>
            <span>Local Payment Verify</span>
            <span className="block text-[9.5px] font-normal text-slate-400">Test Ref & Amount</span>
          </div>
        </button>

        <button
          onClick={() => { onClose(); onOpenBackup(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-xs font-bold text-slate-700 hover:bg-emerald-50/70 hover:text-[#14503F] transition-all text-left"
        >
          <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <Database size={14} />
          </div>
          <span>Backup & Restore</span>
        </button>

        <div className="border-t border-slate-100 my-1" />

        <button
          onClick={() => { onClose(); onOpenAbout(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all text-left"
        >
          <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
            <HelpCircle size={14} />
          </div>
          <span>About & Help</span>
        </button>
      </div>
    </div>
  );
};
