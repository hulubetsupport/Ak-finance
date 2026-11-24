import React from 'react';
import { Home, BarChart2, Sparkles, Building2, ListOrdered } from 'lucide-react';
import { translations } from '../utils/i18n.ts';
import { Language } from '../types/index.ts';

export type TabId = 'home' | 'payments' | 'insights' | 'ai' | 'organize';

interface BottomNavProps {
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
  language: Language;
  attentionCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  language,
  attentionCount,
}) => {
  const t = translations[language];

  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'home', label: t.navHome, icon: <Home size={19} /> },
    {
      id: 'payments',
      label: t.navPayments,
      icon: <ListOrdered size={19} />,
      badge: attentionCount > 0 ? attentionCount : undefined,
    },
    { id: 'insights', label: t.navInsights, icon: <BarChart2 size={19} /> },
    { id: 'ai', label: t.navAi, icon: <Sparkles size={19} /> },
    { id: 'organize', label: t.navOrganize, icon: <Building2 size={19} /> },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1"
    >
      <div className="max-w-lg mx-auto h-full grid grid-cols-5 items-center">
        {tabs.map(tab => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors whitespace-nowrap ${
                isActive ? 'text-[#0F4C3A]' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] rounded-full bg-amber-600 text-white text-[9px] font-bold flex items-center justify-center px-1 tabular-nums">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10.5px] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
