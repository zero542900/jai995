// JAI Assistant - LocalStorage Utilities

import { Preset, Session, ChatMessage, Instruction } from './types';

const KEYS = {
  PRESETS: 'jai_presets',
  SESSIONS: 'jai_sessions',
  API_KEY: 'jai_api_key',
  MODEL_PREFERENCE: 'jai_model_choice',
  USER_TEMPLATE: 'jai_user_template',
  INSTRUCTIONS: 'jai_instructions',
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

// ========== Model Preference ==========

export type ModelPreference = 'flash' | 'pro';

export function getModelPreference(): ModelPreference {
  if (typeof window === 'undefined') return 'flash';
  return (localStorage.getItem(KEYS.MODEL_PREFERENCE) as ModelPreference) || 'flash';
}

export function setModelPreference(pref: ModelPreference): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.MODEL_PREFERENCE, pref);
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



export function updatePreset(id: string, updates: Partial<Preset>): void {
  const preset = getPreset(id);
  if (preset) {
    savePreset({ ...preset, ...updates });
  }
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

// ========== Instructions ==========

export function getInstructions(): Instruction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEYS.INSTRUCTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getInstruction(id: string): Instruction | undefined {
  return getInstructions().find((i) => i.id === id);
}

export function createInstruction(name: string, content: string, summary: string): Instruction {
  const instruction: Instruction = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    content,
    summary,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const instructions = getInstructions();
  instructions.push(instruction);
  localStorage.setItem(KEYS.INSTRUCTIONS, JSON.stringify(instructions));
  return instruction;
}

export function updateInstruction(id: string, updates: Partial<Instruction>): void {
  const instructions = getInstructions();
  const idx = instructions.findIndex((i) => i.id === id);
  if (idx >= 0) {
    instructions[idx] = { ...instructions[idx], ...updates, updatedAt: Date.now() };
    localStorage.setItem(KEYS.INSTRUCTIONS, JSON.stringify(instructions));
  }
}

export function deleteInstruction(id: string): void {
  if (typeof window === 'undefined') return;
  const instructions = getInstructions().filter((i) => i.id !== id);
  localStorage.setItem(KEYS.INSTRUCTIONS, JSON.stringify(instructions));
}

// ========== Seed Default Instructions ==========

const SEED_INSTRUCTIONS: Array<{ name: string; summary: string; content: string }> = [
  {
    name: 'OOC 性别代称',
    summary: '约束 {{user}} 的性别与代词，防止 bot 用错代称',
    content: `[System Note: OOC - {{user}}'s gender is [insert gender]. {{user}}'s pronouns are [insert pronouns]. Use only [insert pronouns again] to refer to {{user}}. Do not break this rule.]\n\n{{user}} 的性别为[insert gender in Chinese]，代词使用"[insert Chinese pronoun]"。`,
  },
  {
    name: '弹幕',
    summary: '观众评论，10条读者反应，不影响剧情',
    content: `[System Note: Reader Barrage]
Generate a section titled "Reader Barrage". This content does not affect the storyline. The character and user cannot know about it. Write 10 reader comments. Each comment includes a reader identity (e.g., "CP Fan") and a reaction to the plot or relationship. Each comment ≤ 20 words. Examples: "They're so cute together" or "I'm crying over this". Vary the reader identities each time.`,
  },
  {
    name: '想但不敢',
    summary: '角色内心的小冲动，一句短描写',
    content: `[System Note: Want to Do but Dare Not]
Generate a short line (≤ 30 words) describing something a random character wants to do but dares not. Example: "Wants to confess, but the words get stuck in their throat."`,
  },
  {
    name: '小剧场',
    summary: '剧情日记 + 上帝弹幕 + AU 场景，一次性生成',
    content: `[System Note: Small Theaters - One-Time Only]
Generate the following three parts in a single output, separated by a line of dashes. Only generate this in the very next response:

Part 1 - Plot Diary: Write a diary entry from {{char}}'s perspective. Minimum 200 words. Reflect recent events and internal thoughts.

Part 2 - Omniscient Barrage: Write 8 short comments from omniscient bystanders. Each comment ≤ 20 words. They comment on the story like a live audience.

Part 3 - Alternate Universe (Short Theaters): Generate 1-2 AU scenes (150-200 words each). Completely open format. Base them on {{char}}'s original settings. Do not repeat the same AU.`,
  },
  {
    name: '读书笔记',
    summary: '角色读书心得，含书名和摘抄，一次性生成',
    content: `[System Note: Reading Notes - One-Time Only]
Generate a "Reading Notes" entry for {{char}} in the very next response. Include:

1. Book title: One book per entry. Do not repeat books. Choose based on {{char}}'s profession, interests, experiences, MBTI, or inner world. Books can be popular, niche, or professional.

2. Reading Notes: Minimum 300 words. Focus only on {{char}}'s thoughts. The notes can be unrelated to plot or user. Optional elements: events from {{char}}'s past, cases they handled, people they met, or recent reflections. Must include a favorite quote from the book.`,
  },
  {
    name: '朋友圈',
    summary: '社交媒体动态 + NPC 评论，一次性生成',
    content: `[System Note: Friends' Circle - One-Time Only]
Generate a "Friends' Circle" section in the very next response. Include a new social media post. Each post must have at least 3 NPC comments. The person posting can be {{char}}, {{char}}'s family/friends, or {{user}}'s family/friends. Format as plain text, separated by lines.`,
  },
  {
    name: '日程表',
    summary: '角色一周生活安排，每周更新',
    content: `[System Note: Weekly Schedule - Permanent Section]
Generate {{char}}'s weekly schedule (Monday to Sunday). Each day includes work hours and personal life content. Update weekly. Include this section in every response. Format as a simple text list.`,
  },
  {
    name: '放歌',
    summary: '当前场景的歌曲信息 + 歌词片段',
    content: `[System Note: Now Playing]
Generate a "Now Playing" section for the current scene. Include:
- Song title
- Artist
- A few lines of lyrics
Do not include an audio player or waveform image. Just present the text.`,
  },
  {
    name: '推时间',
    summary: '场景推移规则，控制对话轮数与时间推进',
    content: `[System-Level Narrative Rule: Highest Priority]
You are not only the portrayer of {{char}} but also the director of this story. You must strictly adhere to the following rules:

1. Rule of Scene Fluidity
   · Dialogue in any scene must not exceed 15 rounds. Once the threshold is reached, you must actively create a reasonable event to change the scene or advance time.
   · Unless it is a highly tense conflict scene (e.g., arguments, confrontations), staying in the same location for too long is prohibited.
2. Mandatory Time Progression
   · After every 20 rounds of dialogue, time must clearly advance (from afternoon to evening, from today to the next day, from this week to next week).
   · The following methods can be used to advance time:
     · Natural transition: "As the sun sank westward, {{char}} suddenly realized..."
     · Jump-cut narrative: "Three days later, just as {{user}} had almost forgotten about it..."
     · Event anchoring: "The weekend invitation came earlier than expected..."
3. Trigger Mechanism for Scene Changes
      When any of the following situations occur, you must immediately change the scene:
   · The current topic has naturally concluded.
   · The atmosphere begins to feel repetitive or dull.
   · An external event can intervene (weather changes, someone barging in, sudden news).
4. Prohibited Actions
   · Filling the narrative with pure inner monologue is prohibited.
   · Pure dialogue exceeding 10 rounds in the same scene is prohibited (must be interspersed with action/environmental descriptions).`,
  },
  {
    name: '推随机剧情',
    summary: '随机事件触发，在合适时机插入意外事件',
    content: `[System Note: Random Event Trigger]
Insert a random event at the right time in the next few responses.
1. Events should occur in logical situations.
2. Events should not deviate from the main plot.
3. Events can be positive or negative.`,
  },
];

const SEED_VERSION_KEY = 'jai_instructions_seed_v';

export function seedInstructions(): void {
  if (typeof window === 'undefined') return;
  const currentSeedVersion = '3';
  const storedVersion = localStorage.getItem(SEED_VERSION_KEY);
  // Only seed once; if already seeded with this version, skip
  if (storedVersion === currentSeedVersion) return;

  const existing = getInstructions();

  // If user already has instructions from a previous version, update changed ones by name
  if (existing.length > 0 && storedVersion !== null) {
    const updated = existing.map((inst) => {
      const seed = SEED_INSTRUCTIONS.find((s) => s.name === inst.name);
      // Update instructions that changed in newer versions
      if (seed && ['小剧场', '读书笔记', '朋友圈'].includes(inst.name)) {
        return { ...inst, content: seed.content, summary: seed.summary, updatedAt: Date.now() };
      }
      // v2→v3: Rename 'OOC 设定' to 'OOC 性别代称' and update content
      if (inst.name === 'OOC 设定') {
        const oocSeed = SEED_INSTRUCTIONS.find((s) => s.name === 'OOC 性别代称');
        if (oocSeed) {
          return { ...inst, name: oocSeed.name, content: oocSeed.content, summary: oocSeed.summary, updatedAt: Date.now() };
        }
      }
      return inst;
    });
    localStorage.setItem(KEYS.INSTRUCTIONS, JSON.stringify(updated));
    localStorage.setItem(SEED_VERSION_KEY, currentSeedVersion);
    return;
  }

  // Fresh seed — no existing instructions
  const now = Date.now();
  const seeded: Instruction[] = SEED_INSTRUCTIONS.map((item, idx) => ({
    id: (now + idx).toString(36) + Math.random().toString(36).slice(2, 7),
    name: item.name,
    content: item.content,
    summary: item.summary,
    createdAt: now + idx,
    updatedAt: now + idx,
  }));
  localStorage.setItem(KEYS.INSTRUCTIONS, JSON.stringify(seeded));
  localStorage.setItem(SEED_VERSION_KEY, currentSeedVersion);
}



export function updateSession(id: string, updates: Partial<Session>): void {
  const session = getSession(id);
  if (session) {
    saveSession({ ...session, ...updates });
  }
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
  greeting: string,
  translations?: Record<string, string>,
): Preset {
  return {
    id: generateId(),
    name,
    charInfo,
    userCard,
    userPersonality,
    greeting,
    plotDirection: '',
    longTermMemory: '',
    personMode: 'third',
    thinkingEnabled: false,
    translations: translations || {},
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
