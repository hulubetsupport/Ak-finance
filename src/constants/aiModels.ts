export type AiChatModelId =
  | 'gemini-4-hydrogen'
  | 'gemini-3.1-flash-lite'
  | 'gemini-4-neon'
  | 'gemini-4-argon'
  | 'gemini-4-carbon'
  | 'gemini-3.1-pro-preview'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-lite';

export interface AiModelOption {
  id: AiChatModelId;
  label: string;
  group: 'Gemini 4 Series' | 'Gemini 3.1 Series' | 'Gemini 2.5 Series';
  tier: 'standard' | 'paid';
  description: string;
}

export const AI_CHAT_AND_PARSER_MODELS: readonly AiModelOption[] = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen (Default · Fast)',
    group: 'Gemini 4 Series',
    tier: 'standard',
    description: 'Recommended default for fast ledger Q&A and Ethiopian SMS parsing.',
  },
  {
    id: 'gemini-4-neon',
    label: 'Gemini 4 Neon / Pro (Complex · Paid Key)',
    group: 'Gemini 4 Series',
    tier: 'paid',
    description: 'High-accuracy multi-bank reasoning and reconciliation.',
  },
  {
    id: 'gemini-4-argon',
    label: 'Gemini 4 Argon (Advanced · Paid Key)',
    group: 'Gemini 4 Series',
    tier: 'paid',
    description: 'Advanced Gemini 4 reasoning tier.',
  },
  {
    id: 'gemini-4-carbon',
    label: 'Gemini 4 Carbon (Deep Reasoning · Paid Key)',
    group: 'Gemini 4 Series',
    tier: 'paid',
    description: 'Deep audit & complex multi-step financial analysis.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite (Lightweight)',
    group: 'Gemini 3.1 Series',
    tier: 'standard',
    description: 'Low-latency lightweight SMS classification.',
  },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview',
    group: 'Gemini 3.1 Series',
    tier: 'standard',
    description: 'Preview multimodal & complex text reasoning model.',
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    group: 'Gemini 2.5 Series',
    tier: 'standard',
    description: 'Stable reasoning & structured JSON extraction.',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    group: 'Gemini 2.5 Series',
    tier: 'standard',
    description: 'Stable balanced speed & accuracy.',
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    group: 'Gemini 2.5 Series',
    tier: 'standard',
    description: 'Compact high-throughput Gemini 2.5 variant.',
  },
] as const;

export const ALLOWED_AI_MODEL_IDS: readonly AiChatModelId[] = AI_CHAT_AND_PARSER_MODELS.map(m => m.id);

export const PAID_GEMINI_MODEL_IDS = new Set<string>([
  'gemini-4-carbon',
  'gemini-4-neon',
  'gemini-4-argon',
  'gemini-3-pro-image',
  'gemini-nano-banana-2.1',
  'gemini-3.1-flash-lite-image',
  'gemini-omni-1.2-flash',
  'genie-4',
  'lyria-3-clip-preview',
  'lyria-3-pro-preview',
]);

export interface SpecializedGoogleModelInfo {
  id: string;
  label: string;
  modality: string;
  tier: 'standard' | 'paid';
}

export const GOOGLE_GEMINI_SPECIALIZED_MODELS: readonly SpecializedGoogleModelInfo[] = [
  { id: 'gemini-3.1-flash-lite-image', label: 'Gemini Flash Image (Nano Banana)', modality: 'Image', tier: 'paid' },
  { id: 'gemini-nano-banana-2.1', label: 'Nano Banana 2.1 (High-Res Image)', modality: 'Image', tier: 'paid' },
  { id: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image (Nano Banana Pro)', modality: 'Image', tier: 'paid' },
  { id: 'gemini-3.8-live', label: 'Gemini 3.8 Live (Real-Time Audio/Video)', modality: 'Live API', tier: 'standard' },
  { id: 'gemini-3.8-live-extended-thinking', label: 'Gemini 3.8 Live Extended Thinking', modality: 'Live API', tier: 'standard' },
  { id: 'gemini-3.5-transcribe', label: 'Gemini 3.5 Transcribe', modality: 'Audio STT', tier: 'standard' },
  { id: 'gemini-3.5-transcribe-live', label: 'Gemini 3.5 Transcribe Live', modality: 'Live STT', tier: 'standard' },
  { id: 'gemini-3.5-live-translate-preview', label: 'Gemini 3.5 Live Translate', modality: 'Speech Translate', tier: 'standard' },
  { id: 'gemini-3.8-flash-lite-tts', label: 'Gemini 3.8 Flash Lite TTS', modality: 'Text-to-Speech', tier: 'standard' },
  { id: 'gemini-3.8-flash-tts', label: 'Gemini 3.8 Flash TTS', modality: 'Expressive TTS', tier: 'standard' },
  { id: 'gemini-omni-1.2-flash', label: 'Gemini Omni 1.2 Flash (Veo Video)', modality: 'Video', tier: 'paid' },
  { id: 'genie-4', label: 'Genie 4 (Interactive World)', modality: 'World Sim', tier: 'paid' },
  { id: 'lyria-3-clip-preview', label: 'Lyria 3 Clip Preview', modality: 'Music', tier: 'paid' },
  { id: 'lyria-3-pro-preview', label: 'Lyria 3 Pro Preview', modality: 'Music', tier: 'paid' },
  { id: 'gemini-embedding-2', label: 'Gemini Embedding 2', modality: 'Embeddings', tier: 'standard' },
  { id: 'gemini-decision-1', label: 'Gemini Decision 1', modality: 'Decisions API', tier: 'standard' },
];

export function resolveAllowedAiModel(requested?: string): AiChatModelId {
  if (requested && (ALLOWED_AI_MODEL_IDS as readonly string[]).includes(requested)) {
    return requested as AiChatModelId;
  }
  return 'gemini-4-hydrogen';
}

export function getAiModelLabel(id?: string): string {
  const found = AI_CHAT_AND_PARSER_MODELS.find(m => m.id === id);
  return found ? found.label : id || 'Gemini 4 Hydrogen';
}
