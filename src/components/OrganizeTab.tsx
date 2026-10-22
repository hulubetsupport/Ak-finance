import React, { useState } from 'react';
import { Account, AppSettings } from '../types/index.ts';
import { translations } from '../utils/i18n.ts';
import { Layers, Plus, Send, Edit2, Trash2, Smartphone, Building2, Store, Check, ExternalLink } from 'lucide-react';

interface OrganizeTabProps {
  accounts: Account[];
  settings: AppSettings;
  onUpdateAccounts: (accounts: Account[]) => Promise<void>;
}

export const OrganizeTab: React.FC<OrganizeTabProps> = ({
  accounts,
  settings,
  onUpdateAccounts,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [bank, setBank] = useState('CBE');
  const [accountNumber, setAccountNumber] = useState('');
  const [balance, setBalance] = useState('');
  const [accent, setAccent] = useState<Account['accent']>('indigo');
  const [type, setType] = useState<Account['type']>('operating');

  const t = translations[settings.language];
  const isAm = settings.language === 'am';

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !accountNumber.trim()) return;

    const num = parseFloat(balance) || 0;
    const last4 = accountNumber.slice(-4);

    const newAcc: Account = {
      id: 'acc-' + Date.now(),
      name: name.trim(),
      bank,
      type,
      accountNumber: accountNumber.trim(),
      maskedNumber: `•••• ${last4}`,
      balance: num,
      accent,
    };

    await onUpdateAccounts([...accounts, newAcc]);
    setShowAddModal(false);
    setName('');
    setAccountNumber('');
    setBalance('');
  };

  const handleDeleteAccount = async (id: string) => {
    if (accounts.length <= 1) {
      alert('Must retain at least 1 primary account.');
      return;
    }
    await onUpdateAccounts(accounts.filter(a => a.id !== id));
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 font-['Poppins',sans-serif]">
            {isAm ? 'ማደራጃ እና ሂሳቦች' : 'Organize & Accounts'}
          </h2>
          <p className="text-xs text-slate-400">
            {isAm ? 'የባንክ ሂሳቦችን ያስተዳድሩ እና በቡድን ይክፈሉ' : 'Manage your collection bank accounts & verification channels'}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-sm hover:bg-[#0e3b2e] active:scale-95 flex items-center gap-1.5 transition-all"
        >
          <Plus size={14} />
          <span>{isAm ? 'አዲስ ሂሳብ' : 'Add Account'}</span>
        </button>
      </div>

      {/* Telegram Verification Integration Card */}
      <div className="bg-gradient-to-r from-sky-500 to-sky-700 text-white rounded-2xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
              <Send size={18} />
            </div>
            <div>
              <div className="text-xs font-bold font-['Poppins',sans-serif]">
                Telegram Payment Verification Bot
              </div>
              <p className="text-[11px] text-sky-100 mt-0.5 max-w-[240px]">
                Connect your business Telegram bot to query real-time payments directly inside chat.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded-full">
            Active
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-sky-400/40 flex items-center justify-between text-xs">
          <span className="font-mono text-sky-100 text-[11px]">@AkFinancePaymentDesk_bot</span>
          <button
            onClick={() => alert('Telegram bot token configured with webhook callback.')}
            className="text-[11px] font-bold text-white hover:underline flex items-center gap-1"
          >
            <span>Configure</span>
            <ExternalLink size={12} />
          </button>
        </div>
      </div>

      {/* Accounts List */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
          {isAm ? 'ንቁ የንግድ ሂሳቦች' : 'Active Financial Accounts'} ({accounts.length})
        </div>

        {accounts.map(acc => (
          <div
            key={acc.id}
            className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                acc.accent === 'blue' ? 'bg-blue-600' :
                acc.accent === 'gold' ? 'bg-amber-600' :
                acc.accent === 'indigo' ? 'bg-indigo-600' : 'bg-[#14503F]'
              }`}>
                {acc.type === 'mobile' ? <Smartphone size={18} /> :
                 acc.type === 'shop' ? <Store size={18} /> : <Building2 size={18} />}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
                  {acc.name}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {acc.bank} · <span className="font-mono">{acc.maskedNumber}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-extrabold text-slate-900 font-['Poppins',sans-serif]">
                  {settings.hideBalances ? '••••' : `+${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB`}
                </div>
                <span className="text-[10px] text-slate-400 capitalize">{acc.type}</span>
              </div>
              <button
                onClick={() => handleDeleteAccount(acc.id)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                title="Remove account"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
            <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif] pb-2 border-b border-slate-100">
              Add Monitored Account
            </h3>

            <form onSubmit={handleAddAccount} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Account Label / Nickname
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Merkato Branch Shop POS"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Financial Institution
                </label>
                <select
                  value={bank}
                  onChange={e => setBank(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F]"
                >
                  <option value="CBE">CBE (Commercial Bank of Ethiopia)</option>
                  <option value="Telebirr">Telebirr Merchant / Ethio telecom</option>
                  <option value="Awash Bank">Awash Bank</option>
                  <option value="Dashen Bank">Dashen Bank</option>
                  <option value="Bank of Abyssinia">Bank of Abyssinia</option>
                  <option value="Coop Bank">Cooperative Bank of Oromia</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Account Number / Till ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 100099283711"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Initial Balance (ETB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={balance}
                  onChange={e => setBalance(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Card Accent Color
                  </label>
                  <select
                    value={accent}
                    onChange={e => setAccent(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F]"
                  >
                    <option value="blue">Blue (Mobile)</option>
                    <option value="indigo">Indigo (Operating)</option>
                    <option value="gold">Gold (Shop POS)</option>
                    <option value="emerald">Emerald (Treasury)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Account Classification
                  </label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F]"
                  >
                    <option value="operating">Operating</option>
                    <option value="mobile">Mobile Collections</option>
                    <option value="shop">Shop Collections</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-md hover:bg-[#0e3b2e]"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
