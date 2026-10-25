import React, { useState } from 'react';
import { 
  Shield, 
  Lock, 
  Check, 
  X, 
  Fingerprint, 
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { 
  getSecuritySettings, 
  setupNewPin, 
  disablePinLock, 
  SecuritySettings 
} from '../utils/security.ts';

interface SecuritySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged: () => void;
}

export const SecuritySettingsModal: React.FC<SecuritySettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsChanged,
}) => {
  const [sec, setSec] = useState<SecuritySettings>(getSecuritySettings);
  const [selectedLength, setSelectedLength] = useState<4 | 6>(sec.pinLength || 4);
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [biometric, setBiometric] = useState(sec.biometricEnabled);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isChangingPin, setIsChangingPin] = useState(!sec.pinEnabled);

  if (!isOpen) return null;

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (pinInput.length !== selectedLength) {
      setErrorMsg(`PIN must be exactly ${selectedLength} digits.`);
      return;
    }
    if (!/^\d+$/.test(pinInput)) {
      setErrorMsg('PIN must only contain numbers.');
      return;
    }
    if (pinInput !== confirmPinInput) {
      setErrorMsg('PIN confirmation does not match.');
      return;
    }

    const updated = await setupNewPin(pinInput, selectedLength, biometric);
    setSec(updated);
    setIsChangingPin(false);
    setPinInput('');
    setConfirmPinInput('');
    setSuccessMsg('Security PIN configured successfully!');
    onSettingsChanged();
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleDisable = () => {
    if (window.confirm('Disable App PIN Lock? The app will open without requiring a passcode.')) {
      const updated = disablePinLock();
      setSec(updated);
      setIsChangingPin(true);
      setSuccessMsg('App lock disabled.');
      onSettingsChanged();
      setTimeout(() => setSuccessMsg(null), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#14503F] flex items-center justify-center">
              <Shield size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                App Security & PIN Lock
              </h3>
              <p className="text-[10px] text-slate-400">
                Protect payment data with offline salted PIN
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

        {/* Current Status */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              sec.pinEnabled ? 'bg-emerald-100 text-[#14503F]' : 'bg-slate-200 text-slate-600'
            }`}>
              <Lock size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">
                {sec.pinEnabled ? 'PIN Lock Active' : 'PIN Lock Disabled'}
              </div>
              <div className="text-[10px] text-slate-400">
                {sec.pinEnabled ? `${sec.pinLength}-digit PIN enabled` : 'App opens immediately'}
              </div>
            </div>
          </div>

          {sec.pinEnabled ? (
            <button
              type="button"
              onClick={handleDisable}
              className="text-[11px] font-bold text-rose-600 hover:underline px-2 py-1"
            >
              Disable
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsChangingPin(true)}
              className="text-[11px] font-bold text-[#14503F] hover:underline px-2 py-1"
            >
              Set up PIN
            </button>
          )}
        </div>

        {/* Setup Form */}
        {(isChangingPin || !sec.pinEnabled) ? (
          <form onSubmit={handleSavePin} className="space-y-3 pt-1">
            {/* PIN length toggle */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800">PIN Length</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLength(4)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    selectedLength === 4
                      ? 'bg-[#14503F] text-white border-[#14503F]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  4 Digits
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLength(6)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                    selectedLength === 6
                      ? 'bg-[#14503F] text-white border-[#14503F]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  6 Digits
                </button>
              </div>
            </div>

            {/* Input New PIN */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800">New {selectedLength}-Digit PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={selectedLength}
                value={pinInput}
                onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder={"•".repeat(selectedLength)}
                className="w-full px-3 py-2 text-center text-lg font-mono font-bold tracking-widest bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F]"
              />
            </div>

            {/* Confirm PIN */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={selectedLength}
                value={confirmPinInput}
                onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                placeholder={"•".repeat(selectedLength)}
                className="w-full px-3 py-2 text-center text-lg font-mono font-bold tracking-widest bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F]"
              />
            </div>

            {/* Biometric toggle */}
            <div className="pt-1 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                <Fingerprint size={16} className="text-[#14503F]" />
                <span>Allow Biometric Unlock</span>
              </div>
              <input
                type="checkbox"
                checked={biometric}
                onChange={e => setBiometric(e.target.checked)}
                className="w-4 h-4 rounded text-[#14503F] accent-[#14503F]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={pinInput.length !== selectedLength || confirmPinInput.length !== selectedLength}
                className="w-full py-2.5 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-md hover:bg-[#0e3b2e] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                <KeyRound size={14} />
                <span>Save Security PIN</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => setIsChangingPin(true)}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <KeyRound size={14} />
              <span>Change Existing PIN</span>
            </button>
          </div>
        )}

        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">How App Lock works:</p>
          <ul className="list-disc list-inside space-y-0.5 text-[10px]">
            <li>Locks whenever the app goes to background or restarts</li>
            <li>Stored only as a cryptographic salted SHA-256 hash</li>
            <li>5 wrong attempts activate a 30-second lockout timer</li>
            <li><b>Real SMS capture & server sync continue working 24/7 in background</b></li>
          </ul>
        </div>
      </div>
    </div>
  );
};
