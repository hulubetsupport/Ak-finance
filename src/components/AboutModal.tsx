import React, { useState } from 'react';
import {
  Building2,
  ShieldCheck,
  ExternalLink,
  X,
  CheckCircle2,
  Sparkles,
  Play,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { openAndroidAppSettings, openAndroidBatterySettings } from '../utils/nativeBridge.ts';
import {
  parseBankSms,
  OFFICIAL_PARSER_BENCHMARKS,
  ParsedPayment,
} from '../utils/smsParser.ts';
import { BANK_PRESETS } from '../constants/bankBrands.ts';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'about' | 'parser-test'>('about');
  const [customSmsInput, setCustomSmsInput] = useState('');
  const [customSenderInput, setCustomSenderInput] = useState('127');
  const [customParsedResult, setCustomParsedResult] = useState<ParsedPayment | null>(null);

  if (!isOpen) return null;

  const handleTestCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSmsInput.trim()) return;
    const res = parseBankSms(customSenderInput.trim() || '127', customSmsInput.trim());
    setCustomParsedResult(res);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl p-5 border border-slate-200 space-y-4 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0F4C3A] text-white flex items-center justify-center">
              <Building2 size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Ak Finance</h3>
              <p className="text-xs text-slate-500">
                Standalone Ethiopian Multi-Bank Ledger & SMS Engine
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close about modal"
            className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-900"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${
              activeTab === 'about' ? 'bg-white text-slate-900 border border-slate-200' : 'text-slate-600'
            }`}
          >
            About & Banks ({BANK_PRESETS.length}+)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('parser-test')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 ${
              activeTab === 'parser-test' ? 'bg-[#0F4C3A] text-white' : 'text-slate-600'
            }`}
          >
            <Sparkles size={13} />
            <span>Parser Benchmark</span>
          </button>
        </div>

        {activeTab === 'about' ? (
          <div className="space-y-4">
            <div className="bg-[#0B3B2E] text-white p-4 rounded-xl space-y-1">
              <div className="text-sm font-bold">
                Ak Finance v3.0 · Autonomous Multi-Bank Edition
              </div>
              <p className="text-xs text-emerald-100/90 leading-relaxed">
                Parses all Ethiopian bank & mobile money SMS locally without requiring a server, tracks fees and official receipts, and lets you sync to a server anytime.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <ShieldCheck size={15} className="text-[#0F4C3A]" />
                <span>Android 13/14+ Background SMS Setup</span>
              </div>
              <ol className="list-decimal list-inside text-xs text-slate-600 space-y-1">
                <li>Open App Info → top-right ⋮ → Allow restricted settings</li>
                <li>Grant SMS read permission for automatic capture</li>
                <li>Set Battery usage to Unrestricted</li>
              </ol>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={openAndroidAppSettings}
                  className="flex-1 py-2 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <ExternalLink size={12} />
                  <span>App Info</span>
                </button>
                <button
                  type="button"
                  onClick={openAndroidBatterySettings}
                  className="flex-1 py-2 px-3 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold"
                >
                  Battery Settings
                </button>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="text-xs font-bold text-slate-900">
                Supported Ethiopian Banks & Wallets
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs max-h-48 overflow-y-auto">
                {BANK_PRESETS.map(b => (
                  <div key={b.shortCode} className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="font-mono font-bold text-slate-900">{b.shortCode}</span>
                    <span className="text-slate-500 block text-[11px] truncate">{b.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <form onSubmit={handleTestCustom} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">Live Test Custom SMS</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customSenderInput}
                  onChange={e => setCustomSenderInput(e.target.value)}
                  placeholder="Sender"
                  className="w-24 px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-200 rounded-lg bg-white"
                />
                <input
                  type="text"
                  value={customSmsInput}
                  onChange={e => setCustomSmsInput(e.target.value)}
                  placeholder="Paste real SMS body..."
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#0F4C3A] text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0"
                >
                  <Play size={12} />
                  <span>Parse</span>
                </button>
              </div>

              {customParsedResult && (
                <div className="mt-2 p-2.5 bg-white rounded-lg border border-slate-200 text-xs space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Bank:</span>
                    <span className="font-bold text-slate-900">{customParsedResult.bank}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Direction / Category:</span>
                    <span className="font-bold text-emerald-800">{customParsedResult.type} ({customParsedResult.category})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Amount:</span>
                    <span className="font-bold text-slate-900">ETB {customParsedResult.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Ref:</span>
                    <span className="font-bold text-slate-900">{customParsedResult.reference || 'None'}</span>
                  </div>
                </div>
              )}
            </form>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {OFFICIAL_PARSER_BENCHMARKS.map(sample => {
                const parsed = parseBankSms(sample.sender, sample.raw);
                const isSent = parsed.type === 'sent';
                const isPass =
                  parsed.bank === sample.expectedBank &&
                  parsed.type === sample.expectedType &&
                  parsed.amount === sample.expectedAmount;

                return (
                  <div key={sample.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">#{sample.sampleNum} · {sample.title}</span>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${isPass ? 'text-emerald-700' : 'text-rose-700'}`}>
                        <CheckCircle2 size={12} /> {isPass ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono bg-slate-50 p-2 rounded-lg line-clamp-2">{sample.raw}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-700">
                      <span>{parsed.bank}</span>
                      <span className="inline-flex items-center gap-0.5 font-semibold">
                        {isSent ? <ArrowUpRight size={11} /> : <ArrowDownLeft size={11} />}
                        {parsed.type} ({parsed.category})
                      </span>
                      <span className="font-mono font-semibold tabular-nums">ETB {parsed.amount.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
