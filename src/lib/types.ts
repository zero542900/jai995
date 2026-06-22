// JAI Assistant - Type Definitions

export interface BilingualText {
  en: string;
  cn: string;
}

export interface StyleSettings {
  personMode: string;
}

export interface PlotData {
  currentMainLine: string;
  currentMainLineCn: string;
  progressDesc?: string;
  progressDescCn?: string;
  lastMemoryCount?: number;
}

export interface PresetTranslations {
  charInfo?: string;
  userCard?: string;
  userPersonality?: string;
  plotDirection?: string;
  longTermMemory?: string;
  greeting?: string;
}

export interface Preset {
  id: string;
  name: string;
  charInfo: string;
  userCard: string;
  userPersonality: string;
  greeting: string;
  plotDirection: string;
  longTermMemory: string;
  personMode: 'first' | 'third';
  thinkingEnabled: boolean;
  plotData?: PlotData;
  translations?: PresetTranslations;
  createdAt: number;
  updatedAt: number;
}

export interface Session {
  id: string;
  presetId: string;
  name: string;
  messages: ChatMessage[];
  longTermMemory: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  chineseTranslation?: string;
  timestamp: number;
}

export interface Instruction {
  id: string;
  name: string;
  content: string;
  summary: string;
  createdAt: number;
  updatedAt: number;
}

export interface GenerateHistory {
  id: string;
  englishCard: string;
  chineseCard: string;
  charInfo: string;
  userPersonality: string;
  greeting: string;
  createdAt: number;
}

export interface ExpandHistory {
  id: string;
  brief: string;
  englishText: string;
  chineseText: string;
  createdAt: number;
}

export type FlowLevel = 'light' | 'medium' | 'heavy';

export interface PeriodRecord {
  id: string;
  startDate: string;   // ISO date string YYYY-MM-DD
  endDate: string;      // ISO date string YYYY-MM-DD
  flow: FlowLevel;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface GenerateRequest {
  charInfo: string;
  userPersonality: string;
  greeting: string;
  apiKey: string;
}

export interface ChatRequest {
  messages: { role: string; content: string }[];
  apiKey: string;
  thinkingEnabled: boolean;
  systemPrompt?: string;
}

export interface InspirationRequest {
  charInfo: string;
  userCard: string;
  userPersonality: string;
  plotDirection: string;
  chatHistory: string;
  longTermMemory: string;
  apiKey: string;
}

export interface ExpandRequest {
  brief: string;
  charInfo: string;
  userCard: string;
  userPersonality: string;
  plotDirection: string;
  chatHistory: string;
  longTermMemory: string;
  apiKey: string;
}

export interface MemoryRequest {
  charInfo: string;
  userCard: string;
  chatHistory: string;
  longTermMemory: string;
  apiKey: string;
}
