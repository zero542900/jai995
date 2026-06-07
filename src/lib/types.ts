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
  currentDirection: string;
  currentDirectionCn: string;
  plotStage: string;
  plotStageCn: string;
  progressDesc: string;
  progressDescCn: string;
  selectedEnding: string[];
  selectedRelation: string[];
  selectedScene: string[];
  selectedStageKeyword: string[];
  savedPlotDirections: BilingualText[];
  suggestedKeywords: {
    ending: BilingualText[];
    relation: BilingualText[];
    scene: BilingualText[];
    stage: BilingualText[];
  };
  styleSettings?: StyleSettings;
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
