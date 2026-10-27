/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from './services/db.ts';
import { PaymentRecord, Account, WithdrawalRecord, AppSettings, TimeRange } from './types/index.ts';
import { filterPaymentsByTimeRange } from './utils/timeRange.ts';
import { translations } from './utils/i18n.ts';
import { Header } from './components/Header.tsx';
import { AccountsCardStack } from './components/AccountsCardStack.tsx';
import { NetMovementCard } from './components/NetMovementCard.tsx';
import { QuickActions } from './components/QuickActions.tsx';
import { SetupBanner } from './components/SetupBanner.tsx';
import { PaymentsList } from './components/PaymentsList.tsx';
import { BottomNav, TabId } from './components/BottomNav.tsx';
import { SmsSimulatorModal } from './components/SmsSimulatorModal.tsx';
import { InsightsTab } from './components/InsightsTab.tsx';
import { WithdrawalsTab } from './components/WithdrawalsTab.tsx';
import { EjetaAiTab } from './components/EjetaAiTab.tsx';
import { OrganizeTab } from './components/OrganizeTab.tsx';
import { SettingsTab } from './components/SettingsTab.tsx';
import { SearchModal } from './components/SearchModal.tsx';
import { AndroidPermissionModal } from './components/AndroidPermissionModal.tsx';
import { SecurityLockScreen } from './components/SecurityLockScreen.tsx';
import { SecuritySettingsModal } from './components/SecuritySettingsModal.tsx';
import { BackupRestoreModal } from './components/BackupRestoreModal.tsx';
import { LocalVerifyModal } from './components/LocalVerifyModal.tsx';
import { AboutModal } from './components/AboutModal.tsx';
import { HeaderMenu } from './components/HeaderMenu.tsx';
import { hasPinConfigured } from './utils/security.ts';
import { MessageSquarePlus, RefreshCw } from 'lucide-react';
import { 
  getNativeStatus, 
  retryNow, 
  startKeepAliveService, 
  NativeStatus 
} from './utils/nativeBridge.ts';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabId>('home');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [nativeStatus, setNativeStatus] = useState<NativeStatus>({
    smsGranted: false,
    lastSmsAt: 0,
    lastSmsSender: '',
    lastCode: 0,
    lastCodeAt: 0,
    pending: 0,
  });

  // Filter state
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [directionFilter, setDirectionFilter] = useState<'all' | 'received' | 'sent'>('all');
  const [currentMonthIndex, setCurrentMonthIndex] = useState(9); // October
  const months = ['January 2026', 'February 2026', 'March 2026', 'April 2026', 'May 2026', 'June 2026', 'July 2026', 'August 2026', 'September 2026', 'October 2026', 'November 2026', 'December 2026'];

  // App Lock State (Rule C2)
  const [isLocked, setIsLocked] = useState<boolean>(() => hasPinConfigured());

  // Modals
  const [showSimulator, setShowSimulator] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPermissionsGuide, setShowPermissionsGuide] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showWithdrawalsSubView, setShowWithdrawalsSubView] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // Time Range (Requirement D)
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    try {
      const stored = localStorage.getItem('ak_time_range_v2');
      if (stored && ['1h', '1d', '7d', '1mo', '1y', 'all', 'custom'].includes(stored)) {
        return stored as TimeRange;
      }
    } catch {}
    return '7d';
  });

  // Compact telemetry status line visibility
  const [showSyncStatusLine, setShowSyncStatusLine] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ak_hide_status_line') !== 'true';
    } catch {
      return true;
    }
  });

  // Per-bank Hidden State (Requirement E)
  const [hiddenBankIds, setHiddenBankIds] = useState<string[]>(() => db.getHiddenBankIds());

  const handleSetTimeRange = (range: TimeRange) => {
    setTimeRange(range);
    try {
      localStorage.setItem('ak_time_range_v2', range);
    } catch {}
  };

  const handleToggleHideBank = async (bankId: string) => {
    await db.toggleBankHidden(bankId);
    setHiddenBankIds(db.getHiddenBankIds());
  };

  // Load all data from native SQLite and SharedPreferences
  const loadData = useCallback(async () => {
    try {
      const [s, p, stat] = await Promise.all([
        db.getSettings(),
        db.getAllPayments(),
        getNativeStatus(),
      ]);
      setSettings(s);
      setPayments(p);
      setNativeStatus(stat);
      setHiddenBankIds(db.getHiddenBankIds());

      const [a, w] = await Promise.all([
        db.getAccounts(),
        db.getAllWithdrawals(),
      ]);
      setAccounts(a);
      setWithdrawals(w);
    } catch (e) {
      console.error('Failed loading data from native layer:', e);
    }
  }, []);

  useEffect(() => {
    loadData();
    startKeepAliveService();

    // Required: Poll getMessages() every 3-4 seconds
    // Bug 1 Fix: Pause polling/refresh while any input, textarea, or select is focused
    const interval = setInterval(() => {
      if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }
      loadData();
    }, 3500);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Lock app on background if PIN configured
        if (hasPinConfigured()) {
          setIsLocked(true);
        }
      } else if (document.visibilityState === 'visible') {
        if (!document.activeElement || !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
          loadData();
        }
        startKeepAliveService();
      }
    };

    const handleFocus = () => {
      if (!document.activeElement || !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        loadData();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadData]);

  // Android Back button handling: Closes active modal or returns to Home tab
  useEffect(() => {
    const handleAndroidBack = () => {
      if (showMenu) { setShowMenu(false); return; }
      if (showSearch) { setShowSearch(false); return; }
      if (showSettingsModal) { setShowSettingsModal(false); return; }
      if (showSecurityModal) { setShowSecurityModal(false); return; }
      if (showBackupModal) { setShowBackupModal(false); return; }
      if (showVerifyModal) { setShowVerifyModal(false); return; }
      if (showAboutModal) { setShowAboutModal(false); return; }
      if (showPermissionsGuide) { setShowPermissionsGuide(false); return; }
      if (showSimulator) { setShowSimulator(false); return; }
      if (currentTab !== 'home') { setCurrentTab('home'); return; }
    };

    window.addEventListener('androidBackPressed', handleAndroidBack);
    return () => {
      window.removeEventListener('androidBackPressed', handleAndroidBack);
    };
  }, [
    showMenu,
    showSearch,
    showSettingsModal,
    showSecurityModal,
    showBackupModal,
    showVerifyModal,
    showAboutModal,
    showPermissionsGuide,
    showSimulator,
    currentTab,
  ]);

  // Requirement B: Header amber pill when recent SMS was Ignored (called unconditionally before early returns)
  const hasIgnoredRecentPayment = useMemo(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return payments.some(p => p.timestamp > dayAgo && p.serverResult?.status === 'Ignored');
  }, [payments]);

  // Requirement D: Memoized time-range filtered payments
  const rangeFilteredPayments = useMemo(() => {
    return filterPaymentsByTimeRange(payments, timeRange);
  }, [payments, timeRange]);

  // Filter payments by account and direction if selected
  const displayedPayments = useMemo(() => {
    let list = rangeFilteredPayments;
    if (directionFilter !== 'all') {
      list = list.filter(p => p.type === directionFilter);
    }
    if (!selectedAccountId) return list;
    const acc = accounts.find(a => a.id === selectedAccountId);
    if (!acc) return list;
    const accBank = acc.bank.toUpperCase().trim();
    return list.filter(p => {
      const pBank = p.bank.toUpperCase().trim();
      return pBank === accBank || (accBank === 'CBE' && pBank.includes('COMMERCIAL'));
    });
  }, [rangeFilteredPayments, selectedAccountId, accounts, directionFilter]);

  if (!settings) {
    return (
      <div className="min-h-screen bg-[#F4F7F5] flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#14503F]">
          <RefreshCw size={18} className="animate-spin" />
          <span>Starting Ak Financial Payment Desk...</span>
        </div>
      </div>
    );
  }

  const t = translations[settings.language];
  const pendingCount = nativeStatus.pending;

  const handleToggleHideBalances = async (forceHide?: boolean) => {
    if (!settings) return;
    const nextVal = typeof forceHide === 'boolean' ? forceHide : !settings.hideBalances;
    const updated = { ...settings, hideBalances: nextVal };
    await db.saveSettings(updated);
    setSettings(updated);
  };

  const handleToggleLanguage = async () => {
    const nextLang = settings.language === 'en' ? 'am' : 'en';
    const updated = { ...settings, language: nextLang as any };
    await db.saveSettings(updated);
    setSettings(updated);
  };

  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = await db.saveSettings(newSettings);
    setSettings(updated);
    await loadData();
  };

  const handleRetrySinglePayment = async () => {
    await retryNow();
    await loadData();
  };

  const handleDeletePayment = async (id: string) => {
    await db.deletePayment(id);
    await loadData();
  };

  const handleSaveOverride = async (
    id: string,
    override: { counterparty?: string | null; direction?: string | null; note?: string; isHidden?: boolean }
  ) => {
    await db.saveSmsOverride(id, override);
    await loadData();
  };

  const handleSaveOpeningBalance = async (bank: string, amount: number) => {
    await db.saveOpeningBalance(bank, amount);
    await loadData();
  };

  const handleAddCustomBank = async (bankName: string) => {
    await db.addCustomAccount({
      id: 'acc-' + bankName.toLowerCase().replace(/\s+/g, '-'),
      name: bankName,
      bank: bankName,
      type: 'operating',
      accountNumber: '••••',
      maskedNumber: bankName.substring(0, 3).toUpperCase(),
      accent: 'emerald',
    });
    await loadData();
  };

  const handleAddWithdrawal = async (w: Omit<WithdrawalRecord, 'id' | 'timestamp'>) => {
    await db.addWithdrawal(w);
    await loadData();
  };

  const handleDeleteWithdrawal = async () => {
    await loadData();
  };

  const handleUpdateAccounts = async (newAccs: Account[]) => {
    setAccounts(newAccs);
  };

  const handlePrevMonth = () => {
    setCurrentMonthIndex(prev => (prev > 0 ? prev - 1 : months.length - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthIndex(prev => (prev < months.length - 1 ? prev + 1 : 0));
  };

  const formatDebugTime = (ts: number) => {
    if (!ts) return 'None';
    const d = new Date(ts);
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  return (
    <div className="min-h-screen bg-[#F4F7F5] flex flex-col antialiased selection:bg-[#14503F]/20 font-sans pb-16">
      {/* Top Header with live nativeStatus */}
      <Header
        settings={settings}
        nativeStatus={nativeStatus}
        hasIgnoredRecentPayment={hasIgnoredRecentPayment}
        onToggleHideBalances={handleToggleHideBalances}
        onToggleLanguage={handleToggleLanguage}
        onOpenNotifications={() => setCurrentTab('payments')}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenMenu={() => setShowMenu(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-3 space-y-4">
        {/* TAB 1: HOME */}
        {currentTab === 'home' && (
          <div className="space-y-4">
            {/* Compact 1-line Telemetry Status Bar (can be hidden with ✕) */}
            {showSyncStatusLine && (
              <div className="flex items-center justify-between bg-slate-900 text-slate-100 px-3 py-1.5 rounded-xl border border-slate-800 font-mono text-[10.5px] shadow-2xs">
                <div className="flex items-center gap-1.5 truncate min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="text-slate-400 font-sans font-medium text-[10px]">SMS:</span>
                  <span className="text-emerald-400 font-semibold truncate">
                    {nativeStatus.lastSmsAt > 0
                      ? `${nativeStatus.lastSmsSender || 'SMS'} ${formatDebugTime(nativeStatus.lastSmsAt)}`
                      : 'None'}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400 font-sans font-medium text-[10px]">Server:</span>
                  <span className={`font-bold ${
                    nativeStatus.lastCode === 200 
                      ? 'text-emerald-400' 
                      : nativeStatus.lastCode > 0 
                        ? 'text-rose-400' 
                        : 'text-slate-400'
                  }`}>
                    {nativeStatus.lastCodeAt > 0 ? `HTTP ${nativeStatus.lastCode}` : 'None'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowSyncStatusLine(false);
                    try { localStorage.setItem('ak_hide_status_line', 'true'); } catch {}
                  }}
                  className="text-slate-500 hover:text-slate-300 p-0.5 ml-2 shrink-0 text-[10.5px]"
                  title="Hide status line"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Real Bank Account Cards (Rule 3 & 4) */}
            <AccountsCardStack
              accounts={accounts}
              payments={payments}
              settings={settings}
              selectedAccountId={selectedAccountId}
              timeRange={timeRange}
              hiddenBankIds={hiddenBankIds}
              onSelectAccount={setSelectedAccountId}
              onManageAccounts={() => setCurrentTab('organize')}
              onSaveOpeningBalance={handleSaveOpeningBalance}
              onToggleHideBank={handleToggleHideBank}
              onAddCustomBank={handleAddCustomBank}
            />

            {/* Large Dark-Green NET MOVEMENT Card (Rule 6: dedupe aware) */}
            <NetMovementCard
              payments={displayedPayments}
              accountCount={accounts.length}
              settings={settings}
              currentMonth={months[currentMonthIndex]}
              timeRange={timeRange}
              hiddenBankIds={hiddenBankIds}
              activeDirection={directionFilter}
              onFilterDirection={setDirectionFilter}
              onChangeTimeRange={handleSetTimeRange}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onToggleHideBalances={handleToggleHideBalances}
            />

            {/* Quick-Action Shortcuts Tiles */}
            <QuickActions
              language={settings.language}
              activeDirection={directionFilter}
              onFilterDirection={setDirectionFilter}
              onOpenTelegram={() => setCurrentTab('organize')}
              onOpenSearch={() => setShowSearch(true)}
              onOpenAccounts={() => setCurrentTab('organize')}
              onOpenSimulator={() => setShowSimulator(true)}
            />

            {/* Setup Banner */}
            <SetupBanner
              language={settings.language}
              onOpenSetup={() => setShowPermissionsGuide(true)}
              serviceRunning={nativeStatus.smsGranted}
            />

            {/* Payments List (from native SQLite only with dedupe and edit) */}
            <PaymentsList
              payments={displayedPayments}
              settings={settings}
              activeDirection={directionFilter}
              onFilterDirection={setDirectionFilter}
              onRetrySinglePayment={handleRetrySinglePayment}
              onDeletePayment={handleDeletePayment}
              onSaveOverride={handleSaveOverride}
            />

            {displayedPayments.length > 8 && (
              <button
                onClick={() => setCurrentTab('payments')}
                className="w-full py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-[#14503F] hover:bg-slate-50 transition-colors shadow-xs"
              >
                {settings.language === 'am' ? 'ሁሉንም ክፍያዎች ተመልከት' : 'View All Captured Payments →'}
              </button>
            )}
          </div>
        )}

        {/* TAB 2: INSIGHTS (Analytics) */}
        {currentTab === 'insights' && (
          <InsightsTab
            payments={payments}
            withdrawals={withdrawals}
            settings={settings}
          />
        )}

        {/* TAB 3: EJETA AI */}
        {currentTab === 'ai' && (
          <EjetaAiTab
            payments={payments}
            accounts={accounts}
            settings={settings}
          />
        )}

        {/* TAB 4: ORGANIZE */}
        {currentTab === 'organize' && (
          <OrganizeTab
            accounts={accounts}
            settings={settings}
            onUpdateAccounts={handleUpdateAccounts}
          />
        )}

        {/* TAB 5: PAYMENTS & WITHDRAWALS */}
        {currentTab === 'payments' && (
          <div className="space-y-4 pb-20">
            {/* View Sub-selector (Payments vs Withdrawals) */}
            <div className="flex items-center gap-1 p-1 bg-slate-200/80 rounded-2xl">
              <button
                onClick={() => setShowWithdrawalsSubView(false)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  !showWithdrawalsSubView ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.allPayments} ({payments.length})
              </button>
              <button
                onClick={() => setShowWithdrawalsSubView(true)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  showWithdrawalsSubView ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.withdrawals} ({withdrawals.length})
              </button>
            </div>

            {!showWithdrawalsSubView ? (
              <>
                {/* Time Range Filter Chips (Requirement D) */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {(['1h', '1d', '7d', '1mo', '1y', 'all'] as TimeRange[]).map((r) => (
                    <button
                      key={r}
                      onClick={() => handleSetTimeRange(r)}
                      className={`px-3 py-1 text-xs font-semibold rounded-full transition-all shrink-0 ${
                        timeRange === r
                          ? 'bg-[#14503F] text-white shadow-xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {r === '1h' ? (settings.language === 'am' ? '1ሰዓት' : '1h') :
                       r === '1d' ? (settings.language === 'am' ? '1ቀን' : '1d') :
                       r === '7d' ? (settings.language === 'am' ? '7ቀን' : '7d') :
                       r === '1mo' ? (settings.language === 'am' ? '1ወር' : '1mo') :
                       r === '1y' ? (settings.language === 'am' ? '1ዓመት' : '1y') :
                       (settings.language === 'am' ? 'ሁሉም' : 'All')}
                    </button>
                  ))}
                </div>

                {/* Bank Filter Chips Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    onClick={() => setSelectedAccountId(null)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-full transition-all shrink-0 ${
                      !selectedAccountId
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {settings.language === 'am' ? 'ሁሉም ባንኮች' : 'All Banks'}
                  </button>
                  {accounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => setSelectedAccountId(selectedAccountId === acc.id ? null : acc.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full transition-all shrink-0 ${
                        selectedAccountId === acc.id
                          ? 'bg-[#14503F] text-white shadow-xs'
                          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {acc.logoUrl && (
                        <img src={acc.logoUrl} alt={acc.name} className="w-3.5 h-3.5 object-contain rounded-full" />
                      )}
                      <span>{acc.shortCode || acc.name}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    {pendingCount > 0 ? (
                      <span className="text-amber-700 font-semibold">
                        {pendingCount} payments waiting in native SQLite queue
                      </span>
                    ) : (
                      'All records verified & synced'
                    )}
                  </div>
                  <button
                    onClick={() => setShowSearch(true)}
                    className="text-xs font-bold text-[#14503F] hover:underline"
                  >
                    Filter & Search
                  </button>
                </div>

                <PaymentsList
                  payments={displayedPayments}
                  settings={settings}
                  activeDirection={directionFilter}
                  onFilterDirection={setDirectionFilter}
                  onRetrySinglePayment={handleRetrySinglePayment}
                  onDeletePayment={handleDeletePayment}
                  onSaveOverride={handleSaveOverride}
                />
              </>
            ) : (
              <WithdrawalsTab
                withdrawals={withdrawals}
                accounts={accounts}
                settings={settings}
                onAddWithdrawal={handleAddWithdrawal}
                onDeleteWithdrawal={handleDeleteWithdrawal}
              />
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button: Simulate Bank SMS (via Sync.save) */}
      <button
        onClick={() => setShowSimulator(true)}
        className="fixed bottom-20 right-4 z-40 bg-[#14503F] text-white px-3.5 py-2.5 rounded-full shadow-xl hover:bg-[#0e3b2e] active:scale-95 transition-all flex items-center gap-2 border border-emerald-600/50 group"
        title="Simulate incoming bank SMS via native pipeline"
      >
        <MessageSquarePlus size={17} className="group-hover:rotate-12 transition-transform" />
        <span className="text-xs font-bold font-['Poppins',sans-serif] pr-1">
          {settings.language === 'am' ? 'SMS ሞክር' : 'Test SMS'}
        </span>
      </button>

      {/* Bottom Nav */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        language={settings.language}
        pendingCount={pendingCount}
      />

      {/* Simulator Modal */}
      <SmsSimulatorModal
        isOpen={showSimulator}
        onClose={() => setShowSimulator(false)}
        settings={settings}
        onSmsProcessed={loadData}
      />

      {/* Search Modal */}
      <SearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        payments={payments}
        settings={settings}
        onSelectPayment={() => setCurrentTab('payments')}
      />

      {/* Android Permissions Guide */}
      <AndroidPermissionModal
        isOpen={showPermissionsGuide}
        onClose={() => setShowPermissionsGuide(false)}
        language={settings.language}
      />

      {/* Settings Modal (Overlay) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                {t.settings}
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                ✕
              </button>
            </div>
            <SettingsTab
              settings={settings}
              onUpdateSettings={async s => {
                await handleUpdateSettings(s);
              }}
              onTriggerSyncAll={async () => {
                await retryNow();
                await loadData();
              }}
            />
          </div>
        </div>
      )}

      {/* 3-Dot Header Menu (Rule C1) */}
      <HeaderMenu
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenSecurity={() => setShowSecurityModal(true)}
        onOpenBackup={() => setShowBackupModal(true)}
        onOpenVerify={() => setShowVerifyModal(true)}
        onOpenAbout={() => setShowAboutModal(true)}
        isPinEnabled={hasPinConfigured()}
      />

      {/* Security PIN Settings Modal (Rule C2) */}
      <SecuritySettingsModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        onSettingsChanged={() => {}}
      />

      {/* Backup & Restore Modal (Rule C6) */}
      <BackupRestoreModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        onDataRestored={loadData}
      />

      {/* Local Verify Modal (Rule C5) */}
      <LocalVerifyModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        payments={payments}
        settings={settings}
      />

      {/* About & Help Modal */}
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />

      {/* App PIN Lock Screen (Rule C2) */}
      {isLocked && (
        <SecurityLockScreen
          onUnlock={() => {
            setIsLocked(false);
            if (settings?.startHiddenAfterUnlock) {
              handleToggleHideBalances(true);
            }
          }}
        />
      )}
    </div>
  );
}
