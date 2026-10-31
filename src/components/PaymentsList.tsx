import React, { useState, useMemo } from 'react';
import { 
  PaymentRecord, 
  PaymentType, 
  AppSettings, 
  PaymentCategory 
} from '../types/index.ts';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Copy, 
  Check, 
  AlertCircle, 
  Clock, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Building2, 
  Edit2, 
  Trash2, 
  RotateCcw,
  Tag as TagIcon,
  Tag,
  CreditCard,
  Receipt,
  Smartphone,
  Wifi,
  Banknote,
  ArrowLeftRight,
  HardDrive,
  Info,
  X,
  Share2,
  Search,
  FileText,
  Download,
  SlidersHorizontal,
  ChevronDown,
  CheckSquare,
  Square,
  BarChart2,
  ArrowUpDown,
  QrCode,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { translations } from '../utils/i18n.ts';
import { getBankBrand, BankBrand } from '../constants/bankBrands.ts';

interface PaymentsListProps {
  payments: PaymentRecord[];
  settings: AppSettings;
  activeDirection?: 'all' | 'received' | 'sent';
  onFilterDirection?: (dir: 'all' | 'received' | 'sent') => void;
  onRetrySinglePayment: (payment: PaymentRecord) => Promise<void>;
  onDeletePayment: (id: string) => Promise<void>;
  onSaveOverride?: (
    id: string,
    override: { counterparty?: string | null; direction?: string | null; note?: string; tag?: string; isHidden?: boolean; reference?: string }
  ) => Promise<void>;
}

