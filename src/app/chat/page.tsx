'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconBack, IconPen, IconBrain, IconCopy, IconFlip, IconRefresh, IconLock, IconSend, IconStop, IconTrash, IconEdit, IconKey, IconBook, IconCheck, IconPlot, IconChevronUp, IconChevronDown } from '@/components/icons';
import { copyToClipboard } from '@/lib/utils';
import type { PlotData } from '@/lib/types';

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
  longTermMemory: string;
  personMode: 'first' | 'third';
  thinkingEnabled: boolean;
  plotData?: PlotData;
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
  return (
    <Suspense fallback={<div className="h-[100dvh] bg-jai-bg flex items-center justify-center"><span className="text-jai-text-secondary text-sm">加载中...</span></div>}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
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



  // Feature states


  const [expandLoading, setExpandLoading] = useState(false);
  const [showExpandModal, setShowExpandModal] = useState(false);
  const [expandBrief, setExpandBrief] = useState('');
  const [expandResult, setExpandResult] = useState<{ en: string; cn: string } | null>(null);
  const [expandFlipped, setExpandFlipped] = useState(false);
  const [expandTranslating, setExpandTranslating] = useState(false);

  const [memoryLoading, setMemoryLoading] = useState(false);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [memoryResult, setMemoryResult] = useState<{ en: string; cn: string } | null>(null);
  const [memoryFlipped, setMemoryFlipped] = useState(false);
  const [thinkingContent, setThinkingContent] = useState('');

  // Plot Assistant states
  const [showPlotPanel, setShowPlotPanel] = useState(false);

  // Memory update tracking
  const [lastMemoryCount, setLastMemoryCount] = useState(0);
  const [showMemoryReminder, setShowMemoryReminder] = useState(false);
  const [memoryAutoGenerating, setMemoryAutoGenerating] = useState(false);

  // Main storyline summary (shown in plot panel, from AI analysis)
  const [currentMainLine, setCurrentMainLine] = useState('');
  const [currentMainLineCn, setCurrentMainLineCn] = useState('');
  const [progressDesc, setProgressDesc] = useState('');
  const [progressDescCn, setProgressDescCn] = useState('');

  // AI analysis state
  const [plotAnalyzeLoading, setPlotAnalyzeLoading] = useState(false);

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



  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);


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
      // Restore messages with runtime defaults, preserve chineseTranslation from storage
      const restored = saved.map((m: { id?: string; role?: string; content?: string; chineseTranslation?: string; timestamp?: number }) => ({
        id: m.id || '',
        role: (m.role === 'bot' ? 'bot' : m.role) as 'user' | 'bot',
        content: m.content || '',
        chineseTranslation: m.chineseTranslation,
        translated: !!m.chineseTranslation,
        translating: false,
        flipped: false,
        editing: false,
        timestamp: m.timestamp || 0,
      }));
      // Always ensure greeting is the first message
      if (greetingMsg && restored[0]?.id !== greetingMsg.id) {
        setMessages([greetingMsg, ...restored]);
      } else {
        setMessages(restored);
      }
    } else if (greetingMsg) {
      setMessages([greetingMsg]);
    } else {
      setMessages([]);
    }
  }, [currentPresetId, presets]);

  // Load personMode, thinkingEnabled, and plotData from preset
  useEffect(() => {
    if (!currentPresetId) return;
    const preset = presets.find(p => p.id === currentPresetId);
    if (preset) {
      setPersonMode(preset.personMode || 'third');
      setThinkingEnabled(preset.thinkingEnabled || false);
      // Restore plotData from preset
      if (preset.plotData) {
        const pd = preset.plotData;
        if (pd.currentMainLine) setCurrentMainLine(pd.currentMainLine);
        if (pd.currentMainLineCn) setCurrentMainLineCn(pd.currentMainLineCn);
        if (pd.progressDesc) setProgressDesc(pd.progressDesc);
        if (pd.progressDescCn) setProgressDescCn(pd.progressDescCn);
        if (pd.lastMemoryCount !== undefined) setLastMemoryCount(pd.lastMemoryCount);

      }
    }
  }, [currentPresetId]);

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

  const RECENT_MESSAGES_LIMIT = 20;

  const buildChatHistory = useCallback(() => {
    // Strategy: long-term memory summary + recent N messages
    const ltm = currentPreset?.longTermMemory;
    const recent = messages.slice(-RECENT_MESSAGES_LIMIT);
    let history = '';
    if (ltm && messages.length > RECENT_MESSAGES_LIMIT) {
      history += `[Long-term Memory Summary]\n${ltm}\n\n[Recent Conversation]\n`;
    }
    history += recent.map(m => `${m.role === 'user' ? 'User' : 'Char'}: ${m.content}`).join('\n');
    return history;
  }, [messages, currentPreset?.longTermMemory]);

  const buildChatHistoryForMemory = useCallback(() => {
    // Memory/inspiration/expand strip instructions — they shouldn't affect these
    const ltm = currentPreset?.longTermMemory;
    const recent = messages.slice(-RECENT_MESSAGES_LIMIT);
    let history = '';
    if (ltm && messages.length > RECENT_MESSAGES_LIMIT) {
      history += `[Long-term Memory Summary]\n${ltm}\n\n[Recent Conversation]\n`;
    }
    history += recent.map(m => `${m.role === 'user' ? 'User' : 'Char'}: ${stripInstructions(m.content)}`).join('\n');
    return history;
  }, [messages, currentPreset?.longTermMemory]);

  const buildMainLinePrompt = useCallback(() => {
    if (!currentMainLine.trim()) return '';
    return `\n\n[主线指令 - 扩写必须向此方向靠拢]\n[主线概括: ${currentMainLine}]\n所有后续生成的扩写内容都应推动剧情向主线方向发展。`;
  }, [currentMainLine]);

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

        // Build context: surrounding messages for better translation accuracy
        const msgIndex = messages.findIndex(m => m.id === id);
        const contextStart = Math.max(0, msgIndex - 2);
        const contextEnd = Math.min(messages.length, msgIndex + 3); // +3 to include the message itself and 2 after
        const contextMessages = messages.slice(contextStart, contextEnd)
          .map(m => `${m.role === 'user' ? '{{user}}' : '{{char}}'}: ${m.content}`)
          .join('\n');

        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: msg.content, apiKey, thinkingEnabled, context: contextMessages })
        });
        if (!res.ok) throw new Error('Translation failed');
        const data = await res.json();
        const translation = data.translation || '';
        if (data.reasoning) setThinkingContent(data.reasoning);

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
  const handleExpand = async () => {
    if (!expandBrief.trim() || !currentPreset) return;
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setExpandLoading(true);
    setExpandResult(null);
    setExpandFlipped(false);
    setThinkingContent('');

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
          mainLinePrompt: buildMainLinePrompt(),
          thinkingEnabled
        })
      });

      if (!res.ok) throw new Error('扩写失败');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      let fullText = '';
      let reasoning = '';
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
              if (parsed.reasoning) reasoning += parsed.reasoning;
            } catch { /* skip */ }
          }
        }
      }

      if (reasoning) setThinkingContent(reasoning);
      setExpandResult({ en: fullText.trim(), cn: '' });
    } catch {
      showNotification('扩写失败');
    } finally {
      setExpandLoading(false);
    }
  };

  const handleExpandFlip = async () => {
    if (expandTranslating || expandLoading) return;
    if (!expandFlipped && expandResult && !expandResult.cn && expandResult.en) {
      // Need to translate before flipping to Chinese
      setExpandTranslating(true);
      try {
        const apiKey = localStorage.getItem('jai_api_key');
        if (!apiKey) return;
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: expandResult.en, apiKey, thinkingEnabled }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.translation) {
            setExpandResult(prev => prev ? { ...prev, cn: data.translation } : prev);
          }
        }
      } catch { /* ignore */ }
      setExpandTranslating(false);
    }
    setExpandFlipped(prev => !prev);
  };

  const handleMemory = async () => {
    if (!currentPreset) { showNotification('请选择预设'); return; }
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setMemoryLoading(true);
    setMemoryResult(null);
    setMemoryFlipped(false);
    setThinkingContent('');
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
          apiKey,
          mainLinePrompt: buildMainLinePrompt(),
          thinkingEnabled
        })
      });

      if (!res.ok) throw new Error('记忆生成失败');
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No reader');

      let fullText = '';
      let reasoning = '';
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
              if (parsed.reasoning) reasoning += parsed.reasoning;
            } catch { /* skip */ }
          }
        }
      }

      if (reasoning) setThinkingContent(reasoning);
      const parts = fullText.split(/===\s*CHINESE\s*===/);
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
    setLastMemoryCount(messages.length);
    setShowMemoryReminder(false);
    showNotification('记忆已写入预设');
  };

  // ========== Plot Assistant ==========
  const handlePlotAnalyze = async () => {
    if (!currentPreset) { showNotification('请选择预设'); return; }
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) { showNotification('请先配置 API Key'); return; }

    setPlotAnalyzeLoading(true);
    setThinkingContent('');

    try {
      const res = await fetch('/api/plot-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistory: buildChatHistoryForMemory(),
          apiKey,
          thinkingEnabled
        })
      });

      if (!res.ok) throw new Error('分析失败');
      const data = await res.json();

      if (data.reasoning) setThinkingContent(data.reasoning);

      // Fill in AI-generated main line info
      if (data.mainLineName) {
        setCurrentMainLine(data.mainLineName);
        setCurrentMainLineCn(data.mainLineNameCn || '');
      }
      if (data.progressDesc) {
        setProgressDesc(data.progressDesc);
        setProgressDescCn(data.progressDescCn || '');
      }

      showNotification('AI 已概括主线剧情');
    } catch {
      showNotification('剧情分析失败');
    } finally {
      setPlotAnalyzeLoading(false);
    }
  };

  // Auto-save all plot data to preset
  const autoSavePlotData = () => {
    if (!currentPresetId) return;
    const preset = presets.find(p => p.id === currentPresetId);
    if (!preset) return;
    const plotData: PlotData = {
      currentMainLine,
      currentMainLineCn,
      progressDesc,
      progressDescCn,
      lastMemoryCount,
    };
    const updated = { ...preset, plotData };
    updatePreset(updated);
    setPresets(prev => prev.map(p => p.id === currentPresetId ? updated : p));
  };

  // Debounced auto-save on any plot data change
  useEffect(() => {
    if (!currentPresetId) return;
    const timer = setTimeout(() => {
      autoSavePlotData();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMainLine, currentMainLineCn, progressDesc, progressDescCn, lastMemoryCount]);

  const handleBackToPresets = () => {
    if (currentPresetId) {
      const preset = presets.find(p => p.id === currentPresetId);
      if (preset) {
        saveSession(currentPresetId, messages, preset.longTermMemory);
      }
    }
    showNotification('会话已保存');
    setTimeout(() => router.push('/presets'), 500);
  };

  // ========== Render ==========
  if (presets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-jai-bg/50 px-4">
        <p className="text-jai-text-secondary mb-4">暂无预设，请先生成 User 卡并保存</p>
        <button onClick={() => router.push('/')} className="px-4 py-2 bg-jai-secondary/60 text-jai-btn-text rounded-lg hover:bg-jai-secondary/80">
          去生成
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-0 right-0 bottom-0 left-0 md:left-16 lg:left-52 flex flex-col bg-jai-bg/50 z-30">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 bg-jai-card/80 backdrop-blur-sm border-b border-jai-card-border">
        <button onClick={handleBackToPresets} className="p-1.5 md:p-1 text-jai-secondary hover:text-jai-accent transition-colors">
          <IconBack className="w-5 h-5" />
        </button>
        <select
          value={currentPresetId}
          onChange={e => setCurrentPresetId(e.target.value)}
          className="flex-1 text-sm font-medium bg-transparent border-none focus:outline-none text-jai-text"
        >
          {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Plot summary indicator - fixed above scroll area */}
      {currentMainLine && (
        <div className="flex justify-end px-3 md:px-4 pt-1 pb-0.5" onClick={() => setShowInstructionPicker(false)}>
          <button
            onClick={() => setShowPlotPanel(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-jai-muted/90 border border-jai-secondary/60 text-jai-accent hover:bg-jai-muted transition-colors text-[11px] max-w-[95%] md:max-w-[80%]"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
            <span className="truncate">{currentMainLineCn || currentMainLine}</span>
          </button>
        </div>
      )}

      {/* Chat Messages - scrollable */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 py-3 md:px-4 space-y-3" onClick={() => setShowInstructionPicker(false)}>
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


      {/* Plot Assistant Panel */}
      {showPlotPanel && (
        <div className="fixed inset-0 z-50 md:relative md:z-auto flex items-end md:items-start justify-center bg-black/30 md:bg-transparent" onClick={() => setShowPlotPanel(false)}>
          <div className="bg-jai-card md:bg-jai-card rounded-t-2xl md:rounded-xl border-t md:border border-jai-card-border md:border-jai-card-border shadow-sm w-full md:mx-4 md:mb-2 max-h-[90vh] md:max-h-[55vh] overflow-hidden md:shadow-sm" onClick={e => e.stopPropagation()}>
            {/* Panel Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-jai-muted/50 border-b border-jai-card-border sticky top-0 z-10">
              <span className="text-xs font-medium text-jai-accent flex items-center gap-1">
                <IconPlot className="w-3.5 h-3.5" /> 剧情助手
              </span>
              <button onClick={() => setShowPlotPanel(false)} className="p-1 text-jai-text-secondary hover:text-jai-text text-xs">✕</button>
            </div>

          <div className="p-3 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 44px)' }}>
            {/* AI Summary */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-jai-text-secondary uppercase tracking-wide">剧情概括</span>
                <button
                  onClick={handlePlotAnalyze}
                  disabled={plotAnalyzeLoading}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg bg-jai-secondary/70 text-jai-btn-text hover:bg-jai-secondary disabled:opacity-50 transition-colors"
                >
                  <IconRefresh className={`w-3 h-3 ${plotAnalyzeLoading ? 'animate-spin' : ''}`} />
                  {plotAnalyzeLoading ? '概括中...' : '重新概括'}
                </button>
              </div>
              {currentMainLine ? (
                <div className="p-2.5 rounded-lg border bg-jai-muted/50 border-jai-secondary">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-jai-accent">{currentMainLine}</span>
                  </div>
                  {currentMainLineCn && (
                    <p className="text-[11px] text-jai-text-secondary mt-1">{currentMainLineCn}</p>
                  )}
                  {(progressDesc || progressDescCn) && (
                    <div className="mt-2 pt-2 border-t border-jai-card-border">
                      {progressDesc && <p className="text-[11px] text-jai-text-secondary">{progressDesc}</p>}
                      {progressDescCn && <p className="text-[11px] text-jai-text-secondary mt-1">{progressDescCn}</p>}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-jai-text-secondary">点击"重新概括"按钮，AI 将自动分析当前剧情主线</p>
              )}
              {thinkingContent && (
                <div className="mt-2 border border-jai-thinking/50 bg-jai-thinking/10 rounded-lg p-2">
                  <div className="text-[11px] font-medium text-jai-thinking mb-1 flex items-center gap-1">
                    <IconBrain className="w-3 h-3" /> 思考过程
                  </div>
                  <div className="text-[10px] text-jai-thinking/80 leading-relaxed whitespace-pre-wrap max-h-[120px] overflow-y-auto">{thinkingContent}</div>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Expand Modal */}
      {showExpandModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-jai-card rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-jai-accent flex items-center gap-1.5">
                  <IconPen className="w-4 h-4" /> 扩写
                </span>
                <button onClick={() => { setShowExpandModal(false); setExpandResult(null); setExpandBrief(''); }} className="text-jai-text-secondary hover:text-jai-text">✕</button>
              </div>

              {!expandResult && !expandLoading ? (
                <div className="space-y-3">
                  <textarea
                    value={expandBrief}
                    onChange={e => setExpandBrief(e.target.value)}
                    placeholder="输入简短梗概..."
                    className="w-full text-sm p-3 rounded-xl border border-jai-card-border focus:border-jai-accent focus:outline-none resize-none min-h-[80px]"
                    rows={3}
                  />
                  <button
                    onClick={handleExpand}
                    disabled={!expandBrief.trim()}
                    className="w-full py-2 text-sm bg-jai-secondary/60 text-jai-btn-text rounded-xl hover:bg-jai-secondary/80 disabled:opacity-50 transition-colors"
                  >
                    扩写
                  </button>
                </div>
              ) : expandLoading && !expandResult ? (
                <div className="flex items-center justify-center py-8 text-sm text-jai-secondary">
                  <IconRefresh className="w-4 h-4 animate-spin mr-2" /> 生成中...
                </div>
              ) : expandResult ? (
                <div className="space-y-3">
                  {thinkingContent && (
                    <div className="border border-jai-thinking/50 bg-jai-thinking/10 rounded-lg p-2.5">
                      <div className="text-xs font-medium text-jai-thinking mb-1.5 flex items-center gap-1">
                        <IconBrain className="w-3 h-3" /> 思考过程
                      </div>
                      <div className="text-xs text-jai-thinking/80 leading-relaxed whitespace-pre-wrap max-h-[150px] overflow-y-auto">{thinkingContent}</div>
                    </div>
                  )}
                  <div className="p-3 rounded-xl bg-jai-bg/50 border border-jai-card-border">
                    <p className="text-sm whitespace-pre-wrap">{expandFlipped && !expandResult.cn ? (
                      <div className="text-center py-4 space-y-2">
                        <p className="text-sm text-jai-text-secondary">中文翻译未生成</p>
                        <button
                          onClick={async () => {
                            const apiKey = localStorage.getItem('jai_api_key');
                            if (!apiKey) { showNotification('请先配置 API Key'); return; }
                            try {
                              const res = await fetch('/api/translate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ text: expandResult.en, apiKey, thinkingEnabled })
                              });
                              if (!res.ok) throw new Error();
                              const data = await res.json();
                              if (data.translation) {
                                setExpandResult(prev => prev ? { ...prev, cn: data.translation } : null);
                              }
                            } catch {
                              showNotification('翻译失败');
                            }
                          }}
                          className="px-3 py-1.5 text-xs rounded-lg bg-jai-secondary/60 text-jai-btn-text hover:bg-jai-secondary/80 transition-colors"
                        >
                          重新翻译
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{expandFlipped ? expandResult.cn : expandResult.en}</p>
                    )}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyContent(expandResult.en)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border">
                      <IconCopy className="w-3 h-3" /> 复制英文
                    </button>
                    <button onClick={handleExpandFlip} disabled={expandTranslating} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border disabled:opacity-50">
                      <IconFlip className="w-3 h-3" /> {expandTranslating ? '翻译中...' : expandFlipped ? '英文' : '中文'}
                    </button>
                    <button onClick={handleExpand} disabled={expandLoading} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border disabled:opacity-50">
                      <IconRefresh className="w-3 h-3" /> 重新生成
                    </button>
                    <button onClick={() => { setExpandResult(null); setThinkingContent(''); }} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border">
                      <IconEdit className="w-3 h-3" /> 重新编辑
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Memory Modal */}
      {showMemoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-jai-card rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-jai-thinking flex items-center gap-1.5">
                  <IconBrain className="w-4 h-4" /> 长期记忆
                </span>
                <button onClick={() => { setShowMemoryModal(false); setMemoryResult(null); }} className="text-jai-text-secondary hover:text-jai-text">✕</button>
              </div>

              {memoryLoading ? (
                <p className="text-sm text-jai-text-secondary animate-pulse">生成中...</p>
              ) : memoryResult ? (
                <div className="space-y-3">
                  {thinkingContent && (
                    <div className="border border-jai-thinking/50 bg-jai-thinking/10 rounded-lg p-2.5">
                      <div className="text-xs font-medium text-jai-thinking mb-1.5 flex items-center gap-1">
                        <IconBrain className="w-3 h-3" /> 思考过程
                      </div>
                      <div className="text-xs text-jai-thinking/80 leading-relaxed whitespace-pre-wrap max-h-[150px] overflow-y-auto">{thinkingContent}</div>
                    </div>
                  )}
                  <div className="p-3 rounded-xl bg-jai-thinking/10 border border-jai-thinking/30">
                    <p className="text-sm whitespace-pre-wrap">{memoryFlipped && !memoryResult.cn ? (
                      <div className="text-center py-4 space-y-2">
                        <p className="text-sm text-jai-text-secondary">中文翻译未生成</p>
                        <button
                          onClick={async () => {
                            const apiKey = localStorage.getItem('jai_api_key');
                            if (!apiKey) { showNotification('请先配置 API Key'); return; }
                            try {
                              const res = await fetch('/api/translate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ text: memoryResult.en, apiKey, thinkingEnabled })
                              });
                              if (!res.ok) throw new Error();
                              const data = await res.json();
                              if (data.translation) {
                                setMemoryResult(prev => prev ? { ...prev, cn: data.translation } : null);
                              }
                            } catch {
                              showNotification('翻译失败');
                            }
                          }}
                          className="px-3 py-1.5 text-xs rounded-lg bg-jai-thinking/10 text-jai-thinking hover:bg-jai-thinking/20 transition-colors"
                        >
                          重新翻译
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{memoryFlipped ? memoryResult.cn : memoryResult.en}</p>
                    )}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => copyContent(memoryResult.en)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-thinking/10 text-jai-thinking hover:bg-jai-thinking/20">
                      <IconCopy className="w-3 h-3" /> 复制英文
                    </button>
                    <button onClick={() => setMemoryFlipped(!memoryFlipped)} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-jai-thinking/10 text-jai-thinking hover:bg-jai-thinking/20">
                      <IconFlip className="w-3 h-3" /> {memoryFlipped ? '英文' : '中文'}
                    </button>
                    <button onClick={saveMemoryToPreset} className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-[#E8F5EF] text-jai-success hover:bg-[#D4EDE2]">
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
      <div className="shrink-0 border-t border-jai-card-border bg-jai-card/90 backdrop-blur-sm px-3 md:px-4 pt-2 pb-2 md:pb-3 space-y-1.5 md:space-y-2 safe-area-bottom">

        {/* Memory Reminder Banner */}
        {showMemoryReminder && !memoryAutoGenerating && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-jai-thinking/10 border border-jai-thinking/50 text-jai-thinking text-xs">
            <IconBrain className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 min-w-0 truncate">距上次记忆已超过 20 轮，建议更新长期记忆</span>
            <button
              onClick={handleMemory}
              disabled={memoryLoading}
              className="px-2 py-0.5 text-[10px] rounded bg-jai-thinking/100 text-white hover:bg-jai-thinking/80 disabled:opacity-50 transition-colors shrink-0"
            >
              立即更新
            </button>
            <button
              onClick={() => setShowMemoryReminder(false)}
              className="text-jai-thinking hover:text-[#8b5cf6] shrink-0"
            >
              ✕
            </button>
          </div>
        )}
        {memoryAutoGenerating && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-jai-thinking/10 border border-jai-thinking/50 text-[#8b5cf6] text-xs animate-pulse">
            <IconBrain className="w-3.5 h-3.5 shrink-0" />
            <span>自动更新长期记忆中...</span>
          </div>
        )}

        {/* Controls Row - unified for mobile & desktop */}
        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
          <select
            value={personMode}
            onChange={e => setPersonMode(e.target.value as 'first' | 'third')}
            className="text-xs px-2 py-1.5 rounded-lg border border-jai-card-border bg-jai-bg/50 text-jai-accent focus:outline-none focus:border-jai-accent"
          >
            <option value="first">第一人称</option>
            <option value="third">第三人称</option>
          </select>
          <button onClick={() => setShowExpandModal(true)} disabled={expandLoading} className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border disabled:opacity-50 transition-colors">
            <IconPen className="w-3 h-3" /> 扩写
          </button>
          <button onClick={handleMemory} disabled={memoryLoading} className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border disabled:opacity-50 transition-colors">
            <IconBrain className="w-3 h-3" /> 记忆
          </button>
          <button
            onClick={() => setShowPlotPanel(!showPlotPanel)}
            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border transition-colors"
          >
            <IconPlot className="w-3 h-3" /> 剧情
          </button>
          <div className="relative" ref={instructionPickerRef}>
            <button
              onClick={() => {
                setInstructionList(getInstructionList());
                setShowInstructionPicker(!showInstructionPicker);
              }}
              className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-accent hover:bg-jai-card-border transition-colors"
            >
              <IconBook className="w-3 h-3" /> 指令
            </button>
            {showInstructionPicker && instructionList.length > 0 && (
              <div className="absolute bottom-full right-0 mb-1 w-56 max-h-48 overflow-y-auto bg-jai-card rounded-xl border border-jai-card-border shadow-lg z-50 py-1">
                {instructionList.map(inst => (
                  <button
                    key={inst.id}
                    onClick={() => {
                      setUserInput(prev => (prev ? prev + '\n' : '') + `【${inst.content}】`);
                      setShowInstructionPicker(false);
                      showNotification(`已插入「${inst.name}」`);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-jai-muted transition-colors"
                  >
                    <p className="text-xs font-medium text-jai-text truncate">{inst.name}</p>
                    <p className="text-[10px] text-jai-text-secondary truncate">{inst.summary}</p>
                  </button>
                ))}
              </div>
            )}
            {showInstructionPicker && instructionList.length === 0 && (
              <div className="absolute bottom-full right-0 mb-1 w-44 bg-jai-card rounded-xl border border-jai-card-border shadow-lg z-50 py-3 px-3">
                <p className="text-xs text-jai-text-secondary">暂无指令</p>
                <p className="text-[10px] text-jai-text-secondary mt-0.5">前往指令库添加</p>
              </div>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-jai-text-secondary cursor-pointer ml-auto">
            <span>思考</span>
            <button
              onClick={() => setThinkingEnabled(!thinkingEnabled)}
              className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${thinkingEnabled ? 'bg-jai-thinking' : 'bg-jai-muted'}`}
            >
              <span className={`inline-block h-3 w-3 transform rounded-full bg-jai-card transition-transform ${thinkingEnabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>

        {/* Input Row */}
        <div className="flex items-end gap-1.5">
          <textarea
            value={jaiInput}
            onChange={e => setJaiInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBotMessage(); } }}
            placeholder="粘贴 Char 回复..."
            className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-jai-card-border bg-jai-input-bg/50 focus:border-jai-accent focus:outline-none placeholder:text-jai-text-secondary min-w-0 resize-none min-h-[30px] max-h-[100px]"
            rows={1}
          />
          <button
            onClick={sendBotMessage}
            disabled={!jaiInput.trim()}
            className="px-2 py-1.5 text-xs bg-jai-secondary/60 text-jai-btn-text rounded-lg hover:bg-jai-secondary/80 disabled:opacity-50 transition-colors shrink-0"
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
            className="flex-1 text-sm p-2.5 md:p-3 rounded-xl border border-jai-card-border focus:border-jai-accent focus:outline-none resize-none min-h-[38px] md:min-h-[40px] max-h-[100px] md:max-h-[120px]"
            rows={1}
          />
          <button
            onClick={sendUserMessage}
            className="p-2.5 md:p-3 rounded-xl bg-jai-secondary/70 text-jai-btn-text hover:bg-jai-secondary transition-colors shrink-0"
          >
            <IconSend className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-jai-text text-white text-sm rounded-lg shadow-lg animate-fade-in">
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
  // Chinese keywords
  '读者弹幕', '上帝弹幕', '全知弹幕',
  '小剧场', '剧情日记', '平行宇宙',
  '阅读笔记', '书名', '性别代称',
  '朋友圈',
  '周程表', '周安排',
  '正在播放',
  '系统备注', '系统级',
  '想做但不敢',
  '随机事件',
  '出戏',
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

  // Split content into paragraphs for the picker
  const paragraphs = message.content.split(/\n\n+/).filter(p => p.trim());
  // Also split translation for display in picker
  const translationParagraphs = message.chineseTranslation ? message.chineseTranslation.split(/\n\n+/).filter(p => p.trim()) : [];

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
          <div className="bg-jai-card rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-jai-card-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-jai-accent flex items-center gap-1.5">
                  <IconBook className="w-4 h-4" /> 标记为指令
                </span>
                <button onClick={() => setShowPicker(false)} className="text-jai-text-secondary hover:text-jai-text">✕</button>
              </div>
              <p className="text-[11px] text-jai-text-secondary mt-1">选择要标记为指令的段落（已自动识别含指令关键词的段落）</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {paragraphs.map((p, idx) => {
                const isSelected = selectedParagraphs.has(idx);
                const isAuto = isInstructionParagraph(p);
                const preview = p.length > 120 ? p.slice(0, 120) + '...' : p;
                const translationPreview = translationParagraphs[idx]
                  ? (translationParagraphs[idx].length > 120 ? translationParagraphs[idx].slice(0, 120) + '...' : translationParagraphs[idx])
                  : null;
                return (
                  <button
                    key={idx}
                    onClick={() => toggleParagraph(idx)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-jai-accent bg-jai-muted'
                        : 'border-jai-card-border bg-jai-muted/50 hover:bg-jai-muted'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? 'border-jai-secondary bg-jai-secondary' : 'border-jai-card-border'
                      }`}>
                        {isSelected && <IconCheck className="w-3 h-3 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-jai-text-secondary whitespace-pre-wrap break-words leading-relaxed">{preview}</p>
                        {translationPreview && (
                          <p className="text-xs text-jai-text whitespace-pre-wrap break-words leading-relaxed mt-0.5">{translationPreview}</p>
                        )}
                        {isAuto && !isSelected && (
                          <span className="inline-block mt-1 text-[9px] text-jai-secondary bg-jai-muted px-1 py-0.5 rounded">建议标记</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="p-3 border-t border-jai-card-border flex items-center justify-between">
              <span className="text-[11px] text-jai-text-secondary">已选 {selectedParagraphs.size} / {paragraphs.length} 段</span>
              <div className="flex gap-2">
                <button onClick={() => setShowPicker(false)} className="px-3 py-1.5 text-xs rounded-lg bg-jai-muted text-jai-text hover:bg-jai-muted">取消</button>
                <button onClick={handleConfirmPicker} className="px-3 py-1.5 text-xs rounded-lg bg-jai-secondary/70 text-jai-btn-text hover:bg-jai-secondary disabled:opacity-50" disabled={selectedParagraphs.size === 0}>
                  确认标记
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-[85%] md:max-w-[80%] rounded-2xl shadow-sm ${
        isUser
          ? 'bg-jai-bubble-user text-jai-bubble-user-text rounded-br-sm'
          : 'bg-jai-bubble text-jai-text border border-jai-card-border rounded-bl-sm'
      }`}>
        {/* Role Label */}
        <div className={`px-3 pt-2 pb-0.5 text-[10px] font-medium ${isUser ? 'text-jai-bubble-user-text/70' : 'text-jai-secondary'}`}>
          {isUser ? 'User' : 'Char'}
        </div>

        {/* Content */}
        <div className="px-3 pb-1">
          {message.editing ? (
            <div className="space-y-1.5">
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className={`w-full text-sm p-2.5 rounded-lg border resize-none min-h-[120px] ${
                  isUser ? 'bg-jai-secondary/30 border-jai-accent text-jai-bubble-user-text placeholder:text-jai-bubble-user-text/50' : 'bg-jai-muted border-jai-secondary text-jai-text'
                } focus:outline-none`}
                rows={5}
              />
              <div className="flex gap-1.5">
                <button onClick={() => onSaveEdit(editContent)} className="text-[10px] px-2 py-0.5 bg-jai-secondary/70 text-jai-btn-text rounded">保存</button>
                <button onClick={onCancelEdit} className="text-[10px] px-2 py-0.5 bg-jai-muted text-jai-text rounded">取消</button>
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
                          ? 'bg-jai-secondary/30 text-jai-muted'
                          : 'bg-jai-muted/80 text-jai-text border border-jai-card-border/50'
                      }`}
                    >
                      <span className={`inline-block text-[9px] font-medium px-1 py-0.5 rounded mb-1 ${
                        isUser ? 'bg-jai-accent/30 text-jai-muted' : 'bg-jai-card-border text-jai-secondary'
                      }`}>
                        指令
                      </span>
                      <span className="ml-1">{inst}</span>
                      {message.chineseTranslation && !message.flipped && (() => {
                        const transParagraphs = message.chineseTranslation.split(/\n\n+/).filter(p => p.trim());
                        const transInst = transParagraphs.find(tp => {
                          const clean = tp.trim().replace(/^【|】$/g, '');
                          return clean.length > 0;
                        });
                        return transInst ? <span className="ml-1 text-jai-text-secondary text-[10px] block mt-0.5">{transInst.replace(/^【|】$/g, '')}</span> : null;
                      })()}
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
          <div className={`flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2 pb-1.5 md:pb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <button onClick={onFlip} disabled={message.translating} title="翻转" className={`p-1.5 md:p-1 rounded hover:bg-black/10 transition-colors disabled:opacity-50 ${isUser ? 'text-jai-bubble-user-text/70 hover:text-jai-bubble-user-text' : 'text-jai-text-secondary hover:text-jai-text'}`}>
              <IconFlip className="w-3 h-3" /> {message.translating ? '...' : ''}
            </button>
            <button onClick={onCopy} title="复制" className={`p-1.5 md:p-1 rounded hover:bg-black/10 transition-colors ${isUser ? 'text-jai-bubble-user-text/70 hover:text-jai-bubble-user-text' : 'text-jai-text-secondary hover:text-jai-text'}`}>
              <IconCopy className="w-3 h-3" />
            </button>
            <button onClick={onEdit} title="编辑" className={`p-1.5 md:p-1 rounded hover:bg-black/10 transition-colors ${isUser ? 'text-jai-bubble-user-text/70 hover:text-jai-bubble-user-text' : 'text-jai-text-secondary hover:text-jai-text'}`}>
              <IconEdit className="w-3 h-3" />
            </button>
            <button onClick={handleOpenPicker} title="标记为指令" className={`p-1.5 md:p-1 rounded hover:bg-black/10 transition-colors ${isUser ? 'text-jai-bubble-user-text/70 hover:text-jai-bubble-user-text' : 'text-jai-text-secondary hover:text-jai-text'}`}>
              <IconBook className="w-3 h-3" />
            </button>
            <button onClick={onDelete} title="删除此条及之后" className={`p-1.5 md:p-1 rounded hover:bg-black/10 transition-colors ${isUser ? 'text-jai-bubble-user-text hover:text-red-300' : 'text-jai-text-secondary hover:text-red-400'}`}>
              <IconTrash className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
