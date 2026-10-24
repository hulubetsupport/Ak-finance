import React, { useState } from 'react';
import { Account, AppSettings } from '../types/index.ts';
import { 
  Building2, 
  Smartphone, 
  ChevronRight, 
  Plus, 
  Sparkles, 
  Check, 
  X, 
  Edit3, 
  ArrowUpRight, 
  ArrowDownLeft,
  DollarSign
} from 'lucide-react';

interface AccountsCardStackProps {
  accounts: Account[];
  settings: AppSettings;
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string | null) => void;
  onManageAccounts: () => void;
  onSaveOpeningBalance: (bank: string, amount: number) => Promise<void>;
  onAddCustomBank?: (bankName: string) => Promise<void>;
}

const BANK_BRAND_THEMES: Record<string, { bg: string; badge: string; textBadge: string; logo: string }> = {
  'Telebirr': {
    bg: 'bg-gradient-to-br from-[#0284c7] via-[#0ea5e9] to-[#38bdf8]',
    badge: 'bg-sky-900/30 text-white border-sky-300/40',
    textBadge: 'TLB',
    logo: 'Telebirr',
  },
  'CBE': {
    bg: 'bg-gradient-to-br from-[#581c87] via-[#7e22ce] to-[#9333ea]',
    badge: 'bg-purple-950/30 text-white border-purple-300/40',
    textBadge: 'CBE',
    logo: 'Commercial Bank of Ethiopia',
  },
  'Commercial Bank of Ethiopia': {
    bg: 'bg-gradient-to-br from-[#581c87] via-[#7e22ce] to-[#9333ea]',
    badge: 'bg-purple-950/30 text-white border-purple-300/40',
    textBadge: 'CBE',
    logo: 'Commercial Bank of Ethiopia',
  },
  'Awash Bank': {
    bg: 'bg-gradient-to-br from-[#0c4a6e] via-[#0369a1] to-[#0284c7]',
    badge: 'bg-sky-950/30 text-amber-300 border-amber-300/40',
    textBadge: 'AWA',
    logo: 'Awash Bank',
  },
  'Dashen Bank': {
    bg: 'bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4338ca]',
    badge: 'bg-indigo-950/30 text-yellow-300 border-yellow-300/40',
    textBadge: 'DSH',
    logo: 'Dashen Bank',
  },
  'Bank of Abyssinia': {
    bg: 'bg-gradient-to-br from-[#78350f] via-[#b45309] to-[#d97706]',
    badge: 'bg-amber-950/30 text-amber-100 border-amber-300/40',
    textBadge: 'BOA',
    logo: 'Bank of Abyssinia',
  },
  'Abay Bank': {
    bg: 'bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#10b981]',
    badge: 'bg-emerald-950/30 text-emerald-100 border-emerald-300/40',
    textBadge: 'ABY',
    logo: 'Abay Bank',
  },
  'Wegagen Bank': {
    bg: 'bg-gradient-to-br from-[#7c2d12] via-[#c2410c] to-[#ea580c]',
    badge: 'bg-orange-950/30 text-orange-100 border-orange-300/40',
    textBadge: 'WGG',
    logo: 'Wegagen Bank',
  },
  'Nib Bank': {
    bg: 'bg-gradient-to-br from-[#713f12] via-[#a16207] to-[#ca8a04]',
    badge: 'bg-yellow-950/30 text-yellow-100 border-yellow-300/40',
    textBadge: 'NIB',
    logo: 'Nib Bank',
  },
  'Zemen Bank': {
    bg: 'bg-gradient-to-br from-[#881337] via-[#be123c] to-[#e11d48]',
    badge: 'bg-rose-950/30 text-rose-100 border-rose-300/40',
    textBadge: 'ZEM',
    logo: 'Zemen Bank',
  },
};

