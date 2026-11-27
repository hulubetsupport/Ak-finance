import React, { useState, useMemo, useEffect } from 'react';
import {
  PaymentRecord,
  PaymentType,
  AppSettings,
  PaymentCategory,
} from '../types/index.ts';
import {
  Copy,
  Check,
  ExternalLink,
  EyeOff,
  Edit2,
  RotateCcw,
  Tag,
  CreditCard,
  Receipt,
  X,
  Share2,
  Search,
  Download,
  SlidersHorizontal,
  CheckSquare,
  Square,
  ArrowUpDown,
  QrCode,
  Sparkles,
  ShieldCheck,
  UploadCloud,
  RefreshCw,
} from 'lucide-react';
import { translations } from '../utils/i18n.ts';
import { getBankBrand, BankBrand } from '../constants/bankBrands.ts';
import { needsFtRecovery } from '../utils/smsParser.ts';

export type LedgerStatusFilter = 'all' | 'saved' | 'local' | 'needs-review' | 'sync-error' | 'alert' | 'duplicate';

interface PaymentsListProps {
  payments: PaymentRecord[];
  settings: AppSettings;
  activeDirection?: 'all' | 'received' | 'sent';
  onFilterDirection?: (dir: 'all' | 'received' | 'sent') => void;
  onRetrySinglePayment: (payment: PaymentRecord) => Promise<void>;
  onDeletePayment: (id: string) => Promise<void>;
  onSaveOverride?: (
    id: string,
    override: {
      counterparty?: string | null;
      direction?: string | null;
      note?: string;
      tag?: string;
      isHidden?: boolean;
      reference?: string;
      category?: string;
    }
  ) => Promise<void>;
  onSyncPayment?: (id: string) => Promise<{ ok: boolean; status: string; message: string }>;
  onSyncSelected?: (ids: string[]) => Promise<void>;
  onAiParsePayment?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onRefreshServerStatus?: () => Promise<void>;
  refreshingServerStatus?: boolean;
  onCheckTransactionStatus?: (payment: PaymentRecord) => Promise<{ ok: boolean; error?: string }>;
  serverUrlConfigured?: boolean;
  initialStatusFilter?: LedgerStatusFilter;
  onOpenSettings?: () => void;
  maxItems?: number;
}

