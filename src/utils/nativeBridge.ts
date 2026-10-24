/**
 * Android Native Bridge helper
 * Directly launches Android OS Settings (e.g., Allow Restricted Settings on Android 13+)
 */

export const isAndroidNative = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(window as any).AndroidBridge?.isNative?.();
};

export const openAndroidAppSettings = (): void => {
  if (typeof window === 'undefined') return;
  if ((window as any).AndroidBridge?.openAppSettings) {
    (window as any).AndroidBridge.openAppSettings();
  } else {
    // Intent fallback on Android Chrome / WebView
    try {
      window.location.href = 'intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;package=com.akfinance.paymentdesk;end';
    } catch {
      window.open('https://support.google.com/android/answer/9431959', '_blank');
    }
  }
};

export const openAndroidBatterySettings = (): void => {
  if (typeof window === 'undefined') return;
  if ((window as any).AndroidBridge?.openBatterySettings) {
    (window as any).AndroidBridge.openBatterySettings();
  } else {
    openAndroidAppSettings();
  }
};

export const restartForegroundService = (): void => {
  if (typeof window === 'undefined') return;
  if ((window as any).AndroidBridge?.restartForegroundService) {
    (window as any).AndroidBridge.restartForegroundService();
  }
};
