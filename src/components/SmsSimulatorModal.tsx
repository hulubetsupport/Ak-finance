import React, { useState, useMemo } from 'react';
import { X, Send, Smartphone, Sparkles, Check, ExternalLink } from 'lucide-react';
import { db } from '../services/db.ts';
import { AppSettings } from '../types/index.ts';
import { parseBankSms } from '../utils/smsParser.ts';

interface SmsSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSmsProcessed: () => void;
}

const SMS_TEMPLATES = [
  {
    name: 'Telebirr · Completed ATM Withdrawal (100 ETB)',
    sender: '127',
    message:
      'Dear Aymen The request to withdraw ETB 100.00 from your telebirr account 251996910607 via secret code 215822 on 2026-11-24 12:46:58 using Awash International Bank S C ATM with transaction number DK06LG3250 is successfully completed. The service fee (including 15% VAT) is ETB 0.57. Your current Account balance is ETB 1,785.36.To download your payment information please click this link: https://transactioninfo.ethiotelecom.et/receipt/DK06LG3250',
  },
  {
    name: 'Telebirr · ATM Secret Code OTP (Notice)',
    sender: '127',
    message:
      'Your ATM withdrawal secret code is 215822 for an amount of ETB 100.00. Please use this code before 2026-11-24 13:15:00.',
  },
  {
    name: 'CBE · Inward Credit with FT & v2 Link',
    sender: 'CBE',
    message:
      'Dear Customer, your account 1000****4819 has been credited with ETB 8,400.00 on 22-10-2026 15:42:10 by Meron Teshome with txn id FT2630981120. Your current balance is ETB 150,900.20. https://mbreciept.cbe.com.et/v2-CBE8400TEST',
  },
  {
    name: 'CBE · Transfer Missing FT (Triggers Retry FT)',
    sender: 'CBE',
    message:
      'Dear Customer, your account 1000****4819 has been credited with ETB 3,500.00 by Dawit Hailu. Your current balance is ETB 48,500.00.',
  },
  {
    name: 'Awash Bank · Credit SMS',
    sender: 'AwashBank',
    message:
      'Awash Bank: Your account 0132****3321 has been credited with ETB 15,000.00 on 22/10/2026 14:10:00 from Yohannes Girma with ref AW993102. Balance is ETB 79,120.50.',
  },
  {
    name: 'Dashen Bank · Debit Transfer',
    sender: 'Dashen',
    message:
      'Dear Customer, your Dashen Bank account 0021****5510 has been debited ETB 2,400.00 to Sara Kebede. Ref: DSH882104. Current Balance: ETB 19,600.00. https://receipts.dashenbanksc.com/receipt/DSH882104',
  },
  {
    name: 'BOA · Service Alert (Non-Financial)',
    sender: 'BOA',
    message:
      'Dear Customer, a new login to your Abyssinia Mobile Banking was detected on 24/11/2026. If not you, call 8397 immediately.',
  },
  {
    name: 'Zemen / Siinqee / M-Pesa Sample',
    sender: 'Zemen',
    message:
      'Zemen Bank: Your account 1034****12 has been credited with ETB 6,250.00 from Abebe Bikila. Ref: ZMN772190. Balance is ETB 42,100.00.',
  },
];