export const AccountsCardStack: React.FC<AccountsCardStackProps> = ({
  accounts,
  settings,
  selectedAccountId,
  onSelectAccount,
  onManageAccounts,
  onSaveOpeningBalance,
  onAddCustomBank,
}) => {
  const isAm = settings.language === 'am';

  // Modal states for "Sync your balance" / Opening Balance
  const [openingBalanceModalBank, setOpeningBalanceModalBank] = useState<string | null>(null);
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [newBankName, setNewBankName] = useState('Abay Bank');

  const formatAmount = (num: number) => {
    if (settings.hideBalances) return '••••••';
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getTheme = (bank: string) => {
    return BANK_BRAND_THEMES[bank] || {
      bg: 'bg-gradient-to-br from-[#14503F] via-[#1b6b54] to-[#228469]',
      badge: 'bg-emerald-950/30 text-emerald-100 border-emerald-300/40',
      textBadge: bank.substring(0, 3).toUpperCase(),
      logo: bank,
    };
  };

  const handleOpenBalanceModal = (e: React.MouseEvent, acc: Account) => {
    e.stopPropagation();
    setOpeningBalanceModalBank(acc.bank);
    setOpeningBalanceInput(acc.openingBalance !== undefined ? String(acc.openingBalance) : '');
  };

  const handleSaveBalance = async () => {
    if (!openingBalanceModalBank) return;
    const val = parseFloat(openingBalanceInput.replace(/,/g, ''));
    if (!isNaN(val)) {
      await onSaveOpeningBalance(openingBalanceModalBank, val);
    }
    setOpeningBalanceModalBank(null);
  };

  const handleAddBankSubmit = async () => {
    if (onAddCustomBank && newBankName.trim()) {
      await onAddCustomBank(newBankName.trim());
      setShowAddBankModal(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Header bar */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider font-['Poppins',sans-serif]">
          {isAm ? 'የባንክ ሂሳቦች' : 'Bank Accounts & Balances'}
        </span>
        <button
          onClick={onManageAccounts}
          className="text-xs font-bold text-[#14503F] hover:underline flex items-center gap-0.5"
        >
          {isAm ? 'አስተዳድር' : 'Manage'}
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Horizontal Scroll Cards */}
      <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none snap-x snap-mandatory">
        {accounts.map(acc => {
          const theme = getTheme(acc.bank);
          const isSelected = selectedAccountId === acc.id;

          return (
            <div
              key={acc.id}
              onClick={() => onSelectAccount(isSelected ? null : acc.id)}
              className={`shrink-0 w-[215px] rounded-2xl p-3.5 text-white shadow-md cursor-pointer transition-all duration-200 snap-start select-none relative overflow-hidden flex flex-col justify-between ${theme.bg} ${
                isSelected ? 'ring-2 ring-[#14503F] ring-offset-2 scale-[1.02]' : 'hover:opacity-95'
              }`}
            >
              {/* Subtle visual glow */}
              <div className="absolute -right-5 -bottom-5 w-24 h-24 rounded-full bg-white/10 blur-xl pointer-events-none" />

              {/* Top Row: Bank Logo Badge & Masked ID */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className={`px-2 py-0.5 rounded-lg border font-black text-[11px] tracking-wider flex items-center gap-1 ${theme.badge}`}>
                    {acc.type === 'mobile' ? <Smartphone size={11} /> : <Building2 size={11} />}
                    <span>{theme.textBadge}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Edit Opening Balance Shortcut */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenBalanceModal(e, acc)}
                      className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
                      title={isAm ? 'የመነሻ ሂሳብ አስተካክል' : 'Edit opening balance'}
                    >
                      <Edit3 size={11} />
                    </button>
                    {isSelected && (
                      <span className="text-[9px] bg-white text-slate-900 font-extrabold px-1.5 py-0.2 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                </div>

                {/* Bank Name */}
                <div className="text-[12.5px] font-bold text-white tracking-tight truncate">
                  {acc.name}
                </div>
              </div>

              {/* Middle: Current Balance OR "Sync your balance" button */}
              <div className="my-2">
                {!acc.hasSyncedBalance ? (
                  <button
                    type="button"
                    onClick={(e) => handleOpenBalanceModal(e, acc)}
                    className="w-full py-1.5 px-2 rounded-xl bg-white text-slate-900 font-extrabold text-[11px] shadow-sm hover:bg-emerald-50 active:scale-95 transition-all flex items-center justify-center gap-1"
                  >
                    <Sparkles size={12} className="text-amber-500" />
                    <span>{isAm ? 'ሂሳብህን አስተካክል (Sync)' : 'Sync your balance'}</span>
                  </button>
                ) : (
                  <div>
                    <div className="text-[10px] text-white/75 uppercase tracking-wider font-semibold">
                      {isAm ? 'የአሁኑ ቀሪ ሂሳብ' : 'Current Balance'}
                    </div>
                    <div className="font-extrabold text-base tracking-tight text-white font-['Poppins',sans-serif]">
                      ETB {formatAmount(acc.balance)}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Row: This month's Received & Sent */}
              <div className="pt-1.5 border-t border-white/15 flex items-center justify-between text-[10px] font-semibold text-white/85">
                <div className="flex items-center gap-0.5 text-emerald-200">
                  <ArrowDownLeft size={11} />
                  <span>+{formatAmount(acc.receivedThisMonth || 0)}</span>
                </div>
                <div className="flex items-center gap-0.5 text-rose-200">
                  <ArrowUpRight size={11} />
                  <span>-{formatAmount(acc.sentThisMonth || 0)}</span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Bank Card */}
        <div
          onClick={() => setShowAddBankModal(true)}
          className="shrink-0 w-[120px] rounded-2xl p-3 border-2 border-dashed border-slate-300 hover:border-[#14503F] text-slate-500 hover:text-[#14503F] bg-white/60 flex flex-col items-center justify-center cursor-pointer transition-all snap-start select-none group"
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center mb-1 text-slate-600 group-hover:text-[#14503F] transition-colors">
            <Plus size={16} />
          </div>
          <span className="text-[11px] font-bold text-center">
            {isAm ? '+ ባንክ ጨምር' : '+ Add Bank'}
          </span>
        </div>
      </div>

      {/* Opening Balance Modal */}
      {openingBalanceModalBank && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                  {isAm ? 'የመነሻ ሂሳብ ያስገቡ' : 'Sync Opening Balance'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {openingBalanceModalBank}
                </p>
              </div>
              <button
                onClick={() => setOpeningBalanceModalBank(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isAm 
                ? 'በዚህ ባንክ ውስጥ ያለዎትን የአሁኑን ወይም የመነሻ ሂሳብ ያስገቡ። ወደፊት የሚገቡ እና የሚወጡ ክፍያዎች በራሳቸው ይደመራሉ/ይቀነሳሉ።'
                : 'Enter your current account balance. In future SMS without an explicit balance, balance = opening + received − sent.'}
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800">
                {isAm ? 'የገንዘብ መጠን (ETB)' : 'Current Balance (ETB)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  value={openingBalanceInput}
                  onChange={e => setOpeningBalanceInput(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-[#14503F]"
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                  ETB
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveBalance}
                className="flex-1 py-2.5 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-md hover:bg-[#0e3b2e]"
              >
                {isAm ? 'ሂሳቡን መዝግብ' : 'Save Balance'}
              </button>
              <button
                type="button"
                onClick={() => setOpeningBalanceModalBank(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-xs font-bold"
              >
                {isAm ? 'ይቅር' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bank Modal */}
      {showAddBankModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                {isAm ? 'አዲስ ባንክ ይጨምሩ' : 'Add Bank Account'}
              </h3>
              <button
                onClick={() => setShowAddBankModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">
                {isAm ? 'ባንክ ይምረጡ' : 'Select Bank'}
              </label>
              <select
                value={newBankName}
                onChange={e => setNewBankName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#14503F]"
              >
                <option value="Abay Bank">Abay Bank</option>
                <option value="Wegagen Bank">Wegagen Bank</option>
                <option value="Nib Bank">Nib Bank</option>
                <option value="Zemen Bank">Zemen Bank</option>
                <option value="Coop Bank">Cooperative Bank of Oromia</option>
                <option value="Hibret Bank">Hibret Bank</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleAddBankSubmit}
                className="flex-1 py-2.5 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-md hover:bg-[#0e3b2e]"
              >
                {isAm ? 'ባንክ ጨምር' : 'Add Account'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddBankModal(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-xs font-bold"
              >
                {isAm ? 'ይቅር' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
