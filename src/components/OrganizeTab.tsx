import React, { useState, useRef, useEffect } from 'react';
import { Account, AppSettings, MonthlyBudget, PaymentRecord, WithdrawalRecord } from '../types/index.ts';
import {
  Building2,
  Plus,
  Edit2,
  Archive,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  X,
  Upload,
  ChevronDown,
  ChevronUp,
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

  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [senderIds, setSenderIds] = useState('');
  const [brandColor, setBrandColor] = useState('#0F4C3A');
  const [accountNumber, setAccountNumber] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [accent, setAccent] = useState<Account['accent']>('emerald');
  const [type, setType] = useState<Account['type']>('operating');

  const [showArchived, setShowArchived] = useState(false);
  const [archivedAccounts, setArchivedAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadArchived = async () => {
    const all = await db.getAccounts(true);
    setArchivedAccounts(all.filter(a => a.isArchived));
  };

  useEffect(() => {
    loadArchived();
  }, [accounts]);

  const resetForm = () => {
    setEditingAccount(null);
    setName('');
    setShortCode('');
    setSenderIds('');
    setBrandColor('#0F4C3A');
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
      if (typeof reader.result === 'string') setLogoUrl(reader.result);
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
      ? `"${bankName}"ን ወደ ማህደር ማስገባት ይፈልጋሉ? የSMS ክትትል ይቆማል፣ ነገር ግን የክፍያ ታሪክ ይጠበቃል።`
      : `Archive "${bankName}"? SMS monitoring pauses, but payment history remains safe.`;

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
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {isAm ? 'ባንኮች እና ወርሃዊ በጀት' : 'Banks & Monthly Budgets'}
          </h2>
          <p className="text-xs text-slate-500">
            {isAm ? 'የባንክ ሂሳቦችን እና የSMS ላኪዎችን ያስተዳድሩ' : 'Manage Ethiopian banks, opening balances, and SMS senders'}
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="px-3.5 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold hover:bg-[#0B3B2E] whitespace-nowrap flex items-center gap-1.5"
        >
          <Plus size={14} />
          <span>{isAm ? 'ባንክ አክል' : 'Add Bank'}</span>
        </button>
      </div>

      {budget && onUpdateBudget && payments && withdrawals && (
        <MonthlyBudgetCard
          payments={payments}
          withdrawals={withdrawals}
          budget={budget}
          settings={settings}
          onUpdateBudget={onUpdateBudget}
        />
      )}

      {/* Active Banks */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          {isAm ? 'ንቁ የባንክ ሂሳቦች' : 'Active Bank Accounts'} ({accounts.length})
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {accounts.map((acc, index) => {
            const brand = getBankBrand(acc.bank);
            const logo = acc.logoUrl || brand.logoUrl;

            return (
              <div
                key={acc.id}
                className="bg-white rounded-xl p-3.5 border border-slate-200 flex items-center justify-between gap-3"
              >
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMoveOrder(index, 'up')}
                    aria-label={`Move ${acc.name} up`}
                    className="w-6 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 disabled:opacity-25"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={index === accounts.length - 1}
                    onClick={() => handleMoveOrder(index, 'down')}
                    aria-label={`Move ${acc.name} down`}
                    className="w-6 h-5 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 disabled:opacity-25"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>

                {logo ? (
                  <div className="w-9 h-9 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden">
                    <img src={logo} alt={acc.name} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs text-white"
                    style={{ backgroundColor: acc.brandColor || brand.primaryColor }}
                  >
                    <span>{acc.shortCode || brand.shortCode}</span>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {acc.name} · <span className="font-mono text-slate-500">{acc.shortCode || brand.shortCode}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate font-mono">
                    Senders: {(acc.senderIds || [acc.bank]).join(', ')}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate tabular-nums">
                    Opening: <span className="font-semibold text-slate-700">{acc.openingBalance ? `${acc.openingBalance.toFixed(2)} ETB` : '0.00 ETB'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(acc)}
                    aria-label={`Edit ${acc.name}`}
                    className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchive(acc.id, acc.name)}
                    aria-label={`Archive ${acc.name}`}
                    className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                  >
                    <Archive size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Archived Banks */}
      {archivedAccounts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-700"
          >
            <div className="flex items-center gap-1.5">
              <Archive size={14} className="text-slate-500" />
              <span>Archived Banks ({archivedAccounts.length})</span>
            </div>
            {showArchived ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showArchived && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {archivedAccounts.map(acc => (
                <div
                  key={acc.id}
                  className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-800 block">{acc.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Senders: {(acc.senderIds || [acc.bank]).join(', ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRestore(acc.id)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold flex items-center gap-1 whitespace-nowrap"
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 border border-slate-200 space-y-4 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#0F4C3A] text-white flex items-center justify-center">
                  <Building2 size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingAccount ? 'Edit Bank Account' : 'Add Ethiopian Bank Account'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pick a preset or enter custom sender IDs
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close bank modal"
                className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Ethiopian Bank Presets ({BANK_PRESETS.length})
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {BANK_PRESETS.map(p => (
                  <button
                    key={p.shortCode}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 whitespace-nowrap flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                    <span>{p.shortCode} · {p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveBank} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Bank Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Zemen Bank"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Short Code</label>
                  <input
                    type="text"
                    value={shortCode}
                    onChange={e => setShortCode(e.target.value.toUpperCase())}
                    placeholder="ZMN"
                    maxLength={5}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold uppercase font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  SMS Sender IDs (comma-separated) *
                </label>
                <input
                  type="text"
                  required
                  value={senderIds}
                  onChange={e => setSenderIds(e.target.value)}
                  placeholder="e.g. Zemen, ZemenBank"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Brand Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brandColor}
                      onChange={e => setBrandColor(e.target.value)}
                      className="w-8 h-8 rounded border border-slate-200 cursor-pointer p-0"
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
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Opening Balance (ETB)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={openingBalance}
                    onChange={e => setOpeningBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Account Tail / Masked Number</label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                  placeholder="e.g. 1000****4819"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Bank Logo (Optional)</label>
                <div className="flex items-center gap-2">
                  {logoUrl && (
                    <div className="w-9 h-9 rounded-lg border bg-white p-1 flex items-center justify-center shrink-0 overflow-hidden">
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
                    className="flex-1 py-2 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Upload size={13} />
                    <span>Upload Logo</span>
                  </button>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      aria-label="Clear logo"
                      className="p-2 rounded-lg border border-rose-200 text-rose-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold"
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
