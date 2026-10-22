import React, { useState } from 'react';
import { PaymentRecord, AppSettings, Account } from '../types/index.ts';
import { Sparkles, Send, Bot, ShieldCheck, ArrowRight, CornerDownLeft } from 'lucide-react';

interface EjetaAiTabProps {
  payments: PaymentRecord[];
  accounts: Account[];
  settings: AppSettings;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ejeta';
  text: string;
  timestamp: number;
}

export const EjetaAiTab: React.FC<EjetaAiTabProps> = ({
  payments,
  accounts,
  settings,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'ejeta',
      text: settings.language === 'am' 
        ? 'ሰላም! እኔ እጀታ AI (Ejeta AI) የክፍያ ረዳትዎ ነኝ። ስለተቀበሏቸው ክፍያዎች፣ ያልተላኩ የSMS ወረፋዎች ወይም የተወሰኑ የባንክ ግብይቶች ማንኛውንም ጥያቄ ይጠይቁኝ።'
        : 'Hello! I am Ejeta AI, your business payment desk auditor. Ask me anything about your captured bank payments, customer transfers, reconciliations, or offline queue status.',
      timestamp: Date.now() - 1000 * 60,
    },
  ]);
  const [query, setQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const QUICK_QUESTIONS = [
    settings.language === 'am' ? 'የዛሬውን የCBE ጠቅላላ ገቢ አጠቃልልኝ' : "Summarize today's CBE income",
    settings.language === 'am' ? 'ከአበበ ከበደ የተላከ ክፍያ አለ?' : 'Did Abebe Kebede send any payment?',
    settings.language === 'am' ? 'ያልተላኩ (Pending) ክፍያዎች ስንት ናቸው?' : 'How many payments are pending in queue?',
    settings.language === 'am' ? 'ከፍተኛ ክፍያ የፈጸሙ ደንበኞች እነማን ናቸው?' : 'Who are our top paying customers?',
  ];

  const handleSend = (textToSend?: string) => {
    const q = (textToSend || query).trim();
    if (!q) return;

    const userMsg: ChatMessage = {
      id: 'usr-' + Date.now(),
      sender: 'user',
      text: q,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setIsTyping(true);

    // AI logic over the local payments database
    setTimeout(() => {
      const lower = q.toLowerCase();
      let response = '';

      if (lower.includes('cbe')) {
        const cbe = payments.filter(p => p.bank.toLowerCase().includes('cbe') && p.type === 'received');
        const sum = cbe.reduce((acc, p) => acc + p.amount, 0);
        response = `CBE Inward Payments: I found ${cbe.length} successful received payments totaling ETB ${sum.toLocaleString('en-US', { minimumFractionDigits: 2 })} across your accounts. Latest txn: ${cbe[0]?.reference || 'N/A'}.`;
      } else if (lower.includes('abebe') || lower.includes('kebede')) {
        const abebe = payments.find(p => p.counterparty.toLowerCase().includes('abebe'));
        if (abebe) {
          response = `Yes! Found payment of ETB ${abebe.amount.toLocaleString()} from ${abebe.counterparty} on ${new Date(abebe.timestamp).toLocaleDateString()} (${abebe.bank}, Ref: ${abebe.reference}). Status: ${abebe.syncStatus.toUpperCase()}.`;
        } else {
          response = `No transactions from "Abebe Kebede" located in your local captured database.`;
        }
      } else if (lower.includes('pending') || lower.includes('queue') || lower.includes('unsent') || lower.includes('ወረፋ')) {
        const pending = payments.filter(p => p.syncStatus === 'pending' || p.syncStatus === 'failed');
        response = pending.length > 0
          ? `There are currently ${pending.length} unsent payments in the offline SQLite queue awaiting HTTP 200 acknowledgment from ${settings.serverUrl}. The auto-retry worker checks every ${settings.retryIntervalSeconds}s.`
          : `All captured payments have been successfully synced (HTTP 200 OK) to your Render webhook! Queue is 100% clean.`;
      } else if (lower.includes('top') || lower.includes('customer') || lower.includes('ደንበኞች')) {
        const tops = [...payments].filter(p => p.type === 'received').sort((a, b) => b.amount - a.amount).slice(0, 3);
        response = `Top captured payments:\n1. ${tops[0]?.counterparty}: ETB ${tops[0]?.amount.toLocaleString()} (${tops[0]?.bank})\n2. ${tops[1]?.counterparty}: ETB ${tops[1]?.amount.toLocaleString()} (${tops[1]?.bank})\n3. ${tops[2]?.counterparty}: ETB ${tops[2]?.amount.toLocaleString()} (${tops[2]?.bank})`;
      } else {
        const total = payments.reduce((acc, p) => p.type === 'received' ? acc + p.amount : acc - p.amount, 0);
        response = `Audit summary: Captured ${payments.length} SMS payments across ${accounts.length} monitored accounts. Net movement is ETB ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Monitored senders: ${settings.allowedSenders.join(', ')}.`;
      }

      const aiMsg: ChatMessage = {
        id: 'ai-' + Date.now(),
        sender: 'ejeta',
        text: response,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] pb-20">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200/60 mb-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#14503F] to-emerald-400 text-white flex items-center justify-center shadow-xs">
          <Sparkles size={16} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
            Ejeta AI Assistant
          </h2>
          <p className="text-[10px] text-slate-400">
            Local smart reconciler & fraud verification
          </p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map(m => (
          <div
            key={m.id}
            className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                m.sender === 'user'
                  ? 'bg-[#14503F] text-white rounded-br-none shadow-xs'
                  : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none shadow-xs whitespace-pre-line'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none p-3 shadow-xs flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      {/* Suggested Quick Prompts */}
      <div className="pt-2 pb-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {QUICK_QUESTIONS.map((q, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(q)}
              className="shrink-0 text-[11px] bg-emerald-50 text-[#14503F] border border-emerald-200/80 px-2.5 py-1 rounded-full font-medium hover:bg-emerald-100 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input row */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 pt-1"
      >
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={settings.language === 'am' ? 'ጥያቄዎን እዚህ ያስገቡ...' : 'Ask Ejeta about any payment...'}
          className="flex-1 px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-[#14503F] shadow-xs"
        />
        <button
          type="submit"
          disabled={!query.trim()}
          className="w-10 h-10 rounded-2xl bg-[#14503F] text-white flex items-center justify-center shadow-xs hover:bg-[#0e3b2e] disabled:opacity-40 transition-all shrink-0"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};
