import React from 'react';
import { PaymentRecord, AppSettings, WithdrawalRecord, MonthlyBudget } from '../types/index.ts';
import { translations } from '../utils/i18n.ts';
import { 
  BarChart3, 
  ArrowDownLeft, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  Download, 
  TrendingUp, 
  Building2,
  PieChart
} from 'lucide-react';
import { MonthlyBudgetCard } from './MonthlyBudgetCard.tsx';

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

  const receivedPayments = payments.filter(p => p.type === 'received');
  const sentPayments = payments.filter(p => p.type === 'sent');

  const totalReceived = receivedPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalSent = sentPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalWithdrawn = withdrawals.reduce((acc, w) => acc + (w.amount || 0), 0);
  const netOperatingCash = totalReceived - totalSent - totalWithdrawn;

  const syncedCount = payments.filter(p => p.syncStatus === 'sent').length;
  const pendingCount = payments.filter(p => p.syncStatus === 'pending' || p.syncStatus === 'failed').length;
  const syncRate = payments.length > 0 ? Math.round((syncedCount / payments.length) * 100) : 100;

  // Group by Bank
  const bankVolumes: Record<string, { received: number; count: number }> = {};
  payments.forEach(p => {
    if (!bankVolumes[p.bank]) {
      bankVolumes[p.bank] = { received: 0, count: 0 };
    }
    if (p.type === 'received') {
      bankVolumes[p.bank].received += p.amount;
    }
    bankVolumes[p.bank].count += 1;
  });

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['ID', 'Date', 'Bank', 'Sender Address', 'Type', 'Amount ETB', 'Counterparty', 'Reference', 'Sync Status', 'Raw SMS'];
    const rows = payments.map(p => [
      p.id,
      new Date(p.timestamp).toLocaleString(),
      p.bank || 'Unknown',
      p.senderAddress || '',
      p.type || 'unknown',
      p.amount || 0,
      `"${(p.counterparty || '').replace(/"/g, '""')}"`,
      p.reference || '',
      p.syncStatus || 'local',
      `"${(p.rawMessage || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ak_finance_payments_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 font-['Poppins',sans-serif]">
            {t.analyticsHeadline}
          </h2>
          <p className="text-xs text-slate-400">
            {isAm ? 'የገቢ እና የወጪ ፍሰት ማጠቃለያ' : 'Real-time reconciliation and cash flow metrics'}
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-xs flex items-center gap-1.5"
        >
          <Download size={13} />
          <span>{t.exportCsv}</span>
        </button>
      </div>

      {/* Top 3 KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mb-1">
            <ArrowDownLeft size={14} />
            <span>{isAm ? 'ጠቅላላ ገቢ' : 'Total Inflow'}</span>
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-['Poppins',sans-serif]">
            {settings.hideBalances ? '••••' : `+${totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {receivedPayments.length} {isAm ? 'የገቡ ክፍያዎች' : 'received txns'}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 mb-1">
            <ArrowUpRight size={14} />
            <span>{isAm ? 'ጠቅላላ ወጪ' : 'Total Outflow'}</span>
          </div>
          <div className="text-xl font-extrabold text-slate-900 font-['Poppins',sans-serif]">
            {settings.hideBalances ? '••••' : `-${totalSent.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {sentPayments.length} {isAm ? 'የተላኩ ክፍያዎች' : 'sent transfers'}
          </div>
        </div>
      </div>

      {/* Monthly Budget Card (2026) */}
      {budget && onUpdateBudget && (
        <MonthlyBudgetCard
          payments={payments}
          withdrawals={withdrawals}
          budget={budget}
          settings={settings}
          onUpdateBudget={onUpdateBudget}
        />
      )}

      {/* Queue Health Card */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#14503F] flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
                {t.syncQueueHealth}
              </div>
              <div className="text-[10px] text-slate-400">
                {isAm ? 'የሰርቨር ማመሳሰል ሁኔታ' : 'Sent vs. unsent SMS to backend webhook'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-extrabold text-[#14503F] font-mono">
              {syncRate}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
          <div
            className="bg-[#14503F] h-full transition-all duration-500"
            style={{ width: `${syncRate}%` }}
          />
          <div
            className="bg-amber-400 h-full transition-all duration-500"
            style={{ width: `${100 - syncRate}%` }}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div className="flex items-center gap-2 bg-emerald-50/60 p-2 rounded-xl border border-emerald-100">
            <CheckCircle2 size={15} className="text-emerald-600" />
            <div>
              <div className="text-[10px] text-slate-500">{isAm ? 'ተልኳል' : 'Synced to Server'}</div>
              <div className="font-bold text-slate-800">{syncedCount} items</div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-amber-50/60 p-2 rounded-xl border border-amber-100">
            <Clock size={15} className="text-amber-600" />
            <div>
              <div className="text-[10px] text-slate-500">{isAm ? 'በወረፋ ላይ' : 'Unsent / Retrying'}</div>
              <div className="font-bold text-slate-800">{pendingCount} items</div>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown by Bank */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Building2 size={16} />
          </div>
          <div className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
            {isAm ? 'የባንክ ክፍፍል' : 'Volume by Financial Channel'}
          </div>
        </div>

        <div className="space-y-2 pt-1">
          {Object.entries(bankVolumes).map(([bName, data]) => {
            const pct = totalReceived > 0 ? Math.round((data.received / totalReceived) * 100) : 0;
            return (
              <div key={bName} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{bName}</span>
                  <span className="font-mono text-slate-600">
                    {settings.hideBalances ? '••••' : `${data.received.toLocaleString()} ETB`} ({pct}%)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#14503F] to-emerald-400 rounded-full"
                    style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2026 Top Counterparties Leaderboard */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#14503F] flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
                {isAm ? 'ዋነኛ ደንበኞች እና ተቀባዮች' : 'Top Counterparties Leaderboard (2026)'}
              </div>
              <div className="text-[10px] text-slate-400">
                {isAm ? 'ከፍተኛ የገንዘብ እንቅስቃሴ ያላቸው' : 'Ranked by cumulative transaction volume'}
              </div>
            </div>
          </div>
        </div>

        {(() => {
          const counterpartiesMap: Record<string, { total: number; count: number; type: 'received' | 'sent' }> = {};
          payments.forEach(p => {
            if (p.category === 'alert' || !p.counterparty || p.counterparty.toLowerCase().includes('unknown')) return;
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
                No identified named counterparties yet
              </div>
            );
          }

          return (
            <div className="space-y-2 pt-1">
              {sortedCounterparties.map(([name, info], idx) => (
                <div key={name} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-800 line-clamp-1">{name}</div>
                      <div className="text-[10px] text-slate-400">
                        {info.count} txn{info.count > 1 ? 's' : ''} • {info.type}
                      </div>
                    </div>
                  </div>
                  <div className="font-black font-['Poppins',sans-serif] text-slate-900">
                    {settings.hideBalances ? '••••' : `${info.total.toLocaleString()} ETB`}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Ticket Size Distribution */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="text-xs font-bold text-slate-900 font-['Poppins',sans-serif]">
          {isAm ? 'የክፍያ መጠን ስርጭት' : 'Transaction Size Distribution'}
        </div>
        {(() => {
          const validTx = payments.filter(p => p.category !== 'alert');
          const micro = validTx.filter(p => p.amount < 500).length;
          const medium = validTx.filter(p => p.amount >= 500 && p.amount <= 2000).length;
          const large = validTx.filter(p => p.amount > 2000).length;
          const total = validTx.length || 1;

          return (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] text-slate-400">&lt; 500 ETB</div>
                <div className="font-bold text-slate-800 text-sm mt-0.5">{micro}</div>
                <div className="text-[9px] text-slate-400">{Math.round((micro / total) * 100)}%</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] text-slate-400">500 - 2,000 ETB</div>
                <div className="font-bold text-slate-800 text-sm mt-0.5">{medium}</div>
                <div className="text-[9px] text-slate-400">{Math.round((medium / total) * 100)}%</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] text-slate-400">&gt; 2,000 ETB</div>
                <div className="font-bold text-slate-800 text-sm mt-0.5">{large}</div>
                <div className="text-[9px] text-slate-400">{Math.round((large / total) * 100)}%</div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
