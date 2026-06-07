'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconCopy, IconFlip, IconRefresh, IconSave } from '@/components/icons';
import { getApiKey, createPreset, savePreset } from '@/lib/storage';

/** 解析 User 卡文本为字段列表 */
function parseFields(text: string): { key: string; value: string }[] {
  const fields: { key: string; value: string }[] = [];
  const regex = /\*\*([^*]+)\*\*:\s*([\s\S]*?)(?=\n\*\*|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    fields.push({ key: match[1].trim(), value: match[2].trim() });
  }
  return fields;
}

/** 从字段列表还原完整文本 */
function buildCardText(fields: { key: string; value: string }[], sectionHeaders: string[]): string {
  let result = '[System Note: This card defines the user\'s persona. Do not break character. Keep responses grounded in the events and details below.]\n\n';
  let fieldIdx = 0;
  for (const header of sectionHeaders) {
    result += header + '\n';
    // count fields under this header - approximate by known template
    const fieldsPerSection: Record<string, number> = {
      '# Basic Information': 6,
      '# Appearance & Physical Traits': 5,
      '# Personality & Psychological Profile': 5,
      '# Background & History (Short Bio)': 2,
      '# Interaction & Dialogue Rules': 3,
    };
    const count = fieldsPerSection[header] || 0;
    for (let i = 0; i < count && fieldIdx < fields.length; i++) {
      const f = fields[fieldIdx];
      if (header === '# Interaction & Dialogue Rules' && f.key === 'Style guideline') {
        result += `*[Style guideline: Keep it realistic, no godmodding]*\n`;
        fieldIdx++;
        continue;
      }
      result += `**${f.key}**: ${f.value}\n`;
      fieldIdx++;
    }
    result += '\n';
  }
  return result.trim();
}

