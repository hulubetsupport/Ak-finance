/**
 * Security & App PIN Lock Utility for Ak Financial
 * Handles salted SHA-256 PIN hashing, lockout timer doubling, and biometric mock/WebAuthn.
 * The native Android background SMS pipeline runs independently of this lock.
 */

import { SecuritySettings } from '../types/index.ts';

export type { SecuritySettings };

const STORAGE_KEY = 'ak_security_settings_v1';

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  pinEnabled: false,
  pinLength: 4,
  pinSalt: '',
  pinHash: '',
  biometricEnabled: false,
  failedAttempts: 0,
  lockoutUntil: 0,
};

export function hasPinConfigured(): boolean {
  const s = getSecuritySettings();
  return !!(s.pinEnabled && s.pinHash && s.pinSalt);
}

export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${pin}:ak_financial_salt`);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const hashBuf = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuf), b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple hash for older environments
  let hash = 0;
  const str = `${salt}:${pin}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 'simple_' + Math.abs(hash).toString(16);
}

export function getSecuritySettings(): SecuritySettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_SECURITY_SETTINGS, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_SECURITY_SETTINGS;
}

export function saveSecuritySettings(settings: Partial<SecuritySettings>): SecuritySettings {
  const current = getSecuritySettings();
  const merged = { ...current, ...settings };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {}
  return merged;
}

export async function setupNewPin(pin: string, length: 4 | 6, biometric = false): Promise<SecuritySettings> {
  const salt = generateSalt();
  const pinHash = await hashPin(pin, salt);
  return saveSecuritySettings({
    pinEnabled: true,
    pinLength: length,
    pinSalt: salt,
    pinHash,
    biometricEnabled: biometric,
    failedAttempts: 0,
    lockoutUntil: 0,
  });
}

export function disablePinLock(): SecuritySettings {
  return saveSecuritySettings({
    pinEnabled: false,
    pinSalt: '',
    pinHash: '',
    failedAttempts: 0,
    lockoutUntil: 0,
  });
}

export async function verifyPinAttempt(pin: string): Promise<{ success: boolean; lockedOut: boolean; lockoutSeconds: number; remainingAttempts: number }> {
  const sec = getSecuritySettings();
  const now = Date.now();

  // Check if currently locked out
  if (sec.lockoutUntil > now) {
    const remainingSecs = Math.ceil((sec.lockoutUntil - now) / 1000);
    return { success: false, lockedOut: true, lockoutSeconds: remainingSecs, remainingAttempts: 0 };
  }

  const attemptedHash = await hashPin(pin, sec.pinSalt);
  if (attemptedHash === sec.pinHash) {
    // Success -> reset failed attempts
    saveSecuritySettings({ failedAttempts: 0, lockoutUntil: 0 });
    return { success: true, lockedOut: false, lockoutSeconds: 0, remainingAttempts: 5 };
  }

  // Failed
  const newFailed = sec.failedAttempts + 1;
  if (newFailed >= 5) {
    // Lockout calculation: 5 attempts = 30s, 6 = 60s, 7 = 120s (doubling)
    const multiplier = Math.pow(2, Math.max(0, newFailed - 5));
    const lockoutSec = 30 * multiplier;
    const lockoutTime = now + (lockoutSec * 1000);
    saveSecuritySettings({ failedAttempts: newFailed, lockoutUntil: lockoutTime });
    return { success: false, lockedOut: true, lockoutSeconds: lockoutSec, remainingAttempts: 0 };
  }

  saveSecuritySettings({ failedAttempts: newFailed });
  return { success: false, lockedOut: false, lockoutSeconds: 0, remainingAttempts: 5 - newFailed };
}
