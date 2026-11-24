import React from 'react';
import { PaymentRecord, AppSettings, WithdrawalRecord, MonthlyBudget } from '../types/index.ts';
import { translations } from '../utils/i18n.ts';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Download,
  TrendingUp,
  Building2,
  AlertTriangle,
  Database,
} from 'lucide-react';
import { MonthlyBudgetCard } from './MonthlyBudgetCard.tsx';
import { db } from '../services/db.ts';
import { saveNativeFile } from '../utils/nativeBridge.ts';

interface InsightsTabProps {
  payments: PaymentRecord[];
  withdrawals: WithdrawalRecord[];
  settings: AppSettings;
  budget?: MonthlyBudget | null;
  onUpdateBudget?: (budget: MonthlyBudget) => Promise<void>;
}

export const InsightsTab: React.FC<InsightsTabProps> = ({
  payments,
  withdrawals,
  settings,
  budget,
  onUpdateBudget,
}) => {
  const t = translations[settings.language];
  const isAm = settings.language === 'am';

  const financialPayments = payments.filter(p => !p.isDuplicate && !p.isHidden && p.category !== 'alert');
  const receivedPayments = financialPayments.filter(p => p.type === 'received');
  const sentPayments = financialPayments.filter(p => p.type === 'sent');

  const totalReceived = receivedPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalSent = sentPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalWithdrawn = withdrawals.reduce((acc, w) => acc + (w.amount || 0), 0);
  const totalFees = financialPayments.reduce((acc, p) => acc + (p.fee || 0), 0);

  const syncedCount = payments.filter(p => p.syncStatus === 'sent' && !p.serverIgnored).length;
  const localOnlyCount = payments.filter(
    p => (p.syncStatus === 'local' || p.syncStatus === 'pending' || p.syncStatus === 'failed') && !p.serverIgnored
  ).length;
  const serverIgnoredCount = payments.filter(p => p.serverIgnored || p.serverResult?.status === 'Ignored').length;
  const totalCount = payments.length || 1;
  const syncedPct = Math.round((syncedCount / totalCount) * 100);
  const localPct = Math.round((localOnlyCount / totalCount) * 100);
  const ignoredPct = Math.max(0, 100 - syncedPct - localPct);

  const bankVolumes: Record<string, { received: number; sent: number; count: number }> = {};
  financialPayments.forEach(p => {
    if (!bankVolumes[p.bank]) {
      bankVolumes[p.bank] = { received: 0, sent: 0, count: 0 };
    }
    if (p.type === 'received') bankVolumes[p.bank].received += p.amount;
    if (p.type === 'sent') bankVolumes[p.bank].sent += p.amount;
    bankVolumes[p.bank].count += 1;
  });

  const handleExportCsv = async () => {
    const csv = await db.exportPaymentsCsv();
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    await saveNativeFile(`ak_finance_payments_${ts}.csv`, 'text/csv;charset=utf-8;', csv);
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {t.analyticsHeadline}
          </h2>
          <p className="text-xs text-slate-500">
            {isAm ? 'የገቢ፣ የወጪ እና የባንኮች ማጠቃለያ' : 'Reconciliation, channel breakdown & storage health'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:border-slate-300 flex items-center gap-1.5 whitespace-nowrap"
        >
          <Download size={13} />
          <span>{t.exportCsv}</span>
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-1">
            <ArrowDownLeft size={14} />
            <span>{isAm ? 'ጠቅላላ ገቢ' : 'Total Inflow'}</span>
          </div>
          <div className="text-lg font-bold text-slate-900 tabular-nums">
            {settings.hideBalances ? '••••' : `+${totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {receivedPayments.length} {isAm ? 'የገቡ ክፍያዎች' : 'received'}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 mb-1">
            <ArrowUpRight size={14} />
            <span>{isAm ? 'ጠቅላላ ወጪ' : 'Total Outflow'}</span>
          </div>
          <div className="text-lg font-bold text-slate-900 tabular-nums">
            {settings.hideBalances ? '••••' : `-${totalSent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {sentPayments.length} {isAm ? 'የተላኩ ክፍያዎች' : 'sent'}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 mb-1">
            {isAm ? 'የባንክ ክፍያ (Fees)' : 'Fees & VAT Tracked'}
          </div>
          <div className="text-lg font-bold text-slate-900 tabular-nums">
            {settings.hideBalances ? '••••' : `${totalFees.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB`}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Across Telebirr & banks
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 mb-1">
            {isAm ? 'ጥሬ ገንዘብ ወጪ' : 'Recorded Withdrawals'}
          </div>
          <div className="text-lg font-bold text-slate-900 tabular-nums">
            {settings.hideBalances ? '••••' : `${totalWithdrawn.toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB`}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {withdrawals.length} vouchers
          </div>
        </div>
      </div>

      {/* Monthly Budget Card */}
      {budget && onUpdateBudget && (
        <MonthlyBudgetCard
          payments={payments}
          withdrawals={withdrawals}
          budget={budget}
          settings={settings}
          onUpdateBudget={onUpdateBudget}
        />
      )}

      {/* Storage & Sync Health Breakdown (Synced vs Local Only vs Server Ignored) */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#0F4C3A] border border-emerald-200 flex items-center justify-center">
              <Database size={15} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">
                Local Autonomy & Sync Breakdown
              </div>
              <div className="text-xs text-slate-500">
                Synced vs. Local-Only vs. Server Ignored (preserved locally)
              </div>
            </div>
          </div>
          <span className="text-xs font-bold text-[#0F4C3A] tabular-nums">
            {payments.length} Total
          </span>
        </div>

        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
          <div className="bg-[#0F4C3A] h-full" style={{ width: `${syncedPct}%` }} />
          <div className="bg-slate-400 h-full" style={{ width: `${localPct}%` }} />
          <div className="bg-amber-500 h-full" style={{ width: `${ignoredPct}%` }} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-2 bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200">
            <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-500">Synced to Server</div>
              <div className="font-bold text-slate-900 tabular-nums">{syncedCount} records</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <Clock size={14} className="text-slate-600 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-500">Local Storage Only</div>
              <div className="font-bold text-slate-900 tabular-nums">{localOnlyCount} records</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
            <AlertTriangle size={14} className="text-amber-700 shrink-0" />
            <div>
              <div className="text-[11px] text-amber-800">Server Ignored (Kept)</div>
              <div className="font-bold text-amber-950 tabular-nums">{serverIgnoredCount} records</div>
            </div>
          </div>
        </div>
      </div>

      {/* Volume by Channel + Top Counterparties */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2">
            <Building2 size={15} className="text-[#0F4C3A]" />
            <div className="text-xs font-bold text-slate-900">
              {isAm ? 'የባንክ ክፍፍል' : 'Volume by Financial Channel'}
            </div>
          </div>

          {Object.keys(bankVolumes).length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">No financial records yet</div>
          ) : (
            <div className="space-y-2.5">
              {Object.entries(bankVolumes).map(([bName, data]) => {
                const pct = totalReceived > 0 ? Math.round((data.received / totalReceived) * 100) : 0;
                return (
                  <div key={bName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{bName} ({data.count})</span>
                      <span className="font-mono text-slate-700 tabular-nums">
                        {settings.hideBalances ? '••••' : `+${data.received.toLocaleString()} / -${data.sent.toLocaleString()} ETB`}
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-[#0F4C3A]"
                        style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-[#0F4C3A]" />
            <div className="text-xs font-bold text-slate-900">
              {isAm ? 'ዋነኛ ደንበኞች እና ተቀባዮች' : 'Top Counterparties'}
            </div>
          </div>

          {(() => {
            const counterpartiesMap: Record<string, { total: number; count: number; type: 'received' | 'sent' }> = {};
            financialPayments.forEach(p => {
              if (!p.counterparty || p.counterparty.toLowerCase().includes('unknown')) return;
              const name = p.counterparty.trim();
              if (!counterpartiesMap[name]) {
                counterpartiesMap[name] = { total: 0, count: 0, type: p.type === 'received' ? 'received' : 'sent' };
              }
              counterpartiesMap[name].total += (p.amount || 0);
              counterpartiesMap[name].count += 1;
            });

            const sortedCounterparties = Object.entries(counterpartiesMap)
              .sort((a, b) => b[1].total - a[1].total)
              .slice(0, 5);

            if (sortedCounterparties.length === 0) {
              return (
                <div className="text-center py-4 text-xs text-slate-400">
                  No named counterparties yet
                </div>
              );
            }

            return (
              <div className="divide-y divide-slate-100">
                {sortedCounterparties.map(([name, info], idx) => (
                  <div key={name} className="flex items-center justify-between py-2 text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-slate-400 tabular-nums shrink-0">#{idx + 1}</span>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{name}</div>
                        <div className="text-[11px] text-slate-500">
                          {info.count} txn{info.count > 1 ? 's' : ''} · {info.type}
                        </div>
                      </div>
                    </div>
                    <div className="font-bold text-slate-900 tabular-nums shrink-0">
                      {settings.hideBalances ? '••••' : `${info.total.toLocaleString()} ETB`}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Ticket Size Distribution */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
        <div className="text-xs font-bold text-slate-900">
          {isAm ? 'የክፍያ መጠን ስርጭት' : 'Transaction Size Distribution'}
        </div>
        {(() => {
          const micro = financialPayments.filter(p => p.amount < 500).length;
          const medium = financialPayments.filter(p => p.amount >= 500 && p.amount <= 2000).length;
          const large = financialPayments.filter(p => p.amount > 2000).length;
          const total = financialPayments.length || 1;

          return (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">&lt; 500 ETB</div>
                <div className="font-bold text-slate-900 text-sm mt-0.5 tabular-nums">{micro}</div>
                <div className="text-[11px] text-slate-500 tabular-nums">{Math.round((micro / total) * 100)}%</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">500 – 2,000 ETB</div>
                <div className="font-bold text-slate-900 text-sm mt-0.5 tabular-nums">{medium}</div>
                <div className="text-[11px] text-slate-500 tabular-nums">{Math.round((medium / total) * 100)}%</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] text-slate-500">&gt; 2,000 ETB</div>
                <div className="font-bold text-slate-900 text-sm mt-0.5 tabular-nums">{large}</div>
                <div className="text-[11px] text-slate-500 tabular-nums">{Math.round((large / total) * 100)}%</div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
