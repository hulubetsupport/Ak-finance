import React, { useState } from 'react';
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  X, 
  ArrowDownLeft, 
  ArrowUpRight,
  ShieldCheck,
  Globe,
  Loader2,
  Copy,
  Info
} from 'lucide-react';
import { PaymentRecord, AppSettings } from '../types/index.ts';
import { parseBankSms } from '../utils/smsParser.ts';

interface LocalVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: PaymentRecord[];
  settings?: AppSettings;
}

export const LocalVerifyModal: React.FC<LocalVerifyModalProps> = ({
  isOpen,
  onClose,
  payments,
  settings,
}) => {
  const [queryInput, setQueryInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [matchedPayment, setMatchedPayment] = useState<PaymentRecord | null>(null);

  // Read-only server check state
  const [checkingServer, setCheckingServer] = useState(false);
  const [serverCheckResult, setServerCheckResult] = useState<any | null>(null);
  const [serverCheckError, setServerCheckError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Extract reference, v2 code, FT number, or parse from full SMS
  const extractSearchTarget = (raw: string): { ref: string; extractedAmount?: number } => {
    const text = raw.trim();
    if (!text) return { ref: '' };

    // Check if user pasted a v2 receipt link (e.g. https://mbreciept.cbe.com.et/v2-xxxx or v2-xxxx)
    const v2Match = text.match(/\b(v2-[A-Za-z0-9_-]+)/);
    if (v2Match && v2Match[1]) {
      return { ref: v2Match[1] };
    }

    // Check if user pasted an FT receipt link (e.g. /BranchReceipt/FT26294BDL5T&6233 or FT...)
    const ftMatch = text.match(/\b(FT[A-Za-z0-9]{8,15})\b/i);
    if (ftMatch && ftMatch[1]) {
      return { ref: ftMatch[1].toUpperCase() };
    }

    // Check if full SMS body was pasted (longer text containing bank keywords)
    if (text.length > 40 && (text.includes('ETB') || text.includes('ብር') || text.includes('account') || text.includes('ተቀብለዋል'))) {
      const parsed = parseBankSms('CBE', text);
      if (parsed.reference) {
        return { ref: parsed.reference, extractedAmount: parsed.amount > 0 ? parsed.amount : undefined };
      }
    }

    // Check standard 10-char Telebirr transaction code or alphanumeric ref
    const clean = text.replace(/^(Ref|TXN|FT)[\s:#-]+/i, '').trim();
    return { ref: clean };
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setServerCheckResult(null);
    setServerCheckError(null);

    const { ref: targetRef, extractedAmount } = extractSearchTarget(queryInput);
    if (!targetRef) return;

    if (extractedAmount && !amountInput) {
      setAmountInput(String(extractedAmount));
    }

    const normTarget = targetRef.toLowerCase();

    // STRICT RULE: Search the LOCAL SQLite database only
    const found = payments.find(p => {
      const pRef = (p.reference || '').toLowerCase().trim();
      const pFt = (p.ftNumber || '').toLowerCase().trim();
      const pV2 = (p.v2Code || '').toLowerCase().trim();
      const rawLower = (p.rawMessage || '').toLowerCase();

      return (
        pRef === normTarget ||
        pFt === normTarget ||
        pV2 === normTarget ||
        (targetRef.length >= 6 && (pRef.includes(normTarget) || rawLower.includes(normTarget)))
      );
    });

    setMatchedPayment(found || null);
    setSearchTriggered(true);
  };

  // Optional read-only server check: GET {server base}/api/check?token=...&ref=...&live=1
  // NEVER calls /api/verify!
  const handleCheckWithServerReadOnly = async () => {
    const { ref: targetRef } = extractSearchTarget(queryInput);
    const searchRef = targetRef || matchedPayment?.reference;
    if (!searchRef) return;

    const serverUrl = settings?.serverUrl?.trim();
    const token = settings?.secretKey || '';

    if (!serverUrl) {
      setServerCheckError('No server URL configured in Settings.');
      return;
    }

    setCheckingServer(true);
    setServerCheckError(null);
    setServerCheckResult(null);

    try {
      // Determine server base URL
      let baseUrl = serverUrl;
      try {
        const u = new URL(serverUrl);
        baseUrl = `${u.protocol}//${u.host}`;
      } catch {}

      const checkUrl = `${baseUrl.replace(/\/+$/, '')}/api/check?token=${encodeURIComponent(token)}&ref=${encodeURIComponent(searchRef)}&live=1`;

      const response = await fetch(checkUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      const text = await response.text();
      try {
        const json = JSON.parse(text);
        setServerCheckResult(json);
      } catch {
        setServerCheckResult({ rawText: text, status: response.status });
      }
    } catch (err: any) {
      setServerCheckError(err?.message || 'Network request to /api/check failed.');
    } finally {
      setCheckingServer(false);
    }
  };

  const searchedAmount = parseFloat(amountInput.replace(/,/g, ''));
  const hasAmountInput = !isNaN(searchedAmount) && amountInput.trim() !== '';
  const isAmountMatch = matchedPayment && hasAmountInput && Math.abs(matchedPayment.amount - searchedAmount) < 0.01;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 max-h-[92dvh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#14503F] flex items-center justify-center font-bold">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-['Poppins',sans-serif]">
                Local Payment Verification
              </h3>
              <p className="text-[10px] text-slate-400">
                Testing only · Queries local SQLite database
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
          >
            <X size={15} />
          </button>
        </div>

        {/* Required Bank App Warning Notice */}
        <div className="bg-amber-50 border border-amber-300/80 rounded-2xl p-3.5 flex items-start gap-2.5 text-amber-900">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-amber-950">Bank Verification Notice</p>
            <p className="text-[11px] text-amber-900 mt-0.5 leading-relaxed font-semibold">
              Confirm in your bank app; SMS sender names can be faked.
            </p>
          </div>
        </div>

        {/* Verification Form */}
        <form onSubmit={handleVerify} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 block">
              Ref / FT / v2 Link / Receipt Link / Full SMS *
            </label>
            <textarea
              rows={2}
              autoFocus
              value={queryInput}
              onChange={e => {
                setQueryInput(e.target.value);
                setSearchTriggered(false);
              }}
              placeholder="Paste Ref, FT number, https://mbreciept.cbe.com.et/v2-xxxx, or full SMS..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-medium focus:outline-none focus:border-[#14503F]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 block">
              Expected Amount in ETB (Optional)
            </label>
            <input
              type="number"
              step="0.01"
              value={amountInput}
              onChange={e => {
                setAmountInput(e.target.value);
                setSearchTriggered(false);
              }}
              placeholder="e.g. 10000.00"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-[#14503F]"
            />
          </div>

          <button
            type="submit"
            disabled={!queryInput.trim()}
            className="w-full py-2.5 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-md hover:bg-[#0e3b2e] disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
          >
            <Search size={14} />
            <span>Search Local Database (SQLite)</span>
          </button>
        </form>

        {/* Verification Results */}
        {searchTriggered && (
          <div className="space-y-3 animate-in fade-in">
            {matchedPayment ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                {/* Result Status Banner */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 size={14} className="text-emerald-700" />
                    <span>Transaction Found in Local Database</span>
                  </div>

                  {hasAmountInput && (
                    isAmountMatch ? (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                        Amount Matches ✓
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                        Amount Mismatch ⚠ (Expected ETB {searchedAmount.toLocaleString()} vs Found ETB {matchedPayment.amount.toLocaleString()})
                      </span>
                    )
                  )}
                </div>

                {/* Sent Payment Explanation Warning (Requirement C) */}
                {matchedPayment.type === 'sent' && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-rose-900">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-rose-950">
                      <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                      <span>Sent Payment Cannot Be Verified</span>
                    </div>
                    <p className="text-[11px] text-rose-800 leading-relaxed">
                      A "Sent" payment can never be verified as valid payment proof to you. This record is an outgoing debit or transfer sent from your account, not an incoming payment received from a customer.
                    </p>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200">
                  <div>
                    <span className="text-[10.5px] text-slate-400 block">Bank</span>
                    <span className="font-bold text-slate-800">{matchedPayment.bank}</span>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-400 block">Direction</span>
                    <span className={`font-bold capitalize flex items-center gap-1 ${
                      matchedPayment.type === 'received' ? 'text-emerald-700' : 'text-slate-900'
                    }`}>
                      {matchedPayment.type === 'received' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                      {matchedPayment.type} ({matchedPayment.category || 'other'})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-400 block">Amount</span>
                    <span className="font-extrabold text-sm text-[#14503F] font-mono">
                      ETB {matchedPayment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-400 block">Counterparty / Name</span>
                    <span className="font-bold text-slate-800 truncate block">
                      {matchedPayment.counterparty || 'None'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-400 block">Ref / FT / v2</span>
                    <span className="font-mono font-bold text-slate-700 truncate block">
                      {matchedPayment.reference || 'None'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-400 block">Date & Time</span>
                    <span className="font-mono text-[11px] text-slate-700">
                      {new Date(matchedPayment.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Raw SMS Text */}
                <div className="space-y-1 pt-1 border-t border-slate-200">
                  <span className="text-[10.5px] font-bold text-slate-600 block">Raw Stored SMS</span>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 font-mono text-[10.5px] text-slate-700 leading-relaxed break-words select-all">
                    {matchedPayment.rawMessage}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center space-y-1.5">
                <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
                  <XCircle size={20} />
                </div>
                <div className="text-xs font-bold text-rose-900">
                  Reference Not Found in Local Database
                </div>
                <p className="text-[11px] text-rose-700 max-w-xs mx-auto">
                  No captured payment matching the query exists in your local SQLite database.
                </p>
              </div>
            )}

            {/* Optional Server Read-Only Check Button (Requirement C) */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Server Reconciliation (Read-Only)
                </span>
                <button
                  type="button"
                  onClick={handleCheckWithServerReadOnly}
                  disabled={checkingServer}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                >
                  {checkingServer ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
                  <span>Check with server (read only)</span>
                </button>
              </div>

              {serverCheckError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700 font-mono">
                  {serverCheckError}
                </div>
              )}

              {serverCheckResult && (
                <div className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] space-y-1 overflow-x-auto">
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider font-bold">
                    GET /api/check Response:
                  </div>
                  <pre className="whitespace-pre-wrap break-words">
                    {JSON.stringify(serverCheckResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1 pt-1 border-t border-slate-100">
          <ShieldCheck size={12} className="text-emerald-600" />
          <span>Local database only. NEVER calls /api/verify (never marks payment as used).</span>
        </div>
      </div>
    </div>
  );
};