export const SmsSimulatorModal: React.FC<SmsSimulatorModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSmsProcessed,
}) => {
  const [sender, setSender] = useState(SMS_TEMPLATES[0].sender);
  const [message, setMessage] = useState(SMS_TEMPLATES[0].message);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  // Live deterministic parser preview
  const livePreview = useMemo(() => {
    if (!message.trim()) return null;
    return parseBankSms(sender || 'Bank', message);
  }, [sender, message]);

  // AI Fallback preview
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPreview, setAiPreview] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleSelectTemplate = (tpl: (typeof SMS_TEMPLATES)[0]) => {
    setSender(tpl.sender);
    setMessage(tpl.message);
    setAiPreview(null);
    setAiError(null);
  };

  const handleAiParse = async () => {
    if (!message.trim()) return;
    setAiLoading(true);
    setAiError(null);
    const res = await db.analyzeRawSmsWithAi(sender, message);
    setAiLoading(false);
    if (res.ok && res.parsed) {
      setAiPreview(res.parsed);
    } else {
      setAiError(res.error || 'AI parser not available.');
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setIsSubmitting(true);
    try {
      await db.insertTestSms(sender || 'Bank', message.trim());
      setSuccessNotice(true);
      onSmsProcessed();
      setTimeout(() => {
        setSuccessNotice(false);
        onClose();
      }, 800);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl p-5 border border-slate-200 shadow-xl max-h-[92dvh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#0F4C3A] flex items-center justify-center">
              <Smartphone size={16} />
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Capture &amp; Parse Bank SMS
              </h3>
              <p className="text-xs text-slate-500">
                Autonomous offline parser for all Ethiopian banks
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close capture modal"
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sender Input */}
        <div className="space-y-1">
          <label htmlFor="sms-sender-input" className="text-xs font-semibold text-slate-700 block">
            Sender Address
          </label>
          <input
            id="sms-sender-input"
            type="text"
            value={sender}
            onChange={e => setSender(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0F4C3A]"
            placeholder="127, CBE, AwashBank, Dashen, BOA, Zemen, Siinqee..."
          />
        </div>

        {/* Presets */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-700 block">Sample Bank SMS Presets</span>
          <div className="flex flex-wrap gap-1.5">
            {SMS_TEMPLATES.map((tpl, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                  sender === tpl.sender && message === tpl.message
                    ? 'border-[#0F4C3A] bg-emerald-50 text-[#0F4C3A] font-semibold'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tpl.name}
              </button>
            ))}
          </div>
        </div>

        {/* Message Body */}
        <div className="space-y-1">
          <label htmlFor="sms-body-input" className="text-xs font-semibold text-slate-700 block">
            Full SMS Text
          </label>
          <textarea
            id="sms-body-input"
            rows={4}
            value={message}
            onChange={e => {
              setMessage(e.target.value);
              setAiPreview(null);
            }}
            className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#0F4C3A]"
            placeholder="Paste raw bank SMS text..."
          />
        </div>

        {/* Live Local Parser Preview */}
        {livePreview && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800">Local Auto-Parse Preview</span>
              {settings.aiEnabled !== false && (
                <button
                  type="button"
                  onClick={handleAiParse}
                  disabled={aiLoading}
                  className="text-xs font-semibold text-[#0F4C3A] hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  <Sparkles size={12} />
                  <span>{aiLoading ? 'Analyzing...' : 'Analyze with Gemini AI'}</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 block">Bank</span>
                <span className="font-semibold text-slate-900">{livePreview.bank}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Type &amp; Category</span>
                <span className="font-semibold text-slate-900 capitalize">
                  {livePreview.type} · {livePreview.category}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Amount</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {livePreview.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                </span>
              </div>
              {livePreview.fee !== undefined && (
                <div>
                  <span className="text-[11px] text-slate-500 block">Service Fee</span>
                  <span className="font-mono font-semibold text-slate-800 tabular-nums">
                    {livePreview.fee.toFixed(2)} ETB
                  </span>
                </div>
              )}
              {livePreview.balance !== undefined && (
                <div>
                  <span className="text-[11px] text-slate-500 block">Post-Balance</span>
                  <span className="font-mono font-semibold text-slate-800 tabular-nums">
                    {livePreview.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                  </span>
                </div>
              )}
              <div>
                <span className="text-[11px] text-slate-500 block">Counterparty</span>
                <span className="font-medium text-slate-800 truncate block">
                  {livePreview.counterparty || '—'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Ref / Code</span>
                <span className="font-mono font-semibold text-slate-800 truncate block">
                  {livePreview.reference || '—'}
                </span>
              </div>
            </div>

            {livePreview.receiptUrl && (
              <div className="pt-1 border-t border-slate-200 text-[11px] font-mono text-[#0F4C3A] truncate flex items-center gap-1">
                <ExternalLink size={11} className="shrink-0" />
                <span className="truncate">{livePreview.receiptUrl}</span>
              </div>
            )}

            {aiError && (
              <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                {aiError}
              </div>
            )}

            {aiPreview && (
              <div className="pt-2 border-t border-slate-200 text-xs space-y-1">
                <div className="font-semibold text-[#0F4C3A]">Gemini AI Extraction:</div>
                <div className="font-mono text-[11px] text-slate-700">
                  {aiPreview.bank} · {aiPreview.type}/{aiPreview.category} · {aiPreview.amount} ETB · {aiPreview.counterparty || 'N/A'} · Ref: {aiPreview.reference || 'N/A'}
                </div>
              </div>
            )}
          </div>
        )}

        {settings.mode === 'server' && settings.serverUrl?.trim() && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900">
            <span className="font-semibold">HuluBet Server Sync active ({settings.deviceLabel || 'Owner'}):</span>{' '}
            Telebirr (127) and CBE SMS will forward automatically to <span className="font-mono">/webhook/sms</span> with offline retry protection.
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isSubmitting || !message.trim()}
          className="w-full min-h-[44px] py-2.5 rounded-xl bg-[#0F4C3A] text-white text-xs font-semibold hover:bg-[#0B3A2C] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {successNotice ? (
            <>
              <Check size={14} />
              <span>Saved to Local Ledger</span>
            </>
          ) : (
            <>
              <Send size={14} />
              <span>{isSubmitting ? 'Saving...' : 'Save SMS to Ledger'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
