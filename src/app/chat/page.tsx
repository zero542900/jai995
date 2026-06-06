'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { IconSend, IconStop, IconSparkle, IconPen, IconBrain, IconCopy, IconFlip, IconBack, IconRefresh, IconLock } from '@/components/icons';
import { getPresets, getPreset, updatePreset, getSessions, getSession, createSession, updateSession, deleteSession, getApiKey } from '@/lib/storage';
import type { Preset, Session, ChatMessage } from '@/lib/types';

// Parse dual-language content (English + Chinese separated by ===CHINESE===)
function parseDualContent(raw: string): { english: string; chinese: string } {
  const separator = '===CHINESE===';
  const idx = raw.indexOf(separator);
  if (idx === -1) {
    return { english: raw.trim(), chinese: '' };
  }
  return {
    english: raw.substring(0, idx).trim(),
    chinese: raw.substring(idx + separator.length).trim(),
  };
}

// Parse inspiration into 3 individual items
function parseInspirationItems(raw: string): Array<{ en: string; cn: string }> {
  const { english, chinese } = parseDualContent(raw);
  if (!english) return [];

  // Split English by numbered lines (1. 2. 3.)
  const enLines = english.split(/\n/).filter(l => l.trim());
  const enItems: string[] = [];
  for (const line of enLines) {
    const match = line.match(/^\d+\.\s*([\s\S]*)/);
    if (match) {
      enItems.push(match[1].trim());
    } else if (enItems.length > 0 && enItems.length <= 3) {
      // Continuation of previous item
      enItems[enItems.length - 1] += ' ' + line.trim();
    }
  }

  // Split Chinese similarly
  const cnItems: string[] = [];
  if (chinese) {
    const cnLines = chinese.split(/\n/).filter(l => l.trim());
    for (const line of cnLines) {
      const match = line.match(/^\d+\.\s*([\s\S]*)/);
      if (match) {
        cnItems.push(match[1].trim());
      } else if (cnItems.length > 0 && cnItems.length <= 3) {
        cnItems[cnItems.length - 1] += ' ' + line.trim();
      }
    }
  }

  const items: Array<{ en: string; cn: string }> = [];
  for (let i = 0; i < Math.max(enItems.length, 3); i++) {
    items.push({
      en: enItems[i] || '',
      cn: cnItems[i] || '',
    });
  }
  return items;
}

