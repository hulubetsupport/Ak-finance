import React from 'react';
import { Home, BarChart2, Sparkles, Layers, CreditCard } from 'lucide-react';
import { translations } from '../utils/i18n.ts';
import { Language } from '../types/index.ts';

export type TabId = 'home' | 'insights' | 'ai' | 'organize' | 'payments';

interface BottomNavProps {
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
  language: Language;
  pendingCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  language,
  pendingCount,
}) => {
  const t = translations[language];

  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'home', label: t.navHome, icon: <Home size={20} /> },
    { id: 'insights', label: t.navInsights, icon: <BarChart2 size={20} /> },
    { id: 'ai', label: t.navAi, icon: <Sparkles size={20} /> },
    { id: 'organize', label: t.navOrganize, icon: <Layers size={20} /> },
    { id: 'payments', label: t.navPayments, icon: <CreditCard size={20} />, badge: pendingCount > 0 ? pendingCount : undefined },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 py-1.5 shadow-lg">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map(tab => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex-1 py-1.5 px-1 flex flex-col items-center justify-center relative transition-all duration-150 active:scale-95 ${
                isActive ? 'text-[#14503F]' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge && (
                  <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-semibold mt-1 font-['Poppins',sans-serif] ${
                isActive ? 'text-[#14503F] font-bold' : 'text-slate-400'
              }`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#14503F] mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
