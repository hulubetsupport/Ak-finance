import React, { useState } from 'react';
import { PaymentRecord, AppSettings, Account } from '../types/index.ts';
import { 
  Sparkles, 
  Send, 
  Calculator, 
  Copy, 
  Check, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Building2, 
  AlertCircle,
  Clock,
  Delete
} from 'lucide-react';

interface EjetaAiTabProps {
  payments: PaymentRecord[];
  accounts: Account[];
  settings: AppSettings;
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

export const EjetaAiTab: React.FC<EjetaAiTabProps> = ({
  payments,
  accounts,
  settings,
}) => {
  const [activeTab, setActiveTab] = useState<'insights' | 'calc'>('insights');
  const [customQuery, setCustomQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Calculator State
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcFormula, setCalcFormula] = useState('');

  // Shortcut Chips (including 2026 intelligence shortcuts)
  const SHORTCUT_CHIPS = [
    { id: 'cbe-month', label: 'Total CBE income this month' },
    { id: 'telebirr-month', label: 'Total Telebirr received/sent this month' },
    { id: 'today-total', label: "Today's total" },
    { id: 'top-counterparty', label: 'Top counterparty by volume' },
    { id: 'avg-ticket', label: 'Average transaction size' },
    { id: 'projected-runrate', label: '2026 monthly run-rate' },
    { id: 'biggest-payment', label: 'Biggest payment this month' },
    { id: 'bank-summary', label: 'Per-bank summary' },
    { id: 'unsent-failed', label: 'Unsent/failed payments' },
    { id: 'last-5', label: 'Last 5 payments' },
  ];

  // Helper date filters
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const todayDateStr = new Date().toISOString().slice(0, 10);

  const validPayments = payments.filter(p => !p.isDuplicate && !p.isHidden);

  // Strictly unique card ID generator across renders
  const createCardId = (prefix: string) => `card-${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  // Compute responses dynamically from local SQLite payments
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
          query: 'Total CBE income this month',
          title: 'Commercial Bank of Ethiopia (CBE)',
          mainFigure: `ETB ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          subtext: `${cbePayments.length} successful received payments this month`,
          details: cbePayments.slice(0, 3).map(p => ({
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
          query: 'Total Telebirr received/sent this month',
          title: 'Telebirr (127)',
          mainFigure: `+${recTotal.toLocaleString()} / -${sentTotal.toLocaleString()} ETB`,
          subtext: `Net movement: ETB ${(recTotal - sentTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          details: [
            { label: 'Received (Inflow)', value: `+${recTotal.toLocaleString()} ETB (${tlbReceived.length} txns)`, color: 'text-emerald-700' },
            { label: 'Sent (Outflow)', value: `-${sentTotal.toLocaleString()} ETB (${tlbSent.length} txns)`, color: 'text-rose-700' },
          ],
          timestamp: Date.now(),
        };
      }

      case 'today-total': {
        const todayPayments = validPayments.filter(p => {
          const dStr = new Date(p.timestamp).toISOString().slice(0, 10);
          return dStr === todayDateStr;
        });
        const rec = todayPayments.filter(p => p.type === 'received').reduce((acc, p) => acc + p.amount, 0);
        const sent = todayPayments.filter(p => p.type === 'sent').reduce((acc, p) => acc + p.amount, 0);
        const net = rec - sent;
        return {
          id: createCardId('today-total'),
          query: "Today's total",
          title: "Today's Transaction Volume",
          mainFigure: `ETB ${net >= 0 ? '+' : ''}${net.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          subtext: `${todayPayments.length} transactions captured today across all banks`,
          details: [
            { label: 'Today Inflow', value: `+${rec.toLocaleString()} ETB`, color: 'text-emerald-700' },
            { label: 'Today Outflow', value: `-${sent.toLocaleString()} ETB`, color: 'text-rose-700' },
          ],
          timestamp: Date.now(),
        };
      }

      case 'biggest-payment': {
        const monthPayments = [...validPayments].filter(p => {
          const d = new Date(p.timestamp);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear && p.type === 'received';
        }).sort((a, b) => b.amount - a.amount);
        const top = monthPayments[0];
        if (!top) {
          return {
            id: createCardId('biggest-payment'),
            query: 'Biggest payment this month',
            title: 'Top Payment',
            mainFigure: '0.00 ETB',
            subtext: 'No received payments recorded this month yet.',
            timestamp: Date.now(),
          };
        }
        return {
          id: createCardId('biggest-payment'),
          query: 'Biggest payment this month',
          title: `Top Inflow: ${top.counterparty}`,
          mainFigure: `ETB ${top.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          subtext: `${top.bank} · Ref: ${top.reference} on ${new Date(top.timestamp).toLocaleDateString()}`,
          details: monthPayments.slice(1, 4).map((p, idx) => ({
            label: `#${idx + 2} ${p.counterparty} (${p.bank})`,
            value: `+${p.amount.toLocaleString()} ETB`,
          })),
          timestamp: Date.now(),
        };
      }