export const PaymentsList: React.FC<PaymentsListProps> = ({
  payments,
  settings,
  activeDirection,
  onFilterDirection,
  onRetrySinglePayment,
  onSaveOverride,
  onSyncPayment,
  onSyncSelected,
  onAiParsePayment,
  onRefreshServerStatus,
  refreshingServerStatus = false,
  onCheckTransactionStatus,
  serverUrlConfigured = false,
  initialStatusFilter,
  onOpenSettings,
  maxItems,
}) => {
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [checkingModalStatus, setCheckingModalStatus] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [aiParsingId, setAiParsingId] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<{ type: 'ok' | 'warn'; text: string } | null>(null);

  const [internalDirection, setInternalDirection] = useState<'all' | 'received' | 'sent'>('all');
  const currentDirection = activeDirection !== undefined ? activeDirection : internalDirection;

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchInput, setShowSearchInput] = useState<boolean>(false);

  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagModalOpen, setBulkTagModalOpen] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [copiedBatchRefs, setCopiedBatchRefs] = useState(false);
  const [bulkSyncing, setBulkSyncing] = useState(false);

  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  const [statusFilter, setStatusFilter] = useState<LedgerStatusFilter>(initialStatusFilter || 'all');
  const [showSortControls, setShowSortControls] = useState<boolean>(false);
  const [modalView, setModalView] = useState<'details' | 'receipt'>('details');

  const [isEditing, setIsEditing] = useState(false);
  const [editCounterparty, setEditCounterparty] = useState('');
  const [editDirection, setEditDirection] = useState<PaymentType>('unknown');
  const [editCategory, setEditCategory] = useState<string>('transfer');
  const [editNote, setEditNote] = useState('');
  const [editTag, setEditTag] = useState('');
  const [savingOverride, setSavingOverride] = useState(false);

  const [inlineEditPayment, setInlineEditPayment] = useState<PaymentRecord | null>(null);
  const [inlineName, setInlineName] = useState('');

  const [ftRetryPayment, setFtRetryPayment] = useState<PaymentRecord | null>(null);
  const [ftInput, setFtInput] = useState('');
  const [ftCandidate, setFtCandidate] = useState<string | null>(null);
  const [savingFt, setSavingFt] = useState(false);
  const [ftSuccessMsg, setFtSuccessMsg] = useState<string | null>(null);

  const [visibleCount, setVisibleCount] = useState(maxItems || 50);

  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
    }
  }, [initialStatusFilter]);

  // Keep open Transaction Desk modal synchronized with latest background poll / /api/check results
  useEffect(() => {
    if (!selectedPayment) return;
    const updated = payments.find(p => p.id === selectedPayment.id);
    if (updated && updated !== selectedPayment) {
      setSelectedPayment(updated);
    }
  }, [payments, selectedPayment]);

  const t = translations[settings.language];
  const isAm = settings.language === 'am';

  const showToast = (type: 'ok' | 'warn', text: string) => {
    setActionToast({ type, text });
    setTimeout(() => setActionToast(null), 4000);
  };

  const counts = useMemo(() => {
    let saved = 0;
    let localOnly = 0;
    let needsReview = 0;
    let syncErrors = 0;
    let alerts = 0;
    let dupes = 0;
    let received = 0;
    let sent = 0;

    for (const p of payments) {
      if (p.syncStatus === 'sent' && !p.needsReview) saved++;
      if (p.syncStatus === 'local' || p.syncStatus === 'pending') localOnly++;
      if (p.needsReview) needsReview++;
      if (p.syncStatus === 'failed' || p.authError) syncErrors++;
      if (p.category === 'alert' || p.amount === 0) alerts++;
      if (p.isDuplicate || p.serverResult?.status === 'Duplicate') dupes++;
      if (p.type === 'received' && p.category !== 'alert') received++;
      if (p.type === 'sent' && p.category !== 'alert') sent++;
    }
    return { saved, localOnly, needsReview, syncErrors, alerts, dupes, received, sent };
  }, [payments]);

  const handleSetDirection = (dir: 'all' | 'received' | 'sent') => {
    setInternalDirection(dir);
    onFilterDirection?.(dir);
    setVisibleCount(maxItems || 50);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredPayments = useMemo(() => {
    const list = payments.filter(p => {
      if (currentDirection !== 'all' && p.type !== currentDirection) return false;

      const isItemAlert = p.category === 'alert' || p.amount === 0;

      if (selectedCategory !== 'all') {
        if (selectedCategory === 'airtime' && p.category !== 'airtime') return false;
        if (selectedCategory === 'data' && p.category !== 'data') return false;
        if (selectedCategory === 'atm-card' && p.category !== 'atm-card') return false;
        if (selectedCategory === 'bill' && p.category !== 'bill') return false;
        if (selectedCategory === 'transfer' && p.category !== 'transfer' && p.category !== undefined && p.category !== 'received' && p.category !== 'payment') return false;
        if (selectedCategory === 'alert' && !isItemAlert) return false;
      }

      if (statusFilter === 'saved' && (p.syncStatus !== 'sent' || p.needsReview)) return false;
      if (statusFilter === 'local' && p.syncStatus !== 'local' && p.syncStatus !== 'pending') return false;
      if (statusFilter === 'needs-review' && !p.needsReview) return false;
      if (statusFilter === 'sync-error' && p.syncStatus !== 'failed' && !p.authError) return false;
      if (statusFilter === 'alert' && !isItemAlert) return false;
      if (statusFilter === 'duplicate' && !p.isDuplicate && p.serverResult?.status !== 'Duplicate') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const haystack = [
          p.counterparty,
          p.reference,
          p.ftNumber,
          p.v2Code,
          p.bank,
          p.rawMessage,
          p.tag,
          p.serverResult?.claimed_by,
          p.serverResult?.claimed_txn_id,
          p.serverResult?.agent,
          String(p.amount || 0),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'newest') return b.timestamp - a.timestamp;
      if (sortBy === 'oldest') return a.timestamp - b.timestamp;
      if (sortBy === 'highest') return (b.amount || 0) - (a.amount || 0);
      if (sortBy === 'lowest') return (a.amount || 0) - (b.amount || 0);
      return b.timestamp - a.timestamp;
    });
  }, [payments, currentDirection, selectedCategory, searchQuery, statusFilter, sortBy]);

  const handleSelectAllVisible = () => {
    const visible = filteredPayments.slice(0, visibleCount);
    const allSelected = visible.length > 0 && visible.every(p => selectedIds.has(p.id));
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(visible.map(p => p.id)));
  };

  const formatAmountCompact = (num: number, type: PaymentType) => {
    if (settings.hideBalances) return '••••••';
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

  const getHuluBetPill = (item: PaymentRecord): { label: string; sub?: string; pillClass: string } => {
    if (item.needsReview) {
      return {
        label: 'Needs review',
        sub: item.needsReviewReason,
        pillClass: 'bg-amber-100 text-amber-900 border-amber-300',
      };
    }
    if (item.authError || item.syncStatus === 'failed') {
      return {
        label: item.authError ? 'Wrong Token (401)' : 'Sync Error',
        sub: item.errorMessage,
        pillClass: 'bg-rose-100 text-rose-800 border-rose-300',
      };
    }
    const usage = item.serverResult?.usage;
    if (usage === 'Unused') {
      return {
        label: 'Unused',
        sub: 'waiting for player',
        pillClass: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }
    if (usage === 'Used') {
      return {
        label: item.serverResult?.claimed_by ? `Used · Claimed by ${item.serverResult.claimed_by}` : 'Used',
        sub: item.serverResult?.claimed_txn_id ? item.serverResult.claimed_txn_id : undefined,
        pillClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    }
    if (usage === 'Sent_Locked') {
      return {
        label: 'Sent_Locked',
        pillClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      };
    }
    if (usage === 'Payout_Verified') {
      return {
        label: 'Payout_Verified',
        sub: [item.serverResult?.claimed_txn_id, item.serverResult?.claimed_by].filter(Boolean).join(' · ') || undefined,
        pillClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    }
    if (item.category === 'alert' || item.amount === 0) {
      return {
        label: isAm ? 'ማሳወቂያ' : 'Notice',
        pillClass: 'bg-slate-100 text-slate-600 border-slate-200',
      };
    }
    if (item.syncStatus === 'sent') {
      return {
        label: item.serverResult?.status === 'Duplicate' ? 'Synced (Duplicate)' : t.statusSynced,
        pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    if (item.syncStatus === 'pending') {
      return {
        label: 'Queued',
        pillClass: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }
    return {
      label: t.statusLocal,
      pillClass: 'bg-slate-100 text-slate-600 border-slate-200',
    };
  };

  const getRowTitle = (item: PaymentRecord): string => {
    const cp = (item.counterparty || '').trim();
    const tail = item.accountNumber ? `acct …${item.accountNumber.slice(-4)}` : '';

    if (item.category === 'alert' || item.amount === 0) {
      if (cp && !cp.toLowerCase().includes('unknown')) return cp;
      return isAm ? `${item.bank || 'ባንክ'} ማሳወቂያ` : `${item.bank || 'Bank'} Service Alert`;
    }
    if (item.category === 'atm-card') {
      return cp ? `ATM · ${cp}` : 'ATM Cash Withdrawal';
    }
    if (item.type === 'received') {
      if (cp) return `From ${cp}`;
      if (tail) return `Incoming (${tail})`;
      return isAm ? 'ገቢ ክፍያ' : 'Incoming payment';
    }
    if (item.type === 'sent') {
      if (cp) return `To ${cp}`;
      if (item.category === 'airtime') return `Airtime Recharge${tail ? ` (${tail})` : ''}`;
      if (item.category === 'data') return `Data Package${tail ? ` (${tail})` : ''}`;
      if (item.category === 'bill') return `Bill Payment${tail ? ` (${tail})` : ''}`;
      if (item.category === 'payment') return `Payment${tail ? ` (${tail})` : ''}`;
      if (tail) return `Outgoing (${tail})`;
      return isAm ? 'ወጪ ክፍያ' : 'Outgoing transfer';
    }
    if (cp) return cp;
    return isAm ? 'ያልተለየ SMS' : 'Unparsed Bank SMS';
  };

  const getCategoryLabel = (category?: PaymentCategory | string): string => {
    switch (category) {
      case 'alert':
        return isAm ? 'ማሳወቂያ' : 'Alert';
      case 'airtime':
        return isAm ? 'አየር ሰዓት' : 'Airtime';
      case 'data':
        return isAm ? 'ዳታ' : 'Data';
      case 'atm-card':
        return 'ATM/Card';
      case 'bill':
        return isAm ? 'ቢል' : 'Bill';
      case 'payment':
        return isAm ? 'ክፍያ' : 'Payment';
      case 'cash':
        return 'Cash';
      case 'received':
        return isAm ? 'ገቢ' : 'Deposit';
      case 'transfer':
      default:
        return isAm ? 'ዝውውር' : 'Transfer';
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopySummary = () => {
    const rec = filteredPayments
      .filter(p => p.type === 'received' && !p.isDuplicate && p.category !== 'alert')
      .reduce((s, p) => s + p.amount, 0);
    const snt = filteredPayments
      .filter(p => p.type === 'sent' && !p.isDuplicate && p.category !== 'alert')
      .reduce((s, p) => s + p.amount, 0);
    const lines = [
      `Ak Finance Statement Summary`,
      `Transactions: ${filteredPayments.length}`,
      `Total Received: +${rec.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB`,
      `Total Sent: -${snt.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB`,
      `Net: ${(rec - snt >= 0 ? '+' : '-')}${Math.abs(rec - snt).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB`,
      `Generated ${new Date().toLocaleString()}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2200);
  };

  const handleSharePaymentReceipt = (item: PaymentRecord) => {
    const text = [
      `Ak Finance Payment Confirmation`,
      `Bank: ${item.bank}`,
      `Amount: ${item.type === 'received' ? '+' : '-'}${item.amount.toFixed(2)} ETB`,
      item.fee ? `Service Fee: ${item.fee.toFixed(2)} ETB` : '',
      item.counterparty ? `Party: ${item.counterparty}` : '',
      item.reference ? `Ref/Code: ${item.reference}` : '',
      item.receiptUrl ? `Receipt: ${item.receiptUrl}` : '',
      `Date: ${new Date(item.timestamp).toLocaleString()}`,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSyncSingle = async (item: PaymentRecord) => {
    if (!serverUrlConfigured && !settings.serverUrl?.trim()) {
      showToast('warn', 'No server webhook URL configured. Open Settings to add one.');
      onOpenSettings?.();
      return;
    }
    if (!onSyncPayment) {
      await onRetrySinglePayment(item);
      return;
    }
    setSyncingId(item.id);
    try {
      const res = await onSyncPayment(item.id);
      showToast(res.ok ? 'ok' : 'warn', res.message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleAiExtract = async (item: PaymentRecord) => {
    if (!onAiParsePayment) return;
    setAiParsingId(item.id);
    try {
      const res = await onAiParsePayment(item.id);
      if (res.ok) {
        showToast('ok', 'Gemini AI extracted fields for this SMS.');
      } else {
        showToast('warn', res.error || 'AI extraction unavailable.');
      }
    } finally {
      setAiParsingId(null);
    }
  };

  const handleBatchCopyRefs = () => {
    const refs = payments
      .filter(p => selectedIds.has(p.id))
      .map(p => p.reference || p.ftNumber || p.id)
      .filter(Boolean);
    if (refs.length === 0) return;
    navigator.clipboard.writeText(refs.join('\n'));
    setCopiedBatchRefs(true);
    setTimeout(() => setCopiedBatchRefs(false), 2000);
  };

  const handleBatchExportCsv = () => {
    const selected = payments.filter(p => selectedIds.has(p.id));
    if (selected.length === 0) return;
    const headers = ['Date', 'Bank', 'Sender', 'Type', 'Amount ETB', 'Fee ETB', 'Counterparty', 'Reference', 'Receipt URL', 'Tag', 'Raw SMS'];
    const rows = selected.map(p => [
      `"${new Date(p.timestamp).toISOString()}"`,
      `"${p.bank || 'Unknown'}"`,
      `"${p.senderAddress || ''}"`,
      `"${p.type || 'unknown'}"`,
      (p.amount || 0).toFixed(2),
      p.fee ? p.fee.toFixed(2) : '',
      `"${(p.counterparty || '').replace(/"/g, '""')}"`,
      `"${p.reference || ''}"`,
      `"${p.receiptUrl || ''}"`,
      `"${p.tag || ''}"`,
      `"${(p.rawMessage || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ak_payments_selected_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const handleBatchSync = async () => {
    if (!onSyncSelected || selectedIds.size === 0) return;
    if (!serverUrlConfigured && !settings.serverUrl?.trim()) {
      showToast('warn', 'No server webhook URL configured. Open Settings to add one.');
      onOpenSettings?.();
      return;
    }
    setBulkSyncing(true);
    try {
      await onSyncSelected(Array.from(selectedIds));
      showToast('ok', `Synced ${selectedIds.size} selected record(s) to server.`);
      setSelectedIds(new Set());
      setSelectionMode(false);
    } finally {
      setBulkSyncing(false);
    }
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

  const openPaymentModal = async (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setModalView('details');
    setIsEditing(false);
    setCopiedRef(false);
    setEditCounterparty(payment.counterparty || '');
    setEditDirection(payment.type);
    setEditCategory(payment.category || 'transfer');
    setEditNote(payment.note || '');
    setEditTag(payment.tag || '');

    if (onCheckTransactionStatus && payment.reference && !payment.reference.startsWith('SMS-') && serverUrlConfigured) {
      setCheckingModalStatus(true);
      try {
        await onCheckTransactionStatus(payment);
      } finally {
        setCheckingModalStatus(false);
      }
    }
  };

  const handleCopyRefOnly = (refStr: string) => {
    if (!refStr) return;
    navigator.clipboard.writeText(refStr);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const openInlineNameEdit = (payment: PaymentRecord) => {
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
    await onSaveOverride(payment.id, {
      counterparty: payment.counterparty,
      direction: payment.type,
      note: payment.note,
      tag: tagToApply,
      isHidden: false,
    });
  };

  const scanForFtCandidate = (rawMessage: string): string | null => {
    if (!rawMessage) return null;
    const ftMatch = rawMessage.match(/\b(FT[A-Za-z0-9]{8,16})\b/i);
    if (ftMatch?.[1]) return ftMatch[1].toUpperCase();
    const v2Match = rawMessage.match(/\b(v2-[A-Za-z0-9_-]+)\b/);
    if (v2Match?.[1]) return v2Match[1];
    return null;
  };

  const handleOpenFtRetry = (p: PaymentRecord) => {
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
      if (onSyncPayment && settings.serverUrl?.trim()) {
        await onSyncPayment(ftRetryPayment.id);
      } else {
        await onRetrySinglePayment(ftRetryPayment);
      }
      setFtSuccessMsg(`Saved FT ${cleanFt}`);
      setTimeout(() => {
        setFtRetryPayment(null);
        setFtSuccessMsg(null);
      }, 1200);
    } catch {
      setFtSuccessMsg('Saved locally');
      setTimeout(() => setFtRetryPayment(null), 1200);
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
        category: editCategory,
        note: editNote.trim(),
        tag: editTag.trim() || undefined,
        isHidden: false,
      });
      setSelectedPayment(prev =>
        prev
          ? {
              ...prev,
              counterparty: editCounterparty.trim(),
              type: editDirection,
              category: editCategory as PaymentCategory,
              note: editNote.trim(),
              tag: editTag.trim() || undefined,
              isOverridden: true,
            }
          : null
      );
      setIsEditing(false);
    } finally {
      setSavingOverride(false);
    }
  };

  const handleHidePayment = async () => {
    if (!selectedPayment || !onSaveOverride) return;
    const confirmMsg = isAm
      ? 'ይህ መልዕክት ከክፍያ ዝርዝር ውስጥ እንዲደበቅ ይፈልጋሉ?'
      : 'Hide this message from the ledger view?';
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

  const statusTabs: { id: LedgerStatusFilter; label: string; count?: number }[] = [
    { id: 'all', label: isAm ? 'ሁሉም' : 'All Status' },
    ...(counts.needsReview > 0 ? [{ id: 'needs-review' as const, label: 'Needs review', count: counts.needsReview }] : []),
    { id: 'saved', label: isAm ? 'የተላኩ' : 'Synced', count: counts.saved },
    { id: 'local', label: isAm ? 'በስልክ' : 'Local Only', count: counts.localOnly },
    { id: 'alert', label: isAm ? 'ማሳወቂያ' : 'Alerts', count: counts.alerts },
    { id: 'duplicate', label: 'Duplicate', count: counts.dupes },
  ];

  return (
    <section aria-label="Transaction Ledger" className="w-full max-w-full space-y-3">
      {/* Feedback Toast */}
      {actionToast && (
        <div
          className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
            actionToast.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <span>{actionToast.text}</span>
          <button type="button" onClick={() => setActionToast(null)} className="text-current opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Toolbar: Heading + Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="font-display text-sm font-semibold text-slate-900 truncate">
            {t.recentPayments}
          </h2>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {filteredPayments.length} {isAm ? 'መዝገቦች' : 'entries'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onRefreshServerStatus && (
            <button
              type="button"
              disabled={refreshingServerStatus}
              onClick={onRefreshServerStatus}
              className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-[#0F4C3A] hover:bg-emerald-50 flex items-center gap-1 whitespace-nowrap shrink-0 disabled:opacity-50"
              title="Refresh HuluBet server status"
            >
              <RefreshCw size={13} className={refreshingServerStatus ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{refreshingServerStatus ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowSortControls(prev => !prev)}
            className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
              showSortControls || sortBy !== 'newest'
                ? 'bg-emerald-50 border-emerald-300 text-[#0F4C3A]'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
            title="Sort order"
          >
            <SlidersHorizontal size={13} />
            <span className="hidden sm:inline">Sort</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectionMode(prev => {
                if (prev) setSelectedIds(new Set());
                return !prev;
              });
            }}
            className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
              selectionMode
                ? 'bg-[#0F4C3A] border-[#0F4C3A] text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckSquare size={13} />
            <span>{selectionMode ? 'Done' : 'Select'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSearchInput(prev => !prev)}
            className={`min-h-[34px] w-[34px] rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
              showSearchInput || searchQuery
                ? 'bg-emerald-50 border-emerald-300 text-[#0F4C3A]'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
            aria-label="Filter transactions"
          >
            <Search size={14} />
          </button>

          <button
            type="button"
            onClick={handleCopySummary}
            className="min-h-[34px] px-2.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1 whitespace-nowrap shrink-0"
          >
            {copiedSummary ? <Check size={13} className="text-emerald-600" /> : <Share2 size={13} />}
            <span className="hidden sm:inline">{copiedSummary ? 'Copied' : 'Summary'}</span>
          </button>
        </div>
      </div>

      {/* Primary Filter Bar: All | Deposits (In) | Withdrawals (Out) | Sync Errors */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-200/70 rounded-xl">
        <button
          type="button"
          onClick={() => {
            setStatusFilter('all');
            handleSetDirection('all');
          }}
          className={`min-h-[36px] px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            currentDirection === 'all' && statusFilter !== 'sync-error'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {isAm ? 'ሁሉም' : 'All'} · {payments.length}
        </button>

        <button
          type="button"
          onClick={() => {
            if (statusFilter === 'sync-error') setStatusFilter('all');
            handleSetDirection('received');
          }}
          className={`min-h-[36px] px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            currentDirection === 'received' && statusFilter !== 'sync-error'
              ? 'bg-[#0F4C3A] text-white'
              : 'text-emerald-900 hover:bg-white/60'
          }`}
        >
          Deposits (In) · {counts.received}
        </button>

        <button
          type="button"
          onClick={() => {
            if (statusFilter === 'sync-error') setStatusFilter('all');
            handleSetDirection('sent');
          }}
          className={`min-h-[36px] px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            currentDirection === 'sent' && statusFilter !== 'sync-error'
              ? 'bg-slate-900 text-white'
              : 'text-rose-900 hover:bg-white/60'
          }`}
        >
          Withdrawals (Out) · {counts.sent}
        </button>

        <button
          type="button"
          onClick={() => {
            handleSetDirection('all');
            setStatusFilter('sync-error');
            setVisibleCount(maxItems || 50);
          }}
          className={`min-h-[36px] px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
            statusFilter === 'sync-error'
              ? 'bg-rose-700 text-white'
              : counts.syncErrors > 0
                ? 'text-rose-800 hover:bg-rose-50'
                : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Sync Errors · {counts.syncErrors}
        </button>
      </div>

      {/* Secondary Status Filter Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {statusTabs.map(st => (
          <button
            key={st.id}
            type="button"
            onClick={() => {
              setStatusFilter(st.id);
              setVisibleCount(maxItems || 50);
            }}
            className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              statusFilter === st.id
                ? st.id === 'needs-review'
                  ? 'bg-amber-700 text-white border-amber-700'
                  : 'bg-slate-900 text-white border-slate-900'
                : st.id === 'needs-review'
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {st.label}
            {st.count !== undefined ? ` (${st.count})` : ''}
          </button>
        ))}
      </div>

      {/* Category Filter Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {[
          { id: 'all', label: isAm ? 'ሁሉም ዓይነት' : 'All Types' },
          { id: 'transfer', label: isAm ? 'ዝውውር' : 'Transfers' },
          { id: 'atm-card', label: 'ATM / Card' },
          { id: 'airtime', label: isAm ? 'አየር ሰዓት' : 'Airtime' },
          { id: 'data', label: isAm ? 'ዳታ' : 'Data' },
          { id: 'bill', label: isAm ? 'ቢል' : 'Bills' },
        ].map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              setSelectedCategory(cat.id);
              setVisibleCount(maxItems || 50);
            }}
            className={`min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              selectedCategory === cat.id
                ? 'bg-[#0F4C3A] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Sort Controls Drawer */}
      {showSortControls && (
        <div className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <ArrowUpDown size={13} />
            Sort Ledger
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'newest', label: 'Newest' },
              { id: 'oldest', label: 'Oldest' },
              { id: 'highest', label: 'Highest ETB' },
              { id: 'lowest', label: 'Lowest ETB' },
            ].map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSortBy(s.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  sortBy === s.id
                    ? 'bg-[#0F4C3A] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Input */}
      {showSearchInput && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={isAm ? 'በስም፣ በባንክ ወይም በሪፈረንስ ፈልግ...' : 'Filter by counterparty, bank, ref, or amount...'}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-medium focus:outline-none focus:border-[#0F4C3A]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Local Unsent Manual Sync Helper Bar */}
      {statusFilter === 'local' && filteredPayments.length > 0 && !selectionMode && (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <span className="text-slate-700 font-medium">
            {filteredPayments.length} local unsent record(s) — select specific items or sync individually.
          </span>
          <button
            type="button"
            onClick={() => setSelectionMode(true)}
            className="px-2.5 py-1 rounded-lg bg-[#0F4C3A] text-white font-semibold whitespace-nowrap shrink-0"
          >
            Select Items to Sync
          </button>
        </div>
      )}

      {/* Selection Bar */}
      {selectionMode && (
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-medium text-emerald-950">
          <span className="font-semibold text-[#0F4C3A]">
            {selectedIds.size} of {filteredPayments.length} selected
          </span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleSelectAllVisible} className="font-semibold text-[#0F4C3A] hover:underline">
              {filteredPayments.slice(0, visibleCount).every(p => selectedIds.has(p.id)) && selectedIds.size > 0
                ? 'Deselect Visible'
                : 'Select Visible'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedIds(new Set());
                setSelectionMode(false);
              }}
              className="font-semibold text-slate-600 hover:text-slate-900"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredPayments.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-200">
          <CreditCard className="w-9 h-9 text-slate-300 mx-auto mb-2" />
          <div className="text-sm font-semibold text-slate-800">{t.emptyPayments}</div>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || currentDirection !== 'all' || selectedCategory !== 'all' || statusFilter !== 'all'
              ? 'No transactions matched your active filters.'
              : t.emptyPaymentsSub}
          </p>
          {(searchQuery || currentDirection !== 'all' || selectedCategory !== 'all' || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setInternalDirection('all');
                onFilterDirection?.('all');
                setSelectedCategory('all');
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className="mt-3 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* Flat 1px-bordered Ledger List */}
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-200 overflow-hidden">
        {filteredPayments.slice(0, visibleCount).map(item => {
          const brand: BankBrand = getBankBrand(item.bank);
          const isReceived = item.type === 'received';
          const isSent = item.type === 'sent';
          const isAlert = item.category === 'alert' || item.amount === 0;
          const rowTitle = getRowTitle(item);
          const isSelected = selectedIds.has(item.id);
          const pillMeta = getHuluBetPill(item);
          const agentLabel = item.serverResult?.agent || (item.syncStatus === 'sent' ? settings.deviceLabel : undefined);
          const showFtRetry = needsFtRecovery(item);
          const showAiExtract =
            Boolean(onAiParsePayment) &&
            settings.aiEnabled !== false &&
            (item.amount === 0 || item.bank === 'Unknown' || item.category === 'other');

          return (
            <article
              key={item.id}
              className={`p-3.5 transition-colors flex items-start justify-between gap-3 ${
                isSelected ? 'bg-emerald-50/40' : 'hover:bg-slate-50/80'
              }`}
            >
              {/* Left: Checkbox + Bank Identity + Primary Clickable Body */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {selectionMode && (
                  <button
                    type="button"
                    onClick={() => handleToggleSelect(item.id)}
                    className="mt-1 text-[#0F4C3A] shrink-0"
                    aria-label={`Select ${rowTitle}`}
                  >
                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                  </button>
                )}

                {brand.logoUrl ? (
                  <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden">
                    <img
                      src={brand.logoUrl}
                      alt={brand.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-mono font-bold text-xs"
                    style={{ backgroundColor: brand.primaryColor }}
                  >
                    {brand.shortCode}
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-1">
                  {/* Top Badge Strip: IN/OUT + Bank + Owner/Agent */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {!isAlert && (isReceived || isSent) && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                          isReceived
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {isReceived ? 'IN' : 'OUT'}
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700">
                      {item.bank}
                    </span>
                    {agentLabel && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700">
                        {agentLabel}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => (selectionMode ? handleToggleSelect(item.id) : openPaymentModal(item))}
                      className="text-left font-display text-sm font-semibold text-slate-900 hover:text-[#0F4C3A] truncate"
                    >
                      {rowTitle}
                    </button>
                    <button
                      type="button"
                      onClick={() => openInlineNameEdit(item)}
                      aria-label={`Rename ${rowTitle}`}
                      className="text-slate-400 hover:text-slate-700 p-0.5 shrink-0"
                      title="Edit counterparty name"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>

                  {/* Single Inline Metadata Line (separated by ·) */}
                  <div className="text-xs text-slate-500 font-mono truncate">
                    <span>{formatDateTime(item.timestamp)}</span>
                    {item.reference && (
                      <>
                        <span> · </span>
                        <span>{item.reference}</span>
                      </>
                    )}
                    {item.fee !== undefined && item.fee > 0 && (
                      <>
                        <span> · </span>
                        <span>Fee {item.fee.toFixed(2)}</span>
                      </>
                    )}
                    {item.category && !isAlert && (
                      <>
                        <span> · </span>
                        <span className="font-sans">{getCategoryLabel(item.category)}</span>
                      </>
                    )}
                    {item.tag && (
                      <>
                        <span> · </span>
                        <span className="font-sans text-[#0F4C3A] font-medium">{item.tag}</span>
                      </>
                    )}
                    {item.aiParsed && (
                      <>
                        <span> · </span>
                        <span className="font-sans text-indigo-700 font-medium">AI Parsed</span>
                      </>
                    )}
                  </div>

                  {/* Error / Needs Review Reason (shown only when present) */}
                  {(item.needsReviewReason || ((item.syncStatus === 'failed' || item.authError) && item.errorMessage)) && (
                    <div className={`text-[11px] font-medium ${item.needsReview ? 'text-amber-800' : 'text-rose-700'}`}>
                      {item.needsReview ? item.needsReviewReason : item.errorMessage}
                    </div>
                  )}

                  {/* Conditional Action Links Row */}
                  {(item.suggestedTag || showFtRetry || item.receiptUrl || showAiExtract || item.syncStatus !== 'sent') && (
                    <div className="flex items-center gap-3 flex-wrap pt-0.5 text-xs">
                      {item.receiptUrl && (
                        <a
                          href={item.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[#0F4C3A] hover:underline whitespace-nowrap"
                        >
                          <span>Receipt</span>
                          <ExternalLink size={11} />
                        </a>
                      )}

                      {showFtRetry && (
                        <button
                          type="button"
                          onClick={() => handleOpenFtRetry(item)}
                          className="inline-flex items-center gap-1 font-semibold text-amber-800 hover:underline whitespace-nowrap"
                        >
                          <RotateCcw size={11} />
                          <span>Retry FT</span>
                        </button>
                      )}

                      {item.syncStatus !== 'sent' && !isAlert && (
                        <button
                          type="button"
                          disabled={syncingId === item.id}
                          onClick={() => handleSyncSingle(item)}
                          className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:text-[#0F4C3A] hover:underline whitespace-nowrap disabled:opacity-50"
                        >
                          <UploadCloud size={11} />
                          <span>{syncingId === item.id ? 'Syncing...' : item.syncStatus === 'failed' ? 'Retry' : 'Sync'}</span>
                        </button>
                      )}

                      {showAiExtract && (
                        <button
                          type="button"
                          disabled={aiParsingId === item.id}
                          onClick={() => handleAiExtract(item)}
                          className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline whitespace-nowrap disabled:opacity-50"
                        >
                          <Sparkles size={11} />
                          <span>{aiParsingId === item.id ? 'Analyzing...' : 'AI Extract'}</span>
                        </button>
                      )}

                      {item.suggestedTag && !item.tag && (
                        <button
                          type="button"
                          onClick={() => handleApplySuggestedTag(item, item.suggestedTag!)}
                          className="inline-flex items-center gap-1 font-medium text-amber-800 hover:underline whitespace-nowrap"
                        >
                          <span>+ Tag: {item.suggestedTag}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Tabular Amount + Server Status Pill */}
              <button
                type="button"
                onClick={() => (selectionMode ? handleToggleSelect(item.id) : openPaymentModal(item))}
                className="text-right shrink-0 flex flex-col items-end gap-1 focus:outline-none"
              >
                {isAlert ? (
                  <span className="text-xs font-semibold text-slate-600">Bank Notice</span>
                ) : (
                  <div className="font-mono text-sm font-bold tabular-nums whitespace-nowrap">
                    <span className={isReceived ? 'text-emerald-700' : isSent ? 'text-rose-700' : 'text-slate-900'}>
                      {formatAmountCompact(item.amount, item.type)}
                    </span>
                    <span className="text-[11px] text-slate-400 ml-1 font-normal">ETB</span>
                  </div>
                )}

                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10.5px] font-semibold whitespace-nowrap ${pillMeta.pillClass}`}
                >
                  {pillMeta.label}
                </span>

                {pillMeta.sub && (
                  <span className="text-[10.5px] font-mono text-slate-500 whitespace-nowrap max-w-[160px] truncate">
                    {pillMeta.sub}
                  </span>
                )}

                {item.balance !== undefined && !settings.hideBalances && !isAlert && (
                  <span className="text-[10.5px] font-mono text-slate-400 tabular-nums whitespace-nowrap">
                    Bal {item.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </button>
            </article>
          );
        })}
      </div>

      {/* Pagination */}
      {filteredPayments.length > visibleCount && (
        <button
          type="button"
          onClick={() => setVisibleCount(prev => prev + 50)}
          className="w-full min-h-[42px] py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-[#0F4C3A] hover:bg-slate-50 transition-colors"
        >
          Load More ({filteredPayments.length - visibleCount} remaining)
        </button>
      )}

      {/* Floating Batch Operations Bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-16 lg:bottom-6 left-4 right-4 max-w-2xl mx-auto z-40 bg-slate-900 text-white rounded-2xl p-3 shadow-xl border border-slate-700 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 pl-1 shrink-0">
            <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center tabular-nums">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold hidden sm:inline">Selected</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap overflow-x-auto no-scrollbar">
            {onSyncSelected && (
              <button
                type="button"
                disabled={bulkSyncing}
                onClick={handleBatchSync}
                className="px-2.5 py-1.5 rounded-lg bg-[#0F4C3A] hover:bg-[#14503F] text-xs font-semibold text-white flex items-center gap-1 shrink-0 whitespace-nowrap"
              >
                <RefreshCw size={12} className={bulkSyncing ? 'animate-spin' : ''} />
                <span>{bulkSyncing ? 'Syncing...' : 'Sync Selected'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleBatchCopyRefs}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium flex items-center gap-1 shrink-0 whitespace-nowrap"
            >
              {copiedBatchRefs ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copiedBatchRefs ? 'Copied' : 'Copy Refs'}</span>
            </button>
            <button
              type="button"
              onClick={handleBatchExportCsv}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium flex items-center gap-1 shrink-0 whitespace-nowrap"
            >
              <Download size={12} />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={() => setBulkTagModalOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium flex items-center gap-1 shrink-0 whitespace-nowrap"
            >
              <Tag size={12} />
              <span>Tag</span>
            </button>
            <button
              type="button"
              onClick={handleBatchHide}
              className="px-2.5 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-xs font-medium text-rose-200 flex items-center gap-1 shrink-0 whitespace-nowrap"
            >
              <EyeOff size={12} />
              <span>Hide</span>
            </button>
          </div>
        </div>
      )}

      {/* Bulk Tag Modal */}
      {bulkTagModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 border border-slate-200 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Tag {selectedIds.size} Selected Items
              </h3>
              <button type="button" onClick={() => setBulkTagModalOpen(false)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">
                <X size={15} />
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={bulkTagInput}
              onChange={e => setBulkTagInput(e.target.value)}
              placeholder="e.g. #Customer, #Vendor, #Rent"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-[#0F4C3A]"
            />
            <div className="flex flex-wrap gap-1.5">
              {['#Customer', '#Vendor', '#Salary', '#Rent', '#Supplies', '#Personal'].map(suggested => (
                <button
                  key={suggested}
                  type="button"
                  onClick={() => setBulkTagInput(suggested)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-[#0F4C3A]"
                >
                  {suggested}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setBulkTagModalOpen(false)} className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600">
                Cancel
              </button>
              <button
                type="button"
                disabled={!bulkTagInput.trim() || savingOverride}
                onClick={() => handleBatchApplyTag(bulkTagInput)}
                className="flex-1 py-2 rounded-xl bg-[#0F4C3A] text-white text-xs font-semibold disabled:opacity-50"
              >
                Apply Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CBE FT Recovery Modal */}
      {ftRetryPayment && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 border border-slate-200 shadow-xl space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                {isAm ? 'የCBE FT ቁጥር ማስገቢያ' : 'Recover CBE FT Reference'}
              </h3>
              <button type="button" onClick={() => setFtRetryPayment(null)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">
                <X size={15} />
              </button>
            </div>

            {ftSuccessMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-2.5 rounded-xl text-xs font-semibold">
                {ftSuccessMsg}
              </div>
            )}

            <p className="text-xs text-slate-600">
              Only CBE transfers use FT / v2 codes. Paste or confirm the CBE FT reference below:
            </p>

            {ftCandidate && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
                <div className="text-xs">
                  <span className="text-emerald-800 font-semibold block">Detected in SMS:</span>
                  <span className="font-mono font-bold text-emerald-950">{ftCandidate}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFtInput(ftCandidate)}
                  className="px-2.5 py-1 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold"
                >
                  Use FT
                </button>
              </div>
            )}

            <input
              type="text"
              autoFocus
              value={ftInput}
              onChange={e => setFtInput(e.target.value.toUpperCase())}
              placeholder="e.g. FT2630981120"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold focus:outline-none focus:border-[#0F4C3A]"
            />

            <div className="bg-slate-900 text-slate-200 p-2.5 rounded-xl font-mono text-[11px] max-h-24 overflow-y-auto break-words">
              {ftRetryPayment.rawMessage}
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setFtRetryPayment(null)} className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600">
                Cancel
              </button>
              <button
                type="button"
                disabled={savingFt || !ftInput.trim()}
                onClick={() => handleSaveFtAndRetry(ftInput)}
                className="flex-2 py-2 rounded-xl bg-[#0F4C3A] text-white text-xs font-semibold disabled:opacity-50"
              >
                {savingFt ? 'Saving...' : 'Save FT & Sync'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Name Edit Modal */}
      {inlineEditPayment && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 border border-slate-200 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Set Counterparty Name
              </h3>
              <button type="button" onClick={() => setInlineEditPayment(null)} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500">
                <X size={15} />
              </button>
            </div>
            <input
              type="text"
              autoFocus
              value={inlineName}
              onChange={e => setInlineName(e.target.value)}
              placeholder="Customer or merchant name"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-[#0F4C3A]"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setInlineEditPayment(null)} className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600">
                Cancel
              </button>
              <button type="button" disabled={savingOverride} onClick={handleSaveInlineName} className="flex-1 py-2 rounded-xl bg-[#0F4C3A] text-white text-xs font-semibold">
                {savingOverride ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Desk Detail Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 border border-slate-200 shadow-xl space-y-4 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#0F4C3A]" />
                <span className="font-display text-sm font-semibold text-slate-900">Transaction Desk</span>
              </div>
              <button
                type="button"
                aria-label="Close transaction details"
                onClick={() => {
                  setSelectedPayment(null);
                  setModalView('details');
                }}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setModalView('details')}
                className={`py-2 rounded-lg transition-colors ${
                  modalView === 'details' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Record Details
              </button>
              <button
                type="button"
                onClick={() => setModalView('receipt')}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                  modalView === 'receipt' ? 'bg-[#0F4C3A] text-white' : 'text-slate-600'
                }`}
              >
                <Sparkles size={12} />
                <span>Digital Voucher</span>
              </button>
            </div>

            {modalView === 'details' ? (
              <>
                {selectedPayment.needsReview && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                    <div className="font-semibold">Needs Review</div>
                    {selectedPayment.needsReviewReason && (
                      <p className="text-[11px] mt-0.5 text-amber-800">
                        {selectedPayment.needsReviewReason}
                      </p>
                    )}
                  </div>
                )}

                {(selectedPayment.authError || selectedPayment.syncStatus === 'failed') && selectedPayment.errorMessage && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900">
                    <div className="font-semibold">
                      {selectedPayment.authError ? 'Authentication Error (HTTP 401)' : 'Sync Error'}
                    </div>
                    <p className="text-[11px] mt-0.5 text-rose-800">
                      {selectedPayment.errorMessage}
                    </p>
                  </div>
                )}

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                  {selectedPayment.category === 'alert' || selectedPayment.amount === 0 ? (
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-500">Message Type</div>
                      <div className="font-display text-base font-bold text-slate-900">
                        {selectedPayment.bank} Service Alert
                      </div>
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                        Informational notice or OTP code. Excluded from financial inflow/outflow totals.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-medium text-slate-500">Amount</div>
                        <div
                          className={`font-mono text-2xl font-bold tabular-nums ${
                            selectedPayment.type === 'received' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {selectedPayment.type === 'received' ? '+' : '-'}
                          {selectedPayment.amount.toFixed(2)} ETB
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${getHuluBetPill(selectedPayment).pillClass}`}
                        >
                          {getHuluBetPill(selectedPayment).label}
                        </span>
                        {checkingModalStatus && (
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                            <RefreshCw size={10} className="animate-spin" />
                            <span>Checking /api/check...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-slate-500 block">Bank</span>
                      <span className="font-semibold text-slate-900">{selectedPayment.bank}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Direction &amp; Type</span>
                      <span className="font-semibold capitalize text-slate-900">
                        {selectedPayment.type} · {getCategoryLabel(selectedPayment.category)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Counterparty</span>
                      <span className="font-semibold text-slate-900 break-words">
                        {selectedPayment.counterparty || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Reference / Code</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-semibold text-slate-900 break-all">
                          {selectedPayment.reference || '—'}
                        </span>
                        {selectedPayment.reference && (
                          <button
                            type="button"
                            onClick={() => handleCopyRefOnly(selectedPayment.reference)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                            aria-label="Copy reference"
                          >
                            {copiedRef ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                            <span>{copiedRef ? 'Copied' : 'Copy Ref'}</span>
                          </button>
                        )}
                        {needsFtRecovery(selectedPayment) && (
                          <button
                            type="button"
                            onClick={() => handleOpenFtRetry(selectedPayment)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:underline"
                          >
                            <RotateCcw size={11} />
                            <span>Retry FT</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Show HuluBet server fields ONLY if they exist */}
                    {selectedPayment.serverResult?.usage && (
                      <div>
                        <span className="text-slate-500 block">Server Usage</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {selectedPayment.serverResult.usage}
                        </span>
                      </div>
                    )}

                    {selectedPayment.serverResult?.claimed_by && (
                      <div>
                        <span className="text-slate-500 block">Claimed By</span>
                        <span className="font-semibold text-emerald-800">
                          {selectedPayment.serverResult.claimed_by}
                        </span>
                      </div>
                    )}

                    {selectedPayment.serverResult?.claimed_txn_id && (
                      <div>
                        <span className="text-slate-500 block">Claimed Txn ID</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {selectedPayment.serverResult.claimed_txn_id}
                        </span>
                      </div>
                    )}

                    {selectedPayment.serverResult?.agent && (
                      <div>
                        <span className="text-slate-500 block">Phone / Agent</span>
                        <span className="font-semibold text-slate-900">
                          {selectedPayment.serverResult.agent}
                        </span>
                      </div>
                    )}

                    {selectedPayment.fee !== undefined && (
                      <div>
                        <span className="text-slate-500 block">Service Fee / VAT</span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {selectedPayment.fee.toFixed(2)} ETB
                        </span>
                      </div>
                    )}

                    {selectedPayment.balance !== undefined && (
                      <div>
                        <span className="text-slate-500 block">Post-Balance</span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {selectedPayment.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                        </span>
                      </div>
                    )}
                  </div>

                  {selectedPayment.receiptUrl && (
                    <a
                      href={selectedPayment.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full min-h-[40px] py-2 px-3 rounded-xl bg-[#0F4C3A] text-white text-xs font-semibold hover:bg-[#0B3A2C] flex items-center justify-center gap-1.5"
                    >
                      <span>Open Official {selectedPayment.bank} Receipt</span>
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>

                {/* Action Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSharePaymentReceipt(selectedPayment)}
                    className="min-h-[38px] px-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Share2 size={13} />
                    <span>{copied ? 'Copied' : 'Share'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditing(v => !v)}
                    className="min-h-[38px] px-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    disabled={syncingId === selectedPayment.id}
                    onClick={() => handleSyncSingle(selectedPayment)}
                    className="min-h-[38px] px-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <UploadCloud size={13} />
                    <span>{syncingId === selectedPayment.id ? '...' : 'Sync'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleHidePayment}
                    className="min-h-[38px] px-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    <EyeOff size={13} />
                    <span>Hide</span>
                  </button>
                </div>

                {onCheckTransactionStatus && selectedPayment.reference && !selectedPayment.reference.startsWith('SMS-') && serverUrlConfigured && (
                  <button
                    type="button"
                    disabled={checkingModalStatus}
                    onClick={async () => {
                      setCheckingModalStatus(true);
                      try {
                        await onCheckTransactionStatus(selectedPayment);
                      } finally {
                        setCheckingModalStatus(false);
                      }
                    }}
                    className="w-full min-h-[38px] py-2 rounded-xl border border-emerald-200 bg-emerald-50/70 text-[#0F4C3A] text-xs font-semibold hover:bg-emerald-100 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={checkingModalStatus ? 'animate-spin' : ''} />
                    <span>{checkingModalStatus ? 'Checking /api/check...' : 'Re-check Live Server Status (/api/check)'}</span>
                  </button>
                )}

                {onAiParsePayment && settings.aiEnabled !== false && (
                  <button
                    type="button"
                    disabled={aiParsingId === selectedPayment.id}
                    onClick={() => handleAiExtract(selectedPayment)}
                    className="w-full min-h-[38px] py-2 rounded-xl border border-indigo-200 bg-indigo-50/70 text-indigo-800 text-xs font-semibold hover:bg-indigo-100 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={13} />
                    <span>
                      {aiParsingId === selectedPayment.id ? 'Analyzing with Gemini AI...' : 'Re-analyze SMS with Gemini AI'}
                    </span>
                  </button>
                )}

                {isEditing && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                    <div className="text-xs font-semibold text-slate-900">Edit Transaction Override</div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Counterparty Name</label>
                      <input
                        type="text"
                        value={editCounterparty}
                        onChange={e => setEditCounterparty(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Direction</label>
                        <select
                          value={editDirection}
                          onChange={e => setEditDirection(e.target.value as PaymentType)}
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                        >
                          <option value="received">Received (In)</option>
                          <option value="sent">Sent (Out)</option>
                          <option value="unknown">Unknown</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Category</label>
                        <select
                          value={editCategory}
                          onChange={e => setEditCategory(e.target.value)}
                          className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                        >
                          <option value="transfer">Transfer</option>
                          <option value="received">Deposit</option>
                          <option value="atm-card">ATM / Card</option>
                          <option value="airtime">Airtime</option>
                          <option value="data">Data Package</option>
                          <option value="bill">Bill Payment</option>
                          <option value="payment">Merchant Payment</option>
                          <option value="alert">Alert Notice</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Tag</label>
                      <input
                        type="text"
                        value={editTag}
                        onChange={e => setEditTag(e.target.value)}
                        placeholder="e.g. #Vendor, #Rent"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Note</label>
                      <input
                        type="text"
                        value={editNote}
                        onChange={e => setEditNote(e.target.value)}
                        placeholder="Optional memo..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600">
                        Cancel
                      </button>
                      <button type="button" disabled={savingOverride} onClick={handleSaveModalEdit} className="flex-1 py-2 rounded-lg bg-[#0F4C3A] text-white text-xs font-semibold">
                        {savingOverride ? 'Saving...' : 'Save Override'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500">Original Bank SMS</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedPayment.rawMessage)}
                      className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1"
                    >
                      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{copied ? 'Copied' : 'Copy SMS'}</span>
                    </button>
                  </div>
                  <div className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] leading-relaxed break-words max-h-36 overflow-y-auto">
                    {selectedPayment.rawMessage}
                  </div>
                </div>
              </>
            ) : (
              /* Digital Voucher View */
              <div className="space-y-4">
                <div className="bg-[#0B3B2E] text-white rounded-2xl p-5 border border-[#14503F] space-y-4">
                  <div className="flex items-center justify-between border-b border-white/15 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-300" />
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-200">
                          Ak Finance Voucher
                        </div>
                        <div className="text-xs font-semibold text-white">Local Ledger Record</div>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-emerald-200">
                      {getHuluBetPill(selectedPayment).label}
                    </span>
                  </div>

                  <div className="py-2 text-center">
                    <div className="text-xs text-emerald-200/80">
                      {selectedPayment.type === 'received' ? 'Incoming Payment' : 'Outgoing Transfer'}
                    </div>
                    <div className="font-mono text-3xl font-bold tracking-tight mt-1 tabular-nums">
                      {selectedPayment.type === 'received' ? '+' : '-'}
                      {selectedPayment.amount.toFixed(2)} <span className="text-sm font-medium text-emerald-200">ETB</span>
                    </div>
                  </div>

                  <div className="bg-white/8 rounded-xl p-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-emerald-100/75">Bank</span>
                      <span className="font-semibold">{selectedPayment.bank}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-100/75">Counterparty</span>
                      <span className="font-semibold">{selectedPayment.counterparty || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-100/75">Reference</span>
                      <span className="font-mono font-semibold">{selectedPayment.reference || '—'}</span>
                    </div>
                    {selectedPayment.fee !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-emerald-100/75">Fee / VAT</span>
                        <span className="font-mono font-semibold">{selectedPayment.fee.toFixed(2)} ETB</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-emerald-100/75">Timestamp</span>
                      <span className="font-mono">{new Date(selectedPayment.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/15">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-white rounded-lg p-1.5 flex items-center justify-center">
                        <QrCode className="w-full h-full text-slate-900" />
                      </div>
                      <span className="text-xs text-emerald-100/85">EthSwitch / Local Audit</span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-200">
                      #{(selectedPayment.id || '').slice(-6)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSharePaymentReceipt(selectedPayment)}
                  className="w-full min-h-[42px] py-2.5 px-4 rounded-xl bg-[#0F4C3A] text-white text-xs font-semibold hover:bg-[#0B3A2C] flex items-center justify-center gap-2"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Voucher Copied' : 'Copy Voucher Text'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
