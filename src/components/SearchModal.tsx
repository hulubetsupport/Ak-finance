import React, { useState } from 'react';
import { PaymentRecord, AppSettings } from '../types/index.ts';
import { Search, X, Filter, Sparkles, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { translations } from '../utils/i18n.ts';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: PaymentRecord[];
  settings: AppSettings;
  onSelectPayment: (p: PaymentRecord) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  payments,
  settings,
  onSelectPayment,
}) => {
  const [query, setQuery] = useState('');
  const [bankFilter, setBankFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'received' | 'sent'>('ALL');
  const [minAmount, setMinAmount] = useState('');

  if (!isOpen) return null;

  const t = translations[settings.language];
  const isAm = settings.language === 'am';

  const filtered = payments.filter(p => {
    // text query
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      const match =
        p.counterparty.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q) ||
        p.bank.toLowerCase().includes(q) ||
        p.rawMessage.toLowerCase().includes(q) ||
        p.amount.toString().includes(q);
      if (!match) return false;
    }

    // bank filter
    if (bankFilter !== 'ALL' && !p.bank.toUpperCase().includes(bankFilter)) {
      return false;
    }

    // type filter
    if (typeFilter !== 'ALL' && p.type !== typeFilter) {
      return false;
    }

    // min amount
    if (minAmount && !isNaN(parseFloat(minAmount))) {
      if (p.amount < parseFloat(minAmount)) return false;
    }

    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#14503F] flex items-center justify-center">
              <Search size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                {t.quickFind}
              </h3>
              <p className="text-[11px] text-slate-400">
                {filtered.length} matching payments found
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

        {/* Search input */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#14503F]"
          />
        </div>

        {/* Filter Pills */}
        <div className="space-y-2">
          {/* Bank selectors */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
            {['ALL', 'CBE', 'TELEBIRR', 'AWASH', 'DASHEN'].map(b => (
              <button
                key={b}
                type="button"
                onClick={() => setBankFilter(b)}
                className={`px-2.5 py-1 rounded-lg border font-medium shrink-0 transition-colors ${
                  bankFilter === b
                    ? 'bg-[#14503F] text-white border-[#14503F]'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {b === 'ALL' ? 'All Banks' : b}
              </button>
            ))}
          </div>

          {/* Type selectors */}
          <div className="flex gap-1.5 text-[11px]">
            {(['ALL', 'received', 'sent'] as const).map(tp => (
              <button
                key={tp}
                type="button"
                onClick={() => setTypeFilter(tp)}
                className={`px-2.5 py-1 rounded-lg border font-medium shrink-0 transition-colors ${
                  typeFilter === tp
                    ? 'bg-[#14503F] text-white border-[#14503F]'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tp === 'ALL' ? 'All Types' : tp === 'received' ? '+ Inflow' : '- Outflow'}
              </button>
            ))}
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-64">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
              No matching transactions found. Try adjusting keywords or bank filter.
            </div>
          ) : (
            filtered.map(p => (
              <div
                key={p.id}
                onClick={() => {
                  onSelectPayment(p);
                  onClose();
                }}
                className="bg-slate-50 hover:bg-emerald-50/50 p-3 rounded-2xl border border-slate-200/80 cursor-pointer flex items-center justify-between gap-3 transition-colors"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
                    {p.counterparty}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {p.bank} · Ref: <span className="font-mono">{p.reference}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xs font-extrabold ${p.type === 'received' ? 'text-emerald-700' : 'text-slate-900'}`}>
                    {p.type === 'received' ? '+' : '-'}{p.amount.toLocaleString()} ETB
                  </div>
                  <span className="text-[9px] text-slate-400 capitalize">{p.syncStatus}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
