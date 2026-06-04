// JAI Assistant - Type Definitions

export interface Preset {
  id: string;
  name: string;
  charInfo: string;
  userCard: string;
  userPersonality: string;
  plotDirection: string;
  longTermMemory: string;
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

export interface GenerateRequest {
  charInfo: string;
  userPersonality: string;
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
