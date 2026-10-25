import React, { useState } from 'react';
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  X, 
  ArrowDownLeft, 
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { PaymentRecord } from '../types/index.ts';

interface LocalVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  payments: PaymentRecord[];
}

export const LocalVerifyModal: React.FC<LocalVerifyModalProps> = ({
  isOpen,
  onClose,
  payments,
}) => {
  const [refInput, setRefInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [matchedPayment, setMatchedPayment] = useState<PaymentRecord | null>(null);

  if (!isOpen) return null;

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRef = refInput.trim().toUpperCase();
    if (!cleanRef) return;

    // Search local SQLite database only
    const found = payments.find(p => {
      const pRef = (p.reference || '').toUpperCase().trim();
      return pRef === cleanRef || pRef.includes(cleanRef);
    });

    setMatchedPayment(found || null);
    setSearchTriggered(true);
  };

  const searchedAmount = parseFloat(amountInput.replace(/,/g, ''));
  const hasAmountInput = !isNaN(searchedAmount) && amountInput.trim() !== '';
  const isAmountMatch = matchedPayment && hasAmountInput && Math.abs(matchedPayment.amount - searchedAmount) < 0.01;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-100 space-y-4 max-h-[90dvh] overflow-y-auto">
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
            <p className="font-bold text-amber-950">Safety Notice</p>
            <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed font-medium">
              Confirm in your bank app; SMS sender names can be faked.
            </p>
          </div>
        </div>

        {/* Verification Form */}
        <form onSubmit={handleVerify} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800">
              Transaction Reference / Ref Number *
            </label>
            <input
              type="text"
              autoFocus
              value={refInput}
              onChange={e => {
                setRefInput(e.target.value);
                setSearchTriggered(false);
              }}
              placeholder="e.g. FT262970QW8Z, TXN892019"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-[#14503F]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800">
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
              placeholder="e.g. 500.00"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-none focus:border-[#14503F]"
            />
          </div>

          <button
            type="submit"
            disabled={!refInput.trim()}
            className="w-full py-2.5 rounded-xl bg-[#14503F] text-white text-xs font-bold shadow-md hover:bg-[#0e3b2e] disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
          >
            <Search size={14} />
            <span>Verify in Local Database</span>
          </button>
        </form>

        {/* Verification Results */}
        {searchTriggered && (
          <div className="pt-2 animate-in fade-in">
            {matchedPayment ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                {/* Result Status Banner */}
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Transaction Found in SQLite</span>
                  </div>

                  {hasAmountInput && (
                    isAmountMatch ? (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                        Amount Matches ✓
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                        Amount Discrepancy ⚠
                      </span>
                    )
                  )}
                </div>

                {/* Details Breakdown */}
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
                      {matchedPayment.type}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-400 block">SMS Amount</span>
                    <span className="font-extrabold text-sm text-[#14503F] font-mono">
                      ETB {matchedPayment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-400 block">Counterparty</span>
                    <span className="font-bold text-slate-800 truncate block">{matchedPayment.counterparty}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10.5px] text-slate-400 block">Date & Time</span>
                    <span className="font-mono text-[11px] text-slate-700">
                      {new Date(matchedPayment.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Raw SMS Text */}
                <div className="space-y-1 pt-1 border-t border-slate-200">
                  <span className="text-[10.5px] font-bold text-slate-600 block">Captured Raw SMS</span>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 font-mono text-[11px] text-slate-700 leading-relaxed break-words select-all">
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
                  Reference Not Found
                </div>
                <p className="text-[11px] text-rose-700 max-w-xs mx-auto">
                  No captured payment with reference "{refInput}" exists in your local SQLite database.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1 pt-1">
          <ShieldCheck size={12} className="text-emerald-600" />
          <span>Local only. Never calls server /api/verify endpoint.</span>
        </div>
      </div>
    </div>
  );
};
