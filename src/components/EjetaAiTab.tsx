import React, { useState, useEffect } from 'react';
import { PaymentRecord, AppSettings, Account, AiModelId } from '../types/index.ts';
import {
  AI_CHAT_AND_PARSER_MODELS,
  AiModelOption,
  PAID_GEMINI_MODEL_IDS,
  resolveAllowedAiModel,
} from '../constants/aiModels.ts';
import {
  Sparkles,
  Send,
  Calculator,
  Copy,
  Check,
  Bot,
  Database,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface EjetaAiTabProps {
  payments: PaymentRecord[];
  accounts: Account[];
  settings: AppSettings;
  onUpdateSettings?: (newSettings: Partial<AppSettings>) => Promise<void>;
}

interface AnswerCard {
  id: string;
  query: string;
  title: string;
  mainFigure: string;
  subtext: string;
  details?: { label: string; value: string; color?: string }[];
  timestamp: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  model?: string;
  timestamp: number;
}

export const EjetaAiTab: React.FC<EjetaAiTabProps> = ({
  payments,
  accounts,
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'sqlite' | 'calc'>('ai');
  const [customQuery, setCustomQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live Gemini AI State
  const [aiStatus, setAiStatus] = useState<{
    checked: boolean;
    configured: boolean;
    availableModels: AiModelOption[];
  }>({
    checked: false,
    configured: false,
    availableModels: [...AI_CHAT_AND_PARSER_MODELS],
  });
  const [selectedModel, setSelectedModel] = useState<AiModelId>(resolveAllowedAiModel(settings.aiModel));
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Calculator State
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcFormula, setCalcFormula] = useState('');

  useEffect(() => {
    setSelectedModel(resolveAllowedAiModel(settings.aiModel));
  }, [settings.aiModel]);

  useEffect(() => {
    let active = true;
    fetch('/api/ai/status')
      .then(r => r.json())
      .then(data => {
        if (!active) return;
        const registryMap = new Map(AI_CHAT_AND_PARSER_MODELS.map(m => [m.id, m]));
        const normalizedModels: AiModelOption[] =
          Array.isArray(data?.availableModels) && data.availableModels.length > 0
            ? data.availableModels
                .map((item: string | Partial<AiModelOption>) => {
                  const id = typeof item === 'string' ? item : item?.id;
                  return id ? registryMap.get(id as AiModelId) : undefined;
                })
                .filter((x: AiModelOption | undefined): x is AiModelOption => Boolean(x))
            : [...AI_CHAT_AND_PARSER_MODELS];
        setAiStatus({
          checked: true,
          configured: Boolean(data?.configured),
          availableModels: normalizedModels.length > 0 ? normalizedModels : [...AI_CHAT_AND_PARSER_MODELS],
        });
      })
      .catch(() => {
        if (active) setAiStatus(prev => ({ ...prev, checked: true, configured: false }));
      });
    return () => {
      active = false;
    };
  }, []);

  const SHORTCUT_CHIPS = [
    { id: 'cbe-month', label: 'CBE Monthly Inflow' },
    { id: 'telebirr-month', label: 'Telebirr In / Out' },
    { id: 'today-total', label: "Today's Net" },
    { id: 'top-counterparty', label: 'Top Counterparty' },
    { id: 'avg-ticket', label: 'Average Ticket' },
    { id: 'bank-summary', label: 'Per-Bank Summary' },
    { id: 'unsent-failed', label: 'Local / Unsynced' },
    { id: 'server-ignored', label: 'Server Ignored Audit' },
    { id: 'last-5', label: 'Last 5 Records' },
  ];

  const AI_SUGGESTIONS = [
    'Summarize my inflows, outflows, and fees across all Ethiopian banks.',
    'Which transactions did my server ignore that are stored locally?',
    'Who are my top counterparties this month and what is my net cash?',
    'Check if any CBE transactions are missing an FT receipt code.',
  ];

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const validPayments = payments.filter(p => !p.isDuplicate && !p.isHidden);

  const createCardId = (prefix: string) =>
    `card-${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const computeShortcutAnswer = (chipId: string): AnswerCard => {
    switch (chipId) {
      case 'cbe-month': {
        const cbePayments = validPayments.filter(p => {
          const d = new Date(p.timestamp);
          const isMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
          const isCbe = p.bank.toUpperCase().includes('CBE') || p.bank.toUpperCase().includes('COMMERCIAL');
          return isMonth && isCbe && p.type === 'received';
        });
        const total = cbePayments.reduce((acc, p) => acc + p.amount, 0);
        return {
          id: createCardId('cbe-month'),
          query: 'CBE Monthly Inflow',
          title: 'Commercial Bank of Ethiopia (CBE)',
          mainFigure: `ETB ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          subtext: `${cbePayments.length} received transactions this month`,
          details: cbePayments.slice(0, 4).map(p => ({
            label: p.counterparty || p.reference,
            value: `+${p.amount.toLocaleString()} ETB`,
            color: 'text-emerald-700',
          })),
          timestamp: Date.now(),
        };
      }

      case 'telebirr-month': {
        const tlbReceived = validPayments.filter(p => {
          const d = new Date(p.timestamp);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear &&
            (p.bank.toUpperCase().includes('TELEBIRR') || p.senderAddress === '127') && p.type === 'received';
        });
        const tlbSent = validPayments.filter(p => {
          const d = new Date(p.timestamp);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear &&
            (p.bank.toUpperCase().includes('TELEBIRR') || p.senderAddress === '127') && p.type === 'sent';
        });
        const recTotal = tlbReceived.reduce((acc, p) => acc + p.amount, 0);
        const sentTotal = tlbSent.reduce((acc, p) => acc + p.amount, 0);
        return {
          id: createCardId('telebirr-month'),
          query: 'Telebirr In / Out',
          title: 'Telebirr (127)',
          mainFigure: `+${recTotal.toLocaleString()} / -${sentTotal.toLocaleString()} ETB`,
          subtext: `Net movement: ETB ${(recTotal - sentTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          details: [
            { label: 'Received (Inflow)', value: `+${recTotal.toLocaleString()} ETB (${tlbReceived.length})`, color: 'text-emerald-700' },
            { label: 'Sent (Outflow)', value: `-${sentTotal.toLocaleString()} ETB (${tlbSent.length})`, color: 'text-rose-700' },
          ],
          timestamp: Date.now(),
        };
      }

      case 'today-total': {
        const todayPayments = validPayments.filter(p => {
          const dStr = new Date(p.timestamp).toISOString().slice(0, 10);
          return dStr === todayDateStr && p.category !== 'alert';
        });
        const rec = todayPayments.filter(p => p.type === 'received').reduce((acc, p) => acc + p.amount, 0);
        const sent = todayPayments.filter(p => p.type === 'sent').reduce((acc, p) => acc + p.amount, 0);
        const net = rec - sent;
        return {
          id: createCardId('today-total'),
          query: "Today's Net",
          title: "Today's Transaction Volume",
          mainFigure: `ETB ${net >= 0 ? '+' : ''}${net.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          subtext: `${todayPayments.length} financial transactions today`,
          details: [
            { label: 'Today Inflow', value: `+${rec.toLocaleString()} ETB`, color: 'text-emerald-700' },
            { label: 'Today Outflow', value: `-${sent.toLocaleString()} ETB`, color: 'text-rose-700' },
          ],
          timestamp: Date.now(),
        };
      }

      case 'bank-summary': {
        const bankTotals: Record<string, { rec: number; sent: number; count: number }> = {};
        for (const p of validPayments) {
          if (p.category === 'alert') continue;
          const b = p.bank || 'Other';
          if (!bankTotals[b]) bankTotals[b] = { rec: 0, sent: 0, count: 0 };
          bankTotals[b].count++;
          if (p.type === 'received') bankTotals[b].rec += p.amount;
          else if (p.type === 'sent') bankTotals[b].sent += p.amount;
        }
        const details = Object.entries(bankTotals).map(([bName, stat]) => ({
          label: bName,
          value: `+${stat.rec.toLocaleString()} / -${stat.sent.toLocaleString()} ETB (${stat.count})`,
        }));
        return {
          id: createCardId('bank-summary'),
          query: 'Per-Bank Summary',
          title: 'All Active Ethiopian Banks',
          mainFigure: `${Object.keys(bankTotals).length} Active Channels`,
          subtext: `${validPayments.length} captured records in local storage`,
          details,
          timestamp: Date.now(),
        };
      }

      case 'unsent-failed': {
        const localOrPending = payments.filter(p => p.syncStatus === 'local' || p.syncStatus === 'pending' || p.syncStatus === 'failed');
        return {
          id: createCardId('unsent-failed'),
          query: 'Local / Unsynced',
          title: 'Local Queue & Sync Status',
          mainFigure: `${localOrPending.length} Local / Unsynced`,
          subtext: localOrPending.length > 0
            ? 'Stored in local storage; ready to forward when server sync is triggered'
            : 'All captured records are synced with server',
          details: localOrPending.slice(0, 5).map(p => ({
            label: `${p.bank} · ${p.counterparty}`,
            value: `${p.amount.toLocaleString()} ETB (${p.syncStatus})`,
            color: 'text-amber-700',
          })),
          timestamp: Date.now(),
        };
      }

      case 'server-ignored': {
        const ignored = payments.filter(p => p.serverIgnored || p.serverResult?.status === 'Ignored');
        return {
          id: createCardId('server-ignored'),
          query: 'Server Ignored Audit',
          title: 'Server Ignored · Preserved Locally',
          mainFigure: `${ignored.length} Records`,
          subtext: 'Messages rejected by a legacy backend webhook that Ak Finance still parsed and stored locally',
          details: ignored.slice(0, 5).map(p => ({
            label: `${p.bank} · ${p.counterparty}`,
            value: `${p.amount.toLocaleString()} ETB`,
            color: 'text-amber-700',
          })),
          timestamp: Date.now(),
        };
      }

      case 'top-counterparty': {
        const counterpartiesMap: Record<string, { total: number; count: number; bank: string }> = {};
        for (const p of validPayments) {
          if (p.category === 'alert' || !p.counterparty || p.counterparty.toLowerCase().includes('unknown')) continue;
          const name = p.counterparty.trim();
          if (!counterpartiesMap[name]) counterpartiesMap[name] = { total: 0, count: 0, bank: p.bank };
          counterpartiesMap[name].total += p.amount;
          counterpartiesMap[name].count += 1;
        }
        const sorted = Object.entries(counterpartiesMap).sort((a, b) => b[1].total - a[1].total);
        const top = sorted[0];
        if (!top) {
          return {
            id: createCardId('top-counterparty'),
            query: 'Top Counterparty',
            title: 'Top Counterparty',
            mainFigure: 'None Identified',
            subtext: 'No named counterparties extracted yet.',
            timestamp: Date.now(),
          };
        }
        return {
          id: createCardId('top-counterparty'),
          query: 'Top Counterparty',
          title: `Leader: ${top[0]}`,
          mainFigure: `ETB ${top[1].total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          subtext: `${top[1].count} transactions · ${top[1].bank}`,
          details: sorted.slice(1, 4).map(([name, stat]) => ({
            label: name,
            value: `${stat.total.toLocaleString()} ETB (${stat.count})`,
            color: 'text-emerald-700',
          })),
          timestamp: Date.now(),
        };
      }

      case 'avg-ticket': {
        const valid = validPayments.filter(p => p.category !== 'alert');
        const total = valid.reduce((acc, p) => acc + p.amount, 0);
        const avg = valid.length > 0 ? total / valid.length : 0;
        const rec = valid.filter(p => p.type === 'received');
        const avgIn = rec.length > 0 ? rec.reduce((acc, p) => acc + p.amount, 0) / rec.length : 0;
        const sent = valid.filter(p => p.type === 'sent');
        const avgOut = sent.length > 0 ? sent.reduce((acc, p) => acc + p.amount, 0) / sent.length : 0;
        return {
          id: createCardId('avg-ticket'),
          query: 'Average Ticket',
          title: 'Ticket Size Intelligence',
          mainFigure: `ETB ${avg.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          subtext: `Computed across ${valid.length} financial transactions`,
          details: [
            { label: 'Avg Received', value: `+${avgIn.toFixed(2)} ETB (${rec.length})`, color: 'text-emerald-700' },
            { label: 'Avg Sent', value: `-${avgOut.toFixed(2)} ETB (${sent.length})`, color: 'text-rose-700' },
          ],
          timestamp: Date.now(),
        };
      }

      case 'last-5': {
        const last5 = validPayments.slice(0, 5);
        return {
          id: createCardId('last-5'),
          query: 'Last 5 Records',
          title: 'Recent Transactions',
          mainFigure: `${last5.length} Recent Records`,
          subtext: 'From local device storage',
          details: last5.map(p => ({
            label: `${p.counterparty} · ${p.bank}`,
            value: `${p.type === 'received' ? '+' : p.type === 'sent' ? '-' : ''}${p.amount.toLocaleString()} ETB`,
            color: p.type === 'received' ? 'text-emerald-700' : 'text-slate-900',
          })),
          timestamp: Date.now(),
        };
      }

      default:
        return {
          id: createCardId(chipId),
          query: chipId,
          title: 'Summary',
          mainFigure: `${validPayments.length} Payments`,
          subtext: 'Database audit ready',
          timestamp: Date.now(),
        };
    }
  };

  const [cards, setCards] = useState<AnswerCard[]>(() => [
    computeShortcutAnswer('today-total'),
    computeShortcutAnswer('bank-summary'),
  ]);

  const handleChipClick = (chipId: string) => {
    const card = computeShortcutAnswer(chipId);
    setCards(prev => [card, ...prev.filter(c => c.query !== card.query)]);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = customQuery.trim().toLowerCase();
    if (!q) return;

    let matchedChip = 'bank-summary';
    if (q.includes('cbe')) matchedChip = 'cbe-month';
    else if (q.includes('telebirr') || q.includes('127')) matchedChip = 'telebirr-month';
    else if (q.includes('today')) matchedChip = 'today-total';
    else if (q.includes('ignore')) matchedChip = 'server-ignored';
    else if (q.includes('unsent') || q.includes('failed') || q.includes('local')) matchedChip = 'unsent-failed';
    else if (q.includes('top') || q.includes('counter')) matchedChip = 'top-counterparty';
    else if (q.includes('avg') || q.includes('ticket')) matchedChip = 'avg-ticket';
    else if (q.includes('last') || q.includes('recent')) matchedChip = 'last-5';

    handleChipClick(matchedChip);
    setCustomQuery('');
  };

  const buildCompactLedgerContext = () => {
    const financial = validPayments.filter(p => p.category !== 'alert');
    const totalReceived = financial.filter(p => p.type === 'received').reduce((s, p) => s + p.amount, 0);
    const totalSent = financial.filter(p => p.type === 'sent').reduce((s, p) => s + p.amount, 0);
    const totalFees = financial.reduce((s, p) => s + (p.fee || 0), 0);
    const serverIgnoredCount = payments.filter(p => p.serverIgnored || p.serverResult?.status === 'Ignored').length;
    const unsyncedCount = payments.filter(p => p.syncStatus === 'local' || p.syncStatus === 'pending' || p.syncStatus === 'failed').length;

    return {
      totalRecords: payments.length,
      financialRecords: financial.length,
      totalReceivedETB: Number(totalReceived.toFixed(2)),
      totalSentETB: Number(totalSent.toFixed(2)),
      netCashETB: Number((totalReceived - totalSent).toFixed(2)),
      totalFeesETB: Number(totalFees.toFixed(2)),
      serverIgnoredCount,
      unsyncedLocalCount: unsyncedCount,
      accounts: accounts.map(a => ({
        name: a.name,
        bank: a.bank,
        balance: Number(a.balance.toFixed(2)),
        receivedThisMonth: Number((a.receivedThisMonth || 0).toFixed(2)),
        sentThisMonth: Number((a.sentThisMonth || 0).toFixed(2)),
      })),
      recentTransactions: payments.slice(0, 25).map(p => ({
        date: new Date(p.timestamp).toISOString().slice(0, 16),
        bank: p.bank,
        type: p.type,
        category: p.category,
        amount: p.amount,
        fee: p.fee || 0,
        counterparty: p.counterparty,
        reference: p.ftNumber || p.reference,
        syncStatus: p.syncStatus,
        serverIgnored: Boolean(p.serverIgnored),
      })),
    };
  };

  const handleAiChatSubmit = async (e: React.FormEvent, overridePrompt?: string) => {
    e.preventDefault();
    const promptText = (overridePrompt ?? aiPrompt).trim();
    if (!promptText || aiLoading) return;

    setAiError(null);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: promptText,
      timestamp: Date.now(),
    };
    setChatMessages(prev => [...prev, userMsg]);
    if (!overridePrompt) setAiPrompt('');
    setAiLoading(true);

    try {
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: promptText,
          model: selectedModel,
          language: settings.language,
          summaryContext: buildCompactLedgerContext(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) {
        setAiError(data?.error || 'Gemini AI service returned an error.');
      } else {
        const highlightsText = Array.isArray(data.highlights) && data.highlights.length > 0
          ? '\n\n' + data.highlights.map((h: { label: string; value: string }) => `• ${h.label}: ${h.value}`).join('\n')
          : '';
        const formattedText = data.answer
          ? `${data.title ? `${data.title} — ` : ''}${data.mainFigure ? `${data.mainFigure}\n\n` : ''}${data.answer}${highlightsText}`
          : (data.text || 'No response generated.');
        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          text: formattedText,
          model: data.model || selectedModel,
          timestamp: Date.now(),
        };
        setChatMessages(prev => [...prev, assistantMsg]);
      }
    } catch (err: any) {
      setAiError(err?.message || 'Failed to contact AI endpoint.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleModelChange = async (model: AiModelId) => {
    setSelectedModel(model);
    if (onUpdateSettings) {
      await onUpdateSettings({ aiModel: model });
    }
  };

  const handleCopyFigure = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCalcBtn = (val: string) => {
    if (val === 'C') {
      setCalcDisplay('0');
      setCalcFormula('');
      return;
    }
    if (val === 'DEL') {
      if (calcDisplay.length <= 1) setCalcDisplay('0');
      else setCalcDisplay(calcDisplay.slice(0, -1));
      return;
    }
    if (val === '=') {
      try {
        const sanitized = (calcFormula + calcDisplay)
          .replace(/×/g, '*')
          .replace(/÷/g, '/')
          .replace(/%/g, '*0.01');
        const result = Function(`'use strict'; return (${sanitized})`)();
        setCalcDisplay(String(Number(result.toFixed(2))));
        setCalcFormula('');
      } catch {
        setCalcDisplay('Error');
      }
      return;
    }
    if (['+', '-', '×', '÷'].includes(val)) {
      setCalcFormula(prev => `${prev} ${calcDisplay} ${val}`);
      setCalcDisplay('0');
      return;
    }
    if (val === '%') {
      const num = parseFloat(calcDisplay);
      if (!isNaN(num)) setCalcDisplay(String(num * 0.01));
      return;
    }
    if (calcDisplay === '0' || calcDisplay === 'Error') setCalcDisplay(val);
    else setCalcDisplay(calcDisplay + val);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header & Subtab Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0F4C3A] text-white flex items-center justify-center shrink-0">
            <Sparkles size={17} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Ejeta AI · Ledger Intelligence
            </h2>
            <p className="text-xs text-slate-500">
              Live Gemini financial advisor, offline SQLite queries & calculator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              activeTab === 'ai' ? 'bg-white text-slate-900 border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bot size={13} />
            <span>AI Advisor</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sqlite')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              activeTab === 'sqlite' ? 'bg-white text-slate-900 border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database size={13} />
            <span>SQLite Queries</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('calc')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
              activeTab === 'calc' ? 'bg-white text-slate-900 border border-slate-200' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calculator size={13} />
            <span>Calculator</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: LIVE GEMINI AI ADVISOR */}
      {activeTab === 'ai' && (
        <div className="space-y-3">
          {/* Model & Readiness Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="text-xs text-slate-600">
              {!aiStatus.checked ? (
                <span>Checking server Gemini API status...</span>
              ) : aiStatus.configured ? (
                <span className="text-emerald-800 font-medium">
                  Gemini AI ready · Server-authenticated over /api/ai
                </span>
              ) : (
                <span className="text-amber-800 font-medium flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>Server GEMINI_API_KEY not configured in Environment Secrets. Local SQLite queries remain active.</span>
                </span>
              )}
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-2">
                <label htmlFor="ejeta-ai-model" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                  Model
                </label>
                <select
                  id="ejeta-ai-model"
                  value={selectedModel}
                  onChange={e => handleModelChange(e.target.value as AiModelId)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0F4C3A]"
                >
                  {(['Gemini 4 Series', 'Gemini 3.1 Series', 'Gemini 2.5 Series'] as const).map(groupName => {
                    const items = aiStatus.availableModels.filter(m => m.group === groupName);
                    if (items.length === 0) return null;
                    return (
                      <optgroup key={groupName} label={groupName}>
                        {items.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.label} ({m.id})
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              {PAID_GEMINI_MODEL_IDS.has(selectedModel) && (
                <span className="text-[11px] text-amber-800">
                  Paid-tier model (uses server GEMINI_API_KEY)
                </span>
              )}
            </div>
          </div>

          {/* Suggested Prompts */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {AI_SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                type="button"
                disabled={aiLoading}
                onClick={e => handleAiChatSubmit(e, s)}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {aiError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{aiError}</span>
            </div>
          )}

          {/* Chat Thread */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 min-h-[240px]">
            {chatMessages.length === 0 ? (
              <div className="py-8 text-center space-y-1.5">
                <Bot size={22} className="mx-auto text-slate-400" />
                <div className="text-xs font-semibold text-slate-800">
                  Ask anything about your Ethiopian bank & mobile money ledger
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Analyzes inflows, outflows, Telebirr ATM fees, CBE FT references, and server-ignored transactions using your local ledger summary.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {chatMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg border text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-slate-50 border-slate-200 text-slate-900 ml-6'
                        : 'bg-emerald-50/40 border-emerald-200 text-slate-900 mr-4'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
                      <span>{msg.role === 'user' ? 'You' : `Ejeta AI · ${msg.model || selectedModel}`}</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Prompt Input */}
            <form onSubmit={e => handleAiChatSubmit(e)} className="flex gap-2 pt-2 border-t border-slate-100">
              <input
                type="text"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="Ask about your balances, fees, CBE FT codes, or ignored messages..."
                className="flex-1 px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F4C3A]"
              />
              <button
                type="submit"
                disabled={!aiPrompt.trim() || aiLoading}
                className="px-4 py-2.5 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold hover:bg-[#0B3B2E] disabled:opacity-40 whitespace-nowrap flex items-center gap-1.5 shrink-0"
              >
                {aiLoading ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                <span>{aiLoading ? 'Thinking...' : 'Ask AI'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SUBTAB 2: OFFLINE SQLITE QUERIES */}
      {activeTab === 'sqlite' && (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {SHORTCUT_CHIPS.map(chip => (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleChipClick(chip.id)}
                className="shrink-0 text-xs font-semibold bg-white text-slate-700 hover:text-[#0F4C3A] hover:border-[#0F4C3A] border border-slate-200 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleCustomSubmit} className="flex gap-2">
            <input
              type="text"
              value={customQuery}
              onChange={e => setCustomQuery(e.target.value)}
              placeholder="Query offline store (e.g. CBE, Telebirr, today, ignored, top)..."
              className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F4C3A]"
            />
            <button
              type="submit"
              disabled={!customQuery.trim()}
              className="px-4 py-2.5 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold hover:bg-[#0B3B2E] disabled:opacity-40 whitespace-nowrap flex items-center gap-1.5 shrink-0"
            >
              <Send size={13} />
              <span>Run</span>
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cards.map(card => (
              <div key={card.id} className="bg-white rounded-xl p-4 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#0F4C3A]">{card.query}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyFigure(card.id, card.mainFigure)}
                    className="text-slate-600 font-semibold hover:text-slate-900 flex items-center gap-1 whitespace-nowrap"
                  >
                    {copiedId === card.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copiedId === card.id ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div>
                  <h3 className="text-xs font-medium text-slate-500">{card.title}</h3>
                  <div className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">{card.mainFigure}</div>
                  <p className="text-xs text-slate-500 mt-0.5">{card.subtext}</p>
                </div>

                {card.details && card.details.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    {card.details.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs gap-2">
                        <span className="text-slate-600 truncate">{d.label}</span>
                        <span className={`font-semibold tabular-nums shrink-0 ${d.color || 'text-slate-900'}`}>
                          {d.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: BUILT-IN FINANCIAL CALCULATOR */}
      {activeTab === 'calc' && (
        <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3 max-w-sm mx-auto">
          <div className="bg-slate-900 text-white rounded-lg p-4 text-right space-y-1 font-mono">
            <div className="text-xs text-slate-400 min-h-4 truncate">
              {calcFormula || 'Financial Calculator'}
            </div>
            <div className="text-3xl font-bold tracking-tight tabular-nums truncate">
              {calcDisplay}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {['C', '%', 'DEL', '÷'].map(btn => (
              <button
                key={btn}
                type="button"
                onClick={() => handleCalcBtn(btn)}
                className={`py-3 rounded-lg text-sm font-bold border transition-colors ${
                  btn === 'C'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : btn === 'DEL'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                {btn}
              </button>
            ))}

            {['7', '8', '9', '×'].map(btn => (
              <button
                key={btn}
                type="button"
                onClick={() => handleCalcBtn(btn)}
                className={`py-3 rounded-lg text-base font-bold border ${
                  btn === '×' ? 'bg-emerald-50 text-[#0F4C3A] border-emerald-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {btn}
              </button>
            ))}

            {['4', '5', '6', '-'].map(btn => (
              <button
                key={btn}
                type="button"
                onClick={() => handleCalcBtn(btn)}
                className={`py-3 rounded-lg text-base font-bold border ${
                  btn === '-' ? 'bg-emerald-50 text-[#0F4C3A] border-emerald-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {btn}
              </button>
            ))}

            {['1', '2', '3', '+'].map(btn => (
              <button
                key={btn}
                type="button"
                onClick={() => handleCalcBtn(btn)}
                className={`py-3 rounded-lg text-base font-bold border ${
                  btn === '+' ? 'bg-emerald-50 text-[#0F4C3A] border-emerald-200' : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                {btn}
              </button>
            ))}

            <button
              type="button"
              onClick={() => handleCalcBtn('0')}
              className="col-span-2 py-3 rounded-lg bg-white border border-slate-200 text-base font-bold text-slate-800"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleCalcBtn('.')}
              className="py-3 rounded-lg bg-white border border-slate-200 text-base font-bold text-slate-800"
            >
              .
            </button>
            <button
              type="button"
              onClick={() => handleCalcBtn('=')}
              className="py-3 rounded-lg bg-[#0F4C3A] text-white text-base font-bold"
            >
              =
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
