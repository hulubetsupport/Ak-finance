import React, { useState } from 'react';
import { WithdrawalRecord, Account, AppSettings } from '../types/index.ts';
import { translations } from '../utils/i18n.ts';
import { Plus, ArrowUpRight, Calendar, User, FileText, Trash2, Check, Banknote } from 'lucide-react';

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
    <div className="space-y-4 pb-20">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 font-['Poppins',sans-serif]">
            {t.withdrawals}
          </h2>
          <p className="text-xs text-slate-400">
            {isAm ? 'የንግድ ወጪ እና የጥሬ ገንዘብ ማውጫ' : 'Record store expenses and branch cash disbursements'}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3.5 py-2 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-sm hover:bg-[#0e3b2e] active:scale-95 flex items-center gap-1.5 transition-all"
        >
          <Plus size={14} />
          <span>{t.recordWithdrawal}</span>
        </button>
      </div>

      {/* Summary Total Card */}
      <div className="bg-gradient-to-br from-amber-600 to-amber-800 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
        <div className="text-xs font-semibold text-amber-100 uppercase tracking-wider">
          {t.totalWithdrawn}
        </div>
        <div className="text-2xl font-extrabold mt-1 font-['Poppins',sans-serif]">
          {settings.hideBalances ? '••••••' : `${totalWithdrawn.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB`}
        </div>
        <div className="text-[11px] text-amber-200/80 mt-1">
          {withdrawals.length} {isAm ? 'የተመዘገቡ ወጪዎች' : 'recorded cash out vouchers'}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {withdrawals.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-slate-200">
            <Banknote className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-700">
              {isAm ? 'ምንም የወጪ መዝገብ የለም' : 'No recorded withdrawals yet'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isAm ? 'ወጪዎችን ለመመዝገብ ከላይ ያለውን ቁልፍ ይጫኑ' : 'Click "Record Withdrawal" to deduct expenses from accounts.'}
            </p>
          </div>
        ) : (
          withdrawals.map(w => (
            <div
              key={w.id}
              className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/60">
                  <ArrowUpRight size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
                    {w.recipient}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {w.bank} · {w.date}
                  </div>
                  {w.note && (
                    <div className="text-[10px] text-slate-400 italic mt-0.5">
                      "{w.note}"
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-sm font-extrabold text-rose-600 font-['Poppins',sans-serif]">
                    -{w.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {w.reference}
                  </span>
                </div>
                <button
                  onClick={() => onDeleteWithdrawal(w.id)}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                  title="Delete record"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Record Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
            <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif] pb-2 border-b border-slate-100">
              {t.recordWithdrawal}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.amount}
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  placeholder="e.g. 5000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F] font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.bankLabel}
                </label>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F]"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.bank}) - Balance: {acc.balance.toLocaleString()} ETB
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.recipient}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Branch Cashier, Supplier, Logistics"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.dateLabel}
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.note}
                </label>
                <textarea
                  rows={2}
                  placeholder="Reason for cash out..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-md hover:bg-[#0e3b2e]"
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
