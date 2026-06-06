'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconBack, IconSparkle, IconPen, IconBrain, IconCopy, IconFlip, IconRefresh, IconLock, IconSend, IconStop, IconTrash, IconEdit, IconKey, IconBook, IconCheck, IconPlot, IconChevronUp, IconChevronDown } from '@/components/icons';
import { copyToClipboard } from '@/lib/utils';

// ========== Types ==========
interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  chineseTranslation?: string;
  translated: boolean;
  translating: boolean;
  flipped: boolean;
  editing: boolean;
  timestamp: number;
}

interface Preset {
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
  createdAt: number;
}

interface Instruction {
  id: string;
  name: string;
  content: string;
  summary: string;
}

// ========== Instruction Utilities ==========
/** Remove all 【...】 blocks from text — used for memory/inspiration/expand APIs */
function stripInstructions(text: string): string {
  return text.replace(/【[\s\S]*?】/g, '').trim();
}

/** Parse content into main text and instruction blocks */
function parseContentSections(text: string): { main: string; instructions: string[] } {
  const instructions: string[] = [];
  const regex = /【([\s\S]*?)】/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    instructions.push(match[1].trim());
  }
  const main = text.replace(/【[\s\S]*?】/g, '').trim();
  return { main, instructions };
}

// ========== Storage helpers ==========
function getPresets(): Preset[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('jai_presets') || '[]'); } catch { return []; }
}

function getSessions(): Record<string, { messages: ChatMessage[]; memory: string }> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem('jai_chat_sessions') || '{}'); } catch { return {}; }
}

function saveSession(presetId: string, messages: ChatMessage[], memory: string) {
  if (typeof window === 'undefined') return;
  const sessions = getSessions();
  sessions[presetId] = { messages, memory };
  localStorage.setItem('jai_chat_sessions', JSON.stringify(sessions));
}

function updatePreset(preset: Preset) {
  if (typeof window === 'undefined') return;
  const presets = getPresets();
  const idx = presets.findIndex(p => p.id === preset.id);
  if (idx >= 0) { presets[idx] = preset; localStorage.setItem('jai_presets', JSON.stringify(presets)); }
}

function getInstructionList(): Instruction[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('jai_instructions') || '[]'); } catch { return []; }
}

// ========== Translation Instruction ==========
const TRANSLATION_INSTRUCTION = `你是一位精通中英双语、深谙同人圈文化的资深译者，尤其擅长 AO3 网站上的同人文。你的翻译不仅是语言转换，更是文化与情感的传递。

核心原则：
- 精准还原文风：根据英文原文语气灵活切换，保留口语化表达（如"I am weak"译为"我已溃不成军"），不做过度书面化或煽情处理。
- 术语统一：对"AU"、"Canon Divergence"等圈内共识术语，使用通用译法，首次出现时保留英文原词。
- 禁止 AI 翻译腔：避免"极其"、"缓慢地"、"不是…而是…"等生硬句式。译文读起来像有文风的真人作者所写。

禁止使用以下句式：
- "不是……而是……"
- "在……的过程中"
- "总而言之""综上所述"
- "不仅……更……"
- "不是……是……是……"
- "不是……不是……是……"
- "是……的基石/关键/必修课"
禁止使用排比句、对偶句、反复等修辞性排叠结构。
禁止使用"不x，不y，不z，就"格式。
禁止使用"这就够了"、"很…，但很…"等总结性短判断。
禁止使用任何以"不是"开头的否定句式。
每个观点后面必须跟一个画面、声音、气味或触感描写。
禁用词汇："兜住"、"接住"、"稳"、"守"、"极其"。

如果出现了"不是...而是..."、"在...的过程中"、"总而言之"这三种句式，请立刻删除该句，并用描写具体画面或动作的句子替换。`;

