/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { db } from './services/db.ts';
import { syncQueue } from './services/syncQueue.ts';
import { PaymentRecord, Account, WithdrawalRecord, AppSettings, SyncLogEntry } from './types/index.ts';
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

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabId>('home');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Filter state
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(9); // October (0-indexed 9)
  const months = ['January 2026', 'February 2026', 'March 2026', 'April 2026', 'May 2026', 'June 2026', 'July 2026', 'August 2026', 'September 2026', 'October 2026', 'November 2026', 'December 2026'];

  // Modals
  const [showSimulator, setShowSimulator] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPermissionsGuide, setShowPermissionsGuide] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showWithdrawalsSubView, setShowWithdrawalsSubView] = useState(false);

  // Load all data
  const loadData = useCallback(async () => {
    const s = await db.getSettings();
    setSettings(s);
    const p = await db.getAllPayments();
    setPayments(p);
    const a = await db.getAccounts();
    setAccounts(a);
    const w = await db.getAllWithdrawals();
    setWithdrawals(w);
    const logs = await db.getSyncLogs();
    setSyncLogs(logs);
  }, []);

  useEffect(() => {
    loadData();
    syncQueue.start();

    // Subscribe to sync queue state changes
    const unsubscribe = syncQueue.subscribe(() => {
      loadData();
      setIsOnline(syncQueue.getNetworkStatus());
    });

    return () => {
      unsubscribe();
      syncQueue.stop();
    };
  }, [loadData]);

  if (!settings) {
    return (
      <div className="min-h-screen bg-[#F4F7F5] flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#14503F]">
          <RefreshCw size={18} className="animate-spin" />
          <span>Starting Ak Finance Payment Desk...</span>
        </div>
      </div>
    );
  }

  const t = translations[settings.language];
  const pendingCount = payments.filter(p => p.syncStatus === 'pending' || p.syncStatus === 'failed').length;

  // Filter payments by account if selected
  const displayedPayments = selectedAccountId
    ? payments.filter(p => {
        const acc = accounts.find(a => a.id === selectedAccountId);
        if (!acc) return true;
        if (acc.type === 'operating') return p.bank.toUpperCase().includes('CBE');
        if (acc.type === 'mobile') return p.bank.toUpperCase().includes('TELEBIRR');
        if (acc.type === 'shop') return p.bank.toUpperCase().includes('AWASH');
        return true;
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

  const handleSaveSettings = async (newSettings: AppSettings) => {
    await db.saveSettings(newSettings);
    setSettings(newSettings);
    syncQueue.start();
    await loadData();
  };

  const handleResetData = async () => {
    await db.resetData();
    await loadData();
    syncQueue.start();
  };

  const handleRetrySinglePayment = async (payment: PaymentRecord) => {
    await syncQueue.syncSinglePayment(payment, settings);
    await loadData();
  };

  const handleDeletePayment = async (id: string) => {
    await db.deletePayment(id);
    await loadData();
  };

  const handleAddWithdrawal = async (w: Omit<WithdrawalRecord, 'id' | 'timestamp'>) => {
    await db.saveWithdrawal(w);
    await loadData();
  };

  const handleDeleteWithdrawal = async (id: string) => {
    await db.deleteWithdrawal(id);
    await loadData();
  };

  const handleUpdateAccounts = async (newAccs: Account[]) => {
    await db.saveAccounts(newAccs);
    setAccounts(newAccs);
  };

  const handlePrevMonth = () => {
    setCurrentMonthIndex(prev => (prev > 0 ? prev - 1 : months.length - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthIndex(prev => (prev < months.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="min-h-screen bg-[#F4F7F5] flex flex-col antialiased selection:bg-[#14503F]/20 font-sans pb-16">
      {/* Top Header */}
      <Header
        settings={settings}
        isOnline={isOnline}
        pendingCount={pendingCount}
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
                {settings.language === 'am' ? 'የባንክ SMS አውቶማቲክ ቅኝት እና ፈጣን ማመሳሰል' : 'Instant SMS parsing, offline SQLite queue, and Render sync'}
              </p>
            </div>

            {/* Stacked Account Cards */}
            <AccountsCardStack
              accounts={accounts}
              settings={settings}
              selectedAccountId={selectedAccountId}
              onSelectAccount={setSelectedAccountId}
              onManageAccounts={() => setCurrentTab('organize')}
            />

            {/* Large Dark-Green NET MOVEMENT Card */}
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
              serviceRunning={settings.serviceRunning}
            />

            {/* Payments List */}
            <PaymentsList
              payments={displayedPayments.slice(0, 8)}
              settings={settings}
              onRetrySinglePayment={handleRetrySinglePayment}
              onDeletePayment={handleDeletePayment}
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
                        {pendingCount} payments waiting in offline SQLite queue
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

      {/* Floating Action Button: Simulate Bank SMS */}
      <button
        onClick={() => setShowSimulator(true)}
        className="fixed bottom-20 right-4 z-40 bg-[#14503F] text-white px-3.5 py-2.5 rounded-full shadow-xl hover:bg-[#0e3b2e] active:scale-95 transition-all flex items-center gap-2 border border-emerald-600/50 group"
        title="Simulate incoming bank SMS"
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
              syncLogs={syncLogs}
              onSaveSettings={async s => {
                await handleSaveSettings(s);
                setShowSettingsModal(false);
              }}
              onResetData={handleResetData}
              onTriggerSyncAll={async () => {
                await syncQueue.processQueue();
                await loadData();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
