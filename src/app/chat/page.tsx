'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconBack, IconSparkle, IconPen, IconBrain, IconCopy, IconFlip, IconRefresh, IconLock, IconSend, IconStop, IconTrash, IconEdit, IconKey, IconBook, IconCheck } from '@/components/icons';

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
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'bot' as const,
      content,
      translated: false, translating: false, flipped: false, editing: false,
      timestamp: Date.now()
    }]);
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

  const copyContent = (text: string) => {
    navigator.clipboard.writeText(text).then(() => showNotification('已复制'));
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
          personMode
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

      // Parse: output is 3 lines of English, one inspiration per line
      const lines = fullText.split('\n').map(s => s.replace(/^\d+[\.\)]\s*/, '').trim()).filter(s => s.length > 5);
      const parsed = lines.slice(0, 3).map(line => ({
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
          personMode
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

  const handleBackToPresets = () => {
    if (currentPresetId) {
      const preset = presets.find(p => p.id === currentPresetId);
      if (preset) saveSession(currentPresetId, messages, preset.longTermMemory);
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
        <div className="flex items-center justify-between">
          <select
            value={personMode}
            onChange={e => setPersonMode(e.target.value as 'first' | 'third')}
            className="text-xs px-2 py-1 rounded-lg border border-pink-100 bg-pink-50/50 text-pink-600 focus:outline-none focus:border-pink-300"
          >
            <option value="first">第一人称 (I/Me)</option>
            <option value="third">第三人称 (He/She)</option>
          </select>

          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
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
