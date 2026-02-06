export type SyncMode = 'off' | 'on-save' | 'on-startup' | 'scheduled';

export interface QmdSettings {
  qmdPath: string;

  syncMode: SyncMode;
  syncIntervalMinutes: number;

  defaultSearchMode: 'search' | 'vsearch' | 'query';
  defaultLimit: number;
  minScore: number;

  enableRelated: boolean;
  relatedLimit: number;
  relatedCacheTTL: number;
  relatedDebounceMs: number;

  llmProvider: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'none';
  
  openaiApiKey: string;
  openaiModel: string;
  openaiCustomModel: string;
  useOpenaiCustomModel: boolean;
  
  anthropicApiKey: string;
  anthropicModel: string;
  anthropicCustomModel: string;
  useAnthropicCustomModel: boolean;
  
  geminiApiKey: string;
  geminiModel: string;
  geminiCustomModel: string;
  useGeminiCustomModel: boolean;
  
  ollamaUrl: string;
  ollamaModel: string;

  ragContextLimit: number;
  ragSystemPrompt: string;
}

export const DEFAULT_SETTINGS: QmdSettings = {
  qmdPath: '',

  syncMode: 'on-startup',
  syncIntervalMinutes: 10,

  defaultSearchMode: 'query',
  defaultLimit: 10,
  minScore: 0.3,

  enableRelated: true,
  relatedLimit: 5,
  relatedCacheTTL: 5,
  relatedDebounceMs: 2000,

  llmProvider: 'none',
  
  openaiApiKey: '',
  openaiModel: 'gpt-5.2',
  openaiCustomModel: '',
  useOpenaiCustomModel: false,
  
  anthropicApiKey: '',
  anthropicModel: 'claude-opus-4-6-20260205',
  anthropicCustomModel: '',
  useAnthropicCustomModel: false,
  
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  geminiCustomModel: '',
  useGeminiCustomModel: false,
  
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2',

  ragContextLimit: 5,
  ragSystemPrompt: `You are a helpful assistant that answers questions based on the user's notes.
Use the provided documents as context. If the answer isn't in the context, say so.
Always cite your sources using [[document-name]] format.`,
};

export const OPENAI_MODELS = [
  { value: 'gpt-5.2', label: 'GPT-5.2 (Latest)' },
  { value: 'gpt-5.1', label: 'GPT-5.1' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
];

export const ANTHROPIC_MODELS = [
  { value: 'claude-opus-4-6-20260205', label: 'Claude Opus 4.6 (Latest)' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-haiku-4-5-20251015', label: 'Claude Haiku 4.5' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
];

export const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Latest GA)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
];
