import React, { useState, useMemo } from 'react';
import { PaymentRecord, AppSettings } from '../types/index.ts';
import { Search, X, Tag as TagIcon } from 'lucide-react';
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
  const [dateFilter, setDateFilter] = useState<'ALL' | 'today' | 'month'>('ALL');

  const t = translations[settings.language];
  const todayStr = new Date().toISOString().slice(0, 10);
  const curMonth = new Date().getMonth();
  const curYear = new Date().getFullYear();

  const availableBanks = useMemo(() => {
    const set = new Set<string>(['CBE', 'Telebirr', 'Awash Bank', 'Dashen Bank', 'Bank of Abyssinia']);
    payments.forEach(p => {
      if (p.bank && p.bank !== 'Unknown') set.add(p.bank);
    });
    return ['ALL', ...Array.from(set)];
  }, [payments]);

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
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        const match =
          (p.counterparty || '').toLowerCase().includes(q) ||
          (p.reference || '').toLowerCase().includes(q) ||
          (p.ftNumber || '').toLowerCase().includes(q) ||
          (p.bank || '').toLowerCase().includes(q) ||
          (p.rawMessage || '').toLowerCase().includes(q) ||
          (p.tag || '').toLowerCase().includes(q) ||
          String(p.amount || 0).includes(q);
        if (!match) return false;
      }

      if (bankFilter !== 'ALL') {
        const bNorm = bankFilter.toUpperCase();
        const pNorm = (p.bank || '').toUpperCase();
        if (!(pNorm === bNorm || pNorm.includes(bNorm) || (bNorm === 'CBE' && pNorm.includes('COMMERCIAL')))) {
          return false;
        }
      }

      if (typeFilter !== 'ALL' && p.type !== typeFilter) return false;
      if (tagFilter !== 'ALL' && (!p.tag || p.tag.toLowerCase() !== tagFilter.toLowerCase())) return false;

      if (dateFilter === 'today') {
        if (new Date(p.timestamp).toISOString().slice(0, 10) !== todayStr) return false;
      } else if (dateFilter === 'month') {
        const d = new Date(p.timestamp);
        if (d.getMonth() !== curMonth || d.getFullYear() !== curYear) return false;
      }

      return true;
    });
  }, [payments, query, bankFilter, typeFilter, tagFilter, dateFilter, todayStr, curMonth, curYear, isOpen]);

  const totalAmount = useMemo(() => {
    if (!isOpen) return 0;
    return filtered.reduce((acc, p) => {
      if (p.category === 'alert') return acc;
      return p.type === 'received' ? acc + p.amount : p.type === 'sent' ? acc - p.amount : acc;
    }, 0);
  }, [filtered, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl p-5 border border-slate-200 max-h-[92dvh] flex flex-col space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0F4C3A] text-white flex items-center justify-center">
              <Search size={15} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t.quickFind} & Filter</h3>
              <p className="text-xs text-slate-500">Search by name, ref, FT, bank, tag, or raw SMS</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search modal"
            className="w-8 h-8 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-900"
          >
            <X size={15} />
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F4C3A]"
          />
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {availableBanks.map(b => (
              <button
                key={b}
                type="button"
                onClick={() => setBankFilter(b)}
                className={`px-2.5 py-1 rounded-lg border font-semibold shrink-0 whitespace-nowrap ${
                  bankFilter === b
                    ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {b === 'ALL' ? 'All Banks' : b}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              {(['ALL', 'received', 'sent'] as const).map(tp => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setTypeFilter(tp)}
                  className={`px-2.5 py-1 rounded-lg border font-semibold whitespace-nowrap ${
                    typeFilter === tp
                      ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {tp === 'ALL' ? 'All' : tp === 'received' ? 'Inflow' : 'Outflow'}
                </button>
              ))}
            </div>

            <div className="flex gap-1">
              {(['ALL', 'today', 'month'] as const).map(dt => (
                <button
                  key={dt}
                  type="button"
                  onClick={() => setDateFilter(dt)}
                  className={`px-2.5 py-1 rounded-lg border font-semibold whitespace-nowrap ${
                    dateFilter === dt
                      ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {dt === 'ALL' ? 'All Time' : dt === 'today' ? 'Today' : 'This Month'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            <TagIcon size={12} className="text-slate-400 shrink-0" />
            <button
              type="button"
              onClick={() => setTagFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg border font-semibold shrink-0 whitespace-nowrap ${
                tagFilter === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              All Tags
            </button>
            {allUniqueTags.map(tg => (
              <button
                key={tg}
                type="button"
                onClick={() => setTagFilter(tg)}
                className={`px-2.5 py-1 rounded-lg border font-semibold shrink-0 whitespace-nowrap ${
                  tagFilter.toLowerCase() === tg.toLowerCase()
                    ? 'bg-[#0F4C3A] text-white border-[#0F4C3A]'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {tg}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
          <span>{filtered.length} matching records</span>
          <span className="font-mono font-bold text-[#0F4C3A] tabular-nums">
            Net: ETB {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-60">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
              No matching transactions found.
            </div>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelectPayment(p);
                  onClose();
                }}
                className="w-full text-left bg-white hover:bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {p.counterparty} {p.tag ? `· ${p.tag}` : ''}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate font-mono">
                    {p.bank} · {p.ftNumber || p.reference}
                    {p.serverIgnored ? ' · Server Ignored' : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xs font-bold tabular-nums ${p.type === 'received' ? 'text-emerald-700' : 'text-slate-900'}`}>
                    {p.type === 'received' ? '+' : p.type === 'sent' ? '-' : ''}{p.amount.toLocaleString()} ETB
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(p.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
