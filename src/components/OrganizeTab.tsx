import React, { useState, useRef } from 'react';
import { Account, AppSettings, MonthlyBudget, PaymentRecord, WithdrawalRecord } from '../types/index.ts';
import { translations } from '../utils/i18n.ts';
import { 
  Building2, 
  Smartphone, 
  Plus, 
  Edit2, 
  Archive, 
  RotateCcw, 
  ArrowUp, 
  ArrowDown, 
  Check, 
  X, 
  Upload, 
  Sparkles,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { BANK_PRESETS, getBankBrand } from '../constants/bankBrands.ts';
import { db } from '../services/db.ts';
import { MonthlyBudgetCard } from './MonthlyBudgetCard.tsx';

interface OrganizeTabProps {
  accounts: Account[];
  settings: AppSettings;
  onUpdateAccounts: (accounts: Account[]) => Promise<void>;
  budget?: MonthlyBudget | null;
  onUpdateBudget?: (budget: MonthlyBudget) => Promise<void>;
  payments?: PaymentRecord[];
  withdrawals?: WithdrawalRecord[];
}

export const OrganizeTab: React.FC<OrganizeTabProps> = ({
  accounts,
  settings,
  onUpdateAccounts,
  budget,
  onUpdateBudget,
  payments,
  withdrawals,
}) => {
  const isAm = settings.language === 'am';

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [senderIds, setSenderIds] = useState('');
  const [brandColor, setBrandColor] = useState('#047857');
  const [accountNumber, setAccountNumber] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [accent, setAccent] = useState<Account['accent']>('emerald');
  const [type, setType] = useState<Account['type']>('operating');

  const [showArchived, setShowArchived] = useState(false);
  const [archivedAccounts, setArchivedAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load archived accounts
  const loadArchived = async () => {
    const all = await db.getAccounts(true);
    setArchivedAccounts(all.filter(a => a.isArchived));
  };

  React.useEffect(() => {
    loadArchived();
  }, [accounts]);

  const resetForm = () => {
    setEditingAccount(null);
    setName('');
    setShortCode('');
    setSenderIds('');
    setBrandColor('#047857');
    setAccountNumber('');
    setOpeningBalance('');
    setLogoUrl('');
    setAccent('emerald');
    setType('operating');
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setShortCode(acc.shortCode || getBankBrand(acc.bank).shortCode);
    setSenderIds((acc.senderIds || []).join(', ') || acc.bank);
    setBrandColor(acc.brandColor || getBankBrand(acc.bank).primaryColor);
    setAccountNumber(acc.accountNumber || '');
    setOpeningBalance(acc.openingBalance !== undefined ? String(acc.openingBalance) : '');
    setLogoUrl(acc.logoUrl || getBankBrand(acc.bank).logoUrl || '');
    setAccent(acc.accent || 'emerald');
    setType(acc.type || 'operating');
    setShowModal(true);
  };

  const applyPreset = (preset: typeof BANK_PRESETS[0]) => {
    setName(preset.name);
    setShortCode(preset.shortCode);
    setSenderIds(preset.senders);
    setBrandColor(preset.color);
    setLogoUrl(preset.logoUrl || '');
    setAccent(preset.accent as any);
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const parsedSenders = senderIds
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const opBal = openingBalance ? parseFloat(openingBalance) : undefined;
      const last4 = accountNumber.trim().slice(-4) || '••••';

      const accountData: Account = {
        id: editingAccount ? editingAccount.id : `acc-${Date.now()}`,
        name: name.trim(),
        bank: name.trim(),
        shortCode: shortCode.trim().toUpperCase() || name.substring(0, 3).toUpperCase(),
        senderIds: parsedSenders.length > 0 ? parsedSenders : [name.trim()],
        brandColor,
        logoUrl: logoUrl || undefined,
        accountNumber: accountNumber.trim() || '••••',
        maskedNumber: `${shortCode || name.substring(0, 3).toUpperCase()} · ${last4}`,
        balance: editingAccount ? editingAccount.balance : (opBal || 0),
        openingBalance: opBal,
        accent,
        type,
        orderIndex: editingAccount?.orderIndex ?? accounts.length,
      };

      await db.saveAccount(accountData);
      const updated = await db.getAccounts(false);
      await onUpdateAccounts(updated);
      await loadArchived();
      setShowModal(false);
      resetForm();
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (id: string, bankName: string) => {
    const confirmMsg = isAm
      ? `"${bankName}"ን ወደ ማህደር (Archive) ማስገባት ይፈልጋሉ? የSMS ክትትል ይቆማል፣ ነገር ግን ያለፈው የክፍያ ታሪክ ሙሉ በሙሉ ይጠበቃል።`
      : `Archive "${bankName}"? Monitoring of its SMS senders will pause, but all payment history and records will remain completely safe.`;

    if (window.confirm(confirmMsg)) {
      await db.archiveAccount(id);
      const updated = await db.getAccounts(false);
      await onUpdateAccounts(updated);
      await loadArchived();
    }
  };

  const handleRestore = async (id: string) => {
    await db.restoreAccount(id);
    const updated = await db.getAccounts(false);
    await onUpdateAccounts(updated);
    await loadArchived();
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === accounts.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...accounts];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    await onUpdateAccounts(reordered);
    await db.reorderAccounts(reordered.map(a => a.id));
  };

  return (
    <div className="space-y-4 pb-20 w-full max-w-full box-border">
      {/* Title & Add Bank Button */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 font-['Poppins',sans-serif]">
            {isAm ? 'ማደራጃ እና ባንኮች' : 'Manage Bank Accounts'}
          </h2>
          <p className="text-xs text-slate-400">
            {isAm ? 'የባንክ ሂሳቦችን፣ መነሻ ቀሪ እና የSMS ላኪዎችን ያስተዳድሩ' : 'Add banks, customize brand colors, logos, and SMS sender IDs'}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-3.5 py-2 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-xs hover:bg-[#0e3b2e] active:scale-95 flex items-center gap-1.5 transition-all"
        >
          <Plus size={14} />
          <span>{isAm ? 'ባንክ አክል' : '+ Add Bank'}</span>
        </button>
      </div>

      {/* Monthly Budget Card (2026) */}
      {budget && onUpdateBudget && payments && withdrawals && (
        <MonthlyBudgetCard
          payments={payments}
          withdrawals={withdrawals}
          budget={budget}
          settings={settings}
          onUpdateBudget={onUpdateBudget}
        />
      )}

      {/* Active Banks List */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
          {isAm ? 'ንቁ የባንክ ሂሳቦች' : 'Active Bank Accounts'} ({accounts.length})
        </div>

        {accounts.map((acc, index) => {
          const brand = getBankBrand(acc.bank);
          const logo = acc.logoUrl || brand.logoUrl;

          return (
            <div
              key={acc.id}
              className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3"
            >
              {/* Order Arrows */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMoveOrder(index, 'up')}
                  className="w-6 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-20"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  disabled={index === accounts.length - 1}
                  onClick={() => handleMoveOrder(index, 'down')}
                  className="w-6 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-20"
                >
                  <ArrowDown size={12} />
                </button>
              </div>

              {/* Bank Logo / Badge */}
              {logo ? (
                <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs overflow-hidden">
                  <img src={logo} alt={acc.name} className="w-full h-full object-contain" />
                </div>
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border font-black text-xs text-white shadow-2xs"
                  style={{ backgroundColor: acc.brandColor || brand.primaryColor }}
                >
                  <span>{acc.shortCode || brand.shortCode}</span>
                </div>
              )}

              {/* Details */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 truncate font-['Poppins',sans-serif]">
                    {acc.name}
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono font-bold">
                    {acc.shortCode || brand.shortCode}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 truncate font-mono">
                  Senders: <span className="text-slate-600 font-semibold">{(acc.senderIds || [acc.bank]).join(', ')}</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  Opening: <span className="font-bold text-slate-700">{acc.openingBalance ? `${acc.openingBalance.toFixed(2)} ETB` : 'Not set (0)'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openEditModal(acc)}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors"
                  title="Edit bank settings"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleArchive(acc.id, acc.name)}
                  className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors"
                  title="Archive bank (stops monitoring, keeps SMS)"
                >
                  <Archive size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Collapsible Archived Banks Section */}
      {archivedAccounts.length > 0 && (
        <div className="bg-slate-100/70 border border-slate-200 rounded-2xl p-3.5 space-y-2">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider"
          >
            <div className="flex items-center gap-1.5">
              <Archive size={14} className="text-slate-500" />
              <span>Archived Banks ({archivedAccounts.length})</span>
            </div>
            {showArchived ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showArchived && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <p className="text-[11px] text-slate-500">
                These banks are hidden from the Home cards and their SMS monitoring is paused. All historical payments remain intact.
              </p>
              {archivedAccounts.map(acc => (
                <div
                  key={acc.id}
                  className="bg-white rounded-xl p-2.5 border border-slate-200 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-800">{acc.name}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      Senders: {(acc.senderIds || [acc.bank]).join(', ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(acc.id)}
                    className="px-2.5 py-1 rounded-lg bg-[#14503F] text-white text-[11px] font-bold hover:bg-[#0e3b2e] flex items-center gap-1 shadow-2xs"
                  >
                    <RotateCcw size={11} />
                    <span>Restore</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Bank Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 max-h-[92dvh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#14503F] flex items-center justify-center">
                  <Building2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                    {editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Configure bank identity, sender IDs, and opening balance
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            {/* Presets Grid */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                Quick Ethiopian Bank Presets
              </label>
              <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
                {BANK_PRESETS.map(p => (
                  <button
                    key={p.shortCode}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[10.5px] font-bold text-slate-800 shrink-0 transition-colors flex items-center gap-1"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                    <span>{p.shortCode}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveBank} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">
                    Bank Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Abay Bank"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-[#14503F]"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">
                    Short Code
                  </label>
                  <input
                    type="text"
                    value={shortCode}
                    onChange={e => setShortCode(e.target.value.toUpperCase())}
                    placeholder="ABAY"
                    maxLength={5}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold uppercase font-mono focus:ring-2 focus:ring-[#14503F]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">
                  SMS Sender IDs (comma-separated) *
                </label>
                <input
                  type="text"
                  required
                  value={senderIds}
                  onChange={e => setSenderIds(e.target.value)}
                  placeholder="e.g. AbayBank, ABAY, 127"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-semibold focus:ring-2 focus:ring-[#14503F]"
                />
                <span className="text-[9.5px] text-slate-400 block mt-0.5">
                  Any incoming SMS from these addresses will be captured and routed to this bank.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">
                    Brand Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={e => setBrandColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer p-0"
                    />
                    <input
                      type="text"
                      value={brandColor}
                      onChange={e => setBrandColor(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">
                    Opening Balance (ETB)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={openingBalance}
                    onChange={e => setOpeningBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:ring-2 focus:ring-[#14503F]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">
                  Account Tail / Masked Number
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder="e.g. 1000****4819"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-[#14503F]"
                />
              </div>

              {/* Logo Upload / URL */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">
                  Bank Logo Image
                </label>
                <div className="flex items-center gap-2">
                  {logoUrl && (
                    <div className="w-10 h-10 rounded-xl border bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-2xs">
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <Upload size={13} />
                    <span>Upload Logo Image</span>
                  </button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"
                      title="Clear logo"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-xs hover:bg-[#0e3b2e]"
                >
                  {loading ? 'Saving...' : editingAccount ? 'Save Changes' : 'Create Bank'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
