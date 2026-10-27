import React from 'react';

interface BankCardPatternProps {
  type: 'guilloche' | 'waves' | 'dots' | 'grid' | 'radiating';
  accentColor: string;
}

export const BankCardPattern: React.FC<BankCardPatternProps> = ({ type, accentColor }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 transition-opacity">
      {type === 'guilloche' && (
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <defs>
            <pattern id="guilloche-pat" width="60" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M0 20 Q 15 5, 30 20 T 60 20 M0 10 Q 15 25, 30 10 T 60 10 M0 30 Q 15 15, 30 30 T 60 30"
                fill="none"
                stroke={accentColor}
                strokeWidth="0.8"
                strokeOpacity="0.4"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#guilloche-pat)" />
        </svg>
      )}

      {type === 'waves' && (
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <defs>
            <pattern id="waves-pat" width="80" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 0 35 C 20 20, 40 45, 60 25 C 70 15, 80 30, 80 30"
                fill="none"
                stroke={accentColor}
                strokeWidth="1"
                strokeOpacity="0.35"
              />
              <path
                d="M 0 15 C 20 30, 40 10, 60 30 C 70 40, 80 15, 80 15"
                fill="none"
                stroke={accentColor}
                strokeWidth="0.6"
                strokeOpacity="0.25"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#waves-pat)" />
        </svg>
      )}

      {type === 'dots' && (
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots-pat" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="3" cy="3" r="1.2" fill={accentColor} fillOpacity="0.3" />
              <circle cx="11" cy="11" r="0.8" fill={accentColor} fillOpacity="0.2" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots-pat)" />
        </svg>
      )}

      {type === 'grid' && (
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid-pat" width="24" height="24" patternUnits="userSpaceOnUse">
              <path
                d="M 24 0 L 0 0 0 24"
                fill="none"
                stroke={accentColor}
                strokeWidth="0.6"
                strokeOpacity="0.25"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pat)" />
        </svg>
      )}

      {type === 'radiating' && (
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <circle cx="100%" cy="0" r="120" fill="none" stroke={accentColor} strokeWidth="0.8" strokeOpacity="0.3" />
          <circle cx="100%" cy="0" r="90" fill="none" stroke={accentColor} strokeWidth="0.8" strokeOpacity="0.3" />
          <circle cx="100%" cy="0" r="60" fill="none" stroke={accentColor} strokeWidth="0.8" strokeOpacity="0.3" />
          <circle cx="100%" cy="0" r="30" fill="none" stroke={accentColor} strokeWidth="0.8" strokeOpacity="0.3" />
        </svg>
      )}
    </div>
  );
};

export const EmvChip: React.FC<{ className?: string }> = ({ className = 'w-7 h-5' }) => (
  <div className={`relative rounded-md bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-[1px] shadow-sm border border-amber-300/60 overflow-hidden ${className}`}>
    <div className="w-full h-full rounded-[3px] bg-gradient-to-br from-amber-300 to-amber-500 relative flex items-center justify-center">
      <div className="absolute inset-x-1 top-1/2 h-[1px] bg-amber-700/40 -translate-y-1/2" />
      <div className="absolute inset-y-0.5 left-1/3 w-[1px] bg-amber-700/40" />
      <div className="absolute inset-y-0.5 right-1/3 w-[1px] bg-amber-700/40" />
      <div className="w-2.5 h-2 rounded-[2px] border border-amber-700/50 bg-amber-400/80" />
    </div>
  </div>
);

export const ContactlessSymbol: React.FC<{ className?: string }> = ({ className = 'w-4 h-4 text-white/50' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M8.5 16.5a6 6 0 0 1 0-9" />
    <path d="M12 19a10 10 0 0 0 0-14" />
    <path d="M15.5 21.5a14 14 0 0 0 0-19" />
  </svg>
);

export const HoloSheen: React.FC = () => (
  <div 
    className="absolute inset-0 pointer-events-none opacity-25 mix-blend-overlay bg-gradient-to-tr from-transparent via-white/40 to-transparent transform -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out" 
  />
);
