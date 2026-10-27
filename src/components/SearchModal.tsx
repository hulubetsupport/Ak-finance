import React, { useState, useMemo } from 'react';
import { PaymentRecord, AppSettings } from '../types/index.ts';
import { Search, X, Tag as TagIcon, ArrowDownLeft, ArrowUpRight, Calendar, DollarSign, Building2 } from 'lucide-react';
import { translations } from '../utils/i18n.ts';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: PaymentRecord[];
  settings: AppSettings;
  onSelectPayment: (p: PaymentRecord) => void;
}

const COMMON_TAGS = ['School', 'Wifi', 'Rent', 'Food', 'Other bank'];

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
  const [tagFilter, setTagFilter] = useState<string>('ALL');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'today' | 'month'>('ALL');

  const t = translations[settings.language];
  const isAm = settings.language === 'am';

  const todayStr = new Date().toISOString().slice(0, 10);
  const curMonth = new Date().getMonth();
  const curYear = new Date().getFullYear();

  // Extract all existing unique tags from payments
  const allUniqueTags = useMemo(() => {
    if (!isOpen) return COMMON_TAGS;
    const set = new Set<string>(COMMON_TAGS);
    payments.forEach(p => {
      if (p.tag) set.add(p.tag);
    });
    return Array.from(set);
  }, [payments, isOpen]);

  const filtered = useMemo(() => {
    if (!isOpen) return [];
    return payments.filter(p => {
      // 1. Text Query (Name, Ref, Bank, Raw text)
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const cp = (p.counterparty || '').toLowerCase();
        const ref = (p.reference || '').toLowerCase();
        const bank = (p.bank || '').toLowerCase();
        const raw = (p.rawMessage || '').toLowerCase();
        const tag = (p.tag || '').toLowerCase();
        const amt = (p.amount || 0).toString();
        const match =
          cp.includes(q) ||
          ref.includes(q) ||
          bank.includes(q) ||
          raw.includes(q) ||
          tag.includes(q) ||
          amt.includes(q);
        if (!match) return false;
      }

      // 2. Bank Filter
      if (bankFilter !== 'ALL' && !p.bank.toUpperCase().includes(bankFilter)) {
        return false;
      }

      // 3. Direction Filter
      if (typeFilter !== 'ALL' && p.type !== typeFilter) {
        return false;
      }

      // 4. Tag Filter
      if (tagFilter !== 'ALL') {
        if (!p.tag || p.tag.toLowerCase() !== tagFilter.toLowerCase()) {
          return false;
        }
      }

      // 5. Min & Max Amount
      if (minAmount && !isNaN(parseFloat(minAmount))) {
        if (p.amount < parseFloat(minAmount)) return false;
      }
      if (maxAmount && !isNaN(parseFloat(maxAmount))) {
        if (p.amount > parseFloat(maxAmount)) return false;
      }

      // 6. Date Filter
      if (dateFilter === 'today') {
        const dStr = new Date(p.timestamp).toISOString().slice(0, 10);
        if (dStr !== todayStr) return false;
      } else if (dateFilter === 'month') {
        const d = new Date(p.timestamp);
        if (d.getMonth() !== curMonth || d.getFullYear() !== curYear) return false;
      }

      return true;
    });
  }, [payments, query, bankFilter, typeFilter, tagFilter, minAmount, maxAmount, dateFilter, todayStr, curMonth, curYear, isOpen]);

  // Total for currently filtered payments
  const totalAmount = useMemo(() => {
    if (!isOpen) return 0;
    return filtered.reduce((acc, p) => p.type === 'received' ? acc + p.amount : acc - p.amount, 0);
  }, [filtered, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 max-h-[92dvh] flex flex-col space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#14503F] flex items-center justify-center">
              <Search size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                {t.quickFind} & Filter
              </h3>
              <p className="text-[10px] text-slate-400">
                Filter by Name, Bank, Amount, Date, Tag & Direction
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

        {/* Filter Controls Stack */}
        <div className="space-y-2 text-xs">
          {/* Bank selection */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
            {['ALL', 'CBE', 'TELEBIRR', 'AWASH', 'DASHEN', 'BOA'].map(b => (
              <button
                key={b}
                type="button"
                onClick={() => setBankFilter(b)}
                className={`px-2.5 py-1 rounded-lg border font-semibold shrink-0 transition-colors ${
                  bankFilter === b
                    ? 'bg-[#14503F] text-white border-[#14503F]'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {b === 'ALL' ? 'All Banks' : b}
              </button>
            ))}
          </div>

          {/* Direction & Date selection */}
          <div className="flex items-center justify-between gap-1.5 text-[11px]">
            {/* Direction */}
            <div className="flex gap-1">
              {(['ALL', 'received', 'sent'] as const).map(tp => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setTypeFilter(tp)}
                  className={`px-2 py-0.8 rounded-lg border font-medium transition-colors ${
                    typeFilter === tp
                      ? 'bg-[#14503F] text-white border-[#14503F]'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tp === 'ALL' ? 'All' : tp === 'received' ? '+ Inflow' : '- Outflow'}
                </button>
              ))}
            </div>

            {/* Date */}
            <div className="flex gap-1">
              {(['ALL', 'today', 'month'] as const).map(dt => (
                <button
                  key={dt}
                  type="button"
                  onClick={() => setDateFilter(dt)}
                  className={`px-2 py-0.8 rounded-lg border font-medium transition-colors ${
                    dateFilter === dt
                      ? 'bg-[#14503F] text-white border-[#14503F]'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {dt === 'ALL' ? 'All Time' : dt === 'today' ? 'Today' : 'This Month'}
                </button>
              ))}
            </div>
          </div>

          {/* Tag Filter Chips */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
              <TagIcon size={11} />
              <span>Filter by Label / Tag</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
              <button
                type="button"
                onClick={() => setTagFilter('ALL')}
                className={`px-2.5 py-0.8 rounded-lg border font-medium shrink-0 transition-colors ${
                  tagFilter === 'ALL'
                    ? 'bg-[#14503F] text-white border-[#14503F]'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                All Tags
              </button>
              {allUniqueTags.map(tg => (
                <button
                  key={tg}
                  type="button"
                  onClick={() => setTagFilter(tg)}
                  className={`px-2.5 py-0.8 rounded-lg border font-medium shrink-0 transition-colors ${
                    tagFilter.toLowerCase() === tg.toLowerCase()
                      ? 'bg-purple-700 text-white border-purple-700'
                      : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  {tg}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Summary Bar */}
        <div className="bg-slate-100/80 px-3 py-1.5 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-700">
          <span>{filtered.length} matching payments</span>
          <span className="font-mono font-bold text-[#14503F]">
            Net: ETB {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-56">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl">
              No matching transactions found with current filters.
            </div>
          ) : (
            filtered.map(p => (
              <div
                key={p.id}
                onClick={() => {
                  onSelectPayment(p);
                  onClose();
                }}
                className="bg-slate-50 hover:bg-emerald-50/50 p-3 rounded-2xl border border-slate-200/80 cursor-pointer flex items-center justify-between gap-3 transition-colors active:scale-99"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 truncate font-['Poppins',sans-serif]">
                      {p.counterparty}
                    </span>
                    {p.tag && (
                      <span className="text-[9.5px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded-md border border-purple-200">
                        {p.tag}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {p.bank} · Ref: <span className="font-mono">{p.reference}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xs font-extrabold ${p.type === 'received' ? 'text-emerald-700' : 'text-slate-900'}`}>
                    {p.type === 'received' ? '+' : '-'}{p.amount.toLocaleString()} ETB
                  </div>
                  <span className="text-[9px] text-slate-400">
                    {new Date(p.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
