/**
 * Bank Brand Identity Constants
 * Editable color schemes, accents, badges, logos and subtle geometric patterns for Ethiopian Banks.
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
  logoUrl?: string;
  defaultSenders?: string[];
}

export const BANK_BRANDS: Record<string, BankBrand> = {
  'CBE': {
    name: 'CBE',
    shortCode: 'CBE',
    fullName: 'Commercial Bank of Ethiopia',
    primaryColor: '#7A1C5A',
    accentColor: '#D4A017',
    gradientClass: 'from-[#4A156B] via-[#6B2C91] to-[#8637B5]',
    badgeClass: 'bg-[#D4A017]/20 text-[#FFD700] border-[#D4A017]/40',
    patternType: 'guilloche',
    logoUrl: '/assets/aistudio/images__1__1__5e8bafae.jpg',
    defaultSenders: ['CBE'],
  },
  'Commercial Bank of Ethiopia': {
    name: 'CBE',
    shortCode: 'CBE',
    fullName: 'Commercial Bank of Ethiopia',
    primaryColor: '#7A1C5A',
    accentColor: '#D4A017',
    gradientClass: 'from-[#4A156B] via-[#6B2C91] to-[#8637B5]',
    badgeClass: 'bg-[#D4A017]/20 text-[#FFD700] border-[#D4A017]/40',
    patternType: 'guilloche',
    logoUrl: '/assets/aistudio/images__1__1__5e8bafae.jpg',
    defaultSenders: ['CBE'],
  },
  'Telebirr': {
    name: 'Telebirr',
    shortCode: 'TLB',
    fullName: 'Ethio Telecom Telebirr',
    primaryColor: '#009EDB',
    accentColor: '#5BC0DE',
    gradientClass: 'from-[#074D8A] via-[#0A6DC2] to-[#258EE8]',
    badgeClass: 'bg-sky-400/20 text-sky-200 border-sky-300/40',
    patternType: 'waves',
    logoUrl: '/assets/aistudio/unnamed__2__485a8cc8.jpg',
    defaultSenders: ['127'],
  },
  '127': {
    name: 'Telebirr',
    shortCode: 'TLB',
    fullName: 'Telebirr (127)',
    primaryColor: '#009EDB',
    accentColor: '#5BC0DE',
    gradientClass: 'from-[#074D8A] via-[#0A6DC2] to-[#258EE8]',
    badgeClass: 'bg-sky-400/20 text-sky-200 border-sky-300/40',
    patternType: 'waves',
    logoUrl: '/assets/aistudio/unnamed__2__485a8cc8.jpg',
    defaultSenders: ['127'],
  },
  'Awash Bank': {
    name: 'Awash Bank',
    shortCode: 'AWH',
    fullName: 'Awash International Bank',
    primaryColor: '#E67300',
    accentColor: '#1B3A6B',
    gradientClass: 'from-[#C45E0B] via-[#F58220] to-[#FA9C4D]',
    badgeClass: 'bg-[#1B3A6B]/40 text-white border-white/30',
    patternType: 'grid',
    logoUrl: '/assets/aistudio/images__1__3__de75fa72.jpg',
    defaultSenders: ['AwashBank', 'Awash'],
  },
  'Dashen Bank': {
    name: 'Dashen Bank',
    shortCode: 'DSH',
    fullName: 'Dashen Bank',
    primaryColor: '#0B2055',
    accentColor: '#38BDF8',
    gradientClass: 'from-[#062459] via-[#0B3A8A] to-[#1E56B3]',
    badgeClass: 'bg-sky-400/20 text-sky-200 border-sky-300/40',
    patternType: 'dots',
    logoUrl: '/assets/aistudio/images__1__2__b5cc990f.jpg',
    defaultSenders: ['Dashen', 'DashenBank'],
  },
  'Bank of Abyssinia': {
    name: 'Bank of Abyssinia',
    shortCode: 'BOA',
    fullName: 'Bank of Abyssinia',
    primaryColor: '#E49600',
    accentColor: '#1E293B',
    gradientClass: 'from-[#A17300] via-[#E0A100] to-[#F5BE2E]',
    badgeClass: 'bg-[#1E293B]/40 text-white border-white/30',
    patternType: 'radiating',
    logoUrl: '/assets/aistudio/images__1__4__6fad4b0d.jpg',
    defaultSenders: ['BOA', 'Abyssinia'],
  },
  'Tsedey Bank': {
    name: 'Tsedey Bank',
    shortCode: 'TSD',
    fullName: 'Tsedey Bank (S.C)',
    primaryColor: '#009A93',
    accentColor: '#F59E0B',
    gradientClass: 'from-[#00605B] via-[#009A93] to-[#0D9488]',
    badgeClass: 'bg-amber-400/20 text-amber-200 border-amber-300/40',
    patternType: 'waves',
    logoUrl: '/assets/aistudio/images__1__5__5d32e7a8.jpg',
    defaultSenders: ['Tsedey', 'TSEDEY'],
  },
  'Abay Bank': {
    name: 'Abay Bank',
    shortCode: 'ABY',
    fullName: 'Abay Bank S.C.',
    primaryColor: '#047857',
    accentColor: '#A7F3D0',
    gradientClass: 'from-[#064E3B] via-[#047857] to-[#10B981]',
    badgeClass: 'bg-emerald-950/40 text-emerald-100 border-emerald-300/40',
    patternType: 'waves',
    defaultSenders: ['AbayBank', 'Abay'],
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
    defaultSenders: ['Wegagen', 'WegagenBank'],
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
    defaultSenders: ['NibBank', 'NIB'],
  },
  'Zemen Bank': {
    name: 'Zemen Bank',
    shortCode: 'ZMN',
    fullName: 'Zemen Bank',
    primaryColor: '#BE123C',
    accentColor: '#FECDD3',
    gradientClass: 'from-[#881337] via-[#BE123C] to-[#E11D48]',
    badgeClass: 'bg-rose-950/40 text-rose-100 border-rose-300/40',
    patternType: 'guilloche',
    defaultSenders: ['Zemen', 'ZemenBank'],
  },
  'Hibret Bank': {
    name: 'Hibret Bank',
    shortCode: 'HBR',
    fullName: 'Hibret Bank (United)',
    primaryColor: '#1D4ED8',
    accentColor: '#BFDBFE',
    gradientClass: 'from-[#1E3A8A] via-[#1D4ED8] to-[#3B82F6]',
    badgeClass: 'bg-blue-950/40 text-blue-100 border-blue-300/40',
    patternType: 'grid',
    defaultSenders: ['Hibret', 'HibretBank', 'UnitedBank'],
  },
  'Cooperative Bank of Oromia': {
    name: 'Coop Bank',
    shortCode: 'COP',
    fullName: 'Cooperative Bank of Oromia / Sinqee',
    primaryColor: '#0F766E',
    accentColor: '#99F6E4',
    gradientClass: 'from-[#134E4A] via-[#0F766E] to-[#14B8A6]',
    badgeClass: 'bg-teal-950/40 text-teal-100 border-teal-300/40',
    patternType: 'waves',
    defaultSenders: ['CoopBank', 'COOP', 'Sinqee'],
  },
  'M-Pesa': {
    name: 'M-Pesa',
    shortCode: 'MPS',
    fullName: 'Safaricom M-Pesa Ethiopia',
    primaryColor: '#DC2626',
    accentColor: '#FECACA',
    gradientClass: 'from-[#991B1B] via-[#DC2626] to-[#EF4444]',
    badgeClass: 'bg-red-950/40 text-red-100 border-red-300/40',
    patternType: 'dots',
    defaultSenders: ['M-PESA', 'MPESA'],
  },
  'CBE Birr': {
    name: 'CBE Birr',
    shortCode: 'CBR',
    fullName: 'Commercial Bank of Ethiopia - CBE Birr',
    primaryColor: '#7E22CE',
    accentColor: '#E9D5FF',
    gradientClass: 'from-[#581C87] via-[#7E22CE] to-[#A855F7]',
    badgeClass: 'bg-purple-950/40 text-purple-100 border-purple-300/40',
    patternType: 'guilloche',
    defaultSenders: ['CBEBirr', 'CBE_Birr'],
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

export const BANK_PRESETS = [
  { name: 'Commercial Bank of Ethiopia', shortCode: 'CBE', senders: 'CBE', color: '#7A1C5A', logoUrl: '/assets/aistudio/images__1__1__5e8bafae.jpg', accent: 'purple' },
  { name: 'Telebirr', shortCode: 'TLB', senders: '127', color: '#009EDB', logoUrl: '/assets/aistudio/unnamed__2__485a8cc8.jpg', accent: 'blue' },
  { name: 'Awash Bank', shortCode: 'AWH', senders: 'AwashBank, Awash', color: '#E67300', logoUrl: '/assets/aistudio/images__1__3__de75fa72.jpg', accent: 'amber' },
  { name: 'Dashen Bank', shortCode: 'DSH', senders: 'Dashen, DashenBank', color: '#0B2055', logoUrl: '/assets/aistudio/images__1__2__b5cc990f.jpg', accent: 'cyan' },
  { name: 'Bank of Abyssinia', shortCode: 'BOA', senders: 'BOA, Abyssinia', color: '#E49600', logoUrl: '/assets/aistudio/images__1__4__6fad4b0d.jpg', accent: 'gold' },
  { name: 'Tsedey Bank', shortCode: 'TSD', senders: 'Tsedey, TSEDEY', color: '#009A93', logoUrl: '/assets/aistudio/images__1__5__5d32e7a8.jpg', accent: 'emerald' },
  { name: 'Abay Bank', shortCode: 'ABY', senders: 'AbayBank, Abay', color: '#047857', logoUrl: '', accent: 'emerald' },
  { name: 'Wegagen Bank', shortCode: 'WGG', senders: 'Wegagen, WegagenBank', color: '#C2410C', logoUrl: '', accent: 'amber' },
  { name: 'Nib Bank', shortCode: 'NIB', senders: 'NibBank, NIB', color: '#A16207', logoUrl: '', accent: 'gold' },
  { name: 'Zemen Bank', shortCode: 'ZMN', senders: 'Zemen, ZemenBank', color: '#BE123C', logoUrl: '', accent: 'red' },
  { name: 'Hibret Bank', shortCode: 'HBR', senders: 'Hibret, HibretBank', color: '#1D4ED8', logoUrl: '', accent: 'blue' },
  { name: 'Cooperative Bank of Oromia', shortCode: 'COP', senders: 'CoopBank, COOP, Sinqee', color: '#0F766E', logoUrl: '', accent: 'indigo' },
  { name: 'M-Pesa', shortCode: 'MPS', senders: 'M-PESA, MPESA', color: '#DC2626', logoUrl: '', accent: 'red' },
  { name: 'CBE Birr', shortCode: 'CBR', senders: 'CBEBirr, CBE_Birr', color: '#7E22CE', logoUrl: '', accent: 'purple' },
];

export function getBankBrand(bankName: string): BankBrand {
  if (!bankName) return DEFAULT_BRAND;
  const upper = bankName.trim().toUpperCase();

  for (const [key, brand] of Object.entries(BANK_BRANDS)) {
    const kUpper = key.toUpperCase();
    if (upper === kUpper || upper.includes(kUpper) || kUpper.includes(upper)) {
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
