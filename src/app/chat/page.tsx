'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { IconSend, IconStop, IconSparkle, IconPen, IconBrain, IconRefresh, IconCopy, IconSave, IconFlip, IconBack } from '@/components/icons';
import {
  getApiKey,
  getPreset,
  getSession,
  saveSession,
  savePreset,
  getPresets,
  getSessionsByPreset,
  createSession,
  createMessage,
  deleteSession,
} from '@/lib/storage';
import type { Session, ChatMessage, Preset } from '@/lib/types';

function ChatContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlSessionId = searchParams.get('sessionId');
  const urlPresetId = searchParams.get('presetId');

  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [currentPreset, setCurrentPreset] = useState<Preset | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [inputText, setInputText] = useState('');
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSessionList, setShowSessionList] = useState(false);
  const [showInspiration, setShowInspiration] = useState(false);
  const [inspirationText, setInspirationText] = useState('');
  const [showExpand, setShowExpand] = useState(false);
  const [expandBrief, setExpandBrief] = useState('');
  const [showMemory, setShowMemory] = useState(false);
  const [memoryText, setMemoryText] = useState('');
  const [showPresetSelect, setShowPresetSelect] = useState(false);

  // Translation panel state
  const [translationEnglish, setTranslationEnglish] = useState('');
  const [translationChinese, setTranslationChinese] = useState('');
  const [translationFlipped, setTranslationFlipped] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [saveToast, setSaveToast] = useState('');

  // First-time usage hint
  const [showHint, setShowHint] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const translationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadSessions = useCallback(() => {
    if (currentPreset) {
      const s = getSessionsByPreset(currentPreset.id);
      setSessions(s);
    }
  }, [currentPreset]);

  useEffect(() => {
    if (urlPresetId) {
      const preset = getPreset(urlPresetId);
      if (preset) {
        setCurrentPreset(preset);
        if (urlSessionId) {
          const session = getSession(urlSessionId);
          if (session) {
            setCurrentSession(session);
          }
        } else {
          // Auto-create or load the single session for this preset
          const existing = getSessionsByPreset(preset.id);
          if (existing.length > 0) {
            setCurrentSession(existing[0]);
          } else {
            const newSess = createSession(preset.id, `${preset.name} - 会话`);
            saveSession(newSess);
            setCurrentSession(newSess);
          }
        }
      }
    }
  }, [urlPresetId, urlSessionId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages, scrollToBottom]);

  // Show first-time hint
  useEffect(() => {
    const seen = localStorage.getItem('jai_chat_hint_seen');
    if (!seen && currentPreset) {
      setShowHint(true);
    }
  }, [currentPreset]);

  // Auto-save long-term memory when switching/closing
  const autoSaveMemory = useCallback(() => {
    if (!currentPreset || !currentSession) return;
    const updatedPreset = {
      ...currentPreset,
      longTermMemory: currentSession.longTermMemory || currentPreset.longTermMemory,
      plotDirection: currentPreset.plotDirection,
      updatedAt: Date.now(),
    };
    savePreset(updatedPreset);
    setCurrentPreset(updatedPreset);
    setSaveToast('记忆已自动保存');
    setTimeout(() => setSaveToast(''), 2000);
  }, [currentPreset, currentSession]);

  // Translation with debounce
  const doTranslate = useCallback(async (text: string) => {
    if (!text.trim()) {
      setTranslationChinese('');
      return;
    }
    const apiKey = getApiKey();
    if (!apiKey) return;

    setIsTranslating(true);
    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, apiKey }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '翻译失败');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(trimmed.slice(6));
            if (json.content) {
              result += json.content;
              setTranslationChinese(result);
            }
          } catch { /* skip */ }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Translation error:', error.message);
      }
    } finally {
      setIsTranslating(false);
    }
  }, []);

  const handleTranslationInput = useCallback((value: string) => {
    setTranslationEnglish(value);
    setTranslationFlipped(false); // Reset to Chinese view on new input

    if (translationTimerRef.current) {
      clearTimeout(translationTimerRef.current);
    }
    translationTimerRef.current = setTimeout(() => {
      doTranslate(value);
    }, 1500);
  }, [doTranslate]);

  const buildSystemPrompt = useCallback(() => {
    if (!currentPreset) return '';
    const translationContext = translationEnglish.trim()
      ? `\n\nLATEST JAI REPLY (English, for context):\n${translationEnglish.trim()}\n`
      : '';
    return `You are an immersive roleplay partner. Follow these rules:

1. Write in a cinematic, Western-narrative style (like an American TV show or novel). NOT anime or Chinese classical style.
2. Stay in character at all times. React based on the Character's personality, background, and the world setting.
3. Write the Character's actions in *asterisks* and dialogue in "quotes".
4. Advance the story naturally based on the User's input. Don't control the User's actions.
5. Be descriptive, atmospheric, and emotionally engaging.
6. Always read the recent 5-10 messages for context before generating.

WORLD & CHARACTER:
${currentPreset.charInfo}

USER PERSONA:
${currentPreset.userCard}

${currentPreset.greeting ? `OPENING GREETING:\n${currentPreset.greeting}\n` : ''}${currentPreset.longTermMemory ? `LONG-TERM MEMORY:\n${currentPreset.longTermMemory}\n` : ''}
${currentPreset.plotDirection ? `CURRENT PLOT DIRECTION:\n${currentPreset.plotDirection}\n` : ''}${translationContext}`;
  }, [currentPreset, translationEnglish]);

  const streamChat = useCallback(
    async (messages: { role: string; content: string }[]) => {
      const apiKey = getApiKey();
      if (!apiKey) {
        alert('请先在设置页面配置 DeepSeek API Key');
        return;
      }

      setIsStreaming(true);
      abortRef.current = new AbortController();

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            apiKey,
            thinkingEnabled,
            systemPrompt: buildSystemPrompt(),
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || '请求失败');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('无法读取响应流');

        const decoder = new TextDecoder();
        let buffer = '';
        let contentText = '';
        let reasoningText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            try {
              const json = JSON.parse(trimmed.slice(6));
              if (json.error) throw new Error(json.error);
              if (json.content) contentText += json.content;
              if (json.reasoning) reasoningText += json.reasoning;

              setCurrentSession((prev) => {
                if (!prev) return prev;
                const msgs = [...prev.messages];
                if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                  msgs[msgs.length - 1] = {
                    ...msgs[msgs.length - 1],
                    content: contentText,
                    thinking: reasoningText || undefined,
                  };
                }
                return { ...prev, messages: msgs };
              });
            } catch (e) {
              if (e instanceof Error && !e.message.includes('JSON')) throw e;
            }
          }
        }

        setCurrentSession((prev) => {
          if (!prev) return prev;
          const msgs = [...prev.messages];
          if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
            msgs[msgs.length - 1] = {
              ...msgs[msgs.length - 1],
              content: contentText,
              thinking: reasoningText || undefined,
            };
          }
          const updated = { ...prev, messages: msgs, updatedAt: Date.now() };
          saveSession(updated);
          return updated;
        });
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          alert(error.message);
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [thinkingEnabled, buildSystemPrompt],
  );

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !currentSession || isStreaming) return;

    const userMsg = createMessage('user', inputText.trim());
    const updatedMessages = [...currentSession.messages, userMsg];
    const updatedSession = { ...currentSession, messages: updatedMessages };

    setCurrentSession(updatedSession);
    saveSession(updatedSession);
    setInputText('');

    const assistantMsg = createMessage('assistant', '');
    const withAssistant = { ...updatedSession, messages: [...updatedMessages, assistantMsg] };
    setCurrentSession(withAssistant);

    const apiMessages = updatedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    await streamChat(apiMessages);
  }, [inputText, currentSession, isStreaming, streamChat]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const streamSSE = useCallback(async (url: string, body: Record<string, string>, onChunk: (text: string) => void) => {
    const apiKey = getApiKey();
    if (!apiKey) {
      alert('请先在设置页面配置 DeepSeek API Key');
      return false;
    }

    setIsStreaming(true);
    abortRef.current = new AbortController();

    try {
      // Include translation context in the chat history for all features
      const chatHistory = currentSession
        ? currentSession.messages.slice(-20).map((m) => `${m.role}: ${m.content}`).join('\n')
        : '';
      const translationContext = translationEnglish.trim()
        ? `\n\n[Latest JAI Reply for context]:\n${translationEnglish.trim()}\n`
        : '';

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, apiKey, chatHistory: chatHistory + translationContext }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '请求失败');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let text = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(trimmed.slice(6));
            if (json.error) throw new Error(json.error);
            if (json.content) {
              text += json.content;
              onChunk(text);
            }
          } catch (e) {
            if (e instanceof Error && !e.message.includes('JSON')) throw e;
          }
        }
      }
      return true;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        alert(error.message);
      }
      return false;
    } finally {
      setIsStreaming(false);
    }
  }, [currentSession, translationEnglish]);

  const handleInspiration = useCallback(async () => {
    if (!currentPreset || !currentSession || isStreaming) return;
    setShowInspiration(true);
    setInspirationText('');

    await streamSSE(
      '/api/inspiration',
      {
        charInfo: currentPreset.charInfo,
        userCard: currentPreset.userCard,
        userPersonality: currentPreset.userPersonality,
        plotDirection: currentPreset.plotDirection,
        longTermMemory: currentPreset.longTermMemory,
        chatHistory: '',
      },
      (text) => setInspirationText(text),
    );
  }, [currentPreset, currentSession, isStreaming, streamSSE]);

  const handleExpand = useCallback(async () => {
    if (!expandBrief.trim() || !currentPreset || !currentSession || isStreaming) return;

    const ok = await streamSSE(
      '/api/expand',
      {
        brief: expandBrief.trim(),
        charInfo: currentPreset.charInfo,
        userCard: currentPreset.userCard,
        userPersonality: currentPreset.userPersonality,
        plotDirection: currentPreset.plotDirection,
        longTermMemory: currentPreset.longTermMemory,
        chatHistory: '',
      },
      (text) => setInputText(text),
    );
    if (ok) {
      setShowExpand(false);
      setExpandBrief('');
    }
  }, [expandBrief, currentPreset, currentSession, isStreaming, streamSSE]);

  const handleMemory = useCallback(async () => {
    if (!currentPreset || !currentSession || isStreaming) return;
    setShowMemory(true);
    setMemoryText('');

    await streamSSE(
      '/api/memory',
      {
        charInfo: currentPreset.charInfo,
        userCard: currentPreset.userCard,
        chatHistory: '',
        longTermMemory: currentPreset.longTermMemory,
      },
      (text) => setMemoryText(text),
    );
  }, [currentPreset, currentSession, isStreaming, streamSSE]);

  const handleSaveMemory = useCallback(() => {
    if (!currentPreset || !memoryText || !currentSession) return;
    const updatedPreset = { ...currentPreset, longTermMemory: memoryText, updatedAt: Date.now() };
    savePreset(updatedPreset);
    setCurrentPreset(updatedPreset);
    const updatedSession = { ...currentSession, longTermMemory: memoryText, updatedAt: Date.now() };
    saveSession(updatedSession);
    setCurrentSession(updatedSession);
    setShowMemory(false);
  }, [currentPreset, currentSession, memoryText]);

  // 1:1 binding: only one session per preset
  const selectPreset = useCallback((preset: Preset) => {
    // Auto-save current session memory before switching
    if (currentPreset && currentSession) {
      autoSaveMemory();
    }

    setCurrentPreset(preset);
    setShowPresetSelect(false);
    const presetSessions = getSessionsByPreset(preset.id);
    setSessions(presetSessions);

    if (presetSessions.length > 0) {
      setCurrentSession(presetSessions[0]);
    } else {
      const newSess = createSession(preset.id, `${preset.name} - 会话`);
      saveSession(newSess);
      setCurrentSession(newSess);
      setSessions([newSess]);
    }

    // Clear translation panel
    setTranslationEnglish('');
    setTranslationChinese('');
    setTranslationFlipped(false);
  }, [currentPreset, currentSession, autoSaveMemory]);

  const handleBackToPresets = useCallback(() => {
    if (currentPreset && currentSession) {
      autoSaveMemory();
    }
    router.push('/presets');
  }, [currentPreset, currentSession, autoSaveMemory, router]);

  const handleDeleteSession = useCallback(
    (id: string) => {
      if (confirm('确定删除此会话吗？聊天记录将丢失。')) {
        deleteSession(id);
        if (currentSession?.id === id) {
          const remaining = getSessionsByPreset(currentPreset!.id);
          setSessions(remaining);
          if (remaining.length > 0) {
            setCurrentSession(remaining[0]);
          } else {
            setCurrentSession(null);
          }
        } else {
          loadSessions();
        }
      }
    },
    [currentSession, currentPreset, loadSessions],
  );

  const allPresets = getPresets();

  return (
    <div className="page-enter flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)]">
      {/* Toast notification */}
      {saveToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-emerald-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-in fade-in slide-in-from-top-2">
          {saveToast}
        </div>
      )}

      {/* First-time hint */}
      {showHint && (
        <div className="flex-shrink-0 bg-pink-50 border border-pink-100 rounded-lg px-4 py-3 mb-3 flex items-start gap-2">
          <p className="text-xs text-pink-700 flex-1">每个预设只允许一个会话。切换预设时，当前会话的长期记忆会自动保存。</p>
          <button
            onClick={() => { setShowHint(false); localStorage.setItem('jai_chat_hint_seen', '1'); }}
            className="text-pink-400 hover:text-pink-600 text-sm flex-shrink-0"
          >
            知道了
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={handleBackToPresets} className="gap-1 text-xs">
          <IconBack className="w-3.5 h-3.5" /> 返回
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowPresetSelect(true)} className="text-xs">
          {currentPreset ? currentPreset.name : '选择预设'}
        </Button>
        {currentPreset && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-emerald-500">会话进行中</span>
            <Button variant="ghost" size="sm" onClick={() => setShowTranslation(!showTranslation)} className="text-xs gap-1">
              <IconCopy className="w-3.5 h-3.5" /> 翻译
            </Button>
          </div>
        )}
      </div>

      {/* Preset selector modal */}
      {showPresetSelect && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setShowPresetSelect(false)}>
          <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">选择预设</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[60vh] overflow-y-auto space-y-1">
              {allPresets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">暂无预设</p>
              ) : (
                allPresets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPreset(p)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${currentPreset?.id === p.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}
                  >
                    {p.name}
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Translation panel */}
      {showTranslation && currentPreset && (
        <div className="flex-shrink-0 border border-pink-100 rounded-xl bg-white p-3 mb-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-pink-600">JAI 回复翻译区</span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTranslationFlipped(!translationFlipped)}
                className="h-7 px-2 text-xs gap-1"
                disabled={!translationChinese}
              >
                <IconFlip className="w-3.5 h-3.5" />
                {translationFlipped ? '看中文' : '看英文'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowTranslation(false); }}
                className="h-7 px-2 text-xs text-muted-foreground"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </Button>
            </div>
          </div>

          {!translationFlipped ? (
            // Default: Show Chinese translation (back)
            <div>
              {translationChinese ? (
                <div className="bg-pink-50/60 rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {translationChinese}
                  {isTranslating && <span className="typing-cursor" />}
                </div>
              ) : isTranslating ? (
                <div className="bg-pink-50/60 rounded-lg p-3 text-sm text-muted-foreground">
                  <span className="typing-cursor">正在翻译...</span>
                </div>
              ) : (
                <div className="bg-pink-50/60 rounded-lg p-3 text-sm text-muted-foreground text-center">
                  在下方粘贴英文原文，翻译将自动生成
                </div>
              )}
            </div>
          ) : (
            // Flipped: Show English original (front)
            <div className="bg-gray-50 rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap border border-gray-100">
              {translationEnglish || <span className="text-muted-foreground">暂无英文原文</span>}
            </div>
          )}

          {/* English input area (always visible at bottom) */}
          <Textarea
            placeholder="粘贴 JanitorAI 的英文回复..."
            value={translationEnglish}
            onChange={(e) => handleTranslationInput(e.target.value)}
            className="mt-2 min-h-[60px] max-h-[100px] resize-none text-xs"
            rows={2}
          />
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {!currentSession ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">{currentPreset ? '正在加载会话...' : '请先选择一个预设'}</p>
          </div>
        ) : currentSession.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">开始新的对话</p>
          </div>
        ) : (
          currentSession.messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card border border-border rounded-bl-md'}`}>
                {msg.thinking && (
                  <div className="mb-2 p-2 bg-violet-50 border border-violet-100 rounded-lg text-xs text-violet-700 whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto">
                    <span className="font-semibold text-violet-800">Thinking:</span><br />
                    {msg.thinking}
                  </div>
                )}
                <div className="whitespace-pre-wrap">
                  {msg.content || (isStreaming ? '' : '...')}
                  {isStreaming && msg.role === 'assistant' && msg.content && <span className="typing-cursor" />}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Inspiration modal */}
      {showInspiration && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end md:items-center justify-center p-4" onClick={() => setShowInspiration(false)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5"><IconSparkle className="w-4 h-4 text-pink-400" /> 灵感 - 剧情走向建议</CardTitle>
              <Button onClick={handleInspiration} size="sm" variant="outline" disabled={isStreaming} className="gap-1"><IconRefresh className="w-3.5 h-3.5" />刷新</Button>
            </CardHeader>
            <CardContent className="max-h-[60vh] overflow-y-auto">
              {inspirationText ? (
                <pre className="whitespace-pre-wrap text-sm leading-relaxed">{inspirationText}</pre>
              ) : isStreaming ? (
                <p className="text-sm text-muted-foreground typing-cursor">正在生成灵感...</p>
              ) : (
                <p className="text-sm text-muted-foreground">点击刷新获取灵感</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Expand modal */}
      {showExpand && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end md:items-center justify-center p-4" onClick={() => setShowExpand(false)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5"><IconPen className="w-4 h-4 text-pink-400" /> 扩写 - 从简短梗概到完整对话</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea placeholder="输入简短梗概..." value={expandBrief} onChange={(e) => setExpandBrief(e.target.value)} className="text-sm" />
              <Button onClick={handleExpand} disabled={isStreaming || !expandBrief.trim()} className="w-full">
                {isStreaming ? '扩写中...' : '扩写'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Memory modal */}
      {showMemory && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end md:items-center justify-center p-4" onClick={() => setShowMemory(false)}>
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5"><IconBrain className="w-4 h-4 text-pink-400" /> 长期记忆生成</CardTitle>
              <div className="flex gap-2">
                <Button onClick={() => navigator.clipboard.writeText(memoryText)} size="sm" variant="outline" disabled={!memoryText} className="gap-1"><IconCopy className="w-3.5 h-3.5" />复制</Button>
                <Button onClick={handleSaveMemory} size="sm" disabled={!memoryText} className="gap-1"><IconSave className="w-3.5 h-3.5" />保存</Button>
              </div>
            </CardHeader>
            <CardContent className="max-h-[60vh] overflow-y-auto">
              {memoryText ? (
                <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed bg-muted/50 p-3 rounded-lg">{memoryText}</pre>
              ) : isStreaming ? (
                <p className="text-sm text-muted-foreground typing-cursor">正在生成长期记忆...</p>
              ) : (
                <p className="text-sm text-muted-foreground">点击生成</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Input area */}
      {currentSession && (
        <div className="flex-shrink-0 border-t border-border bg-card/95 backdrop-blur-sm pt-3 pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:rounded-xl md:border">
          <div className="flex items-center gap-2 mb-2">
            <Switch checked={thinkingEnabled} onCheckedChange={setThinkingEnabled} className="data-[state=checked]:bg-violet-500" />
            <span className="text-xs text-muted-foreground">DS模型思考模式</span>
          </div>
          <div className="flex gap-2">
            <Textarea
              placeholder="输入消息..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              className="min-h-[44px] max-h-[120px] resize-none text-sm flex-1"
              rows={1}
            />
            {!isStreaming ? (
              <Button onClick={handleSend} disabled={!inputText.trim()} size="icon" className="h-11 w-11 flex-shrink-0">
                <IconSend className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleStop} variant="destructive" size="icon" className="h-11 w-11 flex-shrink-0">
                <IconStop className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <Button onClick={handleInspiration} variant="outline" size="sm" disabled={isStreaming} className="flex-1 text-xs h-8 gap-1"><IconSparkle className="w-3.5 h-3.5" />灵感</Button>
            <Button onClick={() => setShowExpand(true)} variant="outline" size="sm" disabled={isStreaming} className="flex-1 text-xs h-8 gap-1"><IconPen className="w-3.5 h-3.5" />扩写</Button>
            <Button onClick={handleMemory} variant="outline" size="sm" disabled={isStreaming} className="flex-1 text-xs h-8 gap-1"><IconBrain className="w-3.5 h-3.5" />记忆</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><p className="text-muted-foreground text-sm">加载中...</p></div>}>
      <ChatContent />
    </Suspense>
  );
}
