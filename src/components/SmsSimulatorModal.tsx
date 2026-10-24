import React, { useState } from 'react';
import { X, Send, Smartphone, Sparkles, Check } from 'lucide-react';
import { db } from '../services/db.ts';
import { AppSettings } from '../types/index.ts';

interface SmsSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSmsProcessed: () => void;
}

const SMS_TEMPLATES = [
  {
    name: 'CBE · Inward Credit (8,400 ETB)',
    sender: 'CBE',
    message: 'Dear Customer, your account 1000****4819 has been credited with ETB 8,400.00 on 22-10-2026 15:42:10 by Meron Teshome with txn id FT2630981120. Your current balance is ETB 150,900.20. Thank you for banking with CBE!',
  },
  {
    name: 'Telebirr · Received (2,800 ETB)',
    sender: 'Telebirr',
    message: 'You have received ETB 2,800.00 from Dawit Haile (0912345678) on 2026-10-22 15:30:00. Transaction ID: 10E9944P1. Your current balance is ETB 31,200.00.',
  },
  {
    name: 'Awash Bank · Inward (15,000 ETB)',
    sender: 'AwashBank',
    message: 'Awash Bank: Your account 0132****3321 has been credited with ETB 15,000.00 on 22/10/2026 14:10:00 from Yohannes Girma with ref FT993102AW. Balance is ETB 79,120.50.',
  },
  {
    name: 'CBE · Outward Debit (-4,200 ETB)',
    sender: '127',
    message: 'Dear Customer, your account 1000****4819 has been debited with ETB 4,200.00 on 22-10-2026 12:20:00 to Addis Supplier Ltd with txn id FT2630971100. Your current balance is ETB 146,700.20.',
  },
];

export const SmsSimulatorModal: React.FC<SmsSimulatorModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSmsProcessed,
}) => {
  const [sender, setSender] = useState('CBE');
  const [message, setMessage] = useState(SMS_TEMPLATES[0].message);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  if (!isOpen) return null;

  const handleSelectTemplate = (tpl: typeof SMS_TEMPLATES[0]) => {
    setSender(tpl.sender);
    setMessage(tpl.message);
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setIsSubmitting(true);
    try {
      // Inserts through native Sync.save() and goes through the exact same SQLite + HTTP pipeline
      await db.insertTestSms(sender || 'CBE', message.trim());
      setSuccessNotice(true);
      onSmsProcessed();
      setTimeout(() => {
        setSuccessNotice(false);
        onClose();
      }, 1000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#14503F] flex items-center justify-center">
              <Smartphone size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                Send Test Bank SMS
              </h3>
              <p className="text-[11px] text-slate-400">
                Processed via native Sync.save() &amp; SQLite pipeline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sender Input */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700">Sender Address</label>
          <input
            type="text"
            value={sender}
            onChange={e => setSender(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-medium focus:outline-none focus:border-[#14503F]"
            placeholder="CBE, 127, Telebirr, AwashBank, Dashen, BOA"
          />
        </div>

        {/* Preset Templates */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <Sparkles size={13} className="text-amber-500" />
            <span>Bank SMS Presets</span>
          </label>
          <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
            {SMS_TEMPLATES.map((tpl, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className={`p-2 rounded-xl border text-left text-xs transition-all ${
                  sender === tpl.sender && message === tpl.message
                    ? 'border-[#14503F] bg-emerald-50 text-[#14503F] font-bold'
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
          <label className="text-xs font-bold text-slate-700">SMS Body</label>
          <textarea
            rows={4}
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-[#14503F]"
            placeholder="Raw SMS message text..."
          />
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isSubmitting || !message.trim()}
          className="w-full py-2.5 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-md hover:bg-[#0e3b2e] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {successNotice ? (
            <>
              <Check size={14} className="text-emerald-300" />
              <span>Saved to SQLite &amp; Triggered Sync!</span>
            </>
          ) : (
            <>
              <Send size={14} />
              <span>{isSubmitting ? 'Saving...' : 'Inject via Sync.save()'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
