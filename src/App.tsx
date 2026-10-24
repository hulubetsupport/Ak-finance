/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { db } from './services/db.ts';
import { PaymentRecord, Account, WithdrawalRecord, AppSettings } from './types/index.ts';
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
  const [currentMonthIndex, setCurrentMonthIndex] = useState(9); // October
  const months = ['January 2026', 'February 2026', 'March 2026', 'April 2026', 'May 2026', 'June 2026', 'July 2026', 'August 2026', 'September 2026', 'October 2026', 'November 2026', 'December 2026'];

  // Modals
  const [showSimulator, setShowSimulator] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPermissionsGuide, setShowPermissionsGuide] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showWithdrawalsSubView, setShowWithdrawalsSubView] = useState(false);

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

    // Required: Poll getMessages() every 3-4 seconds and on app resume
    const interval = setInterval(() => {
      loadData();
    }, 3500);

    const handleResume = () => {
      if (document.visibilityState === 'visible') {
        loadData();
        startKeepAliveService();
      }
    };
    window.addEventListener('visibilitychange', handleResume);
    window.addEventListener('focus', loadData);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleResume);
      window.removeEventListener('focus', loadData);
    };
  }, [loadData]);

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

  // Filter payments by account if selected
  const displayedPayments = selectedAccountId
    ? payments.filter(p => {
        const acc = accounts.find(a => a.id === selectedAccountId);
        if (!acc) return true;
        const accBank = acc.bank.toUpperCase().trim();
        const pBank = p.bank.toUpperCase().trim();
        return pBank === accBank || (accBank === 'CBE' && pBank.includes('COMMERCIAL'));
      })
    : payments;

  const handleToggleHideBalances = async () => {
    const updated = { ...settings, hideBalances: !settings.hideBalances };
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
        onToggleHideBalances={handleToggleHideBalances}
        onToggleLanguage={handleToggleLanguage}
        onOpenNotifications={() => setCurrentTab('payments')}
        onOpenSettings={() => setShowSettingsModal(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-3 space-y-4">
        {/* TAB 1: HOME */}
        {currentTab === 'home' && (
          <div className="space-y-4">
            {/* Bold Headline */}
            <div className="pt-1">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight font-['Poppins',sans-serif] leading-tight">
                {t.headline}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {settings.language === 'am' ? 'የባንክ SMS በስልኩ በራሱ ይቀበላል፣ ወደ ሰርቨር ይልካል' : 'Native 24/7 SMS listener & SQLite queue forwarding'}
              </p>
            </div>

            {/* Required: Home shows two debug lines */}
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-3 border border-slate-800 font-mono text-[11.5px] space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans font-semibold">Last SMS:</span>
                <span className="font-bold text-emerald-400 truncate max-w-[240px]">
                  {nativeStatus.lastSmsAt > 0
                    ? `${nativeStatus.lastSmsSender || 'SMS'} · ${formatDebugTime(nativeStatus.lastSmsAt)}`
                    : 'None'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-sans font-semibold">Last server reply:</span>
                <span className={`font-bold ${
                  nativeStatus.lastCode === 200 
                    ? 'text-emerald-400' 
                    : nativeStatus.lastCode > 0 
                      ? 'text-rose-400' 
                      : 'text-slate-400'
                }`}>
                  {nativeStatus.lastCodeAt > 0
                    ? `HTTP ${nativeStatus.lastCode} · ${formatDebugTime(nativeStatus.lastCodeAt)}`
                    : 'None'}
                </span>
              </div>
            </div>

            {/* Real Bank Account Cards (Rule 3 & 4) */}
            <AccountsCardStack
              accounts={accounts}
              settings={settings}
              selectedAccountId={selectedAccountId}
              onSelectAccount={setSelectedAccountId}
              onManageAccounts={() => setCurrentTab('organize')}
              onSaveOpeningBalance={handleSaveOpeningBalance}
              onAddCustomBank={handleAddCustomBank}
            />

            {/* Large Dark-Green NET MOVEMENT Card (Rule 6: dedupe aware) */}
            <NetMovementCard
              payments={displayedPayments}
              accountCount={accounts.length}
              settings={settings}
              currentMonth={months[currentMonthIndex]}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onToggleHideBalances={handleToggleHideBalances}
            />

            {/* Three Quick-Action Tiles */}
            <QuickActions
              language={settings.language}
              onOpenTelegram={() => setCurrentTab('organize')}
              onOpenSearch={() => setShowSearch(true)}
              onOpenAccounts={() => setCurrentTab('organize')}
            />

            {/* Setup Banner */}
            <SetupBanner
              language={settings.language}
              onOpenSetup={() => setShowPermissionsGuide(true)}
              serviceRunning={nativeStatus.smsGranted}
            />

            {/* Payments List (from native SQLite only with dedupe and edit) */}
            <PaymentsList
              payments={displayedPayments.slice(0, 8)}
              settings={settings}
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
                  payments={payments}
                  settings={settings}
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
    </div>
  );
}