// ========== Component ==========
export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetIdParam = searchParams.get('preset');

  const [presets, setPresets] = useState<Preset[]>([]);
  const [currentPresetId, setCurrentPresetId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [jaiInput, setJaiInput] = useState('');
  const [personMode, setPersonMode] = useState<'first' | 'third'>('third');
  const [thinkingEnabled, setThinkingEnabled] = useState(false);

  // Style selector states
  const [styleTone, setStyleTone] = useState<string>(''); // 剧集调性
  const [styleGenre, setStyleGenre] = useState<string>(''); // 经典类型
  const [styleEmotion, setStyleEmotion] = useState<string>(''); // 情感浓度
  const [stylePace, setStylePace] = useState<string>(''); // 叙事节奏
  const [styleOptional, setStyleOptional] = useState<string[]>([]); // 可选风格(多选)
  const [showOptionalMenu, setShowOptionalMenu] = useState(false);

  // Feature states
  const [inspirationLoading, setInspirationLoading] = useState(false);
  const [inspirationItems, setInspirationItems] = useState<Array<{ en: string; cn?: string; flipped: boolean; translating?: boolean }>>([]);
  const [showInspiration, setShowInspiration] = useState(false);

  const [expandLoading, setExpandLoading] = useState(false);
  const [showExpandModal, setShowExpandModal] = useState(false);
  const [expandBrief, setExpandBrief] = useState('');
  const [expandResult, setExpandResult] = useState<{ en: string; cn: string } | null>(null);
  const [expandFlipped, setExpandFlipped] = useState(false);

  const [memoryLoading, setMemoryLoading] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [memoryResult, setMemoryResult] = useState<{ en: string; cn: string } | null>(null);
  const [memoryFlipped, setMemoryFlipped] = useState(false);

  // Plot Assistant states
  const [showPlotPanel, setShowPlotPanel] = useState(false);
  const [plotSummaryLoading, setPlotSummaryLoading] = useState(false);
  const [plotSummary, setPlotSummary] = useState<{ en: string; cn: string; flipped: boolean; translating: boolean } | null>(null);
  const [plotPredictions, setPlotPredictions] = useState<string[]>([]);
  const [plotTwist, setPlotTwist] = useState<string | null>(null);
  const [plotPredictLoading, setPlotPredictLoading] = useState(false);
  const [plotDirectionKeyword, setPlotDirectionKeyword] = useState('');
  const [plotAdvanceLoading, setPlotAdvanceLoading] = useState(false);
  const [plotAdvanceResult, setPlotAdvanceResult] = useState<{ en: string; cn: string; flipped: boolean } | null>(null);
  const [selectedPredictionIdx, setSelectedPredictionIdx] = useState<number | null>(null);
  const [predictionTranslations, setPredictionTranslations] = useState<Record<number, { cn: string; flipped: boolean; translating: boolean }>>({});

  const [notification, setNotification] = useState('');
  const [showInstructionPicker, setShowInstructionPicker] = useState(false);
  const [instructionList, setInstructionList] = useState<Instruction[]>([]);
  const instructionPickerRef = useRef<HTMLDivElement>(null);

  // Close instruction picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (instructionPickerRef.current && !instructionPickerRef.current.contains(e.target as Node)) {
        setShowInstructionPicker(false);
      }
    };
    if (showInstructionPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showInstructionPicker]);

  // Close optional menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (optionalMenuRef.current && !optionalMenuRef.current.contains(e.target as Node)) {
        setShowOptionalMenu(false);
      }
    };
    if (showOptionalMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOptionalMenu]);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const optionalMenuRef = useRef<HTMLDivElement>(null);

  // ========== Load data ==========
  useEffect(() => {
    const p = getPresets();
    setPresets(p);
    if (presetIdParam && p.find(pr => pr.id === presetIdParam)) {
      setCurrentPresetId(presetIdParam);
    } else if (p.length > 0) {
      setCurrentPresetId(p[0].id);
    }
  }, [presetIdParam]);

  useEffect(() => {
    if (!currentPresetId) return;
    const sessions = getSessions();
    const preset = presets.find(p => p.id === currentPresetId);
    
    // Build greeting message
    let greetingMsg: ChatMessage | null = null;
    if (preset) {
      const greeting = (preset.greeting || '')
        .replace(/\{\{char\}\}/gi, preset.charInfo?.split('\n')[0]?.replace(/[^a-zA-Z\s]/g, '').trim() || 'Char')
        .replace(/\{\{user\}\}/gi, preset.userCard?.split('\n')[0]?.replace(/[^a-zA-Z\s]/g, '').trim() || 'User');
      if (greeting.trim()) {
        greetingMsg = {
          id: 'greeting-' + currentPresetId,
          role: 'bot',
          content: greeting,
          translated: false,
          translating: false,
          flipped: false,
          editing: false,
          timestamp: 0
        };
      }
    }
    
    if (sessions[currentPresetId] && sessions[currentPresetId].messages.length > 0) {
      const saved = sessions[currentPresetId].messages;
      // Always ensure greeting is the first message
      if (greetingMsg && saved[0]?.id !== greetingMsg.id) {
        setMessages([greetingMsg, ...saved]);
      } else {
        setMessages(saved);
      }
    } else if (greetingMsg) {
      setMessages([greetingMsg]);
    } else {
      setMessages([]);
    }
  }, [currentPresetId, presets]);

  // Load personMode and thinkingEnabled from preset
  useEffect(() => {
    if (!currentPresetId) return;
    const preset = presets.find(p => p.id === currentPresetId);
    if (preset) {
      setPersonMode(preset.personMode || 'third');
      setThinkingEnabled(preset.thinkingEnabled || false);
    }
  }, [currentPresetId, presets]);

  // Auto-save
  useEffect(() => {
    if (!currentPresetId || messages.length === 0) return;
    const preset = presets.find(p => p.id === currentPresetId);
    saveSession(currentPresetId, messages, preset?.longTermMemory || '');
  }, [messages, currentPresetId, presets]);

  // Save personMode/thinkingEnabled back to preset
  useEffect(() => {
    if (!currentPresetId || presets.length === 0) return;
    const preset = presets.find(p => p.id === currentPresetId);
    if (!preset) return;
    if (preset.personMode !== personMode || preset.thinkingEnabled !== thinkingEnabled) {
      const updated = { ...preset, personMode, thinkingEnabled };
      const allPresets = presets.map(p => p.id === currentPresetId ? updated : p);
      localStorage.setItem('jai_presets', JSON.stringify(allPresets));
      setPresets(allPresets);
    }
  }, [personMode, thinkingEnabled]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ========== Helpers ==========
  const currentPreset = presets.find(p => p.id === currentPresetId);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2000);
  };

  const buildChatHistory = useCallback(() => {
    // Chat history keeps instructions — bot needs to see them
    return messages.map(m => `${m.role === 'user' ? 'User' : 'Char'}: ${m.content}`).join('\n');
  }, [messages]);

  const buildChatHistoryForMemory = useCallback(() => {
    // Memory/inspiration/expand strip instructions — they shouldn't affect these
    return messages.map(m => `${m.role === 'user' ? 'User' : 'Char'}: ${stripInstructions(m.content)}`).join('\n');
  }, [messages]);

  // Build style prompt string for API injection
  const STYLE_OPTIONS: Record<string, Record<string, string>> = {
    tone: {
      '欧美剧集': '多线叙事，分幕节奏。对话克制但有重量。每轮对话推动一个情绪节点。适合长线发展。',
      '电影质感': '镜头感强，场景切换明显。对话密度低，动作和环境描述占比更高。画面感和张力优先。适合高潮段落或单幕收束。',
    },
    genre: {
      '黑色电影': '冷调、阴影、雨夜。对话简练、暗示多。权力博弈以低语和眼神完成。适合背叛、潜伏、调查线。',
      '西部片': '空旷、沉默、对峙。话少，靠动作和眼神推进。荣誉、复仇、清算作为核心驱动。适合孤立场景、最后通牒、决斗。',
      '赛博朋克': '光与霓虹，潮湿街巷。对话带有信息密度，夹杂术语。科技与肉体的界限模糊。适合改造、入侵、身份错位。',
      '战争军事': '纪律性对话，战术动作为主。感情交流被压缩成暗示和短句。服从、忠诚、牺牲、崩坏。适合小队、任务、撤退、溃败线。',
    },
    emotion: {
      '强强对抗': '对话如击剑，每句都是试探。试探、压制、反杀交替出现。谁先软谁输。适合权力换手、底线博弈。',
      '暧昧推拉': '每句话都带未完成的重量。既定的距离感。肢体和视线描写替代码头。适合持续拉扯、立场渐染。',
      '极度压抑': '静默段落占主导。情绪通过动作泄露。对话断句多、间隙长。适合创伤、废墟、对峙。',
      '极度暴力': '行动优先于语言。对话纯粹功能性，全为推进动作。身体语言给出全部信息。适合围猎、清算、反杀。',
    },
    pace: {
      '慢燃': '前几轮只有铺垫和氛围。细节堆叠。情绪在沉默中积累。适合建立关系、倒叙展开。',
      '快切': '每轮对话切换场景或时间点。推进迅速，冲突提早暴露。适合闪回/多线穿插。',
      '单幕压缩': '所有事件在一轮完整场景内发生。最紧凑的结构。适合短线收束、一次爆发。',
    },
    optional: {
      '加一点浪漫': '对话软一点。手与眼。对看变成事件。',
      '加一点背叛': '所有对话都可以是伏笔。沉默不可信。谁先回头谁输。',
      '加一点救赎': '对方是伤口也是方向。一步远或者一步晚。动作比语言更接近答案。',
      '加一点牺牲': '台词不全。心里话只有一半。另一部分用动作替掉。',
    },
  };

  const buildStylePrompt = useCallback(() => {
    const parts: string[] = [];
    if (styleTone) parts.push(`[剧集调性: ${styleTone}] ${STYLE_OPTIONS.tone[styleTone]}`);
    if (styleGenre) parts.push(`[经典类型: ${styleGenre}] ${STYLE_OPTIONS.genre[styleGenre]}`);
    if (styleEmotion) parts.push(`[情感浓度: ${styleEmotion}] ${STYLE_OPTIONS.emotion[styleEmotion]}`);
    if (stylePace) parts.push(`[叙事节奏: ${stylePace}] ${STYLE_OPTIONS.pace[stylePace]}`);
    styleOptional.forEach(s => {
      if (STYLE_OPTIONS.optional[s]) parts.push(`[可选风格: ${s}] ${STYLE_OPTIONS.optional[s]}`);
    });
    return parts.length > 0
      ? `\n\n[风格指令 - 请严格遵循以下风格进行创作]\n${parts.join('\n')}`
      : '';
  }, [styleTone, styleGenre, styleEmotion, stylePace, styleOptional]);

  // ========== Message Actions ==========
  const sendUserMessage = () => {
    if (!userInput.trim()) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userInput.trim(),
      translated: false, translating: false, flipped: false, editing: false,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, msg]);
    setUserInput('');
  };

  const sendBotMessage = () => {
    if (!jaiInput.trim()) return;
    const content = jaiInput.trim();
    setMessages(prev => {
      // If last message is Bot and no User after it, replace it
      if (prev.length > 0 && prev[prev.length - 1].role === 'bot') {
        return prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, content, translated: false, translating: false, flipped: false, chineseTranslation: undefined }
            : m
        );
      }
      // Otherwise add new
      return [...prev, {
        id: crypto.randomUUID(),
        role: 'bot' as const,
        content,
        translated: false, translating: false, flipped: false, editing: false,
        timestamp: Date.now()
      }];
    });
    setJaiInput('');
  };

  const deleteMessageAndAfter = (id: string) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === id);
      return idx >= 0 ? prev.slice(0, idx) : prev;
    });
  };

  const startEditMessage = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, editing: true } : m));
  };

  const saveEditMessage = (id: string, newContent: string) => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, content: newContent, editing: false, translated: false, chineseTranslation: undefined, flipped: false } : m
    ));
  };

  const cancelEditMessage = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, editing: false } : m));
  };

  const flipMessage = async (id: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    if (!msg.translated && !msg.translating) {
      // Translate first
      setMessages(prev => prev.map(m => m.id === id ? { ...m, translating: true } : m));
      try {
        const apiKey = localStorage.getItem('jai_api_key');
        if (!apiKey) { showNotification('请先配置 API Key'); return; }

        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: msg.content, apiKey })
        });
        if (!res.ok) throw new Error('Translation failed');
        const data = await res.json();
        const translation = data.translation || '';

        setMessages(prev => prev.map(m =>
          m.id === id ? { ...m, chineseTranslation: translation, translated: true, translating: false, flipped: !m.flipped } : m
        ));
      } catch {
        setMessages(prev => prev.map(m => m.id === id ? { ...m, translating: false } : m));
        showNotification('翻译失败');
      }
    } else {
      setMessages(prev => prev.map(m => m.id === id ? { ...m, flipped: !m.flipped } : m));
    }
  };

  const copyContent = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) showNotification('已复制');
    else showNotification('复制失败');
  };

  // ========== AI Features ==========
  const handleInspiration = async () => {
    if (!currentPreset) { showNotification('请选择预设'); return; }
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setInspirationLoading(true);
    setShowInspiration(true);
    setInspirationItems([]);

    try {
      const personInstruction = personMode === 'first'
        ? 'Use first person (I/me/my) for all suggestions.'
        : 'Use third person (he/she/they) for all suggestions.';

      const res = await fetch('/api/inspiration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charInfo: currentPreset.charInfo,
          userCard: currentPreset.userCard,
          chatHistory: buildChatHistoryForMemory(),
          longTermMemory: currentPreset.longTermMemory,
          apiKey,
          personMode,
          stylePrompt: buildStylePrompt()
        })
      });

      if (!res.ok) throw new Error('灵感生成失败');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      let fullText = '';
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) fullText += parsed.content;
            } catch { /* skip */ }
          }
        }
      }

      // Parse: split by ===ITEM=== first, then fallback to newlines
      let items: string[] = [];
      if (fullText.includes('===ITEM===')) {
        items = fullText.split('===ITEM===')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('==='));
      }
      if (items.length < 3) {
        items = fullText.split('\n')
          .map(s => s.replace(/===ITEM===/g, '').replace(/^\d+[\.\)]\s*/, '').trim())
          .filter(s => s.length > 5 && !s.includes('===ITEM==='));
      }
      const parsed = items.slice(0, 3).map(line => ({
        en: line,
        cn: undefined as string | undefined,
        flipped: false,
        translating: false,
      }));
      setInspirationItems(parsed);
    } catch {
      showNotification('灵感生成失败');
    } finally {
      setInspirationLoading(false);
    }
  };

  const handleExpand = async () => {
    if (!expandBrief.trim() || !currentPreset) return;
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setExpandLoading(true);
    setExpandResult(null);
    setExpandFlipped(false);

    try {
      const res = await fetch('/api/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: expandBrief,
          charInfo: currentPreset.charInfo,
          userCard: currentPreset.userCard,
          chatHistory: buildChatHistoryForMemory(),
          longTermMemory: currentPreset.longTermMemory,
          apiKey,
          personMode,
          stylePrompt: buildStylePrompt()
        })
      });

      if (!res.ok) throw new Error('扩写失败');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      let fullText = '';
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) fullText += parsed.content;
            } catch { /* skip */ }
          }
        }
      }

      const parts = fullText.split('===CHINESE===');
      setExpandResult({ en: (parts[0] || '').trim(), cn: (parts[1] || '').trim() });
    } catch {
      showNotification('扩写失败');
    } finally {
      setExpandLoading(false);
    }
  };

  const handleMemory = async () => {
    if (!currentPreset) { showNotification('请选择预设'); return; }
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setMemoryLoading(true);
    setMemoryResult(null);
    setMemoryFlipped(false);
    setShowMemoryModal(true);

    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charInfo: currentPreset.charInfo,
          userCard: currentPreset.userCard,
          chatHistory: buildChatHistoryForMemory(),
          longTermMemory: currentPreset.longTermMemory,
          apiKey
        })
      });

      if (!res.ok) throw new Error('记忆生成失败');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      let fullText = '';
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) fullText += parsed.content;
            } catch { /* skip */ }
          }
        }
      }

      const parts = fullText.split('===CHINESE===');
      const enText = (parts[0] || '').trim();
      const cnText = (parts[1] || '').trim();
      setMemoryResult({ en: enText, cn: cnText });
    } catch {
      showNotification('记忆生成失败');
    } finally {
      setMemoryLoading(false);
    }
  };

  const saveMemoryToPreset = () => {
    if (!memoryResult || !currentPreset) return;
    const updated = { ...currentPreset, longTermMemory: memoryResult.en };
    updatePreset(updated);
    setPresets(prev => prev.map(p => p.id === currentPresetId ? updated : p));
    showNotification('记忆已写入预设');
  };

  // ========== Plot Assistant ==========
  const handlePlotSummary = async () => {
    if (!currentPreset) { showNotification('请选择预设'); return; }
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setPlotSummaryLoading(true);
    setPlotSummary(null);

    try {
      const res = await fetch('/api/plot-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charInfo: currentPreset.charInfo,
          userCard: currentPreset.userCard,
          chatHistory: buildChatHistoryForMemory(),
          longTermMemory: currentPreset.longTermMemory,
          plotDirection: currentPreset.plotDirection,
          apiKey,
          stylePrompt: buildStylePrompt()
        })
      });

      if (!res.ok) throw new Error('摘要生成失败');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      let fullText = '';
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) fullText += parsed.content;
            } catch { /* skip */ }
          }
        }
      }

      const parts = fullText.split('===CHINESE===');
      setPlotSummary({ en: (parts[0] || '').trim(), cn: (parts[1] || '').trim(), flipped: false, translating: false });
    } catch {
      showNotification('摘要生成失败');
    } finally {
      setPlotSummaryLoading(false);
    }
  };

  const handlePlotPredict = async () => {
    if (!currentPreset) { showNotification('请选择预设'); return; }
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setPlotPredictLoading(true);
    setPlotPredictions([]);
    setPlotTwist(null);
    setPlotAdvanceResult(null);
    setSelectedPredictionIdx(null);
    setPredictionTranslations({});

    try {
      const res = await fetch('/api/plot-predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charInfo: currentPreset.charInfo,
          userCard: currentPreset.userCard,
          chatHistory: buildChatHistoryForMemory(),
          longTermMemory: currentPreset.longTermMemory,
          plotDirection: currentPreset.plotDirection,
          messageCount: messages.filter(m => m.id !== 'greeting-' + currentPresetId).length,
          directionKeyword: plotDirectionKeyword || undefined,
          personMode,
          apiKey,
          stylePrompt: buildStylePrompt()
        })
      });

      if (!res.ok) throw new Error('预测生成失败');
      const data = await res.json();

      if (data.predictions && Array.isArray(data.predictions)) {
        setPlotPredictions(data.predictions);
      }
      if (data.twist) {
        setPlotTwist(data.twist);
      }
    } catch {
      showNotification('预测生成失败');
    } finally {
      setPlotPredictLoading(false);
    }
  };

  const handlePlotAdvance = async (prediction: string, idx: number) => {
    if (!currentPreset) return;
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setPlotAdvanceLoading(true);
    setPlotAdvanceResult(null);
    setSelectedPredictionIdx(idx);

    try {
      const res = await fetch('/api/plot-predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charInfo: currentPreset.charInfo,
          userCard: currentPreset.userCard,
          chatHistory: buildChatHistoryForMemory(),
          longTermMemory: currentPreset.longTermMemory,
          plotDirection: currentPreset.plotDirection,
          selectedPrediction: prediction,
          personMode,
          apiKey,
          stylePrompt: buildStylePrompt()
        })
      });

      if (!res.ok) throw new Error('推进生成失败');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      let fullText = '';
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) fullText += parsed.content;
            } catch { /* skip */ }
          }
        }
      }

      const parts = fullText.split('===CHINESE===');
      setPlotAdvanceResult({ en: (parts[0] || '').trim(), cn: (parts[1] || '').trim(), flipped: false });
    } catch {
      showNotification('推进生成失败');
    } finally {
      setPlotAdvanceLoading(false);
    }
  };

  const flipPlotPrediction = async (idx: number) => {
    const existing = predictionTranslations[idx];
    if (existing?.flipped) {
      // Flip back
      setPredictionTranslations(prev => ({ ...prev, [idx]: { ...prev[idx], flipped: false } }));
      return;
    }
    if (existing?.cn) {
      setPredictionTranslations(prev => ({ ...prev, [idx]: { ...prev[idx], flipped: true } }));
      return;
    }
    // Need to translate
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setPredictionTranslations(prev => ({ ...prev, [idx]: { cn: '', flipped: false, translating: true } }));

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: plotPredictions[idx], apiKey }),
      });
      const data = await res.json();
      setPredictionTranslations(prev => ({ ...prev, [idx]: { cn: data.translation || '翻译失败', flipped: true, translating: false } }));
    } catch {
      setPredictionTranslations(prev => ({ ...prev, [idx]: { cn: '翻译失败', flipped: true, translating: false } }));
    }
  };

  const flipPlotSummary = async () => {
    if (!plotSummary) return;
    if (plotSummary.flipped) {
      setPlotSummary(prev => prev ? { ...prev, flipped: false } : null);
      return;
    }
    if (plotSummary.cn) {
      setPlotSummary(prev => prev ? { ...prev, flipped: true } : null);
      return;
    }
    // Translate
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setPlotSummary(prev => prev ? { ...prev, translating: true } : null);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: plotSummary.en, apiKey }),
      });
      const data = await res.json();
      setPlotSummary(prev => prev ? { ...prev, cn: data.translation || '翻译失败', flipped: true, translating: false } : null);
    } catch {
      setPlotSummary(prev => prev ? { ...prev, translating: false } : null);
      showNotification('翻译失败');
    }
  };

  const flipPlotTwist = async () => {
    if (!plotTwist) return;
    // Toggle twist translation inline - reuse predictionTranslations with special key
    const twistKey = -1;
    const existing = predictionTranslations[twistKey];
    if (existing?.flipped) {
      setPredictionTranslations(prev => ({ ...prev, [twistKey]: { ...prev[twistKey], flipped: false } }));
      return;
    }
    if (existing?.cn) {
      setPredictionTranslations(prev => ({ ...prev, [twistKey]: { ...prev[twistKey], flipped: true } }));
      return;
    }
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }
    setPredictionTranslations(prev => ({ ...prev, [twistKey]: { cn: '', flipped: false, translating: true } }));
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: plotTwist, apiKey }),
      });
      const data = await res.json();
      setPredictionTranslations(prev => ({ ...prev, [twistKey]: { cn: data.translation || '翻译失败', flipped: true, translating: false } }));
    } catch {
      setPredictionTranslations(prev => ({ ...prev, [twistKey]: { cn: '翻译失败', flipped: true, translating: false } }));
    }
  };

  const handleBackToPresets = () => {
    if (currentPresetId) {
      const preset = presets.find(p => p.id === currentPresetId);
      if (preset) {
        // Auto-save plot progress: if we have a plot summary, save it to preset.plotDirection
        const updatedPreset = plotSummary?.en
          ? { ...preset, plotDirection: plotSummary.en }
          : preset;
        if (updatedPreset !== preset) {
          updatePreset(updatedPreset);
          setPresets(prev => prev.map(p => p.id === currentPresetId ? updatedPreset : p));
        }
        saveSession(currentPresetId, messages, updatedPreset.longTermMemory);
      }
    }
    showNotification('会话已保存');
    setTimeout(() => router.push('/presets'), 500);
  };

  // ========== Render ==========
  if (presets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-pink-50/50 px-4">
        <p className="text-gray-500 mb-4">暂无预设，请先生成 User 卡并保存</p>
        <button onClick={() => router.push('/')} className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600">
          去生成
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-pink-50/50">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-white/80 backdrop-blur-sm border-b border-pink-100">
        <button onClick={handleBackToPresets} className="p-1 text-pink-400 hover:text-pink-600 transition-colors">
          <IconBack className="w-5 h-5" />
        </button>
        <select
          value={currentPresetId}
          onChange={e => setCurrentPresetId(e.target.value)}
          className="flex-1 text-sm font-medium bg-transparent border-none focus:outline-none text-gray-700"
        >
          {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Chat Messages - scrollable */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" onClick={() => setShowInstructionPicker(false)}>
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onFlip={() => flipMessage(msg.id)}
            onEdit={() => startEditMessage(msg.id)}
            onSaveEdit={(content) => saveEditMessage(msg.id, content)}
            onCancelEdit={() => cancelEditMessage(msg.id)}
            onDelete={() => deleteMessageAndAfter(msg.id)}
            onCopy={() => copyContent(msg.flipped && msg.chineseTranslation ? msg.chineseTranslation : msg.content)}
            onMarkAsInstruction={(selectedIndices: number[]) => {
              // The actual content rebuild happens inside MessageBubble via onSaveEdit
              // This callback is just for notification
              if (selectedIndices.length > 0) {
                showNotification(`已标记 ${selectedIndices.length} 段为指令`);
              }
            }}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Inspiration Panel */}
      {showInspiration && (
        <div className="shrink-0 mx-4 mb-2 bg-white rounded-xl border border-pink-100 shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-pink-500 flex items-center gap-1">
              <IconSparkle className="w-3.5 h-3.5" /> 灵感
            </span>
            <div className="flex items-center gap-1">
              <button onClick={handleInspiration} disabled={inspirationLoading} className="p-1 text-pink-400 hover:text-pink-600 disabled:opacity-50">
                <IconRefresh className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setShowInspiration(false)} className="p-1 text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>
          </div>
          {inspirationLoading ? (
            <p className="text-xs text-gray-400 animate-pulse">生成中...</p>
          ) : (
            <div className="space-y-2">
              {inspirationItems.map((item, i) => (
                <div key={i} className="relative">
                  <div
                    className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
                      item.flipped ? 'bg-pink-50 border-pink-200' : 'bg-white border-pink-100 hover:bg-pink-50/50'
                    }`}
                    onClick={() => {
                      if (!item.flipped) {
                        // Flip to Chinese - translate if needed
                        const newItems = [...inspirationItems];
                        if (!item.cn) {
                          newItems[i] = { ...item, translating: true };
                          setInspirationItems(newItems);
                          // Call translate API
                          const apiKey = localStorage.getItem('jai_api_key') || '';
                          fetch('/api/translate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text: item.en, apiKey }),
                          }).then(r => r.json()).then(data => {
                            const updated = [...inspirationItems];
                            updated[i] = { ...updated[i], cn: data.translation || '翻译失败', flipped: true, translating: false };
                            setInspirationItems(updated);
                          }).catch(() => {
                            const updated = [...inspirationItems];
                            updated[i] = { ...updated[i], translating: false, flipped: true, cn: '翻译失败' };
                            setInspirationItems(updated);
                          });
                        } else {
                          newItems[i] = { ...item, flipped: true };
                          setInspirationItems(newItems);
                        }
                      } else {
                        // Flip back to English
                        const newItems = [...inspirationItems];
                        newItems[i] = { ...item, flipped: false };
                        setInspirationItems(newItems);
                      }
                    }}
                  >
                    {item.translating ? (
                      <p className="text-xs text-gray-400 animate-pulse">翻译中...</p>
                    ) : item.flipped ? (
                      <p className="text-xs text-gray-800">{item.cn}</p>
                    ) : (
                      <p className="text-xs text-gray-800">{item.en}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); copyContent(item.en); }}
                      className="text-[10px] text-pink-400 hover:text-pink-600"
                    >复制</button>
                    <span className="text-[10px] text-gray-300">|</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!item.flipped) {
                          const newItems = [...inspirationItems];
                          if (!item.cn) {
                            newItems[i] = { ...item, translating: true };
                            setInspirationItems(newItems);
                            const apiKey = localStorage.getItem('jai_api_key') || '';
                            fetch('/api/translate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ text: item.en, apiKey }),
                            }).then(r => r.json()).then(data => {
                              const updated = [...inspirationItems];
                              updated[i] = { ...updated[i], cn: data.translation || '翻译失败', flipped: true, translating: false };
                              setInspirationItems(updated);
                            }).catch(() => {
                              const updated = [...inspirationItems];
                              updated[i] = { ...updated[i], translating: false, flipped: true, cn: '翻译失败' };
                              setInspirationItems(updated);
                            });
                          } else {
                            newItems[i] = { ...item, flipped: true };
                            setInspirationItems(newItems);
                          }
                        } else {
                          const newItems = [...inspirationItems];
                          newItems[i] = { ...item, flipped: false };
                          setInspirationItems(newItems);
                        }
                      }}
                      className="text-[10px] text-gray-400 hover:text-gray-600"
                    >翻转</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Plot Assistant Panel */}
      {showPlotPanel && (
        <div className="shrink-0 mx-4 mb-2 bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden">
          {/* Panel Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-amber-50/50 border-b border-amber-100">
            <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
              <IconPlot className="w-3.5 h-3.5" /> 剧情助手
            </span>
            <button onClick={() => setShowPlotPanel(false)} className="p-1 text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>

          <div className="p-3 space-y-3 max-h-[50vh] overflow-y-auto">
            {/* Section 1: Plot Summary */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">剧情摘要</span>
                <div className="flex items-center gap-1">
                  <button onClick={handlePlotSummary} disabled={plotSummaryLoading} className="p-1 text-amber-400 hover:text-amber-600 disabled:opacity-50">
                    <IconRefresh className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {plotSummaryLoading ? (
                <p className="text-xs text-gray-400 animate-pulse">生成中...</p>
              ) : plotSummary ? (
                <div>
                  <div
                    className="p-2.5 rounded-lg border bg-amber-50/50 border-amber-100 cursor-pointer hover:bg-amber-50 transition-colors"
                    onClick={flipPlotSummary}
                  >
                    {plotSummary.translating ? (
                      <p className="text-xs text-gray-400 animate-pulse">翻译中...</p>
                    ) : (
                      <p className="text-xs text-gray-800 whitespace-pre-wrap">
                        {plotSummary.flipped && plotSummary.cn ? plotSummary.cn : plotSummary.en}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <button onClick={(e) => { e.stopPropagation(); copyContent(plotSummary.en); }} className="text-[10px] text-amber-500 hover:text-amber-700">复制</button>
                    <span className="text-[10px] text-gray-300">|</span>
                    <button onClick={flipPlotSummary} className="text-[10px] text-gray-400 hover:text-gray-600">翻转</button>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-gray-400">点击刷新按钮生成摘要</p>
              )}
            </div>

            <div className="border-t border-amber-100" />

            {/* Section 2: Plot Predictions */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">剧情走向</span>
                <div className="flex items-center gap-1">
                  <button onClick={handlePlotPredict} disabled={plotPredictLoading} className="p-1 text-amber-400 hover:text-amber-600 disabled:opacity-50">
                    <IconRefresh className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Direction keyword input */}
              <div className="flex items-center gap-1.5 mb-2">
                <input
                  type="text"
                  value={plotDirectionKeyword}
                  onChange={e => setPlotDirectionKeyword(e.target.value)}
                  placeholder="剧情方向关键词（可选）"
                  className="flex-1 text-[11px] px-2 py-1 rounded border border-amber-100 bg-amber-50/30 focus:border-amber-300 focus:outline-none placeholder:text-amber-300"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handlePlotPredict(); } }}
                />
                <button
                  onClick={handlePlotPredict}
                  disabled={plotPredictLoading}
                  className="text-[10px] px-2 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
                >
                  预测
                </button>
              </div>

              {plotPredictLoading ? (
                <p className="text-xs text-gray-400 animate-pulse">生成中...</p>
              ) : plotPredictions.length > 0 ? (
                <div className="space-y-2">
                  {plotPredictions.map((pred, i) => {
                    const translation = predictionTranslations[i];
                    const isSelected = selectedPredictionIdx === i;
                    return (
                      <div key={i} className={`rounded-lg border p-2 transition-colors ${isSelected ? 'border-amber-300 bg-amber-50' : 'border-amber-100 bg-white hover:bg-amber-50/30'}`}>
                        <div
                          className="cursor-pointer"
                          onClick={() => flipPlotPrediction(i)}
                        >
                          {translation?.translating ? (
                            <p className="text-xs text-gray-400 animate-pulse">翻译中...</p>
                          ) : translation?.flipped && translation.cn ? (
                            <p className="text-xs text-gray-800">{translation.cn}</p>
                          ) : (
                            <p className="text-xs text-gray-800">{pred}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); copyContent(pred); }}
                            className="text-[10px] text-amber-500 hover:text-amber-700"
                          >复制</button>
                          <span className="text-[10px] text-gray-300">|</span>
                          <button
                            onClick={() => flipPlotPrediction(i)}
                            className="text-[10px] text-gray-400 hover:text-gray-600"
                          >翻转</button>
                          <span className="text-[10px] text-gray-300">|</span>
                          <button
                            onClick={() => handlePlotAdvance(pred, i)}
                            disabled={plotAdvanceLoading}
                            className="text-[10px] text-amber-500 hover:text-amber-700 font-medium disabled:opacity-50"
                          >推进</button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Twist prediction (long-term plot) */}
                  {plotTwist && (
                    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-2">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[9px] font-medium text-violet-500 bg-violet-100 px-1 py-0.5 rounded">阶段性转折</span>
                      </div>
                      <div className="cursor-pointer" onClick={flipPlotTwist}>
                        {predictionTranslations[-1]?.translating ? (
                          <p className="text-xs text-gray-400 animate-pulse">翻译中...</p>
                        ) : predictionTranslations[-1]?.flipped && predictionTranslations[-1]?.cn ? (
                          <p className="text-xs text-gray-800">{predictionTranslations[-1].cn}</p>
                        ) : (
                          <p className="text-xs text-gray-800">{plotTwist}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <button onClick={(e) => { e.stopPropagation(); copyContent(plotTwist); }} className="text-[10px] text-violet-500 hover:text-violet-700">复制</button>
                        <span className="text-[10px] text-gray-300">|</span>
                        <button onClick={flipPlotTwist} className="text-[10px] text-gray-400 hover:text-gray-600">翻转</button>
                        <span className="text-[10px] text-gray-300">|</span>
                        <button
                          onClick={() => handlePlotAdvance(plotTwist, -1)}
                          disabled={plotAdvanceLoading}
                          className="text-[10px] text-violet-500 hover:text-violet-700 font-medium disabled:opacity-50"
                        >推进</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400">点击预测按钮生成走向</p>
              )}
            </div>

            {/* Section 3: Advance Result */}
            {plotAdvanceResult && (
              <>
                <div className="border-t border-amber-100" />
                <div>
                  <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">推进结果</span>
                  <div
                    className="mt-1.5 p-2.5 rounded-lg border bg-amber-50/50 border-amber-100 cursor-pointer hover:bg-amber-50 transition-colors"
                    onClick={() => setPlotAdvanceResult(prev => prev ? { ...prev, flipped: !prev.flipped } : null)}
                  >
                    <p className="text-xs text-gray-800 whitespace-pre-wrap">
                      {plotAdvanceResult.flipped ? plotAdvanceResult.cn : plotAdvanceResult.en}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <button
                      onClick={() => copyContent(plotAdvanceResult.en)}
                      className="text-[10px] text-amber-500 hover:text-amber-700"
                    >复制</button>
                    <span className="text-[10px] text-gray-300">|</span>
                    <button
                      onClick={() => setPlotAdvanceResult(prev => prev ? { ...prev, flipped: !prev.flipped } : null)}
                      className="text-[10px] text-gray-400 hover:text-gray-600"
                    >翻转</button>
                    <span className="text-[10px] text-gray-300">|</span>
                    <button
                      onClick={() => {
                        setUserInput(plotAdvanceResult.en);
                        showNotification('已复制到输入框');
                      }}
                      className="text-[10px] text-pink-500 hover:text-pink-700 font-medium"
                    >填入输入框</button>
                  </div>
                </div>
              </>
            )}

            {plotAdvanceLoading && (
              <p className="text-xs text-gray-400 animate-pulse">生成推进内容中...</p>
            )}
          </div>
        </div>
      )}

      {/* Expand Modal */}
      {showExpandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-pink-500 flex items-center gap-1.5">
                  <IconPen className="w-4 h-4" /> 扩写
                </span>
                <button onClick={() => { setShowExpandModal(false); setExpandResult(null); setExpandBrief(''); }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {!expandResult ? (
                <div className="space-y-3">
                  <textarea
                    value={expandBrief}
                    onChange={e => setExpandBrief(e.target.value)}
                    placeholder="输入简短梗概..."
                    className="w-full text-sm p-3 rounded-xl border border-pink-100 focus:border-pink-300 focus:outline-none resize-none min-h-[80px]"
                    rows={3}
                  />
                  <button
                    onClick={handleExpand}
                    disabled={!expandBrief.trim() || expandLoading}
                    className="w-full py-2 text-sm bg-pink-500 text-white rounded-xl hover:bg-pink-600 disabled:opacity-50 transition-colors"
                  >
                    {expandLoading ? '生成中...' : '扩写'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-pink-50/50 border border-pink-100">
                    <p className="text-sm whitespace-pre-wrap">{expandFlipped ? expandResult.cn : expandResult.en}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyContent(expandResult.en)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-pink-50 text-pink-500 hover:bg-pink-100">
                      <IconCopy className="w-3 h-3" /> 复制英文
                    </button>
                    <button onClick={() => setExpandFlipped(!expandFlipped)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-pink-50 text-pink-500 hover:bg-pink-100">
                      <IconFlip className="w-3 h-3" /> {expandFlipped ? '英文' : '中文'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Memory Modal */}
      {showMemoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-violet-500 flex items-center gap-1.5">
                  <IconBrain className="w-4 h-4" /> 长期记忆
                </span>
                <button onClick={() => { setShowMemoryModal(false); setMemoryResult(null); }} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {memoryLoading ? (
                <p className="text-sm text-gray-400 animate-pulse">生成中...</p>
              ) : memoryResult ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-violet-50/50 border border-violet-100">
                    <p className="text-sm whitespace-pre-wrap">{memoryFlipped ? memoryResult.cn : memoryResult.en}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => copyContent(memoryResult.en)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-violet-50 text-violet-500 hover:bg-violet-100">
                      <IconCopy className="w-3 h-3" /> 复制英文
                    </button>
                    <button onClick={() => setMemoryFlipped(!memoryFlipped)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-violet-50 text-violet-500 hover:bg-violet-100">
                      <IconFlip className="w-3 h-3" /> {memoryFlipped ? '英文' : '中文'}
                    </button>
                    <button onClick={saveMemoryToPreset} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-emerald-50 text-emerald-500 hover:bg-emerald-100">
                      <IconLock className="w-3 h-3" /> 写入预设库
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Input Area */}
      <div className="shrink-0 border-t border-pink-100 bg-white/90 backdrop-blur-sm px-4 py-3 space-y-2">
        {/* Controls Row */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={personMode}
            onChange={e => setPersonMode(e.target.value as 'first' | 'third')}
            className="text-xs px-2 py-1 rounded-lg border border-pink-100 bg-pink-50/50 text-pink-600 focus:outline-none focus:border-pink-300"
          >
            <option value="first">第一人称 (I/Me)</option>
            <option value="third">第三人称 (He/She)</option>
          </select>

          <select
            value={styleTone}
            onChange={e => setStyleTone(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg border border-pink-100 bg-pink-50/50 text-pink-600 focus:outline-none focus:border-pink-300"
          >
            <option value="">剧集调性</option>
            <option value="欧美剧集">欧美剧集</option>
            <option value="电影质感">电影质感</option>
          </select>

          <select
            value={styleGenre}
            onChange={e => setStyleGenre(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg border border-pink-100 bg-pink-50/50 text-pink-600 focus:outline-none focus:border-pink-300"
          >
            <option value="">经典类型</option>
            <option value="黑色电影">黑色电影</option>
            <option value="西部片">西部片</option>
            <option value="赛博朋克/科幻">赛博朋克/科幻</option>
            <option value="战争/军事">战争/军事</option>
          </select>

          <select
            value={styleEmotion}
            onChange={e => setStyleEmotion(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg border border-pink-100 bg-pink-50/50 text-pink-600 focus:outline-none focus:border-pink-300"
          >
            <option value="">情感浓度</option>
            <option value="强强对抗">强强对抗</option>
            <option value="暧昧推拉">暧昧推拉</option>
            <option value="极度压抑">极度压抑</option>
            <option value="极度暴力">极度暴力</option>
          </select>

          <select
            value={stylePace}
            onChange={e => setStylePace(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg border border-pink-100 bg-pink-50/50 text-pink-600 focus:outline-none focus:border-pink-300"
          >
            <option value="">叙事节奏</option>
            <option value="慢燃">慢燃</option>
            <option value="快切">快切</option>
            <option value="单幕压缩">单幕压缩</option>
          </select>

          <div className="relative" ref={optionalMenuRef}>
            <button
              onClick={() => setShowOptionalMenu(!showOptionalMenu)}
              className="text-xs px-2 py-1 rounded-lg border border-pink-100 bg-pink-50/50 text-pink-600 focus:outline-none focus:border-pink-300 flex items-center gap-1"
            >
              <span>可选风格</span>
              {styleOptional.length > 0 && <span className="bg-pink-500 text-white rounded-full px-1.5 text-[10px]">{styleOptional.length}</span>}
            </button>
            {showOptionalMenu && (
              <div className="absolute bottom-full left-0 mb-1 bg-white border border-pink-100 rounded-lg shadow-lg p-2 min-w-[180px] z-50">
                {['加一点浪漫', '加一点背叛', '加一点救赎', '加一点牺牲'].map(opt => (
                  <label key={opt} className="flex items-center gap-2 py-1 text-xs text-gray-700 cursor-pointer hover:bg-pink-50 rounded px-1">
                    <input
                      type="checkbox"
                      checked={styleOptional.includes(opt)}
                      onChange={e => {
                        if (e.target.checked) setStyleOptional(prev => [...prev, opt]);
                        else setStyleOptional(prev => prev.filter(v => v !== opt));
                      }}
                      className="rounded border-pink-300 text-pink-500 focus:ring-pink-300"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer ml-auto">
            <span>思考</span>
            <button
              onClick={() => setThinkingEnabled(!thinkingEnabled)}
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${thinkingEnabled ? 'bg-violet-400' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${thinkingEnabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>

        {/* JAI Reply Input */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={jaiInput}
            onChange={e => setJaiInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendBotMessage(); } }}
            placeholder="粘贴 Char/Bot 回复（英文）..."
            className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-blue-100 bg-blue-50/50 focus:border-blue-300 focus:outline-none placeholder:text-blue-300"
          />
          <button
            onClick={sendBotMessage}
            disabled={!jaiInput.trim()}
            className="px-2.5 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors shrink-0"
          >
            发送
          </button>
        </div>

        {/* User Chat Input */}
        <div className="flex items-end gap-2">
          <textarea
            value={userInput}
            onChange={e => setUserInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendUserMessage(); } }}
            placeholder="输入你的消息..."
            className="flex-1 text-sm p-3 rounded-xl border border-pink-100 focus:border-pink-300 focus:outline-none resize-none min-h-[40px] max-h-[120px]"
            rows={1}
          />
          <button
            onClick={sendUserMessage}
            className="p-3 rounded-xl bg-pink-500 text-white hover:bg-pink-600 transition-colors shrink-0"
          >
            <IconSend className="w-4 h-4" />
          </button>
        </div>

        {/* Feature Buttons */}
        <div className="flex items-center gap-2 relative">
          <button onClick={handleInspiration} disabled={inspirationLoading} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-pink-50 text-pink-500 hover:bg-pink-100 disabled:opacity-50 transition-colors">
            <IconSparkle className="w-3.5 h-3.5" /> 灵感
          </button>
          <button onClick={() => setShowExpandModal(true)} disabled={expandLoading} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-pink-50 text-pink-500 hover:bg-pink-100 disabled:opacity-50 transition-colors">
            <IconPen className="w-3.5 h-3.5" /> 扩写
          </button>
          <button onClick={handleMemory} disabled={memoryLoading} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-pink-50 text-pink-500 hover:bg-pink-100 disabled:opacity-50 transition-colors">
            <IconBrain className="w-3.5 h-3.5" /> 记忆
          </button>
          <button
            onClick={() => { setShowPlotPanel(!showPlotPanel); if (!showPlotPanel && !plotSummary && !plotPredictions.length) { handlePlotSummary(); handlePlotPredict(); } }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 transition-colors"
          >
            <IconPlot className="w-3.5 h-3.5" /> 剧情
          </button>
          <div className="relative" ref={instructionPickerRef}>
            <button
              onClick={() => {
                setInstructionList(getInstructionList());
                setShowInstructionPicker(!showInstructionPicker);
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-pink-50 text-pink-500 hover:bg-pink-100 transition-colors"
            >
              <IconBook className="w-3.5 h-3.5" /> 指令
            </button>
            {showInstructionPicker && instructionList.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-56 max-h-60 overflow-y-auto bg-white rounded-xl border border-pink-100 shadow-lg z-50 py-1">
                {instructionList.map(inst => (
                  <button
                    key={inst.id}
                    onClick={() => {
                      setUserInput(prev => (prev ? prev + '\n' : '') + `【${inst.content}】`);
                      setShowInstructionPicker(false);
                      showNotification(`已插入「${inst.name}」`);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-pink-50 transition-colors"
                  >
                    <p className="text-xs font-medium text-gray-800 truncate">{inst.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">{inst.summary}</p>
                  </button>
                ))}
              </div>
            )}
            {showInstructionPicker && instructionList.length === 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-56 bg-white rounded-xl border border-pink-100 shadow-lg z-50 py-3 px-3">
                <p className="text-xs text-gray-400">暂无指令</p>
                <p className="text-[10px] text-gray-400 mt-0.5">前往指令库添加</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg animate-fade-in">
          {notification}
        </div>
      )}
    </div>
  );
}

// ========== Instruction keyword detection ==========
const INSTRUCTION_KEYWORDS = [
  'Reader Barrage', 'Omniscient Barrage',
  'Small Theaters', 'Plot Diary', 'Alternate Universe', 'AU',
  'Reading Notes', 'Book title',
  "Friends' Circle", 'Friends Circle',
  'Weekly Schedule',
  'Now Playing',
  'System Note', 'System-Level',
  'Want to Do but Dare Not',
  'Random Event',
  'OOC',
];

function isInstructionParagraph(text: string): boolean {
  const lower = text.toLowerCase();
  return INSTRUCTION_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

// ========== Message Bubble Component ==========
function MessageBubble({ message, onFlip, onEdit, onSaveEdit, onCancelEdit, onDelete, onCopy, onMarkAsInstruction }: {
  message: ChatMessage;
  onFlip: () => void;
  onEdit: () => void;
  onSaveEdit: (content: string) => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onMarkAsInstruction: (selectedIndices: number[]) => void;
}) {
  const [editContent, setEditContent] = useState(message.content);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedParagraphs, setSelectedParagraphs] = useState<Set<number>>(new Set());
  const isUser = message.role === 'user';

  useEffect(() => {
    setEditContent(message.content);
  }, [message.content]);

  // Parse content into sections
  const displayText = message.flipped && message.chineseTranslation ? message.chineseTranslation : message.content;
  const { main, instructions } = parseContentSections(displayText);

  // Split content into paragraphs for the picker (use original content, not display)
  const paragraphs = message.content.split(/\n\n+/).filter(p => p.trim());

  const handleOpenPicker = () => {
    // Auto-select paragraphs that look like instructions
    const autoSelected = new Set<number>();
    paragraphs.forEach((p, idx) => {
      if (isInstructionParagraph(p)) {
        autoSelected.add(idx);
      }
      // Also keep paragraphs that are already wrapped in 【】
      if (p.trim().startsWith('【') && p.trim().endsWith('】')) {
        autoSelected.add(idx);
      }
    });
    setSelectedParagraphs(autoSelected);
    setShowPicker(true);
  };

  const handleConfirmPicker = () => {
    if (selectedParagraphs.size === 0) {
      setShowPicker(false);
      return;
    }
    // Rebuild content: wrap selected paragraphs in 【】, leave others as-is
    const rebuilt = paragraphs.map((p, idx) => {
      const clean = p.trim();
      // If already wrapped, keep or unwrap based on selection
      if (clean.startsWith('【') && clean.endsWith('】')) {
        const inner = clean.slice(1, -1);
        return selectedParagraphs.has(idx) ? p : inner;
      }
      return selectedParagraphs.has(idx) ? `【${clean}】` : p;
    }).join('\n\n');
    onMarkAsInstruction(Array.from(selectedParagraphs));
    onSaveEdit(rebuilt);
    setShowPicker(false);
  };

  const toggleParagraph = (idx: number) => {
    setSelectedParagraphs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* Paragraph Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setShowPicker(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-pink-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-pink-500 flex items-center gap-1.5">
                  <IconBook className="w-4 h-4" /> 标记为指令
                </span>
                <button onClick={() => setShowPicker(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">选择要标记为指令的段落（已自动识别含指令关键词的段落）</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {paragraphs.map((p, idx) => {
                const isSelected = selectedParagraphs.has(idx);
                const isAuto = isInstructionParagraph(p);
                const preview = p.length > 120 ? p.slice(0, 120) + '...' : p;
                return (
                  <button
                    key={idx}
                    onClick={() => toggleParagraph(idx)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-pink-300 bg-pink-50'
                        : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'border-pink-500 bg-pink-500' : 'border-gray-300'
                      }`}>
                        {isSelected && <IconCheck className="w-3 h-3 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{preview}</p>
                        {isAuto && !isSelected && (
                          <span className="inline-block mt-1 text-[9px] text-pink-400 bg-pink-50 px-1 py-0.5 rounded">建议标记</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="p-3 border-t border-pink-100 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">已选 {selectedParagraphs.size} / {paragraphs.length} 段</span>
              <div className="flex gap-2">
                <button onClick={() => setShowPicker(false)} className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">取消</button>
                <button onClick={handleConfirmPicker} className="px-3 py-1.5 text-xs rounded-lg bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-50" disabled={selectedParagraphs.size === 0}>
                  确认标记
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-[85%] rounded-2xl shadow-sm ${
        isUser
          ? 'bg-pink-500 text-white rounded-br-sm'
          : 'bg-white text-gray-800 border border-pink-100 rounded-bl-sm'
      }`}>
        {/* Role Label */}
        <div className={`px-3 pt-2 pb-0.5 text-[10px] font-medium ${isUser ? 'text-pink-200' : 'text-pink-400'}`}>
          {isUser ? 'User' : 'Char'}
        </div>

        {/* Content */}
        <div className="px-3 pb-1">
          {message.editing ? (
            <div className="space-y-1.5">
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className={`w-full text-sm p-2 rounded-lg border resize-none min-h-[60px] ${
                  isUser ? 'bg-pink-400/30 border-pink-300 text-white placeholder:text-pink-200' : 'bg-pink-50 border-pink-200 text-gray-800'
                } focus:outline-none`}
                rows={3}
              />
              <div className="flex gap-1.5">
                <button onClick={() => onSaveEdit(editContent)} className="text-[10px] px-2 py-0.5 bg-pink-500 text-white rounded">保存</button>
                <button onClick={onCancelEdit} className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-600 rounded">取消</button>
              </div>
            </div>
          ) : (
            <>
              {/* Main content */}
              {main && (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {main}
                </p>
              )}
              {/* Instruction blocks */}
              {instructions.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {instructions.map((inst, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'bg-pink-400/30 text-pink-100'
                          : 'bg-pink-50/80 text-gray-600 border border-pink-100/50'
                      }`}
                    >
                      <span className={`inline-block text-[9px] font-medium px-1 py-0.5 rounded mb-1 ${
                        isUser ? 'bg-pink-300/30 text-pink-100' : 'bg-pink-100 text-pink-400'
                      }`}>
                        指令
                      </span>
                      <span className="ml-1">{inst}</span>
                    </div>
                  ))}
                </div>
              )}
              {!main && instructions.length === 0 && (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {displayText}
                </p>
              )}
              {message.translating && <span className="text-xs opacity-60 ml-1">翻译中...</span>}
            </>
          )}
        </div>

        {/* Action Buttons - always visible */}
        {!message.editing && (
          <div className={`flex items-center gap-1 px-2 pb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <button onClick={onFlip} title="翻转" className={`p-1 rounded hover:bg-black/10 transition-colors ${isUser ? 'text-pink-200 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}>
              <IconFlip className="w-3 h-3" />
            </button>
            <button onClick={onCopy} title="复制" className={`p-1 rounded hover:bg-black/10 transition-colors ${isUser ? 'text-pink-200 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}>
              <IconCopy className="w-3 h-3" />
            </button>
            <button onClick={onEdit} title="编辑" className={`p-1 rounded hover:bg-black/10 transition-colors ${isUser ? 'text-pink-200 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}>
              <IconEdit className="w-3 h-3" />
            </button>
            <button onClick={handleOpenPicker} title="标记为指令" className={`p-1 rounded hover:bg-black/10 transition-colors ${isUser ? 'text-pink-200 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}>
              <IconBook className="w-3 h-3" />
            </button>
            <button onClick={onDelete} title="删除此条及之后" className={`p-1 rounded hover:bg-black/10 transition-colors ${isUser ? 'text-pink-200 hover:text-red-300' : 'text-gray-400 hover:text-red-400'}`}>
              <IconTrash className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
