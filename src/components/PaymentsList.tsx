import React, { useState } from 'react';
import { PaymentRecord, AppSettings, PaymentType } from '../types/index.ts';
import { translations } from '../utils/i18n.ts';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  HardDrive, 
  Copy, 
  RefreshCw, 
  X, 
  CreditCard, 
  Check, 
  Edit3, 
  EyeOff, 
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  HelpCircle,
  Smartphone,
  Wifi,
  Receipt,
  Banknote,
  ArrowLeftRight,
  Tag as TagIcon,
  ExternalLink
} from 'lucide-react';
import { getBankBrand } from '../constants/bankBrands.ts';

interface PaymentsListProps {
  payments: PaymentRecord[];
  settings: AppSettings;
  onRetrySinglePayment: (payment: PaymentRecord) => Promise<void>;
  onDeletePayment?: (id: string) => Promise<void>;
  onSaveOverride?: (
    paymentId: string,
    override: { counterparty?: string | null; direction?: string | null; note?: string; tag?: string; isHidden?: boolean }
  ) => Promise<void>;
}

const COMMON_TAGS = ['School', 'Wifi', 'Rent', 'Food', 'Other bank'];

export const PaymentsList: React.FC<PaymentsListProps> = ({
  payments,
  settings,
  onRetrySinglePayment,
  onSaveOverride,
}) => {
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Edit modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editCounterparty, setEditCounterparty] = useState('');
  const [editDirection, setEditDirection] = useState<PaymentType>('unknown');
  const [editNote, setEditNote] = useState('');
  const [editTag, setEditTag] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  // Performance pagination for 5,000+ rows
  const [visibleCount, setVisibleCount] = useState(50);

  const t = translations[settings.language];
  const isAm = settings.language === 'am';

  const formatAmountCompact = (num: number, type: PaymentType) => {
    if (settings.hideBalances) return '••••';
    const sign = type === 'received' ? '+' : type === 'sent' ? '-' : '';
    let valStr = '';
    if (num >= 1000) {
      valStr = (num / 1000).toFixed(1) + 'K';
    } else {
      valStr = num.toLocaleString('en-US');
    }
    return `${sign}${valStr}`;
  };

  const formatDateTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const day = d.getDate().toString().padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${hours}:${mins}`;
  };

  const getBankBadge = (bank: string) => {
    const b = (bank || '').toUpperCase();
    if (b.includes('TELEBIRR') || b === '127') {
      return { text: 'TLB', bg: 'bg-sky-100 text-sky-900 border-sky-200' };
    }
    if (b.includes('CBE') || b.includes('COMMERCIAL')) {
      return { text: 'CBE', bg: 'bg-purple-100 text-purple-900 border-purple-200' };
    }
    if (b.includes('AWASH')) {
      return { text: 'AWA', bg: 'bg-amber-100 text-amber-900 border-amber-200' };
    }
    if (b.includes('DASHEN')) {
      return { text: 'DSH', bg: 'bg-blue-100 text-blue-900 border-blue-200' };
    }
    if (b.includes('BOA') || b.includes('ABYSSINIA')) {
      return { text: 'BOA', bg: 'bg-yellow-100 text-yellow-900 border-yellow-200' };
    }
    if (b.includes('ABAY')) {
      return { text: 'ABY', bg: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
    }
    if (b.includes('WEGAGEN')) {
      return { text: 'WGG', bg: 'bg-orange-100 text-orange-900 border-orange-200' };
    }
    return {
      text: (bank || 'SMS').substring(0, 3).toUpperCase(),
      bg: 'bg-slate-100 text-slate-800 border-slate-200',
    };
  };

  const getStatusDot = (status: PaymentRecord['syncStatus']) => {
    switch (status) {
      case 'sent':
        return <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs shrink-0" title="Sent (HTTP 200)" />;
      case 'pending':
        return <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-xs shrink-0" title="Pending" />;
      case 'failed':
        return <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs shrink-0" title="Failed" />;
      case 'local':
      default:
        return <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shadow-xs shrink-0" title="Local SQLite" />;
    }
  };

  const getSyncStatusBadge = (item: PaymentRecord) => {
    const sr = item.serverResult;
    if (sr) {
      if (sr.resolving) {
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200" title="The server is fetching the CBE transaction number">
            <Clock size={11} className="text-blue-600 animate-spin" />
            <span>FT pending</span>
          </span>
        );
      }
      if (sr.status === 'Saved') {
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <CheckCircle2 size={11} className="text-emerald-600" />
            <span>Saved ✓</span>
          </span>
        );
      }
      if (sr.status === 'Duplicate') {
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-300">
            <span>Duplicate</span>
          </span>
        );
      }
      if (sr.status === 'Ignored') {
        return (
          <div className="flex items-center gap-1">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300"
              title={sr.reason ? `Server did NOT save this: ${sr.reason}` : 'Server did NOT save this'}
            >
              <AlertTriangle size={11} className="text-amber-600" />
              <span className="truncate max-w-[130px]">
                {sr.reason ? `Ignored: ${sr.reason}` : 'Ignored'}
              </span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleManualRetry(item);
              }}
              disabled={retryingId === item.id}
              className="px-1.5 py-0.5 text-[9.5px] font-bold bg-amber-100 text-amber-900 rounded border border-amber-300 hover:bg-amber-200 disabled:opacity-50"
            >
              {retryingId === item.id ? '...' : 'Retry'}
            </button>
          </div>
        );
      }
      if (sr.httpCode === 200 && sr.status === 'Unknown') {
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200" title="HTTP 200 with non-JSON reply">
            <span>Unknown reply</span>
          </span>
        );
      }
    }

    // Default status handling when no explicit server_result reply yet
    switch (item.syncStatus) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <CheckCircle2 size={11} className="text-emerald-600" />
            <span>Saved ✓</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
            <Clock size={11} className="text-amber-600 animate-spin" />
            <span>{t.statusPending}</span>
          </span>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
              <AlertCircle size={11} className="text-rose-600" />
              <span>{t.statusFailed}</span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleManualRetry(item);
              }}
              disabled={retryingId === item.id}
              className="px-1.5 py-0.5 text-[9.5px] font-bold bg-rose-100 text-rose-900 rounded border border-rose-300 hover:bg-rose-200 disabled:opacity-50"
            >
              {retryingId === item.id ? '...' : 'Retry'}
            </button>
          </div>
        );
      case 'local':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            <HardDrive size={11} className="text-slate-500" />
            <span>{t.statusLocal}</span>
          </span>
        );
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualRetry = async (payment: PaymentRecord) => {
    setRetryingId(payment.id);
    await onRetrySinglePayment(payment);
    setRetryingId(null);
  };

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'airtime':
        return <Smartphone size={11} className="text-sky-600" />;
      case 'data':
        return <Wifi size={11} className="text-blue-600" />;
      case 'bill':
        return <Receipt size={11} className="text-amber-600" />;
      case 'cash':
        return <Banknote size={11} className="text-emerald-600" />;
      case 'transfer':
      default:
        return <ArrowLeftRight size={11} className="text-slate-500" />;
    }
  };

  const getCategoryLabel = (category?: string) => {
    switch (category) {
      case 'airtime':
        return isAm ? 'አየር ሰዓት' : 'Airtime';
      case 'data':
        return isAm ? 'ዳታ' : 'Data';
      case 'bill':
        return isAm ? 'ቢል' : 'Bill';
      case 'cash':
        return isAm ? 'ጥሬ ገንዘብ' : 'Cash';
      case 'transfer':
      default:
        return isAm ? 'ዝውውር' : 'Transfer';
    }
  };

  const openPaymentModal = (payment: PaymentRecord) => {
    triggerHaptic();
    setSelectedPayment(payment);
    setIsEditing(false);
    setEditCounterparty(payment.counterparty || '');
    setEditDirection(payment.type);
    setEditNote(payment.note || '');
    setEditTag(payment.tag || '');
  };

  const handleSaveEdit = async () => {
    if (!selectedPayment || !onSaveOverride) return;
    setSavingOverride(true);
    try {
      await onSaveOverride(selectedPayment.id, {
        counterparty: editCounterparty.trim(),
        direction: editDirection,
        note: editNote.trim(),
        tag: editTag.trim() || undefined,
        isHidden: false,
      });
      setSelectedPayment(prev => prev ? {
        ...prev,
        counterparty: editCounterparty.trim(),
        type: editDirection,
        note: editNote.trim(),
        tag: editTag.trim() || undefined,
        isOverridden: true,
      } : null);
      setIsEditing(false);
    } finally {
      setSavingOverride(false);
    }
  };

  const handleHidePayment = async () => {
    if (!selectedPayment || !onSaveOverride) return;
    const confirmMsg = isAm
      ? 'ይህ መልዕክት ከክፍያ ዝርዝር ውስጥ እንዲደበቅ ይፈልጋሉ? (የማስታወቂያ ወይም ሌላ SMS)'
      : 'Hide this message from payments list? (Use for non-payment or promotional SMS)';
    if (window.confirm(confirmMsg)) {
      setSavingOverride(true);
      try {
        await onSaveOverride(selectedPayment.id, { isHidden: true });
        setSelectedPayment(null);
      } finally {
        setSavingOverride(false);
      }
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-['Poppins',sans-serif]">
            {t.recentPayments}
          </span>
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
            {payments.length}
          </span>
        </div>
      </div>

      {/* Empty State */}
      {payments.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-slate-200">
          <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <div className="text-sm font-bold text-slate-700">{t.emptyPayments}</div>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {t.emptyPaymentsSub}
          </p>
        </div>
      )}

      {/* Payment List */}
      <div className="space-y-2">
        {payments.slice(0, visibleCount).map(item => {
          const brand = getBankBrand(item.bank);
          const isReceived = item.type === 'received';
          const isSent = item.type === 'sent';
          const isUnknown = item.type === 'unknown';
          const hasParsedAmount = item.amount > 0;

          return (
            <div
              key={item.id}
              onClick={() => openPaymentModal(item)}
              className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:border-[#14503F]/30 hover:shadow-sm transition-all duration-150 cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3 group"
            >
              {/* Left Column: Sync Dot + Bank Logo Badge & Counterparty */}
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Sync Dot */}
                {getStatusDot(item.syncStatus)}

                {/* Bank Brand Logo Badge */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border font-black text-[10.5px] shadow-2xs ${brand.badgeClass}`}
                  title={brand.name}
                >
                  <span>{brand.shortCode}</span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 truncate font-['Poppins',sans-serif]">
                      {item.counterparty || item.senderAddress}
                    </span>

                    {/* Category Icon Badge (Airtime, Data, Bill, Cash, Transfer) */}
                    {item.category && (
                      <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded-md">
                        {getCategoryIcon(item.category)}
                        <span>{getCategoryLabel(item.category)}</span>
                      </span>
                    )}

                    {/* Dedupe Badge (Rule 6) */}
                    {item.isDuplicate && (
                      <span className="inline-flex items-center text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded-md">
                        Duplicate Ref
                      </span>
                    )}

                    {/* Edited Badge (Rule 5) */}
                    {item.isOverridden && (
                      <span className="inline-flex items-center text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.2 rounded-md">
                        Edited
                      </span>
                    )}

                    {/* Tag / Label Badge (Rule C4) */}
                    {item.tag && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                        <TagIcon size={9} />
                        {item.tag}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5 truncate">
                    <span className="font-medium text-slate-600">{item.bank}</span>
                    <span>·</span>
                    <span>{formatDateTime(item.timestamp)}</span>
                  </div>

                  {!hasParsedAmount && (
                    <p className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5 font-mono">
                      {item.rawMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Direction Arrow + Colored Amount + Status Badge */}
              <div className="text-right shrink-0">
                {hasParsedAmount ? (
                  <div className="flex items-center justify-end gap-1 font-['Poppins',sans-serif]">
                    {/* Small direction arrow */}
                    {isReceived && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-50 text-emerald-600">
                        <ArrowDownLeft size={12} />
                      </span>
                    )}
                    {isSent && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-100 text-slate-700">
                        <ArrowUpRight size={12} />
                      </span>
                    )}
                    {isUnknown && (
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-50 text-amber-600">
                        <HelpCircle size={12} />
                      </span>
                    )}

                    <span className={`text-sm font-extrabold ${
                      isReceived ? 'text-emerald-700' : isSent ? 'text-slate-900' : 'text-amber-700'
                    }`}>
                      {formatAmountCompact(item.amount, item.type)}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs font-mono font-bold text-slate-500">
                    RAW SMS
                  </div>
                )}

                {/* If Direction is unknown, prompt user clearly */}
                {isUnknown && (
                  <div className="mt-0.5 inline-flex items-center gap-0.5 text-[9.5px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                    <AlertTriangle size={10} />
                    <span>{isAm ? 'አልታወቀም' : 'Unknown Direction'}</span>
                  </div>
                )}

                <div className="mt-1 flex items-center justify-end flex-wrap gap-1">
                  {getSyncStatusBadge(item)}
                  {item.v2Code && (
                    <a
                      href={`https://mbreciept.cbe.com.et/${item.v2Code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-[#14503F] hover:underline bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shadow-2xs"
                    >
                      <ExternalLink size={9} />
                      <span>Open receipt</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>


      {/* Pagination Load More for 5,000+ items */}
      {payments.length > visibleCount && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount(prev => prev + 50)}
            className="w-full py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:text-[#14503F] hover:bg-slate-50 shadow-2xs transition-all"
          >
            Load more ({visibleCount} of {payments.length} shown)
          </button>
        </div>
      )}

      {/* Payment Detail & Edit Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${getBankBadge(selectedPayment.bank).bg}`}>
                  {getBankBadge(selectedPayment.bank).text}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                    {selectedPayment.bank} · {selectedPayment.type === 'received' ? 'Received' : selectedPayment.type === 'sent' ? 'Sent' : 'Unknown'}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Sender: {selectedPayment.senderAddress} {selectedPayment.reference ? `· Ref: ${selectedPayment.reference}` : ''}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPayment(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            {/* Big Amount & Duplicate Notice */}
            <div className="bg-[#14503F]/5 rounded-2xl p-4 text-center border border-[#14503F]/10 space-y-1">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {selectedPayment.type === 'received' ? 'Total Received' : selectedPayment.type === 'sent' ? 'Total Sent' : 'Transaction Amount'}
              </div>
              <div className="text-2xl font-extrabold text-[#14503F] font-['Poppins',sans-serif]">
                {selectedPayment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
              </div>
              {selectedPayment.isDuplicate && (
                <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                  <AlertTriangle size={12} />
                  <span>Duplicate Ref (Excluded from total balances)</span>
                </div>
              )}
            </div>

            {/* Edit Transaction Section (Rule 5) */}
            {isEditing ? (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
                    {isAm ? 'ክፍያውን ያስተካክሉ' : 'Edit Transaction Info'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>

                {/* Counterparty name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Counterparty Name</label>
                  <input
                    type="text"
                    value={editCounterparty}
                    onChange={e => setEditCounterparty(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#14503F]"
                    placeholder="Customer / Merchant Name"
                  />
                </div>

                {/* Direction Buttons */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Direction</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditDirection('received')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                        editDirection === 'received'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      <ArrowDownLeft size={13} />
                      <span>Received</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditDirection('sent')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                        editDirection === 'sent'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      <ArrowUpRight size={13} />
                      <span>Sent</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditDirection('unknown')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                        editDirection === 'unknown'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      <HelpCircle size={13} />
                      <span>Unknown</span>
                    </button>
                  </div>
                </div>

                {/* Note / Reason */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Note / Reason</label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={e => setEditNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#14503F]"
                    placeholder="e.g. Shop sales, supplier payout"
                  />
                </div>

                {/* Tag / Label Selection (Rule C4) */}
                <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                      <TagIcon size={12} className="text-[#14503F]" />
                      <span>Tag / Label</span>
                    </label>
                    {editTag && (
                      <button
                        type="button"
                        onClick={() => setEditTag('')}
                        className="text-[10px] text-slate-400 hover:text-slate-600 underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_TAGS.map(t => {
                      const isSel = editTag.toLowerCase() === t.toLowerCase();
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setEditTag(isSel ? '' : t)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                            isSel
                              ? 'bg-[#14503F] text-white border-[#14503F] shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    type="text"
                    value={editTag}
                    onChange={e => setEditTag(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#14503F]"
                    placeholder="Or type custom label..."
                  />
                  <p className="text-[10px] text-slate-400">
                    💡 Tagging remembers this label for &ldquo;{editCounterparty || 'this sender'}&rdquo; on future transactions.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingOverride}
                  className="w-full py-2.5 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-sm hover:bg-[#0e3b2e] flex items-center justify-center gap-1.5"
                >
                  <Check size={14} />
                  <span>{savingOverride ? 'Saving to SQLite...' : 'Save Changes'}</span>
                </button>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Counterparty:</span>
                  <span className="font-bold text-slate-900">{selectedPayment.counterparty}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Direction:</span>
                  <span className={`font-bold capitalize ${
                    selectedPayment.type === 'received' ? 'text-emerald-700' : selectedPayment.type === 'sent' ? 'text-slate-900' : 'text-amber-700'
                  }`}>
                    {selectedPayment.type}
                  </span>
                </div>

                {selectedPayment.tag && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Label / Tag:</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full">
                      <TagIcon size={10} />
                      {selectedPayment.tag}
                    </span>
                  </div>
                )}

                {selectedPayment.balance !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">SMS Stated Balance:</span>
                    <span className="font-mono font-bold text-slate-800">
                      ETB {selectedPayment.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {selectedPayment.note && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Note:</span>
                    <span className="font-medium text-slate-800">{selectedPayment.note}</span>
                  </div>
                )}

                {selectedPayment.reference && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Ref / FT Number:</span>
                    <span className="font-mono font-bold text-slate-900 select-all">{selectedPayment.reference}</span>
                  </div>
                )}

                {selectedPayment.v2Code && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">CBE v2 Link:</span>
                    <a
                      href={`https://mbreciept.cbe.com.et/${selectedPayment.v2Code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#14503F] hover:underline bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md"
                    >
                      <ExternalLink size={11} />
                      <span>Open receipt ({selectedPayment.v2Code})</span>
                    </a>
                  </div>
                )}

                {selectedPayment.serverResult && (
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Server Reply:</span>
                      <span className={`font-bold ${
                        selectedPayment.serverResult.status === 'Saved' 
                          ? 'text-emerald-700' 
                          : selectedPayment.serverResult.status === 'Ignored' 
                            ? 'text-amber-800' 
                            : 'text-slate-700'
                      }`}>
                        {selectedPayment.serverResult.status} (HTTP {selectedPayment.serverResult.httpCode})
                      </span>
                    </div>
                    {selectedPayment.serverResult.reason && (
                      <p className="text-slate-600 font-mono text-[10px]">
                        Reason: {selectedPayment.serverResult.reason}
                      </p>
                    )}
                    {selectedPayment.serverResult.resolving && (
                      <span className="inline-block text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 font-semibold">
                        FT resolution in progress on server
                      </span>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="flex-1 py-1.5 px-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1"
                  >
                    <Edit3 size={12} />
                    <span>Edit Name / Tag</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleHidePayment}
                    className="py-1.5 px-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-1"
                    title="Hide promotional or non-payment SMS"
                  >
                    <EyeOff size={12} />
                    <span>Not a payment</span>
                  </button>
                </div>
              </div>
            )}

            {/* RAW SMS Body (Never Changed) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Raw Bank SMS:</span>
                <button
                  type="button"
                  onClick={() => handleCopy(selectedPayment.rawMessage)}
                  className="text-[11px] text-[#14503F] font-bold hover:underline flex items-center gap-1"
                >
                  {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>
              <div className="bg-slate-900 text-slate-100 p-3 rounded-2xl font-mono text-xs leading-relaxed break-words border border-slate-800 select-all">
                {selectedPayment.rawMessage}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleManualRetry(selectedPayment)}
                disabled={retryingId === selectedPayment.id}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-md hover:bg-[#0e3b2e] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw size={14} className={retryingId === selectedPayment.id ? 'animate-spin' : ''} />
                <span>{retryingId === selectedPayment.id ? 'Retrying via Sync.run()...' : 'Retry Now'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
