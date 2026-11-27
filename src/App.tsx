/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from './services/db.ts';
import { PaymentRecord, Account, WithdrawalRecord, AppSettings, TimeRange, MonthlyBudget } from './types/index.ts';
import { filterPaymentsByTimeRange } from './utils/timeRange.ts';
import { computeHuluBetOverviewStats } from './utils/hulubetSync.ts';
import { translations } from './utils/i18n.ts';
import { Header } from './components/Header.tsx';
import { AccountsCardStack } from './components/AccountsCardStack.tsx';
import { NetMovementCard } from './components/NetMovementCard.tsx';
import { PaymentsList, LedgerStatusFilter } from './components/PaymentsList.tsx';
import { BottomNav, TabId } from './components/BottomNav.tsx';
import { SmsSimulatorModal } from './components/SmsSimulatorModal.tsx';
import { InsightsTab } from './components/InsightsTab.tsx';
import { WithdrawalsTab } from './components/WithdrawalsTab.tsx';
import { EjetaAiTab } from './components/EjetaAiTab.tsx';
import { OrganizeTab } from './components/OrganizeTab.tsx';
import { SettingsTab } from './components/SettingsTab.tsx';
import { SearchModal } from './components/SearchModal.tsx';
import { SecurityLockScreen } from './components/SecurityLockScreen.tsx';
import { SecuritySettingsModal } from './components/SecuritySettingsModal.tsx';
import { BackupRestoreModal } from './components/BackupRestoreModal.tsx';
import { LocalVerifyModal } from './components/LocalVerifyModal.tsx';
import { AboutModal } from './components/AboutModal.tsx';
import { HeaderMenu } from './components/HeaderMenu.tsx';
import { hasPinConfigured } from './utils/security.ts';
import {
  LayoutGrid,
  ReceiptText,
  BarChart3,
  Layers,
  Sparkles,
  MessageSquarePlus,
  Database,
  ShieldCheck,
  Settings,
  Lock,
  Info,
  CloudUpload,
  RefreshCw,
} from 'lucide-react';
import { retryNow, startKeepAliveService } from './utils/nativeBridge.ts';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabId>('home');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<LedgerStatusFilter>('all');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<MonthlyBudget | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Filter state
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [directionFilter, setDirectionFilter] = useState<'all' | 'received' | 'sent'>('all');
  const [currentMonthIndex, setCurrentMonthIndex] = useState(new Date().getMonth());
  const months = [
    'January 2026', 'February 2026', 'March 2026', 'April 2026', 'May 2026', 'June 2026',
    'July 2026', 'August 2026', 'September 2026', 'October 2026', 'November 2026', 'December 2026',
  ];

  // App Lock
  const [isLocked, setIsLocked] = useState<boolean>(() => hasPinConfigured());

  // Modals
  const [showSimulator, setShowSimulator] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showWithdrawalsSubView, setShowWithdrawalsSubView] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [refreshingServerStatus, setRefreshingServerStatus] = useState(false);

  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    try {
      const stored = localStorage.getItem('ak_time_range_v2');
      if (stored && ['1h', '1d', '7d', '1mo', '1y', 'all', 'custom'].includes(stored)) {
        return stored as TimeRange;
      }
    } catch {}
    return '1mo';
  });

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

  const loadData = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([db.getSettings(), db.getAllPayments()]);
      setSettings(s);
      setPayments(p);
      setHiddenBankIds(db.getHiddenBankIds());

      const [a, w, b] = await Promise.all([
        db.getAccounts(),
        db.getAllWithdrawals(),
        db.getMonthlyBudget(),
      ]);
      setAccounts(a);
      setWithdrawals(w);
      setMonthlyBudget(b);
    } catch (e) {
      console.error('Failed loading ledger data:', e);
    }
  }, []);

  useEffect(() => {
    loadData();
    startKeepAliveService();

    const interval = setInterval(() => {
      if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }
      loadData();
    }, 4000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (hasPinConfigured()) setIsLocked(true);
      } else if (document.visibilityState === 'visible') {
        if (!document.activeElement || !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
          loadData();
        }
        startKeepAliveService();
      }
    };

    const handleOnline = async () => {
      await db.processOfflineRetryQueue(true);
      await db.refreshRecentFromHuluBet();
      loadData();
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [loadData]);

  // HuluBet background engine: immediate open recovery + 15s backoff queue flush + 60s /api/recent live poll
  useEffect(() => {
    const runStartupSync = async () => {
      await db.processOfflineRetryQueue(true);
      await db.refreshRecentFromHuluBet();
      await loadData();
    };
    runStartupSync();

    const retryTimer = setInterval(async () => {
      const res = await db.processOfflineRetryQueue(false);
      if (res.synced > 0 || res.failed > 0) {
        loadData();
      }
    }, 15_000);

    const recentPollTimer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const res = await db.refreshRecentFromHuluBet();
      if (res.ok && res.updatedCount > 0) {
        loadData();
      }
    }, 60_000);

    return () => {
      clearInterval(retryTimer);
      clearInterval(recentPollTimer);
    };
  }, [loadData]);

  useEffect(() => {
    const handleAndroidBack = () => {
      if (showMenu) { setShowMenu(false); return; }
      if (showSearch) { setShowSearch(false); return; }
      if (showSettingsModal) { setShowSettingsModal(false); return; }
      if (showSecurityModal) { setShowSecurityModal(false); return; }
      if (showBackupModal) { setShowBackupModal(false); return; }
      if (showVerifyModal) { setShowVerifyModal(false); return; }
      if (showAboutModal) { setShowAboutModal(false); return; }
      if (showSimulator) { setShowSimulator(false); return; }
      if (currentTab !== 'home') { setCurrentTab('home'); return; }
    };

    window.addEventListener('androidBackPressed', handleAndroidBack);
    return () => window.removeEventListener('androidBackPressed', handleAndroidBack);
  }, [
    showMenu,
    showSearch,
    showSettingsModal,
    showSecurityModal,
    showBackupModal,
    showVerifyModal,
    showAboutModal,
    showSimulator,
    currentTab,
  ]);

  const hulubetStats = useMemo(() => computeHuluBetOverviewStats(payments), [payments]);

  const localUnsyncedCount = useMemo(
    () => payments.filter(p => p.syncStatus === 'local' || p.syncStatus === 'pending' || p.syncStatus === 'failed').length,
    [payments]
  );

  const rangeFilteredPayments = useMemo(() => {
    return filterPaymentsByTimeRange(payments, timeRange);
  }, [payments, timeRange]);

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
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#0F4C3A]">
          <RefreshCw size={17} className="animate-spin" />
          <span>Starting Ak Finance Ledger...</span>
        </div>
      </div>
    );
  }

  const t = translations[settings.language];
  const serverUrlConfigured = Boolean(settings.serverUrl && settings.serverUrl.trim().length > 0);
  const attentionCount = hulubetStats.syncErrorsCount + hulubetStats.needsReviewCount;

  const pageTitleMap: Record<TabId, string> = {
    home: settings.language === 'am' ? 'አጠቃላይ እይታ' : 'Overview',
    payments: settings.language === 'am' ? 'የክፍያ መዝገብ' : 'Transactions Ledger',
    insights: settings.language === 'am' ? 'ትንታኔ' : 'Analytics & Health',
    organize: settings.language === 'am' ? 'ባንኮች እና በጀት' : 'Banks & Budgets',
    ai: settings.language === 'am' ? 'እጀታ AI' : 'Ejeta AI',
  };

  const handleToggleHideBalances = async (forceHide?: boolean) => {
    const nextVal = typeof forceHide === 'boolean' ? forceHide : !settings.hideBalances;
    const updated = await db.saveSettings({ hideBalances: nextVal });
    setSettings(updated);
  };

  const handleToggleLanguage = async () => {
    const nextLang = settings.language === 'en' ? 'am' : 'en';
    const updated = await db.saveSettings({ language: nextLang });
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
    override: { counterparty?: string | null; direction?: string | null; note?: string; isHidden?: boolean; tag?: string; reference?: string }
  ) => {
    await db.saveSmsOverride(id, override);
    await loadData();
  };

  const handleSyncPayment = async (id: string) => {
    const res = await db.syncPaymentToServer(id);
    setSyncNotice(res.message);
    setTimeout(() => setSyncNotice(null), 4000);
    await loadData();
    return res;
  };

  const handleRefreshServerStatus = async () => {
    setRefreshingServerStatus(true);
    try {
      await db.processOfflineRetryQueue(true);
      const res = await db.refreshRecentFromHuluBet();
      if (!res.ok) {
        setSyncNotice(res.error || 'Could not refresh HuluBet server status.');
      } else {
        setSyncNotice(`HuluBet status refreshed (${res.totalFetched} recent, ${res.updatedCount} matched).`);
      }
      setTimeout(() => setSyncNotice(null), 4000);
      await loadData();
    } finally {
      setRefreshingServerStatus(false);
    }
  };

  const handleCheckTransactionStatus = async (payment: PaymentRecord) => {
    const res = await db.checkTransactionStatus(payment.id, payment.reference);
    await loadData();
    if (!res.ok && res.error) {
      setSyncNotice(res.error);
      setTimeout(() => setSyncNotice(null), 4000);
    }
    return res;
  };

  const handleSyncSelected = async (ids: string[]) => {
    let synced = 0;
    let needsReview = 0;
    let failed = 0;
    for (const id of ids) {
      const res = await db.syncPaymentToServer(id);
      if (res.ok) {
        if (res.needsReview) needsReview++;
        else synced++;
      } else {
        failed++;
        if (res.authError) {
          setSyncNotice(res.message);
          setTimeout(() => setSyncNotice(null), 5000);
          await loadData();
          return;
        }
      }
    }
    setSyncNotice(
      `Sync complete: ${synced} synced${needsReview ? `, ${needsReview} needs review` : ''}${failed ? `, ${failed} queued for retry` : ''}.`
    );
    setTimeout(() => setSyncNotice(null), 5000);
    await loadData();
  };

  const handleBulkSync = async () => {
    const res = await db.syncAllLocalToServer();
    if (res.error) {
      setSyncNotice(res.error);
    } else {
      setSyncNotice(
        `Synced ${res.synced}${res.needsReview ? ` · Needs review ${res.needsReview}` : ''}${res.failed ? ` · Queued/Retry ${res.failed}` : ''}`
      );
    }
    setTimeout(() => setSyncNotice(null), 5000);
    await loadData();
    return res;
  };

  const handleAiParsePayment = async (id: string) => {
    const res = await db.parseUnknownSmsWithAi(id);
    if (!res.ok) {
      setSyncNotice(res.error || 'Gemini AI parsing failed.');
      setTimeout(() => setSyncNotice(null), 4000);
    } else {
      setSyncNotice('Gemini AI extracted transaction fields and saved to local cache.');
      setTimeout(() => setSyncNotice(null), 4000);
    }
    await loadData();
    return res;
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

  const handleDeleteWithdrawal = async (id: string) => {
    await db.deleteWithdrawal(id);
    await loadData();
  };

  const handleUpdateAccounts = async (newAccs: Account[]) => {
    setAccounts(newAccs);
  };

  const handleUpdateBudget = async (b: MonthlyBudget) => {
    await db.saveMonthlyBudget(b);
    setMonthlyBudget(b);
  };

  const openLedgerFiltered = (filter: LedgerStatusFilter) => {
    setLedgerStatusFilter(filter);
    setShowWithdrawalsSubView(false);
    setCurrentTab('payments');
  };

  const navItems: { id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'home', label: settings.language === 'am' ? 'መነሻ' : 'Overview', icon: LayoutGrid },
    { id: 'payments', label: settings.language === 'am' ? 'ክፍያዎች' : 'Ledger', icon: ReceiptText },
    { id: 'insights', label: settings.language === 'am' ? 'ትንታኔ' : 'Insights', icon: BarChart3 },
    { id: 'organize', label: settings.language === 'am' ? 'ባንኮች' : 'Banks & Budgets', icon: Layers },
    { id: 'ai', label: settings.language === 'am' ? 'እጀታ AI' : 'Ejeta AI', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-[#F7F8F6] text-slate-900 flex antialiased selection:bg-[#0F4C3A]/15">
      {/* Desktop Persistent Sidebar (240px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 bg-white border-r border-slate-200 sticky top-0 h-screen">
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="text-base font-bold tracking-tight text-slate-900">
            Ak Finance
          </div>
          <div className="text-[11px] font-medium text-slate-500">
            Ethiopian Treasury Desk
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Desktop Navigation">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'payments') setLedgerStatusFilter('all');
                  setCurrentTab(item.id);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-[#0F4C3A] text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon size={16} />
                  <span>{item.label}</span>
                </span>
                {item.id === 'payments' && attentionCount > 0 && (
                  <span className={`text-[11px] font-bold tabular-nums ${active ? 'text-amber-300' : 'text-amber-700'}`}>
                    {attentionCount}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-slate-200 space-y-1">
            <div className="px-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Tools
            </div>
            <button
              type="button"
              onClick={() => setShowSimulator(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              <MessageSquarePlus size={15} />
              <span>Capture Bank SMS</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBackupModal(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              <Database size={15} />
              <span>Backup & Storage</span>
            </button>
            <button
              type="button"
              onClick={() => setShowVerifyModal(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              <ShieldCheck size={15} />
              <span>Verify Receipt</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              <Settings size={15} />
              <span>Settings</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSecurityModal(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              <Lock size={15} />
              <span>PIN Security</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAboutModal(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              <Info size={15} />
              <span>Parser & Banks</span>
            </button>
          </div>
        </nav>

        <div className="p-3 border-t border-slate-200 text-xs text-slate-600">
          <div className="font-semibold text-slate-900">
            {settings.mode === 'local'
              ? 'Standalone Local Mode'
              : `HuluBet · ${settings.deviceLabel || (settings.deviceRole === 'agent' ? 'Agent 1' : 'Owner')}`}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {payments.length} stored
            {hulubetStats.syncErrorsCount > 0 ? ` · ${hulubetStats.syncErrorsCount} sync error` : ''}
          </div>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col pb-16 lg:pb-0">
        <Header
          settings={settings}
          pageTitle={pageTitleMap[currentTab]}
          onToggleHideBalances={handleToggleHideBalances}
          onToggleLanguage={handleToggleLanguage}
          onOpenSearch={() => setShowSearch(true)}
          onOpenSimulator={() => setShowSimulator(true)}
          onOpenMenu={() => setShowMenu(true)}
        />

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-4">
          {syncNotice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-2">
              <span>{syncNotice}</span>
              <button type="button" onClick={() => setSyncNotice(null)} className="text-emerald-700 hover:text-emerald-950 font-bold">
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {currentTab === 'home' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
                <div className="xl:col-span-7">
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
                </div>
                <div className="xl:col-span-5">
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
                    onPrevMonth={() => setCurrentMonthIndex(p => (p > 0 ? p - 1 : months.length - 1))}
                    onNextMonth={() => setCurrentMonthIndex(p => (p < months.length - 1 ? p + 1 : 0))}
                    onToggleHideBalances={handleToggleHideBalances}
                  />
                </div>
              </div>

              {/* HuluBet Overview Live Counters & Quick Balances */}
              <section
                aria-label="HuluBet Verification Counters"
                className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-700">
                      HuluBet Verify Overview · {settings.deviceLabel || 'Owner'}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {hulubetStats.syncErrorsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => openLedgerFiltered('sync-error')}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold whitespace-nowrap"
                      >
                        Sync Errors ({hulubetStats.syncErrorsCount})
                      </button>
                    )}
                    {localUnsyncedCount > 0 && serverUrlConfigured && (
                      <button
                        type="button"
                        onClick={handleBulkSync}
                        className="px-2.5 py-1.5 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold flex items-center gap-1 whitespace-nowrap"
                      >
                        <CloudUpload size={12} />
                        <span>Sync Local ({localUnsyncedCount})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={refreshingServerStatus}
                      onClick={handleRefreshServerStatus}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 text-[#0F4C3A] text-xs font-semibold flex items-center gap-1 whitespace-nowrap disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={refreshingServerStatus ? 'animate-spin' : ''} />
                      <span>{refreshingServerStatus ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                    <div className="text-[11px] font-medium text-slate-500">Deposits Claimed</div>
                    <div className="font-mono text-sm font-bold text-emerald-700 tabular-nums mt-0.5">
                      {settings.hideBalances
                        ? '••••••'
                        : `${hulubetStats.depositsClaimedEtb.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                    <div className="text-[11px] font-medium text-slate-500">Withdrawals Verified</div>
                    <div className="font-mono text-sm font-bold text-slate-900 tabular-nums mt-0.5">
                      {settings.hideBalances
                        ? '••••••'
                        : `${hulubetStats.withdrawalsVerifiedEtb.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                    <div className="text-[11px] font-medium text-slate-500">Pending / Unclaimed</div>
                    <div className="font-mono text-sm font-bold text-amber-800 tabular-nums mt-0.5">
                      {hulubetStats.pendingUnclaimedCount}{' '}
                      <span className="text-[11px] font-normal text-slate-500">
                        {settings.hideBalances
                          ? ''
                          : `(${hulubetStats.pendingUnclaimedEtb.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB)`}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openLedgerFiltered('needs-review')}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-amber-50 p-2.5 text-left transition-colors"
                  >
                    <div className="text-[11px] font-medium text-slate-500">Needs Review</div>
                    <div className={`font-mono text-sm font-bold tabular-nums mt-0.5 ${hulubetStats.needsReviewCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                      {hulubetStats.needsReviewCount}
                    </div>
                  </button>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                    <div className="text-[11px] font-medium text-slate-500">Latest Telebirr Bal</div>
                    <div className="font-mono text-sm font-bold text-sky-800 tabular-nums mt-0.5">
                      {settings.hideBalances
                        ? '••••••'
                        : hulubetStats.latestTelebirrBalance !== null
                          ? `${hulubetStats.latestTelebirrBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
                          : '—'}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                    <div className="text-[11px] font-medium text-slate-500">Latest CBE Balance</div>
                    <div className="font-mono text-sm font-bold text-purple-900 tabular-nums mt-0.5">
                      {settings.hideBalances
                        ? '••••••'
                        : hulubetStats.latestCbeBalance !== null
                          ? `${hulubetStats.latestCbeBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
                          : '—'}
                    </div>
                  </div>
                </div>
              </section>

              <PaymentsList
                payments={displayedPayments}
                settings={settings}
                activeDirection={directionFilter}
                onFilterDirection={setDirectionFilter}
                onRetrySinglePayment={handleRetrySinglePayment}
                onDeletePayment={handleDeletePayment}
                onSaveOverride={handleSaveOverride}
                onSyncPayment={handleSyncPayment}
                onSyncSelected={handleSyncSelected}
                onAiParsePayment={handleAiParsePayment}
                onRefreshServerStatus={handleRefreshServerStatus}
                refreshingServerStatus={refreshingServerStatus}
                onCheckTransactionStatus={handleCheckTransactionStatus}
                serverUrlConfigured={serverUrlConfigured}
                onOpenSettings={() => setShowSettingsModal(true)}
                maxItems={8}
              />

              {displayedPayments.length > 8 && (
                <button
                  type="button"
                  onClick={() => openLedgerFiltered('all')}
                  className="w-full py-2.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#0F4C3A] hover:bg-slate-50"
                >
                  {settings.language === 'am' ? 'ሁሉንም ክፍያዎች ተመልከት' : `Open Full Ledger (${displayedPayments.length} records)`}
                </button>
              )}
            </div>
          )}

          {/* TAB 2: LEDGER */}
          {currentTab === 'payments' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowWithdrawalsSubView(false)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
                      !showWithdrawalsSubView ? 'bg-white text-slate-900 border border-slate-200' : 'text-slate-600'
                    }`}
                  >
                    {t.allPayments} ({payments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWithdrawalsSubView(true)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap ${
                      showWithdrawalsSubView ? 'bg-white text-slate-900 border border-slate-200' : 'text-slate-600'
                    }`}
                  >
                    {t.withdrawals} ({withdrawals.length})
                  </button>
                </div>

                {!showWithdrawalsSubView && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBackupModal(true)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      Backup & Sync
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSearch(true)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#0F4C3A] hover:bg-slate-50 whitespace-nowrap"
                    >
                      Filter & Search
                    </button>
                  </div>
                )}
              </div>

              {!showWithdrawalsSubView ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                      {(['1h', '1d', '7d', '1mo', '1y', 'all'] as TimeRange[]).map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => handleSetTimeRange(r)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border whitespace-nowrap ${
                            timeRange === r
                              ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {r === 'all' ? 'All Time' : r}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                      <button
                        type="button"
                        onClick={() => setSelectedAccountId(null)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border whitespace-nowrap ${
                          !selectedAccountId
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        All Banks
                      </button>
                      {accounts.map(acc => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => setSelectedAccountId(selectedAccountId === acc.id ? null : acc.id)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border whitespace-nowrap ${
                            selectedAccountId === acc.id
                              ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {acc.shortCode || acc.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <PaymentsList
                    payments={displayedPayments}
                    settings={settings}
                    activeDirection={directionFilter}
                    onFilterDirection={setDirectionFilter}
                    onRetrySinglePayment={handleRetrySinglePayment}
                    onDeletePayment={handleDeletePayment}
                    onSaveOverride={handleSaveOverride}
                    onSyncPayment={handleSyncPayment}
                    onSyncSelected={handleSyncSelected}
                    onAiParsePayment={handleAiParsePayment}
                    onRefreshServerStatus={handleRefreshServerStatus}
                    refreshingServerStatus={refreshingServerStatus}
                    onCheckTransactionStatus={handleCheckTransactionStatus}
                    serverUrlConfigured={serverUrlConfigured}
                    initialStatusFilter={ledgerStatusFilter}
                    onOpenSettings={() => setShowSettingsModal(true)}
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

          {/* TAB 3: INSIGHTS */}
          {currentTab === 'insights' && (
            <InsightsTab
              payments={payments}
              withdrawals={withdrawals}
              settings={settings}
              budget={monthlyBudget}
              onUpdateBudget={handleUpdateBudget}
            />
          )}

          {/* TAB 4: ORGANIZE */}
          {currentTab === 'organize' && (
            <OrganizeTab
              accounts={accounts}
              settings={settings}
              onUpdateAccounts={handleUpdateAccounts}
              budget={monthlyBudget}
              onUpdateBudget={handleUpdateBudget}
              payments={payments}
              withdrawals={withdrawals}
            />
          )}

          {/* TAB 5: EJETA AI */}
          {currentTab === 'ai' && (
            <EjetaAiTab
              payments={payments}
              accounts={accounts}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={tab => {
          if (tab === 'payments') setLedgerStatusFilter('all');
          setCurrentTab(tab);
        }}
        language={settings.language}
        attentionCount={attentionCount}
      />

      {/* Modals */}
      <SmsSimulatorModal
        isOpen={showSimulator}
        onClose={() => setShowSimulator(false)}
        settings={settings}
        onSmsProcessed={loadData}
      />

      <SearchModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        payments={payments}
        settings={settings}
        onSelectPayment={() => setCurrentTab('payments')}
      />

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-5 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <h3 className="text-sm font-bold text-slate-900">{t.settings}</h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                aria-label="Close settings"
                className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>
            </div>
            <SettingsTab
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onTriggerSyncAll={async () => {
                await handleBulkSync();
              }}
            />
          </div>
        </div>
      )}

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

      <SecuritySettingsModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        onSettingsChanged={() => {}}
      />

      <BackupRestoreModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        onDataRestored={loadData}
        onTriggerBulkSync={handleBulkSync}
        serverUrlConfigured={serverUrlConfigured}
      />

      <LocalVerifyModal
        isOpen={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        payments={payments}
        settings={settings}
      />

      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
      />

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