      case 'bank-summary': {
        const bankTotals: Record<string, { rec: number; sent: number; count: number }> = {};
        for (const p of validPayments) {
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
          query: 'Per-bank summary',
          title: 'All Monitored Banks Summary',
          mainFigure: `${Object.keys(bankTotals).length} Active Channels`,
          subtext: `Total ${validPayments.length} captured transactions in local SQLite`,
          details,
          timestamp: Date.now(),
        };
      }

      case 'unsent-failed': {
        const pending = payments.filter(p => p.syncStatus === 'pending' || p.syncStatus === 'failed');
        return {
          id: createCardId('unsent-failed'),
          query: 'Unsent/failed payments',
          title: 'Offline Server Queue Status',
          mainFigure: `${pending.length} Unsent Payments`,
          subtext: pending.length > 0
            ? `Waiting for HTTP 200 acknowledgment from ${settings.serverUrl || 'configured webhook'}`
            : 'All captured payments are 100% verified & acknowledged by server',
          details: pending.slice(0, 4).map(p => ({
            label: `${p.bank}: ${p.counterparty}`,
            value: `${p.amount.toLocaleString()} ETB (${p.syncStatus})`,
            color: 'text-amber-700',
          })),
          timestamp: Date.now(),
        };
      }

      case 'top-counterparty': {
        const counterpartiesMap: Record<string, { total: number; count: number; bank: string; type: string }> = {};
        for (const p of validPayments) {
          if (p.category === 'alert' || !p.counterparty || p.counterparty.toLowerCase().includes('unknown')) continue;
          const name = p.counterparty.trim();
          if (!counterpartiesMap[name]) counterpartiesMap[name] = { total: 0, count: 0, bank: p.bank, type: p.type };
          counterpartiesMap[name].total += p.amount;
          counterpartiesMap[name].count += 1;
        }
        const sorted = Object.entries(counterpartiesMap).sort((a, b) => b[1].total - a[1].total);
        const top = sorted[0];
        if (!top) {
          return {
            id: createCardId('top-counterparty'),
            query: 'Top counterparty by volume',
            title: 'Top Counterparty',
            mainFigure: 'None Identified',
            subtext: 'No named counterparties extracted from messages yet.',
            timestamp: Date.now(),
          };
        }
        return {
          id: createCardId('top-counterparty'),
          query: 'Top counterparty by volume',
          title: `Leader: ${top[0]}`,
          mainFigure: `ETB ${top[1].total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          subtext: `${top[1].count} transactions across ${top[1].bank}`,
          details: sorted.slice(1, 4).map(([name, stat]) => ({
            label: name,
            value: `${stat.total.toLocaleString()} ETB (${stat.count} txns)`,
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
          query: 'Average transaction size',
          title: 'Ticket Size Intelligence (2026)',
          mainFigure: `ETB ${avg.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          subtext: `Computed across ${valid.length} non-alert transactions`,
          details: [
            { label: 'Avg Received Ticket', value: `+${avgIn.toFixed(2)} ETB (${rec.length} txns)`, color: 'text-emerald-700' },
            { label: 'Avg Sent Ticket', value: `-${avgOut.toFixed(2)} ETB (${sent.length} txns)`, color: 'text-rose-700' },
          ],
          timestamp: Date.now(),
        };
      }

      case 'projected-runrate': {
        const receivedTotal = validPayments.filter(p => p.type === 'received').reduce((acc, p) => acc + p.amount, 0);
        const dayOfMonth = Math.max(1, new Date().getDate());
        const daysInMonth = 30;
        const projected = (receivedTotal / dayOfMonth) * daysInMonth;
        return {
          id: createCardId('projected-runrate'),
          query: '2026 monthly run-rate',
          title: 'Projected Monthly Inflow Run-Rate',
          mainFigure: `ETB ${projected.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          subtext: `Based on current pace of ETB ${(receivedTotal / dayOfMonth).toFixed(2)}/day (day ${dayOfMonth} of ${daysInMonth})`,
          details: [
            { label: 'Actual Month-to-Date Inflow', value: `${receivedTotal.toLocaleString()} ETB`, color: 'text-emerald-700' },
            { label: 'Daily Average Velocity', value: `${(receivedTotal / dayOfMonth).toFixed(2)} ETB/day` },
          ],
          timestamp: Date.now(),
        };
      }

      case 'last-5': {
        const last5 = validPayments.slice(0, 5);
        return {
          id: createCardId('last-5'),
          query: 'Last 5 payments',
          title: 'Recent Transactions',
          mainFigure: `${last5.length} Recent Records`,
          subtext: 'Directly from native SQLite sms table',
          details: last5.map(p => ({
            label: `${p.counterparty} · ${p.bank}`,
            value: `${p.type === 'received' ? '+' : '-'}${p.amount.toLocaleString()} ETB`,
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

  const [cards, setCards] = useState<AnswerCard[]>([
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
    else if (q.includes('big') || q.includes('top')) matchedChip = 'biggest-payment';
    else if (q.includes('unsent') || q.includes('failed') || q.includes('pending')) matchedChip = 'unsent-failed';
    else if (q.includes('last') || q.includes('recent')) matchedChip = 'last-5';

    handleChipClick(matchedChip);
    setCustomQuery('');
  };

  const handleCopyFigure = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Calculator Functions
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
        // Safe math evaluation
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
      if (!isNaN(num)) {
        setCalcDisplay(String(num * 0.01));
      }
      return;
    }

    if (calcDisplay === '0' || calcDisplay === 'Error') {
      setCalcDisplay(val);
    } else {
      setCalcDisplay(calcDisplay + val);
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header View Switcher (Offline Insights vs Calculator) */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#14503F] to-emerald-500 text-white flex items-center justify-center shadow-xs">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
              Ejeta AI · Offline Intelligence
            </h2>
            <p className="text-[10px] text-slate-400">
              100% Offline SQLite queries & built-in financial calculator
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-xl">
          <button
            onClick={() => setActiveTab('insights')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'insights' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Insights
          </button>
          <button
            onClick={() => setActiveTab('calc')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              activeTab === 'calc' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            <Calculator size={12} />
            <span>Calc</span>
          </button>
        </div>
      </div>

      {activeTab === 'insights' ? (
        <div className="space-y-3.5">
          {/* 7 Required Shortcut Chips */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
              Quick SQLite Queries
            </span>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none snap-x">
              {SHORTCUT_CHIPS.map(chip => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleChipClick(chip.id)}
                  className="shrink-0 text-[11px] font-bold bg-white text-slate-700 hover:text-[#14503F] hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-300 px-3 py-1.5 rounded-xl shadow-2xs active:scale-95 transition-all snap-start"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Query Form */}
          <form onSubmit={handleCustomSubmit} className="flex gap-2">
            <input
              type="text"
              value={customQuery}
              onChange={e => setCustomQuery(e.target.value)}
              placeholder="e.g. CBE income, today, telebirr, biggest payment..."
              className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-[#14503F] shadow-xs"
            />
            <button
              type="submit"
              disabled={!customQuery.trim()}
              className="w-10 h-10 rounded-2xl bg-[#14503F] text-white flex items-center justify-center shadow-xs hover:bg-[#0e3b2e] disabled:opacity-40 transition-all shrink-0"
            >
              <Send size={14} />
            </button>
          </form>

          {/* Answer Cards Stack */}
          <div className="space-y-3 pt-1">
            {cards.map(card => (
              <div
                key={card.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-2.5 animate-in fade-in"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {card.query}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyFigure(card.id, card.mainFigure)}
                    className="text-[11px] text-[#14503F] font-bold hover:underline flex items-center gap-1"
                  >
                    {copiedId === card.id ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copiedId === card.id ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-500">
                    {card.title}
                  </h3>
                  <div className="text-2xl font-black text-slate-900 font-['Poppins',sans-serif] tracking-tight mt-0.5">
                    {card.mainFigure}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {card.subtext}
                  </p>
                </div>

                {card.details && card.details.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    {card.details.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 truncate max-w-[200px]">{d.label}</span>
                        <span className={`font-bold font-mono ${d.color || 'text-slate-900'}`}>
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
      ) : (
        /* Built-in Financial Calculator */
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3 max-w-sm mx-auto">
          {/* Display */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 text-right space-y-1 font-mono">
            <div className="text-xs text-slate-400 min-h-4 truncate">
              {calcFormula || 'Financial Calculator'}
            </div>
            <div className="text-3xl font-black tracking-tight truncate">
              {calcDisplay}
            </div>
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-4 gap-2">
            {['C', '%', 'DEL', '÷'].map(btn => (
              <button
                key={btn}
                type="button"
                onClick={() => handleCalcBtn(btn)}
                className={`py-3.5 rounded-2xl text-sm font-extrabold shadow-2xs active:scale-95 transition-all ${
                  btn === 'C' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                  btn === 'DEL' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  'bg-slate-100 text-slate-800'
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
                className={`py-3.5 rounded-2xl text-base font-extrabold shadow-2xs active:scale-95 transition-all ${
                  btn === '×' ? 'bg-emerald-50 text-[#14503F] border border-emerald-200' : 'bg-white border border-slate-200 text-slate-800'
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
                className={`py-3.5 rounded-2xl text-base font-extrabold shadow-2xs active:scale-95 transition-all ${
                  btn === '-' ? 'bg-emerald-50 text-[#14503F] border border-emerald-200' : 'bg-white border border-slate-200 text-slate-800'
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
                className={`py-3.5 rounded-2xl text-base font-extrabold shadow-2xs active:scale-95 transition-all ${
                  btn === '+' ? 'bg-emerald-50 text-[#14503F] border border-emerald-200' : 'bg-white border border-slate-200 text-slate-800'
                }`}
              >
                {btn}
              </button>
            ))}

            <button
              type="button"
              onClick={() => handleCalcBtn('0')}
              className="col-span-2 py-3.5 rounded-2xl bg-white border border-slate-200 text-base font-extrabold text-slate-800 shadow-2xs active:scale-95 transition-all"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleCalcBtn('.')}
              className="py-3.5 rounded-2xl bg-white border border-slate-200 text-base font-extrabold text-slate-800 shadow-2xs active:scale-95 transition-all"
            >
              .
            </button>
            <button
              type="button"
              onClick={() => handleCalcBtn('=')}
              className="py-3.5 rounded-2xl bg-[#14503F] text-white text-base font-extrabold shadow-md active:scale-95 transition-all"
            >
              =
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