// Flip Card Component for expand/memory outputs
function FlipCard({ title, icon, rawContent, isLoading, onCopy, onSave, showSave }: {
  title: string;
  icon: React.ReactNode;
  rawContent: string;
  isLoading: boolean;
  onCopy: (text: string) => void;
  onSave?: () => void;
  showSave?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  const { english, chinese } = parseDualContent(rawContent);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(english);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    onCopy(english);
  };

  if (isLoading && !rawContent) {
    return (
      <div className="bg-white rounded-xl border border-pink-100 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <span className="font-medium text-sm text-gray-700">{title}</span>
          <span className="text-xs text-pink-400 animate-pulse">生成中...</span>
        </div>
        <div className="flex items-center gap-1 py-8 justify-center">
          <div className="w-2 h-2 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  if (!rawContent) return null;

  const displayContent = flipped ? english : (chinese || english);
  const label = flipped ? 'English' : (chinese ? '中文翻译' : 'English');

  return (
    <div className="bg-white rounded-xl border border-pink-100 p-4 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm text-gray-700">{title}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-pink-50 text-pink-400">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleCopy} className="p-1.5 rounded-lg hover:bg-pink-50 text-pink-400 transition-colors" title="复制英文">
            <IconCopy className="w-3.5 h-3.5" />
          </button>
          {chinese && (
            <button onClick={() => setFlipped(!flipped)} className="p-1.5 rounded-lg hover:bg-pink-50 text-pink-400 transition-colors" title="翻转查看">
              <IconFlip className="w-3.5 h-3.5" />
            </button>
          )}
          {copied && <span className="text-xs text-emerald-400 ml-1">已复制</span>}
        </div>
      </div>
      <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
        {displayContent}
        {isLoading && <span className="inline-block w-1.5 h-4 bg-pink-400 animate-pulse ml-0.5 align-text-bottom" />}
      </div>
      {showSave && onSave && english && (
        <button
          onClick={onSave}
          className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-500 hover:bg-emerald-100 transition-colors"
        >
          写入预设库
        </button>
      )}
    </div>
  );
}

// Person perspective type
type PersonPerspective = 'first' | 'third';

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetId = searchParams.get('preset');

  const [preset, setPreset] = useState<Preset | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [personMode, setPersonMode] = useState<PersonPerspective>('first');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showFirstTimeTip, setShowFirstTimeTip] = useState(false);
  const [greetingShown, setGreetingShown] = useState(false);
  const [greetingFlipped, setGreetingFlipped] = useState(false);
  const [greetingTranslation, setGreetingTranslation] = useState('');
  const [greetingTranslating, setGreetingTranslating] = useState(false);

  // JAI Translation area
  const [jaiOriginal, setJaiOriginal] = useState('');
  const [jaiTranslation, setJaiTranslation] = useState('');
  const [jaiFlipped, setJaiFlipped] = useState(false);
  const [jaiTranslating, setJaiTranslating] = useState(false);
  const jaiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inspiration / Expand / Memory outputs (dual-language)
  const [inspirationContent, setInspirationContent] = useState('');
  const [inspirationLoading, setInspirationLoading] = useState(false);
  const [expandBrief, setExpandBrief] = useState('');
  const [expandContent, setExpandContent] = useState('');
  const [expandLoading, setExpandLoading] = useState(false);
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryLoading, setMemoryLoading] = useState(false);

  // Modals
  const [showExpandModal, setShowExpandModal] = useState(false);

  // Save status
  const [saveNotice, setSaveNotice] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Show save notice
  const showSaveNotice = (msg: string) => {
    setSaveNotice(msg);
    setTimeout(() => setSaveNotice(''), 2500);
  };

  // Load preset and session
  useEffect(() => {
    const presets = getPresets();
    const sessions = getSessions();

    if (presetId) {
      const p = presets.find(pr => pr.id === presetId);
      if (p) {
        setPreset(p);
        const existingSession = sessions.find(s => s.presetId === p.id);
        if (existingSession) {
          setSession(existingSession);
          setMessages(existingSession.messages);
        } else {
          const newSession = createSession(p.id, p.name);
          setSession(newSession);
          setMessages([]);
        }
      }
    } else if (presets.length > 0) {
      const p = presets[0];
      setPreset(p);
      const existingSession = sessions.find(s => s.presetId === p.id);
      if (existingSession) {
        setSession(existingSession);
        setMessages(existingSession.messages);
      } else {
        const newSession = createSession(p.id, p.name);
        setSession(newSession);
        setMessages([]);
      }
    }

    if (!localStorage.getItem('jai_chat_tip_shown')) {
      setShowFirstTimeTip(true);
    }
  }, [presetId]);

  // Show greeting as first message if new session
  useEffect(() => {
    if (preset && session && messages.length === 0 && !greetingShown && preset.greeting) {
      let greeting = preset.greeting;
      // Replace common placeholders
      greeting = greeting.replace(/\{\{char\}\}/gi, 'Char');
      greeting = greeting.replace(/\{\{user\}\}/gi, 'User');
      greeting = greeting.replace(/\{\{Char\}\}/g, 'Char');
      greeting = greeting.replace(/\{\{User\}\}/g, 'User');

      const greetingMsg: ChatMessage = {
        id: 'greeting-' + Date.now(),
        role: 'system',
        content: greeting,
        timestamp: Date.now(),
      };
      setMessages([greetingMsg]);
      updateSession(session.id, { messages: [greetingMsg] });
      setGreetingShown(true);
    }
  }, [preset, session, messages.length, greetingShown]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, inspirationContent, expandContent, memoryContent]);

  // Auto-save on unmount / page leave
  useEffect(() => {
    const handleSave = () => {
      if (session && preset) {
        updateSession(session.id, { messages });
        if (memoryContent) {
          const memParsed = parseDualContent(memoryContent);
          updatePreset(preset.id, { longTermMemory: memParsed.english });
        }
      }
    };
    window.addEventListener('beforeunload', handleSave);
    return () => {
      handleSave();
      window.removeEventListener('beforeunload', handleSave);
    };
  }, [session, preset, messages, memoryContent]);

  // JAI Translation - debounced auto-translate
  const translateJAI = useCallback(async (text: string) => {
    if (!text.trim()) {
      setJaiTranslation('');
      return;
    }
    const apiKey = getApiKey();
    if (!apiKey) return;

    setJaiTranslating(true);
    setJaiTranslation('');
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, apiKey }),
      });
      if (!res.ok) throw new Error('Translation failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let result = '';
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                result += parsed.content;
                setJaiTranslation(result);
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (e) {
      console.error('Translation error:', e);
    } finally {
      setJaiTranslating(false);
    }
  }, []);

  const handleJAIInput = (text: string) => {
    setJaiOriginal(text);
    setJaiFlipped(false);
    setJaiTranslation('');
    if (jaiDebounceRef.current) clearTimeout(jaiDebounceRef.current);
  };

  // Greeting flip handler - translate on first flip
  const handleGreetingFlip = useCallback(async () => {
    if (greetingFlipped) {
      setGreetingFlipped(false);
      return;
    }
    // Flipping to translation side
    if (!greetingTranslation && messages.length > 0 && messages[0].role === 'system') {
      const originalText = messages[0].content;
      const key = getApiKey();
      if (originalText && key) {
        setGreetingTranslating(true);
        try {
          const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: originalText, apiKey: key }),
          });
          if (!res.ok) throw new Error('Translation failed');
          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let result = '';
          while (reader) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') break;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    result += parsed.content;
                    setGreetingTranslation(result);
                  }
                } catch { /* skip */ }
              }
            }
          }
        } catch (e) {
          console.error('Greeting translation error:', e);
        } finally {
          setGreetingTranslating(false);
        }
      }
    }
    setGreetingFlipped(true);
  }, [greetingFlipped, greetingTranslation, messages]);

  // Build chat history string for AI context
  const buildChatHistory = useCallback(() => {
    const recent = messages.slice(-10);
    let history = recent.map(m => `${m.role === 'user' ? 'User' : m.role === 'system' ? 'Scene' : 'Assistant'}: ${m.content}`).join('\n');
    if (jaiOriginal.trim()) {
      history += `\n\n[Latest JAI Reply - Char's response]:\n${jaiOriginal}`;
    }
    return history || '(This is the beginning of the story)';
  }, [messages, jaiOriginal]);

  // Person mode instruction
  const personInstruction = personMode === 'first'
    ? 'Write from the FIRST PERSON perspective (I / me / my).'
    : 'Write from the THIRD PERSON perspective (he / she / they).';

  // Send message
  const handleSend = async () => {
    if (!inputText.trim() || isGenerating || !preset) return;
    const apiKey = getApiKey();
    if (!apiKey) { alert('请先在设置页面配置 API Key'); return; }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputText('');
    setIsGenerating(true);

    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    abortRef.current = new AbortController();

    try {
      const systemPrompt = `You are a roleplay partner. Stay in character based on the context below.

CHARACTER (Char):
${preset.charInfo}

USER PERSONA:
${preset.userCard}

${preset.greeting ? `OPENING SCENE:\n${preset.greeting}\n` : ''}
${preset.longTermMemory ? `LONG-TERM MEMORY:\n${preset.longTermMemory}\n` : ''}
${preset.plotDirection ? `CURRENT PLOT DIRECTION:\n${preset.plotDirection}\n` : ''}

PERSPECTIVE: ${personInstruction}

Always read the recent 5-10 messages for context before responding. If there is a "Latest JAI Reply" in the context, treat it as Char's most recent action/dialogue — respond naturally to it from the User's perspective.`;

      const chatMsgs = newMessages.map(m => ({ role: m.role, content: m.content }));
      if (jaiOriginal.trim()) {
        chatMsgs.push({ role: 'user', content: `[Latest JAI Reply - Char's response]:\n${jaiOriginal}\n\nBased on the above, respond as the User. ${personInstruction}` });
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMsgs,
          apiKey,
          thinkingEnabled,
          systemPrompt,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error('Chat request failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let thinkingContent = '';

      setMessages([...newMessages, assistantMsg]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'thinking' && parsed.content) {
                thinkingContent += parsed.content;
              } else if (parsed.content) {
                fullContent += parsed.content;
              }
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...assistantMsg,
                  content: fullContent,
                  thinking: thinkingContent || undefined,
                };
                return updated;
              });
            } catch { /* skip */ }
          }
        }
      }

      if (session) {
        const finalMessages = [...newMessages, { ...assistantMsg, content: fullContent, thinking: thinkingContent || undefined }];
        updateSession(session.id, { messages: finalMessages });
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        console.error('Chat error:', e);
      }
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  // Inspiration
  const handleInspiration = async () => {
    if (inspirationLoading || !preset) return;
    const apiKey = getApiKey();
    if (!apiKey) { alert('请先在设置页面配置 API Key'); return; }

    setInspirationContent('');
    setInspirationLoading(true);

    try {
      const res = await fetch('/api/inspiration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charInfo: preset.charInfo,
          userCard: preset.userCard,
          userPersonality: preset.userPersonality,
          plotDirection: preset.plotDirection,
          chatHistory: buildChatHistory(),
          longTermMemory: preset.longTermMemory,
          personMode,
          apiKey,
        }),
      });

      if (!res.ok) throw new Error('Inspiration request failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let result = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                result += parsed.content;
                setInspirationContent(result);
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (e) {
      console.error('Inspiration error:', e);
    } finally {
      setInspirationLoading(false);
    }
  };

  // Expand
  const handleExpand = async () => {
    if (expandLoading || !expandBrief.trim() || !preset) return;
    const apiKey = getApiKey();
    if (!apiKey) { alert('请先在设置页面配置 API Key'); return; }

    setExpandContent('');
    setExpandLoading(true);
    setShowExpandModal(false);

    try {
      const res = await fetch('/api/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: expandBrief,
          charInfo: preset.charInfo,
          userCard: preset.userCard,
          userPersonality: preset.userPersonality,
          plotDirection: preset.plotDirection,
          chatHistory: buildChatHistory(),
          longTermMemory: preset.longTermMemory,
          personMode,
          apiKey,
        }),
      });

      if (!res.ok) throw new Error('Expand request failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let result = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                result += parsed.content;
                setExpandContent(result);
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (e) {
      console.error('Expand error:', e);
    } finally {
      setExpandLoading(false);
    }
  };

  // Memory
  const handleMemory = async () => {
    if (memoryLoading || !preset) return;
    const apiKey = getApiKey();
    if (!apiKey) { alert('请先在设置页面配置 API Key'); return; }

    setMemoryContent('');
    setMemoryLoading(true);

    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charInfo: preset.charInfo,
          userCard: preset.userCard,
          chatHistory: buildChatHistory(),
          longTermMemory: preset.longTermMemory,
          apiKey,
        }),
      });

      if (!res.ok) throw new Error('Memory request failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let result = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                result += parsed.content;
                setMemoryContent(result);
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (e) {
      console.error('Memory error:', e);
    } finally {
      setMemoryLoading(false);
    }
  };

  // Save memory to preset
  const handleSaveMemory = () => {
    if (preset && memoryContent) {
      const memParsed = parseDualContent(memoryContent);
      updatePreset(preset.id, { longTermMemory: memParsed.english });
      setPreset({ ...preset, longTermMemory: memParsed.english });
      showSaveNotice('记忆已保存');
    }
  };

  // Go back to presets (auto-save)
  const handleGoBack = () => {
    if (session) {
      updateSession(session.id, { messages });
    }
    if (preset && memoryContent) {
      const memParsed = parseDualContent(memoryContent);
      updatePreset(preset.id, { longTermMemory: memParsed.english });
    }
    showSaveNotice('会话已关闭，记忆已保存');
    setTimeout(() => router.push('/presets'), 500);
  };

  // Copy text helper
  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  // Inspiration items
  const inspirationItems = inspirationContent ? parseInspirationItems(inspirationContent) : [];

  if (!preset) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-gray-500 mb-4">请先在预设库中创建预设</p>
          <button onClick={() => router.push('/presets')} className="px-4 py-2 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition-colors">
            前往预设库
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* Save notice */}
      {saveNotice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-50 text-emerald-600 text-sm rounded-xl border border-emerald-200 shadow-sm animate-fade-in">
          {saveNotice}
        </div>
      )}

      {/* Header - minimal */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-pink-100 bg-white/80 backdrop-blur-sm shrink-0">
        <button onClick={handleGoBack} className="p-1.5 rounded-lg hover:bg-pink-50 text-pink-400 transition-colors" title="返回预设库（自动保存）">
          <IconBack className="w-4 h-4" />
        </button>
        <span className="font-medium text-sm text-gray-800 truncate max-w-[200px]">{preset.name}</span>
      </div>

      {/* First time tip */}
      {showFirstTimeTip && (
        <div className="px-4 py-2 bg-pink-50 border-b border-pink-100 text-xs text-pink-600 flex items-center justify-between shrink-0">
          <span>每个预设只允许一个会话。切换预设时，当前会话的长期记忆会自动保存。</span>
          <button onClick={() => { setShowFirstTimeTip(false); localStorage.setItem('jai_chat_tip_shown', '1'); }} className="text-pink-400 hover:text-pink-600 ml-2 shrink-0">知道了</button>
        </div>
      )}

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* JAI Translation result in chat - only show latest */}
        {jaiOriginal.trim() && (
          <div className="flex justify-start">
            <div className="max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5 bg-blue-50 border border-blue-100 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-blue-400">Char 回复</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => copyText(jaiOriginal)} className="text-xs text-blue-300 hover:text-blue-500 transition-colors flex items-center gap-0.5">
                    <IconCopy className="w-3 h-3" /> 英
                  </button>
                  {jaiTranslation && (
                    <button onClick={() => copyText(jaiTranslation)} className="text-xs text-blue-300 hover:text-blue-500 transition-colors flex items-center gap-0.5">
                      <IconCopy className="w-3 h-3" /> 中
                    </button>
                  )}
                  <button onClick={() => setJaiFlipped(!jaiFlipped)} className="text-xs text-blue-400 hover:text-blue-600 transition-colors flex items-center gap-1">
                    <IconFlip className="w-3 h-3" />
                    {jaiFlipped ? '英文' : '中文'}
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {jaiFlipped ? jaiOriginal : (jaiTranslation || jaiOriginal)}
                {jaiTranslating && <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-text-bottom" />}
                {!jaiTranslation && !jaiTranslating && jaiOriginal}
              </div>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}>
            <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-pink-500 text-white'
                : msg.role === 'system'
                ? 'bg-amber-50 border border-amber-100 text-amber-800 text-xs italic'
                : 'bg-white border border-pink-100 text-gray-800 shadow-sm'
            }`}>
              {msg.thinking && (
                <div className="mb-2 p-2 rounded-lg bg-violet-50 border border-violet-100 text-xs text-violet-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                  <span className="font-medium">思考过程</span>
                  {'\n'}{msg.thinking}
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.role === 'system' && (
                <div className="mt-2 pt-2 border-t border-amber-200/50">
                  <button
                    onClick={handleGreetingFlip}
                    disabled={greetingTranslating}
                    className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-600 transition-colors"
                  >
                    <IconFlip className="w-3.5 h-3.5" />
                    {greetingTranslating ? '翻译中...' : greetingFlipped ? '查看原文' : '查看中文翻译'}
                  </button>
                  {greetingFlipped && greetingTranslation && (
                    <div className="mt-2 text-xs text-amber-700 whitespace-pre-wrap leading-relaxed border-t border-amber-200/50 pt-2">
                      {greetingTranslation}
                    </div>
                  )}
                </div>
              )}
              {msg.role === 'assistant' && msg.content && (
                <button
                  onClick={() => copyText(msg.content)}
                  className="mt-1 text-xs text-pink-300 hover:text-pink-400 transition-colors"
                >
                  复制
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Inspiration Items - 3 individual options */}
        {(inspirationContent || inspirationLoading) && (
          <div className="bg-white rounded-xl border border-pink-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <IconSparkle className="w-4 h-4 text-pink-400" />
                <span className="font-medium text-sm text-gray-700">灵感</span>
                {inspirationLoading && <span className="text-xs text-pink-400 animate-pulse">生成中...</span>}
              </div>
              <button
                onClick={handleInspiration}
                disabled={inspirationLoading}
                className="p-1.5 rounded-lg hover:bg-pink-50 text-pink-400 transition-colors disabled:opacity-30"
                title="刷新灵感"
              >
                <IconRefresh className="w-3.5 h-3.5" />
              </button>
            </div>
            {inspirationLoading && !inspirationContent ? (
              <div className="flex items-center gap-1 py-6 justify-center">
                <div className="w-2 h-2 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-pink-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            ) : (
              <div className="space-y-2">
                {inspirationItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="group relative p-3 rounded-lg bg-pink-50/50 hover:bg-pink-50 border border-pink-50 hover:border-pink-200 transition-colors cursor-pointer"
                    onClick={() => copyText(item.en)}
                  >
                    <div className="text-sm text-gray-800 leading-relaxed">
                      <span className="text-pink-400 font-medium mr-1">{idx + 1}.</span>
                      {item.en}
                    </div>
                    {item.cn && (
                      <div className="text-xs text-gray-500 mt-1.5 leading-relaxed pl-4">
                        {item.cn}
                      </div>
                    )}
                    <span className="absolute top-2 right-2 text-xs text-pink-300 opacity-0 group-hover:opacity-100 transition-opacity">
                      点击复制
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Expand Card */}
        <FlipCard
          title="扩写"
          icon={<IconPen className="w-4 h-4 text-pink-400" />}
          rawContent={expandContent}
          isLoading={expandLoading}
          onCopy={(text) => {}}
        />

        {/* Memory Card */}
        <FlipCard
          title="长期记忆"
          icon={<IconBrain className="w-4 h-4 text-pink-400" />}
          rawContent={memoryContent}
          isLoading={memoryLoading}
          onCopy={(text) => {}}
          onSave={handleSaveMemory}
          showSave={true}
        />

        <div ref={messagesEndRef} />
      </div>

      {/* Expand Modal */}
      {showExpandModal && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30" onClick={() => setShowExpandModal(false)}>
          <div className="bg-white rounded-t-2xl md:rounded-2xl w-full md:max-w-md p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
              <IconPen className="w-4 h-4 text-pink-400" /> 扩写
            </h3>
            <textarea
              value={expandBrief}
              onChange={e => setExpandBrief(e.target.value)}
              placeholder="输入简短梗概，AI 将扩写为完整对话..."
              className="w-full text-sm p-3 rounded-lg border border-pink-100 focus:border-pink-300 focus:outline-none resize-none min-h-[80px]"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setShowExpandModal(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">取消</button>
              <button onClick={handleExpand} disabled={!expandBrief.trim()} className="px-4 py-2 text-sm bg-pink-500 text-white rounded-xl hover:bg-pink-600 disabled:opacity-50 transition-colors">扩写</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Input Area */}
      <div className="shrink-0 border-t border-pink-100 bg-white/95 backdrop-blur-sm px-4 py-3 space-y-2">
        {/* Controls: Person mode dropdown + Thinking toggle */}
        <div className="flex items-center gap-3">
          <select
            value={personMode}
            onChange={e => setPersonMode(e.target.value as 'first' | 'third')}
            className="text-xs px-2 py-1 rounded-lg border border-pink-100 bg-pink-50 text-pink-600 focus:outline-none focus:border-pink-300 appearance-none cursor-pointer"
          >
            <option value="first">第一人称 (I)</option>
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

        {/* JAI Reply Paste Area */}
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={jaiOriginal}
            onChange={e => handleJAIInput(e.target.value)}
            placeholder="粘贴 JAI 回复（英文）..."
            className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-blue-100 bg-blue-50/50 focus:border-blue-300 focus:outline-none placeholder:text-blue-300"
          />
          <button
            onClick={() => { if (jaiOriginal.trim()) translateJAI(jaiOriginal); }}
            disabled={!jaiOriginal.trim() || jaiTranslating}
            className="px-2 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors shrink-0"
          >
            翻译
          </button>
        </div>

        {/* Chat Input */}
        <div className="flex items-end gap-2">
          <textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="输入消息..."
            className="flex-1 text-sm p-3 rounded-xl border border-pink-100 focus:border-pink-300 focus:outline-none resize-none min-h-[40px] max-h-[120px]"
            rows={1}
          />
          <button
            onClick={isGenerating ? () => abortRef.current?.abort() : handleSend}
            className={`p-3 rounded-xl transition-colors shrink-0 ${isGenerating ? 'bg-red-50 text-red-400 hover:bg-red-100' : 'bg-pink-500 text-white hover:bg-pink-600'}`}
          >
            {isGenerating ? <IconStop className="w-4 h-4" /> : <IconSend className="w-4 h-4" />}
          </button>
        </div>

        {/* Feature Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleInspiration}
            disabled={inspirationLoading}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-pink-50 text-pink-500 hover:bg-pink-100 disabled:opacity-50 transition-colors"
          >
            <IconSparkle className="w-3.5 h-3.5" /> 灵感
          </button>
          <button
            onClick={() => setShowExpandModal(true)}
            disabled={expandLoading}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-pink-50 text-pink-500 hover:bg-pink-100 disabled:opacity-50 transition-colors"
          >
            <IconPen className="w-3.5 h-3.5" /> 扩写
          </button>
          <button
            onClick={handleMemory}
            disabled={memoryLoading}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-pink-50 text-pink-500 hover:bg-pink-100 disabled:opacity-50 transition-colors"
          >
            <IconBrain className="w-3.5 h-3.5" /> 记忆
          </button>
        </div>
      </div>
    </div>
  );
}
