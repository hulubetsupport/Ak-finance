import React, { useState } from 'react';
import { WithdrawalRecord, Account, AppSettings } from '../types/index.ts';
import { translations } from '../utils/i18n.ts';
import { Plus, ArrowUpRight, Trash2, Banknote } from 'lucide-react';

interface WithdrawalsTabProps {
  withdrawals: WithdrawalRecord[];
  accounts: Account[];
  settings: AppSettings;
  onAddWithdrawal: (w: Omit<WithdrawalRecord, 'id' | 'timestamp'>) => Promise<void>;
  onDeleteWithdrawal: (id: string) => Promise<void>;
}

export const WithdrawalsTab: React.FC<WithdrawalsTabProps> = ({
  withdrawals,
  accounts,
  settings,
  onAddWithdrawal,
  onDeleteWithdrawal,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const t = translations[settings.language];
  const isAm = settings.language === 'am';

  const totalWithdrawn = withdrawals.reduce((acc, w) => acc + (w.amount || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(num) || num <= 0) return;

    setIsSubmitting(true);
    try {
      const selectedAcc = accounts.find(a => a.id === accountId);
      await onAddWithdrawal({
        amount: num,
        date,
        bank: selectedAcc ? selectedAcc.name : 'Business Account',
        accountId,
        recipient: recipient.trim() || 'Internal Cash Transfer',
        note: note.trim() || 'Business withdrawal',
        reference: 'WDR-' + Date.now().toString().slice(-6),
      });
      setShowModal(false);
      setAmount('');
      setRecipient('');
      setNote('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">{t.withdrawals}</h2>
          <p className="text-xs text-slate-500">
            {isAm ? 'የንግድ ወጪ እና የጥሬ ገንዘብ ማውጫ' : 'Store expenses & manual cash disbursements'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="px-3.5 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold hover:bg-[#0B3B2E] flex items-center gap-1.5 whitespace-nowrap"
        >
          <Plus size={14} />
          <span>{t.recordWithdrawal}</span>
        </button>
      </div>

      <div className="bg-[#0B3B2E] text-white rounded-xl p-4">
        <div className="text-xs font-medium text-emerald-200 uppercase tracking-wider">
          {t.totalWithdrawn}
        </div>
        <div className="text-2xl font-bold mt-1 tabular-nums">
          {settings.hideBalances ? '••••••' : `${totalWithdrawn.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB`}
        </div>
        <div className="text-xs text-emerald-200/80 mt-1">
          {withdrawals.length} {isAm ? 'የተመዘገቡ ወጪዎች' : 'recorded vouchers'}
        </div>
      </div>

      <div className="space-y-2">
        {withdrawals.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-dashed border-slate-300">
            <Banknote className="w-9 h-9 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-700">
              {isAm ? 'ምንም የወጪ መዝገብ የለም' : 'No recorded withdrawals yet'}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {isAm ? 'ወጪዎችን ለመመዝገብ ከላይ ያለውን ቁልፍ ይጫኑ' : 'Click "Record Withdrawal" to log cash disbursements.'}
            </p>
          </div>
        ) : (
          withdrawals.map(w => (
            <div
              key={w.id}
              className="bg-white rounded-xl p-3.5 border border-slate-200 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
                  <ArrowUpRight size={16} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{w.recipient}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {w.bank} · {w.date} {w.note ? `· "${w.note}"` : ''}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-bold text-rose-700 tabular-nums">
                    -{w.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">{w.reference}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteWithdrawal(w.id)}
                  aria-label={`Delete withdrawal ${w.recipient}`}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 flex items-center justify-center"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              {t.recordWithdrawal}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.amount}</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  placeholder="e.g. 5000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-bold tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.bankLabel}</label>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.bank}) — {acc.balance.toLocaleString()} ETB
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.recipient}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Branch Cashier, Supplier"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.dateLabel}</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{t.note}</label>
                <textarea
                  rows={2}
                  placeholder="Reason for cash out..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold"
                >
                  {isSubmitting ? 'Recording...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
