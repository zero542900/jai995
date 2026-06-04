'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [showFront, setShowFront] = useState(true);
  const [lockedFields, setLockedFields] = useState<Record<string, string>>({});
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const parsedFields = useMemo(() => parseFields(englishCard), [englishCard]);
  const parsedChineseFields = useMemo(() => parseFields(chineseCard), [chineseCard]);

  const isFieldLocked = useCallback((key: string) => key in lockedFields, [lockedFields]);

  const toggleFieldLock = useCallback((key: string, value: string) => {
    setLockedFields(prev => {
      const next = { ...prev };
      if (key in next) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async (withLocked = false) => {
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
    setShowFront(true);
    setShowSaveDialog(false);

    abortRef.current = new AbortController();

    try {
      const body: Record<string, string | Record<string, string>> = {
        charInfo: charInfo.trim(),
        userPersonality: userPersonality.trim(),
        greeting: greeting.trim(),
        apiKey,
      };
      if (withLocked && Object.keys(lockedFields).length > 0) {
        body.lockedFields = lockedFields;
      }

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

      if (!withLocked) {
        setLockedFields({});
      }
      setShowSaveDialog(true);
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        alert(error.message);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [charInfo, userPersonality, greeting, lockedFields, router]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const handleRefresh = useCallback(() => {
    const hasLocked = Object.keys(lockedFields).length > 0;
    handleGenerate(hasLocked);
  }, [handleGenerate, lockedFields]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(englishCard);
  }, [englishCard]);

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) {
      alert('请输入预设名称');
      return;
    }
    const preset = createPreset(presetName.trim(), charInfo.trim(), englishCard, userPersonality.trim(), greeting.trim());
    savePreset(preset);
    router.push('/presets');
  }, [presetName, charInfo, englishCard, userPersonality, greeting, router]);

  const hasLocked = Object.keys(lockedFields).length > 0;

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground">生成 User 面具</h1>
      </div>

      <Card className="border-pink-100">
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

      <Card className="border-pink-100">
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

      <Card className="border-pink-100">
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

      <div className="flex gap-3">
        {!isGenerating ? (
          <Button onClick={() => handleGenerate(false)} className="flex-1" size="lg">
            生成 User 卡
          </Button>
        ) : (
          <Button onClick={handleStop} variant="destructive" className="flex-1" size="lg">
            停止生成
          </Button>
        )}
      </div>

      {englishCard && (
        <Card className="border-pink-200 overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {showFront ? 'English' : '中文翻译'}
                {isGenerating && (
                  <span className="typing-cursor text-sm text-muted-foreground">生成中</span>
                )}
              </CardTitle>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-1">
                  {showFront ? '正面' : '背面'}
                </span>
                <div className={`w-2 h-2 rounded-full ${showFront ? 'bg-pink-500' : 'bg-violet-400'}`} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Card content area */}
            <div className="bg-muted/50 p-4 rounded-lg max-h-[500px] overflow-y-auto">
              {showFront ? (
                <div className="text-sm font-mono leading-relaxed whitespace-pre-wrap">{englishCard}</div>
              ) : (
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{chineseCard || '翻译生成中...'}</div>
              )}
            </div>

            {/* Field locking - both sides, when not generating */}
            {!isGenerating && (showFront ? parsedFields : parsedChineseFields).length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-muted-foreground mb-2">
                  点击 🔒 标记满意的内容，刷新时标记字段将保留不变
                  {hasLocked && <span className="text-pink-500 ml-1">（已标记 {Object.keys(lockedFields).length} 项）</span>}
                </p>
                <div className="grid gap-1">
                  {(showFront ? parsedFields : parsedChineseFields).map((field, idx) => {
                    // Use English key as lock identifier (same index maps between EN/CN)
                    const lockKey = parsedFields[idx]?.key || field.key;
                    const locked = isFieldLocked(lockKey);
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                          locked
                            ? 'bg-pink-50 border border-pink-200'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <span className="font-mono text-muted-foreground min-w-0 shrink-0">**{field.key}**:</span>
                        <span className="flex-1 truncate text-foreground">{field.value}</span>
                        <button
                          onClick={() => toggleFieldLock(lockKey, parsedFields[idx]?.value || field.value)}
                          className={`shrink-0 text-base leading-none transition-transform hover:scale-110 ${
                            locked ? 'opacity-100' : 'opacity-30 hover:opacity-60'
                          }`}
                          title={locked ? '取消锁定' : '锁定此字段（锁定对应英文字段）'}
                        >
                          {locked ? '🔒' : '🔓'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!isGenerating && (
              <div className="mt-4 flex gap-2 flex-wrap">
                <Button onClick={handleCopy} variant="outline" size="sm" title="复制英文全文">
                  📋 复制
                </Button>
                <Button onClick={() => setShowFront(prev => !prev)} variant="outline" size="sm" title="翻转卡片">
                  🔄 {showFront ? '中文翻译' : 'English'}
                </Button>
                <Button onClick={handleRefresh} variant="outline" size="sm" title={hasLocked ? '保留标记项，重新生成其余' : '重新生成整卡'}>
                  🔁 {hasLocked ? '局部刷新' : '刷新'}
                </Button>
                <Button onClick={() => setShowSaveDialog(true)} size="sm">
                  💾 保存预设
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 保存弹窗 */}
      {showSaveDialog && !isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl shadow-xl border border-pink-100 p-6 mx-4 max-w-md w-full space-y-4">
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
