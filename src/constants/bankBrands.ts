/**
 * Bank Brand Identity Constants
 * Editable color schemes, accents, badges and subtle geometric patterns for Ethiopian Banks.
 */

export interface BankBrand {
  name: string;
  shortCode: string;
  fullName: string;
  primaryColor: string;
  accentColor: string;
  gradientClass: string;
  badgeClass: string;
  patternType: 'guilloche' | 'waves' | 'dots' | 'grid' | 'radiating';
}

export const BANK_BRANDS: Record<string, BankBrand> = {
  'CBE': {
    name: 'CBE',
    shortCode: 'CBE',
    fullName: 'Commercial Bank of Ethiopia',
    primaryColor: '#6B2C91',
    accentColor: '#D4A017',
    gradientClass: 'from-[#4A156B] via-[#6B2C91] to-[#8637B5]',
    badgeClass: 'bg-[#D4A017]/20 text-[#FFD700] border-[#D4A017]/40',
    patternType: 'guilloche',
  },
  'Commercial Bank of Ethiopia': {
    name: 'CBE',
    shortCode: 'CBE',
    fullName: 'Commercial Bank of Ethiopia',
    primaryColor: '#6B2C91',
    accentColor: '#D4A017',
    gradientClass: 'from-[#4A156B] via-[#6B2C91] to-[#8637B5]',
    badgeClass: 'bg-[#D4A017]/20 text-[#FFD700] border-[#D4A017]/40',
    patternType: 'guilloche',
  },
  'Telebirr': {
    name: 'Telebirr',
    shortCode: 'TLB',
    fullName: 'Ethio Telecom Telebirr (127)',
    primaryColor: '#0A6DC2',
    accentColor: '#5BC0DE',
    gradientClass: 'from-[#074D8A] via-[#0A6DC2] to-[#258EE8]',
    badgeClass: 'bg-sky-400/20 text-sky-200 border-sky-300/40',
    patternType: 'waves',
  },
  '127': {
    name: 'Telebirr',
    shortCode: 'TLB',
    fullName: 'Telebirr',
    primaryColor: '#0A6DC2',
    accentColor: '#5BC0DE',
    gradientClass: 'from-[#074D8A] via-[#0A6DC2] to-[#258EE8]',
    badgeClass: 'bg-sky-400/20 text-sky-200 border-sky-300/40',
    patternType: 'waves',
  },
  'Awash Bank': {
    name: 'Awash Bank',
    shortCode: 'AWA',
    fullName: 'Awash International Bank',
    primaryColor: '#F58220',
    accentColor: '#1B3A6B',
    gradientClass: 'from-[#C45E0B] via-[#F58220] to-[#FA9C4D]',
    badgeClass: 'bg-[#1B3A6B]/40 text-white border-white/30',
    patternType: 'grid',
  },
  'Dashen Bank': {
    name: 'Dashen Bank',
    shortCode: 'DSH',
    fullName: 'Dashen Bank',
    primaryColor: '#0B3A8A',
    accentColor: '#38BDF8',
    gradientClass: 'from-[#062459] via-[#0B3A8A] to-[#1E56B3]',
    badgeClass: 'bg-sky-400/20 text-sky-200 border-sky-300/40',
    patternType: 'dots',
  },
  'Bank of Abyssinia': {
    name: 'Bank of Abyssinia',
    shortCode: 'BOA',
    fullName: 'Bank of Abyssinia',
    primaryColor: '#E0A100',
    accentColor: '#1E293B',
    gradientClass: 'from-[#A17300] via-[#E0A100] to-[#F5BE2E]',
    badgeClass: 'bg-[#1E293B]/40 text-white border-white/30',
    patternType: 'radiating',
  },
  'Abay Bank': {
    name: 'Abay Bank',
    shortCode: 'ABY',
    fullName: 'Abay Bank',
    primaryColor: '#047857',
    accentColor: '#A7F3D0',
    gradientClass: 'from-[#064E3B] via-[#047857] to-[#10B981]',
    badgeClass: 'bg-emerald-950/40 text-emerald-100 border-emerald-300/40',
    patternType: 'waves',
  },
  'Wegagen Bank': {
    name: 'Wegagen Bank',
    shortCode: 'WGG',
    fullName: 'Wegagen Bank',
    primaryColor: '#C2410C',
    accentColor: '#FED7AA',
    gradientClass: 'from-[#7C2D12] via-[#C2410C] to-[#EA580C]',
    badgeClass: 'bg-orange-950/40 text-orange-100 border-orange-300/40',
    patternType: 'grid',
  },
  'Nib Bank': {
    name: 'Nib Bank',
    shortCode: 'NIB',
    fullName: 'Nib International Bank',
    primaryColor: '#A16207',
    accentColor: '#FEF08A',
    gradientClass: 'from-[#713F12] via-[#A16207] to-[#CA8A04]',
    badgeClass: 'bg-yellow-950/40 text-yellow-100 border-yellow-300/40',
    patternType: 'dots',
  },
  'Zemen Bank': {
    name: 'Zemen Bank',
    shortCode: 'ZEM',
    fullName: 'Zemen Bank',
    primaryColor: '#BE123C',
    accentColor: '#FECDD3',
    gradientClass: 'from-[#881337] via-[#BE123C] to-[#E11D48]',
    badgeClass: 'bg-rose-950/40 text-rose-100 border-rose-300/40',
    patternType: 'guilloche',
  },
};

export const DEFAULT_BRAND: BankBrand = {
  name: 'Ak Finance',
  shortCode: 'BNK',
  fullName: 'Bank Account',
  primaryColor: '#14503F',
  accentColor: '#34D399',
  gradientClass: 'from-[#0B3328] via-[#14503F] to-[#1C6E56]',
  badgeClass: 'bg-emerald-950/40 text-emerald-100 border-emerald-300/40',
  patternType: 'guilloche',
};

export function getBankBrand(bankName: string): BankBrand {
  if (!bankName) return DEFAULT_BRAND;
  const upper = bankName.trim().toUpperCase();

  for (const [key, brand] of Object.entries(BANK_BRANDS)) {
    if (upper === key.toUpperCase() || upper.includes(key.toUpperCase())) {
      return brand;
    }
  }
  return {
    ...DEFAULT_BRAND,
    name: bankName,
    shortCode: bankName.substring(0, 3).toUpperCase(),
    fullName: bankName,
  };
}
