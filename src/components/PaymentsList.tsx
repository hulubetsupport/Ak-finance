import React, { useState } from 'react';
import { PaymentRecord, AppSettings } from '../types/index.ts';
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
  Check
} from 'lucide-react';

interface PaymentsListProps {
  payments: PaymentRecord[];
  settings: AppSettings;
  onRetrySinglePayment: (payment: PaymentRecord) => Promise<void>;
  onDeletePayment?: (id: string) => Promise<void>;
}

export const PaymentsList: React.FC<PaymentsListProps> = ({
  payments,
  settings,
  onRetrySinglePayment,
}) => {
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const t = translations[settings.language];
  const isAm = settings.language === 'am';

  const formatAmountCompact = (num: number, type: 'received' | 'sent') => {
    if (settings.hideBalances) return '••••';
    const sign = type === 'received' ? '+' : '-';
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
    if (b.includes('CBE') || b === '127') {
      return { text: 'CBE', bg: 'bg-purple-100 text-purple-900 border-purple-200' };
    }
    if (b.includes('TELEBIRR')) {
      return { text: 'Telebirr', bg: 'bg-sky-100 text-sky-900 border-sky-200' };
    }
    if (b.includes('AWASH')) {
      return { text: 'Awash', bg: 'bg-amber-100 text-amber-900 border-amber-200' };
    }
    if (b.includes('DASHEN')) {
      return { text: 'Dashen', bg: 'bg-blue-100 text-blue-900 border-blue-200' };
    }
    if (b.includes('BOA') || b.includes('ABYSSINIA')) {
      return { text: 'BOA', bg: 'bg-rose-100 text-rose-900 border-rose-200' };
    }
    return {
      text: (bank || 'SMS').substring(0, 6),
      bg: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    };
  };

  // Payment row dot: green sent, amber pending, red failed
  const getStatusDot = (status: PaymentRecord['syncStatus']) => {
    switch (status) {
      case 'sent':
        return <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" title="Sent (HTTP 200)" />;
      case 'pending':
        return <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-xs" title="Pending" />;
      case 'failed':
        return <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs" title="Failed" />;
      case 'local':
      default:
        return <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shadow-xs" title="Local SQLite" />;
    }
  };

  const getSyncStatusBadge = (status: PaymentRecord['syncStatus']) => {
    switch (status) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <CheckCircle2 size={11} className="text-emerald-600" />
            <span>{t.statusSynced}</span>
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
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
            <AlertCircle size={11} className="text-rose-600" />
            <span>{t.statusFailed}</span>
          </span>
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

  return (
    <div className="space-y-2.5">
      {/* Header bar */}
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

      {/* List of Payments */}
      <div className="space-y-2">
        {payments.map(item => {
          const bankBadge = getBankBadge(item.bank);
          const isReceived = item.type === 'received';
          const hasParsedAmount = item.amount > 0;

          return (
            <div
              key={item.id}
              onClick={() => setSelectedPayment(item)}
              className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs hover:border-[#14503F]/30 hover:shadow-sm transition-all duration-150 cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3 group"
            >
              {/* Left Column: Status Dot + Bank badge & Counterparty */}
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Payment row dot: green sent, amber pending, red failed */}
                <div className="shrink-0 pl-0.5">
                  {getStatusDot(item.syncStatus)}
                </div>

                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border font-extrabold text-[10px] ${bankBadge.bg}`}>
                  <span>{bankBadge.text}</span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 truncate font-['Poppins',sans-serif]">
                      {item.counterparty || item.senderAddress}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 truncate">
                    <span>{item.bank}</span>
                    <span>·</span>
                    <span>{formatDateTime(item.timestamp)}</span>
                  </div>

                  {/* If parsing was unable to extract an amount, show raw preview snippet */}
                  {!hasParsedAmount && (
                    <p className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                      {item.rawMessage}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column: Amount + Status */}
              <div className="text-right shrink-0">
                {hasParsedAmount ? (
                  <div className={`text-sm font-extrabold font-['Poppins',sans-serif] ${
                    isReceived ? 'text-emerald-700' : 'text-slate-900'
                  }`}>
                    {formatAmountCompact(item.amount, item.type)}{' '}
                    <span className="text-[10px] font-semibold">
                      {isReceived ? (isAm ? 'ገቢ' : 'Received') : (isAm ? 'ወጪ' : 'Sent')}
                    </span>
                  </div>
                ) : (
                  <div className="text-xs font-mono font-bold text-slate-500">
                    RAW SMS
                  </div>
                )}

                <div className="mt-1 flex items-center justify-end">
                  {getSyncStatusBadge(item.syncStatus)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment Detail Modal: Raw SMS, error, [Retry] */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${getBankBadge(selectedPayment.bank).bg}`}>
                  {getBankBadge(selectedPayment.bank).text}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                    {selectedPayment.type === 'received' ? 'Incoming Payment' : 'Outgoing Transfer'}
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    From: {selectedPayment.senderAddress}
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

            {/* Amount (if parsed) */}
            {selectedPayment.amount > 0 && (
              <div className="bg-[#14503F]/5 rounded-2xl p-4 text-center border border-[#14503F]/10">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {selectedPayment.type === 'received' ? 'Total Received' : 'Total Sent'}
                </div>
                <div className="text-2xl font-extrabold text-[#14503F] mt-1 font-['Poppins',sans-serif]">
                  {selectedPayment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                </div>
              </div>
            )}

            {/* Status & Attempts */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Sync Status:</span>
                <div>{getSyncStatusBadge(selectedPayment.syncStatus)}</div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tries / Attempts:</span>
                <span className="font-mono font-bold text-slate-800">{selectedPayment.retryCount}</span>
              </div>

              {selectedPayment.serverResponse && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Server Reply:</span>
                  <span className="font-mono font-bold text-slate-800">{selectedPayment.serverResponse}</span>
                </div>
              )}

              {selectedPayment.errorMessage && (
                <div className="pt-1 border-t border-slate-200">
                  <span className="text-rose-600 font-semibold block mb-0.5">Sync Error:</span>
                  <p className="font-mono text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200 break-all">
                    {selectedPayment.errorMessage}
                  </p>
                </div>
              )}
            </div>

            {/* RAW SMS Body with Copy Button */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Raw SMS Text:</span>
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

            {/* Actions: Retry button if failed or pending */}
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
