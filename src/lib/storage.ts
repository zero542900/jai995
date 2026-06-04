// JAI Assistant - LocalStorage Utilities

import { Preset, Session, ChatMessage } from './types';

const KEYS = {
  PRESETS: 'jai_presets',
  SESSIONS: 'jai_sessions',
  API_KEY: 'jai_api_key',
  USER_TEMPLATE: 'jai_user_template',
} as const;

// ========== API Key ==========

export function getApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(KEYS.API_KEY) || '';
}

export function setApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.API_KEY, key);
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

// ========== User Template ==========

export function getUserTemplate(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(KEYS.USER_TEMPLATE) || '';
}

export function setUserTemplate(template: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.USER_TEMPLATE, template);
}

// ========== Presets ==========

export function getPresets(): Preset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEYS.PRESETS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getPreset(id: string): Preset | undefined {
  return getPresets().find((p) => p.id === id);
}

export function savePreset(preset: Preset): void {
  if (typeof window === 'undefined') return;
  const presets = getPresets();
  const idx = presets.findIndex((p) => p.id === preset.id);
  if (idx >= 0) {
    presets[idx] = { ...preset, updatedAt: Date.now() };
  } else {
    presets.push(preset);
  }
  localStorage.setItem(KEYS.PRESETS, JSON.stringify(presets));
}

export function deletePreset(id: string): void {
  if (typeof window === 'undefined') return;
  const presets = getPresets().filter((p) => p.id !== id);
  localStorage.setItem(KEYS.PRESETS, JSON.stringify(presets));
  // Also delete related sessions
  const sessions = getSessions().filter((s) => s.presetId !== id);
  localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
}

// ========== Sessions ==========

export function getSessions(): Session[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEYS.SESSIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getSessionsByPreset(presetId: string): Session[] {
  return getSessions().filter((s) => s.presetId === presetId);
}

export function getSession(id: string): Session | undefined {
  return getSessions().find((s) => s.id === id);
}

export function saveSession(session: Session): void {
  if (typeof window === 'undefined') return;
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = { ...session, updatedAt: Date.now() };
  } else {
    sessions.push(session);
  }
  localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
}

export function deleteSession(id: string): void {
  if (typeof window === 'undefined') return;
  const sessions = getSessions().filter((s) => s.id !== id);
  localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
}

// ========== Helpers ==========

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createPreset(
  name: string,
  charInfo: string,
  userCard: string,
  userPersonality: string,
): Preset {
  return {
    id: generateId(),
    name,
    charInfo,
    userCard,
    userPersonality,
    plotDirection: '',
    longTermMemory: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function createSession(presetId: string, name: string): Session {
  return {
    id: generateId(),
    presetId,
    name,
    messages: [],
    longTermMemory: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function createMessage(
  role: 'user' | 'assistant' | 'system',
  content: string,
  thinking?: string,
): ChatMessage {
  return {
    id: generateId(),
    role,
    content,
    thinking,
    timestamp: Date.now(),
  };
}