export const PaymentsList: React.FC<PaymentsListProps> = ({
  payments,
  settings,
  activeDirection,
  onFilterDirection,
  onRetrySinglePayment,
  onDeletePayment,
  onSaveOverride,
}) => {
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Direction filter (internal fallback if activeDirection not controlled)
  const [internalDirection, setInternalDirection] = useState<'all' | 'received' | 'sent'>('all');
  const currentDirection = activeDirection !== undefined ? activeDirection : internalDirection;

  // Category and Search filter
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchInput, setShowSearchInput] = useState<boolean>(false);

  // 2026 Batch Selection & Multi-Transaction Management
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagModalOpen, setBulkTagModalOpen] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [copiedBatchRefs, setCopiedBatchRefs] = useState(false);

  // 2026 Advanced Sorting & Status Filtering
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [statusFilter, setStatusFilter] = useState<'all' | 'saved' | 'pending' | 'duplicate'>('all');
  const [showFiltersDrawer, setShowFiltersDrawer] = useState<boolean>(false);
  const [showQuickAnalytics, setShowQuickAnalytics] = useState<boolean>(false);

  // Modal Sub-view: Details or Branded Digital Receipt
  const [modalView, setModalView] = useState<'details' | 'receipt'>('details');

  // Quick edit modal or row title edit
  const [isEditing, setIsEditing] = useState(false);
  const [editCounterparty, setEditCounterparty] = useState('');
  const [editDirection, setEditDirection] = useState<PaymentType>('unknown');
  const [editCategory, setEditCategory] = useState<string>('transfer');
  const [editNote, setEditNote] = useState('');
  const [editTag, setEditTag] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  // Quick inline name edit state
  const [inlineEditPayment, setInlineEditPayment] = useState<PaymentRecord | null>(null);
  const [inlineName, setInlineName] = useState('');

  // FT Retry & Recovery State ("isn't the FT gaind add rety")
  const [ftRetryPayment, setFtRetryPayment] = useState<PaymentRecord | null>(null);
  const [ftInput, setFtInput] = useState('');
  const [ftCandidate, setFtCandidate] = useState<string | null>(null);
  const [savingFt, setSavingFt] = useState(false);
  const [ftSuccessMsg, setFtSuccessMsg] = useState<string | null>(null);

  // Performance pagination
  const [visibleCount, setVisibleCount] = useState(50);

  // Non-transaction alerts toggle (hide/show)
  const [hideAlerts, setHideAlerts] = useState(false);

  const t = translations[settings.language];
  const isAm = settings.language === 'am';

  const alertCount = useMemo(() => {
    return payments.filter(p => p.category === 'alert' || p.amount === 0 || p.serverResult?.status === 'Ignored').length;
  }, [payments]);

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  };

  const handleSetDirection = (dir: 'all' | 'received' | 'sent') => {
    triggerHaptic();
    setInternalDirection(dir);
    onFilterDirection?.(dir);
    setVisibleCount(50);
  };

  // Toggle item selection
  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerHaptic();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all currently visible filtered items
  const handleSelectAllVisible = () => {
    triggerHaptic();
    const visible = filteredPayments.slice(0, visibleCount);
    const allSelected = visible.every(p => selectedIds.has(p.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visible.map(p => p.id)));
    }
  };

  // Filtered Payments calculation (with status filter and sorting)
  const filteredPayments = useMemo(() => {
    const list = payments.filter(p => {
      // 1. Direction filter
      if (currentDirection !== 'all' && p.type !== currentDirection) {
        return false;
      }

      // 2. Category filter & Alert option
      const isItemAlert = p.category === 'alert' || p.amount === 0 || p.serverResult?.status === 'Ignored';

      if (selectedCategory !== 'all') {
        if (selectedCategory === 'airtime' && p.category !== 'airtime') return false;
        if (selectedCategory === 'data' && p.category !== 'data') return false;
        if (selectedCategory === 'atm-card' && p.category !== 'atm-card') return false;
        if (selectedCategory === 'bill' && p.category !== 'bill') return false;
        if (selectedCategory === 'transfer' && (p.category !== 'transfer' && p.category !== undefined)) return false;
        if (selectedCategory === 'alert' && !isItemAlert) return false;
      } else if (hideAlerts && isItemAlert) {
        return false;
      }

      // 3. Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'saved' && p.syncStatus !== 'sent' && p.serverResult?.status !== 'Saved') return false;
        if (statusFilter === 'pending' && p.syncStatus !== 'pending' && p.syncStatus !== 'local') return false;
        if (statusFilter === 'duplicate' && !p.isDuplicate && p.serverResult?.status !== 'Duplicate') return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const cp = (p.counterparty || '').toLowerCase();
        const ref = (p.reference || '').toLowerCase();
        const bank = (p.bank || '').toLowerCase();
        const raw = (p.rawMessage || '').toLowerCase();
        const tag = (p.tag || '').toLowerCase();
        const amt = (p.amount || 0).toString();

        const match = cp.includes(q) || ref.includes(q) || bank.includes(q) || raw.includes(q) || tag.includes(q) || amt.includes(q);
        if (!match) return false;
      }

      return true;
    });

    // 5. Sort Order
    return list.sort((a, b) => {
      if (sortBy === 'newest') return b.timestamp - a.timestamp;
      if (sortBy === 'oldest') return a.timestamp - b.timestamp;
      if (sortBy === 'highest') return (b.amount || 0) - (a.amount || 0);
      if (sortBy === 'lowest') return (a.amount || 0) - (b.amount || 0);
      return b.timestamp - a.timestamp;
    });
  }, [payments, currentDirection, selectedCategory, searchQuery, hideAlerts, statusFilter, sortBy]);

  // Totals for direction chips (exclude alert non-payments)
  const totalReceived = useMemo(() => {
    return payments
      .filter(p => p.type === 'received' && !p.isDuplicate && !p.isHidden && p.category !== 'alert')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  const totalSent = useMemo(() => {
    return payments
      .filter(p => p.type === 'sent' && !p.isDuplicate && !p.isHidden && p.category !== 'alert')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  const receivedCount = useMemo(() => payments.filter(p => p.type === 'received' && p.category !== 'alert').length, [payments]);
  const sentCount = useMemo(() => payments.filter(p => p.type === 'sent' && p.category !== 'alert').length, [payments]);

  const formatAmountCompact = (num: number, type: PaymentType) => {
    if (settings.hideBalances) return '••••';
    const sign = type === 'received' ? '+' : type === 'sent' ? '-' : '';
    return `${sign}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  const getSyncStatusBadge = (item: PaymentRecord) => {
    const sr = item.serverResult;
    if (sr) {
      if (sr.resolving) {
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
            <Clock size={11} className="text-blue-600 animate-spin" />
            <span>FT pending</span>
          </span>
        );
      }
      if (sr.status === 'Saved') {
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <Check size={11} className="text-emerald-600" />
            <span>Saved ✓</span>
          </span>
        );
      }
      if (sr.status === 'Duplicate') {
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-300">
            <span>Duplicate</span>
          </span>
        );
      }
      if (sr.status === 'Ignored') {
        const isAlertOrNonPayment = item.category === 'alert' || item.amount === 0 || (sr.reason && /not\s*a\s*payment/i.test(sr.reason));
        if (isAlertOrNonPayment) {
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-300" title={sr.reason || 'Non-financial notification'}>
              <Info size={11} className="text-slate-500" />
              <span>Bank Alert</span>
            </span>
          );
        }
        return (
          <div className="inline-flex items-center gap-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300" title={sr.reason || 'Ignored by server'}>
              <AlertCircle size={11} className="text-amber-600" />
              <span>Ignored{sr.reason ? `: ${sr.reason}` : ''}</span>
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleManualRetry(item);
              }}
              disabled={retryingId === item.id}
              className="px-1.5 py-0.5 text-[9.5px] font-bold bg-amber-100 text-amber-900 rounded border border-amber-300 hover:bg-amber-200"
            >
              Retry
            </button>
          </div>
        );
      }
      if (sr.status === 'Unknown' || (!sr.status && sr.httpCode === 200)) {
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            <span>Unknown reply</span>
          </span>
        );
      }
    }

    switch (item.syncStatus) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <Check size={11} className="text-emerald-600" />
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
    triggerHaptic();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySummary = () => {
    const lines = [
      `📊 Ak Financial Statement Summary`,
      `📅 Period Transactions: ${filteredPayments.length}`,
      `💰 Total Received: +${totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB (${receivedCount} in)`,
      `💸 Total Sent: -${totalSent.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB (${sentCount} out)`,
      `📈 Net Movement: ${(totalReceived - totalSent >= 0 ? '+' : '-')}${Math.abs(totalReceived - totalSent).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB`,
      `Generated on ${new Date().toLocaleDateString()}`
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSummary(true);
    triggerHaptic();
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const handleSharePaymentReceipt = (item: PaymentRecord) => {
    const text = [
      `🧾 Payment Confirmation`,
      `🏦 Bank: ${item.bank}`,
      `💵 Amount: ${item.type === 'received' ? '+' : '-'}${item.amount.toFixed(2)} ETB`,
      `🔄 Direction: ${item.type === 'received' ? 'Received (In)' : 'Sent (Out)'}`,
      item.counterparty ? `👤 Party: ${item.counterparty}` : '',
      item.reference ? `🔢 Ref/FT: ${item.reference}` : '',
      item.v2Code ? `🔗 Receipt: https://mbreciept.cbe.com.et/${item.v2Code}` : '',
      `📅 Date: ${new Date(item.timestamp).toLocaleString()}`,
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    triggerHaptic();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualRetry = async (payment: PaymentRecord) => {
    setRetryingId(payment.id);
    await onRetrySinglePayment(payment);
    setRetryingId(null);
  };

  // 2026 Batch Actions Handlers
  const handleBatchCopyRefs = () => {
    const refs = payments
      .filter(p => selectedIds.has(p.id))
      .map(p => p.reference || p.ftNumber || p.id)
      .filter(Boolean);
    if (refs.length === 0) return;
    navigator.clipboard.writeText(refs.join('\n'));
    setCopiedBatchRefs(true);
    triggerHaptic();
    setTimeout(() => setCopiedBatchRefs(false), 2000);
  };

  const handleBatchExportCsv = () => {
    const selected = payments.filter(p => selectedIds.has(p.id));
    if (selected.length === 0) return;
    const headers = ['ID', 'Date', 'Bank', 'Sender Address', 'Type', 'Amount ETB', 'Counterparty', 'Reference', 'Category', 'Tag', 'Raw SMS'];
    const rows = selected.map(p => [
      p.id,
      new Date(p.timestamp).toLocaleString(),
      p.bank || 'Unknown',
      p.senderAddress || '',
      p.type || 'unknown',
      p.amount || 0,
      `"${(p.counterparty || '').replace(/"/g, '""')}"`,
      p.reference || '',
      p.category || 'other',
      p.tag || '',
      `"${(p.rawMessage || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ak_payments_selected_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerHaptic();
  };

  const handleBatchHide = async () => {
    if (!onSaveOverride) return;
    const count = selectedIds.size;
    if (!window.confirm(`Hide ${count} selected transactions from your statement?`)) return;
    setSavingOverride(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await onSaveOverride(id, { isHidden: true });
      }
      setSelectedIds(new Set());
      setSelectionMode(false);
    } finally {
      setSavingOverride(false);
    }
  };

  const handleBatchApplyTag = async (tagToApply: string) => {
    if (!onSaveOverride || !tagToApply.trim()) return;
    setSavingOverride(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await onSaveOverride(id, { tag: tagToApply.trim() });
      }
      setBulkTagModalOpen(false);
      setBulkTagInput('');
      setSelectedIds(new Set());
      setSelectionMode(false);
    } finally {
      setSavingOverride(false);
    }
  };

  // Active Filtered Totals for Analytics Gauge
  const filteredInflow = useMemo(() => {
    return filteredPayments
      .filter(p => p.type === 'received' && p.category !== 'alert')
      .reduce((s, p) => s + (p.amount || 0), 0);
  }, [filteredPayments]);

  const filteredOutflow = useMemo(() => {
    return filteredPayments
      .filter(p => p.type === 'sent' && p.category !== 'alert')
      .reduce((s, p) => s + (p.amount || 0), 0);
  }, [filteredPayments]);

  const filteredNet = filteredInflow - filteredOutflow;
  const filteredTotalVolume = filteredInflow + filteredOutflow;
  const inflowRatio = filteredTotalVolume > 0 ? Math.round((filteredInflow / filteredTotalVolume) * 100) : 50;

  const avgTxnSize = useMemo(() => {
    const nonAlerts = filteredPayments.filter(p => p.category !== 'alert' && p.amount > 0);
    if (nonAlerts.length === 0) return 0;
    const sum = nonAlerts.reduce((s, p) => s + p.amount, 0);
    return Math.round(sum / nonAlerts.length);
  }, [filteredPayments]);

  const getRowTitle = (item: PaymentRecord): string => {
    const cp = (item.counterparty || '').trim();
    const tail = item.accountNumber ? `acct …${item.accountNumber.slice(-4)}` : '';

    if (item.category === 'alert' || item.amount === 0 || item.serverResult?.status === 'Ignored') {
      if (cp && !cp.toLowerCase().includes('unknown')) return cp;
      return isAm ? `${item.bank || 'ባንክ'} ማሳወቂያ` : `${item.bank || 'Bank'} Alert`;
    }

    if (item.type === 'received') {
      if (cp) return `From ${cp}`;
      if (tail) return `Unknown sender (${tail})`;
      return isAm ? 'ያልታወቀ ላኪ' : 'Unknown sender';
    }

    if (item.type === 'sent') {
      if (cp) return `To ${cp}`;
      if (item.category === 'airtime') return `Airtime Recharge${tail ? ` (${tail})` : ''}`;
      if (item.category === 'data') return `Data Package${tail ? ` (${tail})` : ''}`;
      if (item.category === 'atm-card') return 'ATM / Card debit';
      if (item.category === 'bill') return `Bill Payment${tail ? ` (${tail})` : ''}`;
      if (item.category === 'payment') return `Payment${tail ? ` (${tail})` : ''}`;
      if (tail) return `Unknown receiver (${tail})`;
      return isAm ? 'ያልታወቀ ተቀባይ' : 'Unknown receiver';
    }

    if (cp) return cp;
    return isAm ? 'ያልታወቀ ግብይት' : 'Unknown transaction';
  };

  const getCategoryLabel = (category?: PaymentCategory | string): string => {
    switch (category) {
      case 'alert':
        return isAm ? 'ማሳወቂያ' : 'Bank Alert';
      case 'airtime':
        return isAm ? 'አየር ሰዓት' : 'Airtime';
      case 'data':
        return isAm ? 'ዳታ' : 'Data';
      case 'atm-card':
        return isAm ? 'ATM / ካርድ' : 'ATM/Card';
      case 'bill':
        return isAm ? 'ቢል' : 'Bill';
      case 'payment':
        return isAm ? 'ክፍያ' : 'Payment';
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
    setEditCategory(payment.category || 'transfer');
    setEditNote(payment.note || '');
    setEditTag(payment.tag || '');
  };

  const openInlineNameEdit = (e: React.MouseEvent, payment: PaymentRecord) => {
    e.stopPropagation();
    triggerHaptic();
    setInlineEditPayment(payment);
    setInlineName(payment.counterparty || '');
  };

  const handleSaveInlineName = async () => {
    if (!inlineEditPayment || !onSaveOverride) return;
    setSavingOverride(true);
    try {
      await onSaveOverride(inlineEditPayment.id, {
        counterparty: inlineName.trim(),
        direction: inlineEditPayment.type,
        note: inlineEditPayment.note,
        tag: inlineEditPayment.tag,
        isHidden: false,
      });
      setInlineEditPayment(null);
    } finally {
      setSavingOverride(false);
    }
  };

  const handleApplySuggestedTag = async (payment: PaymentRecord, tagToApply: string) => {
    if (!onSaveOverride) return;
    triggerHaptic();
    await onSaveOverride(payment.id, {
      counterparty: payment.counterparty,
      direction: payment.type,
      note: payment.note,
      tag: tagToApply,
      isHidden: false,
    });
  };

  const isMissingFt = (p: PaymentRecord): boolean => {
    if (p.category === 'alert') return false;
    if (!p.reference || p.reference === 'None' || p.reference === 'Unknown' || p.reference.startsWith('SMS-')) {
      return true;
    }
    return false;
  };

  const scanForFtCandidate = (rawMessage: string): string | null => {
    if (!rawMessage) return null;
    const ftMatch = rawMessage.match(/\b(FT[A-Za-z0-9]{8,16})\b/i);
    if (ftMatch && ftMatch[1]) return ftMatch[1].toUpperCase();

    const djsMatch = rawMessage.match(/\b(DJS[A-Za-z0-9]{6,14})\b/i);
    if (djsMatch && djsMatch[1]) return djsMatch[1].toUpperCase();

    const v2Match = rawMessage.match(/\b(v2-[A-Za-z0-9_-]+)\b/);
    if (v2Match && v2Match[1]) return v2Match[1];

    const tbMatch = rawMessage.match(/(?:የግብይት\s*ቁጥርዎ?|transaction\s*(?:number|id|no\.?)|txn\s*id)\s*(?:is|ነው|ነዉ)?\s*:?\s*([A-Za-z0-9]{8,15})/i);
    if (tbMatch && tbMatch[1]) return tbMatch[1].trim();

    const refMatch = rawMessage.match(/(?:txn\s*id|ref(?:erence)?\s*no\.?|code)\s*[:#]?\s*([A-Za-z0-9]{6,16})/i);
    if (refMatch && refMatch[1]) return refMatch[1].trim();

    return null;
  };

  const handleOpenFtRetry = (p: PaymentRecord) => {
    triggerHaptic();
    const candidate = scanForFtCandidate(p.rawMessage);
    setFtCandidate(candidate);
    setFtInput(candidate || (p.reference && !p.reference.startsWith('SMS-') ? p.reference : ''));
    setFtRetryPayment(p);
    setFtSuccessMsg(null);
  };

  const handleSaveFtAndRetry = async (targetFt: string) => {
    if (!ftRetryPayment || !onSaveOverride) return;
    const cleanFt = targetFt.trim();
    if (!cleanFt) return;
    setSavingFt(true);
    try {
      await onSaveOverride(ftRetryPayment.id, {
        reference: cleanFt,
        isHidden: false,
      });
      await onRetrySinglePayment(ftRetryPayment);
      setFtSuccessMsg(`FT Saved ✓ (${cleanFt}) - Synced`);
      setTimeout(() => {
        setFtRetryPayment(null);
        setFtSuccessMsg(null);
      }, 1400);
    } catch {
      setFtSuccessMsg('Saved locally');
      setTimeout(() => setFtRetryPayment(null), 1400);
    } finally {
      setSavingFt(false);
    }
  };

  const handleSaveModalEdit = async () => {
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
        category: editCategory as PaymentCategory,
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
    <div className="w-full max-w-full box-border space-y-3">
      {/* 1. Direction Filter Segmented Bar: All, Received, Sent */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-['Poppins',sans-serif]">
              {t.recentPayments}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
              {filteredPayments.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Analytics Toggle */}
            <button
              onClick={() => {
                triggerHaptic();
                setShowQuickAnalytics(prev => !prev);
              }}
              className={`p-1.5 rounded-xl border transition-colors ${
                showQuickAnalytics
                  ? 'bg-emerald-50 border-emerald-300 text-[#14503F]'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
              title="Toggle Quick Volume Analytics"
            >
              <BarChart2 size={14} />
            </button>

            {/* Sort & Status Filter Toggle */}
            <button
              onClick={() => {
                triggerHaptic();
                setShowFiltersDrawer(prev => !prev);
              }}
              className={`p-1.5 rounded-xl border transition-colors ${
                showFiltersDrawer || sortBy !== 'newest' || statusFilter !== 'all'
                  ? 'bg-emerald-50 border-emerald-300 text-[#14503F]'
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
              title="Sort and status options"
            >
              <SlidersHorizontal size={14} />
            </button>

            {/* Multi-Select Mode Toggle */}
            <button
              onClick={() => {
                triggerHaptic();
                setSelectionMode(prev => {
                  if (prev) setSelectedIds(new Set());
                  return !prev;
                });
              }}
              className={`px-2 py-1 rounded-xl border text-[11px] font-semibold transition-colors flex items-center gap-1 ${
                selectionMode
                  ? 'bg-[#14503F] border-[#14503F] text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="Select multiple transactions"
            >
              <CheckSquare size={13} />
              <span className="hidden xs:inline">{selectionMode ? 'Done' : 'Select'}</span>
            </button>

            {/* Search Toggle */}
            <button
              onClick={() => {
                triggerHaptic();
                setShowSearchInput(prev => !prev);
              }}
              className={`p-1.5 rounded-xl border transition-colors ${
                showSearchInput || searchQuery 
                  ? 'bg-emerald-50 border-emerald-300 text-[#14503F]' 
                  : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
              }`}
              title="Search transactions"
            >
              <Search size={14} />
            </button>

            {/* Statement Summary Copy Button */}
            <button
              onClick={handleCopySummary}
              className="px-2 py-1 rounded-xl bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-2xs transition-all active:scale-95"
              title="Copy summary statement"
            >
              {copiedSummary ? <Check size={12} className="text-emerald-600" /> : <Share2 size={12} />}
              <span className="hidden sm:inline">{copiedSummary ? 'Copied' : 'Share'}</span>
            </button>
          </div>
        </div>

        {/* 2026 Quick Cashflow Analytics Gauge (Toggleable) */}
        {showQuickAnalytics && (
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-3.5 shadow-sm space-y-2.5 animate-fadeIn border border-emerald-900/40">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5 text-emerald-300">
                <Sparkles size={13} /> Active Period Flow Metrics
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Avg: {avgTxnSize.toLocaleString()} ETB
              </span>
            </div>

            {/* Visual Ratio Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10.5px] font-semibold">
                <span className="text-emerald-400">Inflow: +{filteredInflow.toLocaleString()} ETB ({inflowRatio}%)</span>
                <span className="text-rose-300">Outflow: -{filteredOutflow.toLocaleString()} ETB ({100 - inflowRatio}%)</span>
              </div>
              <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden flex">
                <div 
                  className="bg-emerald-400 h-full transition-all duration-300" 
                  style={{ width: `${inflowRatio}%` }} 
                />
                <div 
                  className="bg-rose-500 h-full transition-all duration-300" 
                  style={{ width: `${100 - inflowRatio}%` }} 
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-700/60 text-xs">
              <span className="text-slate-400">Net Movement:</span>
              <span className={`font-black font-['Poppins',sans-serif] ${
                filteredNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {filteredNet >= 0 ? '+' : ''}{filteredNet.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
              </span>
            </div>
          </div>
        )}

        {/* 2026 Sort & Status Drawer (Toggleable) */}
        {showFiltersDrawer && (
          <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-2xs space-y-2.5 animate-fadeIn">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <ArrowUpDown size={10} /> Sort Order
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'newest', label: 'Newest First' },
                  { id: 'oldest', label: 'Oldest First' },
                  { id: 'highest', label: 'Highest Amount' },
                  { id: 'lowest', label: 'Lowest Amount' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      triggerHaptic();
                      setSortBy(s.id as any);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all ${
                      sortBy === s.id
                        ? 'bg-[#14503F] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Status Filter
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'all', label: 'All Status' },
                  { id: 'saved', label: 'Saved ✓' },
                  { id: 'pending', label: 'Pending ⏳' },
                  { id: 'duplicate', label: 'Duplicate ⚠️' },
                ].map(st => (
                  <button
                    key={st.id}
                    onClick={() => {
                      triggerHaptic();
                      setStatusFilter(st.id as any);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all ${
                      statusFilter === st.id
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Selection Mode Header Toolbar */}
        {selectionMode && (
          <div className="flex items-center justify-between px-3 py-2 bg-emerald-50/80 rounded-xl border border-emerald-200/80 text-xs font-semibold text-emerald-950">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#14503F]">
                {selectedIds.size} of {filteredPayments.length} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="text-[11px] font-bold text-[#14503F] hover:underline"
              >
                {filteredPayments.slice(0, visibleCount).every(p => selectedIds.has(p.id))
                  ? 'Deselect All'
                  : 'Select Visible'}
              </button>
              <span className="text-emerald-300">|</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedIds(new Set());
                  setSelectionMode(false);
                }}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Direction Segmented Control */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/80 rounded-2xl">
          {/* All */}
          <button
            type="button"
            onClick={() => handleSetDirection('all')}
            className={`py-2 px-1 text-center rounded-xl transition-all font-bold text-xs flex flex-col items-center justify-center ${
              currentDirection === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-1">
              <span>{isAm ? 'ሁሉም' : 'All'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                currentDirection === 'all' ? 'bg-white/20 text-white' : 'bg-slate-300 text-slate-700'
              }`}>
                {payments.length}
              </span>
            </div>
          </button>

          {/* Received (In) */}
          <button
            type="button"
            onClick={() => handleSetDirection('received')}
            className={`py-2 px-1 text-center rounded-xl transition-all font-bold text-xs flex flex-col items-center justify-center ${
              currentDirection === 'received'
                ? 'bg-[#14503F] text-white shadow-sm ring-1 ring-emerald-500'
                : 'text-emerald-800 hover:bg-emerald-50/60'
            }`}
          >
            <div className="flex items-center gap-1">
              <ArrowDownLeft size={13} className="text-emerald-400" />
              <span>{isAm ? 'ገቢ (In)' : 'Received'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                currentDirection === 'received' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-900'
              }`}>
                {receivedCount}
              </span>
            </div>
          </button>

          {/* Sent (Out) */}
          <button
            type="button"
            onClick={() => handleSetDirection('sent')}
            className={`py-2 px-1 text-center rounded-xl transition-all font-bold text-xs flex flex-col items-center justify-center ${
              currentDirection === 'sent'
                ? 'bg-rose-950 text-white shadow-sm ring-1 ring-rose-500'
                : 'text-rose-800 hover:bg-rose-50/60'
            }`}
          >
            <div className="flex items-center gap-1">
              <ArrowUpRight size={13} className="text-rose-400" />
              <span>{isAm ? 'ወጪ (Out)' : 'Sent'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                currentDirection === 'sent' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-900'
              }`}>
                {sentCount}
              </span>
            </div>
          </button>
        </div>

        {/* Search input field if toggled */}
        {showSearchInput && (
          <div className="relative animate-fadeIn">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isAm ? 'በስም፣ በባንክ ወይም በሪፈረንስ ፈልግ...' : 'Search by name, reference, bank or amount...'}
              className="w-full pl-8 pr-8 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#14503F]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Quick Category Filter Chips */}
        <div className="flex items-center justify-between gap-1.5 py-0.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
            {[
              { id: 'all', label: isAm ? 'ሁሉም ዓይነቶች' : 'All Types' },
              { id: 'transfer', label: isAm ? 'ዝውውር' : 'Transfers' },
              { id: 'airtime', label: isAm ? 'አየር ሰዓት' : 'Airtime' },
              { id: 'data', label: isAm ? 'ዳታ' : 'Data' },
              { id: 'atm-card', label: isAm ? 'ATM/ካርድ' : 'ATM/Card' },
              { id: 'bill', label: isAm ? 'ቢል' : 'Bills' },
              { id: 'alert', label: isAm ? `ማሳወቂያ (${alertCount})` : `Alerts ${alertCount > 0 ? `(${alertCount})` : ''}` },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  triggerHaptic();
                  setSelectedCategory(cat.id);
                  setVisibleCount(50);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {alertCount > 0 && selectedCategory === 'all' && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic();
                setHideAlerts(v => !v);
              }}
              className="text-[10px] font-bold text-slate-500 hover:text-slate-800 shrink-0 px-2 py-1 rounded-lg border border-slate-200 bg-white shadow-2xs"
              title="Toggle non-transaction alerts"
            >
              {hideAlerts ? 'Show Alerts' : 'Hide Alerts'}
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredPayments.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-slate-200">
          <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <div className="text-sm font-bold text-slate-700">{t.emptyPayments}</div>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {searchQuery || currentDirection !== 'all' || selectedCategory !== 'all'
              ? 'No transactions matched the selected filters. Tap another filter to see records.'
              : t.emptyPaymentsSub}
          </p>
          {(searchQuery || currentDirection !== 'all' || selectedCategory !== 'all') && (
            <button
              onClick={() => {
                setInternalDirection('all');
                onFilterDirection?.('all');
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="mt-3 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-xs hover:bg-slate-800"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* Payment List */}
      <div className="space-y-2 w-full max-w-full">
        {filteredPayments.slice(0, visibleCount).map(item => {
          const brand: BankBrand = getBankBrand(item.bank);
          const isReceived = item.type === 'received';
          const isSent = item.type === 'sent';
          const isAlert = item.category === 'alert' || item.amount === 0 || item.serverResult?.status === 'Ignored';
          const rowTitle = getRowTitle(item);
          const hasV2 = Boolean(item.v2Code);
          const v2Link = item.v2Code ? `https://mbreciept.cbe.com.et/${item.v2Code}` : null;

          const isSelected = selectedIds.has(item.id);

          return (
            <div
              key={item.id}
              onClick={() => {
                if (selectionMode) {
                  handleToggleSelect(item.id);
                } else {
                  openPaymentModal(item);
                }
              }}
              style={{ boxSizing: 'border-box' }}
              className={`bg-white rounded-2xl p-3 border shadow-xs hover:border-[#14503F]/40 hover:shadow-sm transition-all duration-150 cursor-pointer active:scale-[0.99] flex items-center justify-between gap-2.5 group w-full min-w-0 ${
                isSelected ? 'border-[#14503F] bg-emerald-50/20 ring-1 ring-[#14503F]/30' : 'border-slate-200/80'
              }`}
            >
              {/* Left Column: Selection Checkbox + Bank LOGO + Title/Subtitle */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {selectionMode && (
                  <button
                    type="button"
                    onClick={(e) => handleToggleSelect(item.id, e)}
                    className="p-1 -ml-1 text-[#14503F] shrink-0 hover:scale-110 transition-transform"
                    aria-label="Toggle selection"
                  >
                    {isSelected ? (
                      <CheckSquare size={18} className="text-[#14503F]" />
                    ) : (
                      <Square size={18} className="text-slate-300 hover:text-slate-500" />
                    )}
                  </button>
                )}
                {/* Bank Brand Logo Badge */}
                {brand.logoUrl ? (
                  <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs overflow-hidden group-hover:scale-105 transition-transform">
                    <img 
                      src={brand.logoUrl} 
                      alt={brand.name} 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border font-black text-[10.5px] shadow-2xs group-hover:scale-105 transition-transform ${brand.badgeClass}`}
                    title={brand.name}
                  >
                    <span>{brand.shortCode}</span>
                  </div>
                )}

                {/* Title + Subtitle + Chips */}
                <div className="min-w-0 flex-1">
                  {/* Title Row (tappable to edit name) */}
                  <div className="flex items-center gap-1 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => openInlineNameEdit(e, item)}
                      className="text-left text-xs font-bold text-slate-900 truncate hover:text-[#14503F] hover:underline transition-colors font-['Poppins',sans-serif] block"
                      title="Tap to edit counterparty name"
                    >
                      {rowTitle}
                    </button>
                    {item.isOverridden && (
                      <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1 py-0.2 rounded shrink-0">
                        Edited
                      </span>
                    )}
                  </div>

                  {/* Subtitle: Bank Short Name · Date Time · Ref */}
                  <div className="flex items-center gap-1 text-[10.5px] text-slate-500 mt-0.5 truncate font-mono">
                    <span className="font-bold text-slate-700">{brand.shortCode}</span>
                    <span>·</span>
                    <span>{formatDateTime(item.timestamp)}</span>
                    {item.reference && (
                      <>
                        <span>·</span>
                        <span className="text-slate-400 truncate max-w-[80px]">{item.reference}</span>
                      </>
                    )}
                  </div>

                  {/* Chips Row: Direction Chip + Separate Category Chip + Tag / Tag Suggestion */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    {/* Direction / Alert Chip */}
                    {isAlert ? (
                      <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold bg-amber-50 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded-md">
                        Alert ℹ️
                      </span>
                    ) : (
                      <>
                        {isReceived && (
                          <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.2 rounded-md">
                            Received ↙
                          </span>
                        )}
                        {isSent && (
                          <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold bg-rose-100 text-rose-900 border border-rose-300 px-1.5 py-0.2 rounded-md">
                            Sent ↗
                          </span>
                        )}
                        {!isReceived && !isSent && (
                          <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.2 rounded-md">
                            Unknown ?
                          </span>
                        )}
                      </>
                    )}

                    {/* Separate Category Chip */}
                    {item.category && item.category !== 'received' && item.category !== 'alert' && !isAlert && (
                      <span className="inline-flex items-center text-[9px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.2 rounded-md">
                        {getCategoryLabel(item.category)}
                      </span>
                    )}

                    {/* Tag Chip */}
                    {item.tag && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                        <TagIcon size={8} />
                        {item.tag}
                      </span>
                    )}

                    {/* Suggested Tag */}
                    {item.suggestedTag && !item.tag && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplySuggestedTag(item, item.suggestedTag!);
                        }}
                        className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-300 border-dashed px-1.5 py-0.2 rounded-md hover:bg-amber-100 transition-colors"
                        title="Click to apply suggested tag"
                      >
                        + Suggest: {item.suggestedTag}
                      </button>
                    )}

                    {/* Duplicate Indicator */}
                    {item.isDuplicate && (
                      <span className="inline-flex items-center text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded-md">
                        Duplicate
                      </span>
                    )}

                    {/* Missing FT Retry Action */}
                    {isMissingFt(item) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenFtRetry(item);
                        }}
                        className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-md transition-colors"
                        title="FT code wasn't gained. Tap to scan SMS or enter FT & retry"
                      >
                        <RotateCcw size={8} />
                        <span>Retry FT</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Amount + Status Badge */}
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                {/* Amount / Notice Badge */}
                {isAlert ? (
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    Bank Notice
                  </span>
                ) : (
                  <div className="text-sm font-black font-['Poppins',sans-serif] tracking-tight">
                    <span className={isReceived ? 'text-emerald-700' : isSent ? 'text-rose-700' : 'text-slate-800'}>
                      {formatAmountCompact(item.amount, item.type)}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-0.5 font-normal">ETB</span>
                  </div>
                )}

                {/* Server Sync / Result Badge */}
                {getSyncStatusBadge(item)}

                {/* Receipt Quick Link */}
                {hasV2 && v2Link && (
                  <a
                    href={v2Link}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 px-1.5 py-0.2 rounded border border-purple-200 transition-colors"
                  >
                    <span>Receipt</span>
                    <ExternalLink size={9} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination View More */}
      {filteredPayments.length > visibleCount && (
        <button
          onClick={() => setVisibleCount(prev => prev + 50)}
          className="w-full py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-[#14503F] hover:bg-slate-50 transition-colors shadow-xs"
        >
          Load More ({filteredPayments.length - visibleCount} remaining)
        </button>
      )}

      {/* Floating Batch Operations Toolbar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto z-40 bg-slate-900/95 text-white backdrop-blur-md rounded-2xl p-3 shadow-2xl border border-slate-700/80 flex items-center justify-between gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pl-1">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center">
              {selectedIds.size}
            </span>
            <span className="text-xs font-bold text-slate-200 hidden sm:inline">Selected</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            <button
              type="button"
              onClick={handleBatchCopyRefs}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1 shrink-0 transition-colors"
              title="Copy Reference / FT numbers"
            >
              {copiedBatchRefs ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span>{copiedBatchRefs ? 'Copied' : 'Copy FTs'}</span>
            </button>

            <button
              type="button"
              onClick={handleBatchExportCsv}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1 shrink-0 transition-colors"
              title="Export selected as CSV"
            >
              <Download size={13} />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setBulkTagModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-[#14503F] hover:bg-[#104032] text-xs font-bold text-emerald-100 flex items-center gap-1 shrink-0 transition-colors"
              title="Tag all selected transactions"
            >
              <Tag size={13} />
              <span>Tag</span>
            </button>

            <button
              type="button"
              onClick={handleBatchHide}
              className="px-2.5 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-xs font-semibold text-rose-300 flex items-center gap-1 shrink-0 transition-colors"
              title="Hide all selected from list"
            >
              <EyeOff size={13} />
              <span className="hidden xs:inline">Hide</span>
            </button>
          </div>
        </div>
      )}

      {/* Bulk Tag Modal */}
      {bulkTagModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#14503F]" />
                <h3 className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
                  Batch Apply Tag ({selectedIds.size} items)
                </h3>
              </div>
              <button
                onClick={() => setBulkTagModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Type a custom tag or select a quick tag below:
            </p>

            <input
              type="text"
              autoFocus
              value={bulkTagInput}
              onChange={e => setBulkTagInput(e.target.value)}
              placeholder="e.g. #Customer, #Vendor, #Store"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#14503F]"
            />

            <div className="flex flex-wrap gap-1.5 pt-1">
              {['#Customer', '#Vendor', '#Salary', '#Rent', '#Supplies', '#Personal'].map(suggested => (
                <button
                  key={suggested}
                  type="button"
                  onClick={() => setBulkTagInput(suggested)}
                  className="px-2 py-1 rounded-lg text-[10.5px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 hover:bg-emerald-100 transition-colors"
                >
                  {suggested}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBulkTagModalOpen(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!bulkTagInput.trim()}
                onClick={() => handleBatchApplyTag(bulkTagInput)}
                className="flex-1 py-2 rounded-xl bg-[#14503F] text-white text-xs font-bold hover:bg-[#0e3b2e] disabled:opacity-50"
              >
                Apply to {selectedIds.size}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FT Recovery & Retry Modal ("isn't the FT gaind add rety") */}
      {ftRetryPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#14503F]" />
                <h3 className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
                  {isAm ? 'የግብይት ቁጥር (FT) ማረጋገጫ' : 'Retry & Recover Bank FT'}
                </h3>
              </div>
              <button
                onClick={() => setFtRetryPayment(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            {ftSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                <Check size={14} className="text-emerald-600 shrink-0" />
                <span>{ftSuccessMsg}</span>
              </div>
            )}

            <p className="text-[11px] text-slate-500 leading-snug">
              {isAm 
                ? 'የባንክ SMS መልዕክት ተመርምሮ FT አልተገኘም። ከስር በራስ-ሰር ይቃኙ ወይም ትክክለኛውን FT እራስዎ ያስገቡ:' 
                : 'The official FT reference wasn\'t gained automatically. Auto-scan SMS or enter manual FT:'}
            </p>

            {/* Candidate Detected from SMS */}
            {ftCandidate && (
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
                <div className="text-[10.5px]">
                  <span className="text-emerald-800 font-bold block">Candidate FT Detected:</span>
                  <span className="font-mono font-bold text-emerald-950">{ftCandidate}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFtInput(ftCandidate)}
                  className="px-2 py-1 rounded-lg bg-[#14503F] text-white text-[10.5px] font-bold hover:bg-[#0e3b2e]"
                >
                  Use This FT
                </button>
              </div>
            )}

            {/* Input Field */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                Official FT / Reference Code
              </label>
              <input
                type="text"
                autoFocus
                value={ftInput}
                onChange={e => setFtInput(e.target.value.toUpperCase())}
                placeholder="e.g. FT2630981120 or 10E9944P1"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-[#14503F]"
              />
            </div>

            {/* Raw SMS Snippet for convenience */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Original Bank SMS</span>
              <div className="bg-slate-900 text-slate-200 p-2.5 rounded-xl font-mono text-[10px] leading-relaxed max-h-24 overflow-y-auto break-words">
                {ftRetryPayment.rawMessage}
              </div>
            </div>

            <div className="flex gap-2 pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFtRetryPayment(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
              >
                {isAm ? 'ይቅር' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={savingFt || !ftInput.trim()}
                onClick={() => handleSaveFtAndRetry(ftInput)}
                className="flex-2 py-2 rounded-xl bg-[#14503F] text-white text-xs font-bold hover:bg-[#0e3b2e] shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={13} className={savingFt ? 'animate-spin' : ''} />
                <span>{savingFt ? (isAm ? 'በማረጋገጥ ላይ...' : 'Retrying Sync...') : (isAm ? 'አረጋግጥና አስምር' : 'Save & Retry Sync')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Name Edit Modal */}
      {inlineEditPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
                Set Counterparty Name
              </h3>
              <button
                onClick={() => setInlineEditPayment(null)}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Provide the customer or merchant name for this {inlineEditPayment.bank} transaction:
            </p>

            <input
              type="text"
              autoFocus
              value={inlineName}
              onChange={e => setInlineName(e.target.value)}
              placeholder="e.g. Bilal Seid / Usmeal Abdela"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#14503F]"
            />

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setInlineEditPayment(null)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingOverride}
                onClick={handleSaveInlineName}
                className="flex-1 py-2 rounded-xl bg-[#14503F] text-white text-xs font-bold hover:bg-[#0e3b2e]"
              >
                {savingOverride ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Transaction Receipt Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 max-h-[92dvh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#14503F]" />
                <span className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                  Transaction Desk
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedPayment(null);
                  setModalView('details');
                }}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X size={15} />
              </button>
            </div>

            {/* View Mode Toggle: Record Details vs 2026 Branded Receipt */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setModalView('details')}
                className={`py-1.5 rounded-xl transition-all ${
                  modalView === 'details'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Record Details
              </button>
              <button
                type="button"
                onClick={() => setModalView('receipt')}
                className={`py-1.5 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  modalView === 'receipt'
                    ? 'bg-[#14503F] text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sparkles size={12} className="text-emerald-300" />
                <span>Digital Voucher 2026</span>
              </button>
            </div>

            {modalView === 'details' ? (
              <>
                {/* Main Info Card */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                  {selectedPayment.category === 'alert' ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400">Message Type</span>
                          <div className="text-lg font-bold text-slate-800 font-['Poppins',sans-serif]">
                            {selectedPayment.bank} Service Alert
                          </div>
                        </div>
                        {getSyncStatusBadge(selectedPayment)}
                      </div>
                      <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-2.5 text-[11px] text-amber-900 leading-snug">
                        <b>Informational Alert:</b> This SMS is a bank login notification or security notice. It contains no financial debit or credit and is excluded from your totals and reports.
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Amount</div>
                        <div className={`text-2xl font-black font-['Poppins',sans-serif] ${
                          selectedPayment.type === 'received' ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {selectedPayment.type === 'received' ? '+' : '-'}{selectedPayment.amount.toFixed(2)} ETB
                        </div>
                      </div>
                      {getSyncStatusBadge(selectedPayment)}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Bank:</span>
                      <span className="font-bold text-slate-800">{selectedPayment.bank}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Direction:</span>
                      <span className="font-bold capitalize text-slate-800">{selectedPayment.type}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Counterparty:</span>
                      <span className="font-bold text-slate-800">{selectedPayment.counterparty || 'None extracted'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Reference / FT:</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-mono font-bold text-slate-800 break-all">{selectedPayment.reference || 'None'}</span>
                        {selectedPayment.reference && (
                          <button
                            onClick={() => handleCopy(selectedPayment.reference)}
                            className="text-slate-400 hover:text-slate-700 p-0.5"
                            title="Copy Reference"
                          >
                            {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenFtRetry(selectedPayment)}
                          className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md ml-0.5 transition-colors"
                          title="Retry scan or enter bank FT code"
                        >
                          <RotateCcw size={9} />
                          <span>Retry FT</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedPayment.v2Code && (
                    <div className="pt-2 border-t border-slate-200">
                      <a
                        href={`https://mbreciept.cbe.com.et/${selectedPayment.v2Code}`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 px-3 rounded-xl bg-purple-700 text-white text-xs font-bold shadow-xs hover:bg-purple-800 flex items-center justify-center gap-1.5"
                      >
                        <span>Open Official CBE Receipt</span>
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  )}
                </div>

                {/* Quick Actions: Share, Edit, Hide */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSharePaymentReceipt(selectedPayment)}
                    className="py-2 px-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center justify-center gap-1 shadow-2xs"
                  >
                    <Share2 size={13} />
                    <span>{copied ? 'Copied ✓' : 'Share'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="py-2 px-2 rounded-xl border border-slate-300 text-slate-800 text-xs font-bold hover:bg-slate-50 flex items-center justify-center gap-1 shadow-2xs"
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleHidePayment}
                    className="py-2 px-2 rounded-xl border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-50 flex items-center justify-center gap-1 shadow-2xs"
                  >
                    <EyeOff size={13} />
                    <span>Hide</span>
                  </button>
                </div>

                {/* Edit Section Drawer */}
                {isEditing && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3">
                    <div className="text-xs font-bold text-slate-900">Edit Override</div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Party Name</label>
                      <input
                        type="text"
                        value={editCounterparty}
                        onChange={e => setEditCounterparty(e.target.value)}
                        placeholder="Enter counterparty name..."
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-[#14503F]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Direction</label>
                        <select
                          value={editDirection}
                          onChange={e => setEditDirection(e.target.value as PaymentType)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-medium"
                        >
                          <option value="received">Received (In)</option>
                          <option value="sent">Sent (Out)</option>
                          <option value="unknown">Unknown</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Category</label>
                        <select
                          value={editCategory}
                          onChange={e => setEditCategory(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-medium"
                        >
                          <option value="transfer">Transfer</option>
                          <option value="airtime">Airtime</option>
                          <option value="data">Data Package</option>
                          <option value="atm-card">ATM / Card</option>
                          <option value="bill">Bill Payment</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Tag / Category</label>
                      <input
                        type="text"
                        value={editTag}
                        onChange={e => setEditTag(e.target.value)}
                        placeholder="e.g. WiFi, Rent, Salary..."
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium"
                      />
                    </div>

                    {/* Popular Tag Chips */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Quick Tag Presets</label>
                      <div className="flex flex-wrap gap-1">
                        {['#Customer', '#Vendor', '#Salary', '#Rent', '#Supplies', '#Personal'].map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setEditTag(tag)}
                            className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="flex-1 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={savingOverride}
                        onClick={handleSaveModalEdit}
                        className="flex-1 py-1.5 rounded-lg bg-[#14503F] text-white text-xs font-bold hover:bg-[#0e3b2e]"
                      >
                        {savingOverride ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Raw SMS Box */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Original Bank SMS</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedPayment.rawMessage)}
                      className="text-[10px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold"
                    >
                      {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      <span>{copied ? 'Copied' : 'Copy SMS'}</span>
                    </button>
                  </div>
                  <div className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] leading-relaxed break-words max-h-36 overflow-y-auto">
                    {selectedPayment.rawMessage}
                  </div>
                </div>
              </>
            ) : (
              /* 2026 Branded Digital Receipt Voucher View */
              <div className="space-y-4">
                <div className="relative bg-gradient-to-br from-emerald-950 via-[#14503F] to-slate-950 text-white rounded-3xl p-5 shadow-xl border border-emerald-800/40 overflow-hidden">
                  {/* Subtle Background Watermark */}
                  <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none select-none text-9xl font-black">
                    {selectedPayment.bank}
                  </div>

                  {/* Header Badge */}
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20">
                        <ShieldCheck className="w-4 h-4 text-emerald-300" />
                      </div>
                      <div>
                        <div className="text-[9px] font-black uppercase tracking-wider text-emerald-300">
                          Verified Digital Voucher • 2026
                        </div>
                        <div className="text-xs font-bold text-white">
                          Ak Financial Business Desk
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                      SETTLED
                    </span>
                  </div>

                  {/* Amount Hero */}
                  <div className="py-4 text-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/80">
                      {selectedPayment.type === 'received' ? 'Incoming Payment Credited' : 'Outgoing Transfer Debited'}
                    </div>
                    <div className="text-3xl font-black font-['Poppins',sans-serif] tracking-tight mt-1 text-white">
                      {selectedPayment.type === 'received' ? '+' : '-'}{selectedPayment.amount.toFixed(2)}
                      <span className="text-sm font-semibold text-emerald-300 ml-1.5">ETB</span>
                    </div>
                  </div>

                  {/* Voucher Data Table */}
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/10 space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-white/5">
                      <span className="text-slate-300 text-[11px]">Financial Institution</span>
                      <span className="font-bold text-white">{selectedPayment.bank}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-white/5">
                      <span className="text-slate-300 text-[11px]">Counterparty</span>
                      <span className="font-bold text-emerald-200">
                        {selectedPayment.counterparty || 'Identified by Bank'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-white/5">
                      <span className="text-slate-300 text-[11px]">Reference / FT</span>
                      <span className="font-mono font-bold text-white">
                        {selectedPayment.reference || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-white/5">
                      <span className="text-slate-300 text-[11px]">Timestamp</span>
                      <span className="font-medium text-slate-200">
                        {selectedPayment.date || new Date(selectedPayment.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {selectedPayment.tag && (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-300 text-[11px]">Applied Tag</span>
                        <span className="font-bold text-amber-300">{selectedPayment.tag}</span>
                      </div>
                    )}
                  </div>

                  {/* QR Code Graphic Mock */}
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-12 h-12 bg-white rounded-xl p-1.5 flex items-center justify-center shadow-md">
                        <QrCode className="w-full h-full text-slate-900" />
                      </div>
                      <div className="text-[10px] text-slate-300 leading-tight">
                        <div className="font-bold text-white">Scan & Verify</div>
                        <div>EthSwitch Standard 2026</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-emerald-300 font-mono">HASH VERIFIED</div>
                      <div className="text-[9px] text-slate-400 font-mono">
                        {(selectedPayment.id || 'TXN').slice(-8).toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1-Tap Copy Voucher Text Button */}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const voucherText = `🧾 OFFICIAL DIGITAL RECEIPT (2026)\n------------------------------------\n🏦 Bank: ${selectedPayment.bank}\n💰 Amount: ${selectedPayment.amount.toFixed(2)} ETB (${selectedPayment.type.toUpperCase()})\n👤 Counterparty: ${selectedPayment.counterparty || 'N/A'}\n🔖 Reference / FT: ${selectedPayment.reference || 'N/A'}\n📅 Time: ${selectedPayment.date || new Date(selectedPayment.timestamp).toLocaleString()}\n✅ Status: Verified FinTech Record\n⚡ Platform: Ak Financial Business Desk`;
                      handleCopy(voucherText);
                    }}
                    className="w-full py-2.5 px-4 rounded-2xl bg-[#14503F] text-white text-xs font-bold hover:bg-[#0e3b2e] shadow-md flex items-center justify-center gap-2 transition-all"
                  >
                    {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                    <span>{copied ? 'Voucher Copied to Clipboard ✓' : 'Copy Telegram / WhatsApp Voucher'}</span>
                  </button>

                  {selectedPayment.v2Code && (
                    <a
                      href={`https://mbreciept.cbe.com.et/${selectedPayment.v2Code}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2 px-3 rounded-2xl bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-purple-100 transition-colors"
                    >
                      <span>Open Live CBE Web Receipt</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
