'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiKey, createPreset, savePreset, generateId } from '@/lib/storage';

export default function GeneratePage() {
  const router = useRouter();
  const [charInfo, setCharInfo] = useState('');
  const [userPersonality, setUserPersonality] = useState('');
  const [greeting, setGreeting] = useState('');
  const [generatedCard, setGeneratedCard] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [presetName, setPresetName] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = useCallback(async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      alert('请先在设置页面配置 DeepSeek API Key');
      router.push('/settings');
      return;
    }
    if (!charInfo.trim()) {
      alert('请输入角色卡（Char）信息');
      return;
    }

    setIsGenerating(true);
    setGeneratedCard('');
    setShowSavePrompt(false);

    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          charInfo: charInfo.trim(),
          userPersonality: userPersonality.trim(),
          greeting: greeting.trim(),
          apiKey,
        }),
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
              setGeneratedCard(fullText);
            }
          } catch (e) {
            if (e instanceof Error && !e.message.includes('JSON')) throw e;
          }
        }
      }

      setShowSavePrompt(true);
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

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) {
      alert('请输入预设名称');
      return;
    }
    const preset = createPreset(presetName.trim(), charInfo.trim(), generatedCard, userPersonality.trim(), greeting.trim());
    savePreset(preset);
    router.push('/presets');
  }, [presetName, charInfo, generatedCard, userPersonality, greeting, router]);

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground">生成 User 面具</h1>
      </div>

      <Card className="border-pink-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">角色卡信息 (Char)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="粘贴角色卡设定内容..."
            value={charInfo}
            onChange={(e) => setCharInfo(e.target.value)}
            className="min-h-[160px] resize-y text-sm"
          />
        </CardContent>
      </Card>

      <Card className="border-pink-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">开场白 (Greeting)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="输入你希望的开场白内容，AI 将据此生成符合世界观的 User 开场白。留空则由 AI 自行创作。"
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            className="min-h-[100px] resize-y text-sm"
          />
        </CardContent>
      </Card>

      <Card className="border-pink-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">User 性格要求</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="描述你希望 User 具备的性格、背景等要求..."
            value={userPersonality}
            onChange={(e) => setUserPersonality(e.target.value)}
            className="min-h-[100px] resize-y text-sm"
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        {!isGenerating ? (
          <Button onClick={handleGenerate} className="flex-1" size="lg">
            生成 User 卡
          </Button>
        ) : (
          <Button onClick={handleStop} variant="destructive" className="flex-1" size="lg">
            停止生成
          </Button>
        )}
      </div>

      {generatedCard && (
        <Card className="border-pink-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              生成的 User 卡
              {isGenerating && (
                <span className="typing-cursor text-sm text-muted-foreground">生成中</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg font-mono leading-relaxed max-h-[500px] overflow-y-auto">
              {generatedCard}
            </pre>
            {showSavePrompt && !isGenerating && (
              <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
                <p className="text-sm font-medium text-foreground">
                  是否与当前角色卡绑定并保存为预设？
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="输入预设名称..."
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded-md border border-input bg-background"
                  />
                  <Button onClick={handleSavePreset} size="sm">
                    保存预设
                  </Button>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCard);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    复制
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
