import React, { useState, useEffect } from 'react';
import { Lock, Delete, ShieldAlert, Fingerprint, ShieldCheck } from 'lucide-react';
import { verifyPinAttempt, getSecuritySettings } from '../utils/security.ts';

interface SecurityLockScreenProps {
  onUnlock: () => void;
}

export const SecurityLockScreen: React.FC<SecurityLockScreenProps> = ({ onUnlock }) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);
  const [shake, setShake] = useState(false);

  const sec = getSecuritySettings();
  const targetLength = sec.pinLength || 4;

  // Check lockout on mount and tick
  useEffect(() => {
    const checkLockout = () => {
      const currentSec = getSecuritySettings();
      const diff = currentSec.lockoutUntil - Date.now();
      if (diff > 0) {
        setLockoutRemaining(Math.ceil(diff / 1000));
      } else {
        setLockoutRemaining(0);
      }
    };
    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleKeyPress = (num: string) => {
    if (lockoutRemaining > 0) return;
    if (pin.length < targetLength) {
      const nextPin = pin + num;
      setPin(nextPin);
      setErrorMsg(null);

      if (nextPin.length === targetLength) {
        validatePin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    if (lockoutRemaining > 0) return;
    setPin(prev => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const validatePin = async (enteredPin: string) => {
    const res = await verifyPinAttempt(enteredPin);
    if (res.success) {
      onUnlock();
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
      if (res.lockedOut) {
        setLockoutRemaining(res.lockoutSeconds);
        setErrorMsg(`Too many wrong attempts. Locked for ${res.lockoutSeconds}s.`);
      } else {
        setErrorMsg(`Incorrect PIN. ${res.remainingAttempts} attempts remaining.`);
      }
    }
  };

  const handleBiometricMock = () => {
    if (sec.biometricEnabled) {
      // Simulate biometric authorization
      onUnlock();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F4F7F5] flex flex-col justify-between items-center p-6 select-none">
      {/* Top Header */}
      <div className="w-full max-w-xs flex flex-col items-center pt-8 space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-[#14503F] text-white flex items-center justify-center shadow-lg">
          <Lock size={26} />
        </div>
        <h2 className="text-xl font-black text-slate-900 font-['Poppins',sans-serif] tracking-tight">
          Ak Financial Locked
        </h2>
        <p className="text-xs text-slate-500 text-center">
          Enter your {targetLength}-digit security PIN to unlock
        </p>
      </div>

      {/* Middle: PIN Dots & Errors */}
      <div className="w-full max-w-xs flex flex-col items-center space-y-4 my-auto">
        <div className={`flex items-center gap-4 ${shake ? 'animate-bounce' : ''}`}>
          {Array.from({ length: targetLength }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-200 border-2 ${
                i < pin.length
                  ? 'bg-[#14503F] border-[#14503F] scale-110'
                  : 'bg-white border-slate-300'
              }`}
            />
          ))}
        </div>

        {/* Lockout or Error Banner */}
        {lockoutRemaining > 0 ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-2 text-center text-xs font-bold text-rose-700 flex items-center gap-1.5 animate-pulse">
            <ShieldAlert size={16} />
            <span>Lockout active: {lockoutRemaining}s remaining</span>
          </div>
        ) : errorMsg ? (
          <div className="text-xs font-bold text-rose-600 text-center animate-in fade-in">
            {errorMsg}
          </div>
        ) : (
          <div className="h-5" />
        )}
      </div>

      {/* Bottom: Numeric Keypad */}
      <div className="w-full max-w-xs space-y-4 pb-4">
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
            <button
              key={n}
              type="button"
              disabled={lockoutRemaining > 0}
              onClick={() => handleKeyPress(n)}
              className="h-16 rounded-2xl bg-white border border-slate-200 text-xl font-extrabold text-slate-800 shadow-xs hover:bg-slate-50 active:scale-95 disabled:opacity-40 transition-all font-mono"
            >
              {n}
            </button>
          ))}

          {/* Biometric or blank */}
          <button
            type="button"
            disabled={!sec.biometricEnabled || lockoutRemaining > 0}
            onClick={handleBiometricMock}
            className="h-16 rounded-2xl bg-white/60 border border-slate-200 flex items-center justify-center text-slate-700 disabled:opacity-20 active:scale-95 transition-all"
            title="Biometric Unlock"
          >
            <Fingerprint size={24} className={sec.biometricEnabled ? 'text-[#14503F]' : 'text-slate-400'} />
          </button>

          {/* Zero */}
          <button
            type="button"
            disabled={lockoutRemaining > 0}
            onClick={() => handleKeyPress('0')}
            className="h-16 rounded-2xl bg-white border border-slate-200 text-xl font-extrabold text-slate-800 shadow-xs hover:bg-slate-50 active:scale-95 disabled:opacity-40 transition-all font-mono"
          >
            0
          </button>

          {/* Backspace */}
          <button
            type="button"
            disabled={lockoutRemaining > 0 || pin.length === 0}
            onClick={handleBackspace}
            className="h-16 rounded-2xl bg-white/60 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 disabled:opacity-30 active:scale-95 transition-all"
          >
            <Delete size={20} />
          </button>
        </div>

        {/* Reassurance Footer */}
        <div className="pt-2 text-center flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <ShieldCheck size={13} className="text-emerald-600" />
          <span>Background SMS Capture & Sync is Active 24/7</span>
        </div>
      </div>
    </div>
  );
};