export default function GeneratePage() {
  const router = useRouter();
  const [charInfo, setCharInfo] = useState('');
  const [userPersonality, setUserPersonality] = useState('');
  const [greeting, setGreeting] = useState('');
  const [englishCard, setEnglishCard] = useState('');
  const [chineseCard, setChineseCard] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [showFront, setShowFront] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [thinkingContent, setThinkingContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const parsedFields = useMemo(() => parseFields(englishCard), [englishCard]);
  const parsedChineseFields = useMemo(() => parseFields(chineseCard), [chineseCard]);

  const handleGenerate = useCallback(async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      alert('请先在设置页面配置 DeepSeek API Key');
      router.push('/settings');
      return;
    }
    if (!userPersonality.trim()) {
      alert('请输入用户性格要求（必填）');
      return;
    }

    setIsGenerating(true);
    setEnglishCard('');
    setChineseCard('');
    setThinkingContent('');
    setShowFront(true);
    setShowSaveDialog(false);

    abortRef.current = new AbortController();

    try {
      const body: Record<string, string | boolean> = {
        charInfo: charInfo.trim(),
        userPersonality: userPersonality.trim(),
        greeting: greeting.trim(),
        apiKey,
        thinkingEnabled,
      };

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '生成失败');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

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
              fullText += json.content;
              // Split on separator
              const sepIdx = fullText.indexOf('===CHINESE===');
              if (sepIdx !== -1) {
                setEnglishCard(fullText.slice(0, sepIdx).trim());
                setChineseCard(fullText.slice(sepIdx + '===CHINESE==='.length).trim());
              } else {
                setEnglishCard(fullText);
                setChineseCard('');
              }
            }
            if (json.reasoning) {
              setThinkingContent(prev => prev + json.reasoning);
            }
          } catch (e) {
            if (e instanceof Error && !e.message.includes('JSON')) throw e;
          }
        }
      }

      // Final split
      const sepIdx = fullText.indexOf('===CHINESE===');
      if (sepIdx !== -1) {
        setEnglishCard(fullText.slice(0, sepIdx).trim());
        setChineseCard(fullText.slice(sepIdx + '===CHINESE==='.length).trim());
      }

      setShowSaveDialog(true);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        alert(error.message);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [charInfo, userPersonality, greeting, router]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const handleRefresh = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  const handleCopy = useCallback(() => {
    copyToClipboard(englishCard);
  }, [englishCard]);

  const handleFlip = useCallback(async () => {
    if (isGenerating || isTranslating) return;
    // If flipping to Chinese side and no translation yet, translate first
    if (showFront && !chineseCard && englishCard) {
      setIsTranslating(true);
      try {
        const apiKey = localStorage.getItem('jai_api_key');
        if (!apiKey) return;
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: englishCard, apiKey, thinkingEnabled }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.translation) setChineseCard(data.translation);
        }
      } catch { /* ignore */ }
      setIsTranslating(false);
    }
    setShowFront(prev => !prev);
  }, [showFront, chineseCard, englishCard, isGenerating, isTranslating, thinkingEnabled]);

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) {
      alert('请输入预设名称');
      return;
    }
    const translations: Record<string, string> = {};
    if (chineseCard) translations.userCard = chineseCard;
    const preset = createPreset(presetName.trim(), charInfo.trim(), englishCard, userPersonality.trim(), greeting.trim(), translations);
    savePreset(preset);
    router.push('/presets');
  }, [presetName, charInfo, englishCard, chineseCard, userPersonality, greeting, router]);

  return (
    <div className="page-enter space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-lg md:text-xl font-semibold text-foreground">生成 User 面具</h1>
      </div>

      <Card className="border-jai-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">角色卡信息 (Char) <span className="text-muted-foreground font-normal text-xs">— 可选</span></CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="粘贴角色卡设定内容。AI 将根据其世界观反推 User 合理身份..."
            value={charInfo}
            onChange={(e) => setCharInfo(e.target.value)}
            className="min-h-[160px] resize-y text-sm"
          />
        </CardContent>
      </Card>

      <Card className="border-jai-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">开场白 (Greeting) <span className="text-muted-foreground font-normal text-xs">— 可选</span></CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="粘贴 Jaibot 的开场白，AI 将据此确保 User 卡与场景逻辑一致。留空则忽略。"
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            className="min-h-[100px] resize-y text-sm"
          />
        </CardContent>
      </Card>

      <Card className="border-jai-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">User 性格要求 <span className="text-red-400 font-normal text-xs">— 必填</span></CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder='简短描述你希望 User 具备的性格，如："冷面杀手、话少、会照顾人、童年创伤、喜欢听蓝调音乐"'
            value={userPersonality}
            onChange={(e) => setUserPersonality(e.target.value)}
            className="min-h-[100px] resize-y text-sm"
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        {!isGenerating ? (
          <Button onClick={() => handleGenerate()} className="flex-1 h-11 md:h-10" size="lg">
            生成 User 卡
          </Button>
        ) : (
          <Button onClick={handleStop} variant="destructive" className="flex-1 h-11 md:h-10" size="lg">
            停止生成
          </Button>
        )}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">思考模式</span>
          <button
            type="button"
            role="switch"
            aria-checked={thinkingEnabled}
            onClick={() => setThinkingEnabled(v => !v)}
            className={`relative inline-flex h-7 w-12 md:h-6 md:w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-jai-thinking/50 focus:ring-offset-2 ${thinkingEnabled ? 'bg-jai-thinking' : 'bg-jai-muted'}`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 md:h-5 md:w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${thinkingEnabled ? 'translate-x-5 md:translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </div>

      {englishCard && (
        <Card className="border-jai-secondary overflow-hidden">
          <CardHeader className="pb-2 md:pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm md:text-base flex items-center gap-2">
                {showFront ? 'English' : '中文翻译'}
                {isGenerating && (
                  <span className="typing-cursor text-xs md:text-sm text-muted-foreground">生成中</span>
                )}
              </CardTitle>
              <div className="flex items-center gap-1">
                <span className="text-[11px] md:text-xs text-muted-foreground mr-1">
                  {showFront ? '正面' : '背面'}
                </span>
                <div className={`w-2 h-2 rounded-full ${showFront ? 'bg-jai-secondary' : 'bg-jai-thinking'}`} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
            {/* Thinking content */}
            {thinkingContent && (
              <div className="mb-3 border border-jai-thinking/50 bg-jai-thinking/10 rounded-lg p-2.5 md:p-3">
                <div className="text-xs font-medium text-jai-thinking mb-1.5 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.8-3.5 6v1.5a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5V15C6.4 13.8 5 11.6 5 9a7 7 0 0 1 7-7z"/><line x1="10" y1="21" x2="14" y2="21"/></svg>
                  思考过程
                </div>
                <div className="text-xs text-jai-thinking/80 leading-relaxed whitespace-pre-wrap max-h-[150px] md:max-h-[200px] overflow-y-auto">{thinkingContent}</div>
              </div>
            )}
            {/* Card content area */}
            <div className="bg-muted/50 p-2.5 md:p-4 rounded-lg max-h-[50vh] md:max-h-[500px] overflow-y-auto">
              {showFront ? (
                <div className="text-xs md:text-sm font-mono leading-relaxed whitespace-pre-wrap break-words">{englishCard}</div>
              ) : (
                <div className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words">{chineseCard || '翻译生成中...'}</div>
              )}
            </div>

            {/* Action buttons */}
            {!isGenerating && (
              <div className="mt-3 md:mt-4 flex gap-2 flex-wrap">
                <Button onClick={handleCopy} variant="outline" size="sm" title="复制英文全文" className="gap-1.5 h-9 md:h-8 text-xs md:text-sm">
                  <IconCopy className="w-4 h-4" /> 复制
                </Button>
                <Button onClick={handleFlip} disabled={isTranslating} variant="outline" size="sm" title="翻转卡片" className="gap-1.5 h-9 md:h-8 text-xs md:text-sm">
                  <IconFlip className="w-4 h-4" /> {isTranslating ? '翻译中...' : showFront ? '中文' : 'EN'}
                </Button>
                <Button onClick={handleRefresh} variant="outline" size="sm" title="重新生成整卡" className="gap-1.5 h-9 md:h-8 text-xs md:text-sm">
                  <IconRefresh className="w-4 h-4" /> 刷新
                </Button>
                <Button onClick={() => setShowSaveDialog(true)} size="sm" className="gap-1.5 h-9 md:h-8 text-xs md:text-sm">
                  <IconSave className="w-4 h-4" /> 保存预设
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 保存弹窗 */}
      {showSaveDialog && !isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl shadow-xl border border-jai-card-border p-6 mx-4 max-w-md w-full space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              是否与当前 Char 信息绑定并保存为预设？
            </h3>
            <p className="text-sm text-muted-foreground">
              保存后可在预设库中查看和管理，也可直接从预设库开始会话。
            </p>
            <input
              type="text"
              placeholder="输入预设名称..."
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
            />
            <div className="flex gap-3">
              <Button
                onClick={() => setShowSaveDialog(false)}
                variant="outline"
                className="flex-1"
              >
                否，仅保留
              </Button>
              <Button
                onClick={handleSavePreset}
                className="flex-1"
              >
                是，保存预设
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
