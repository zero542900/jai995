'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IconBack, IconPlay } from '@/components/icons';
import { getPreset, savePreset } from '@/lib/storage';
import FlipCard from '@/components/flip-card';
import type { Preset } from '@/lib/types';

export default function PresetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const presetId = params.id as string;

  const [preset, setPreset] = useState<Preset | null>(null);
  const [editMemory, setEditMemory] = useState('');
  const [editGreeting, setEditGreeting] = useState('');
  const [editCharInfo, setEditCharInfo] = useState('');
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [isEditingGreeting, setIsEditingGreeting] = useState(false);
  const [isEditingCharInfo, setIsEditingCharInfo] = useState(false);

  const loadPreset = useCallback(() => {
    const p = getPreset(presetId);
    if (p) {
      setPreset(p);
      setEditMemory(p.longTermMemory);
      setEditGreeting(p.greeting);
      setEditCharInfo(p.charInfo);
    }
  }, [presetId]);

  useEffect(() => {
    loadPreset();
  }, [loadPreset]);

  if (!preset) {
    return (
      <div className="page-enter flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">预设不存在</p>
      </div>
    );
  }

  /** Update a single translation field in preset and persist */
  const updateTranslation = (field: string, value: string) => {
    if (!preset) return;
    const updated = {
      ...preset,
      translations: { ...preset.translations, [field]: value },
      updatedAt: Date.now(),
    };
    savePreset(updated);
    setPreset(updated);
  };

  /** Clear a single translation field (content changed) */
  const clearTranslation = (field: string) => {
    if (!preset?.translations?.[field as keyof typeof preset.translations]) return;
    const updated = {
      ...preset,
      translations: { ...preset.translations, [field]: undefined },
      updatedAt: Date.now(),
    };
    savePreset(updated);
    setPreset(updated);
  };

  const handleSave = (field: keyof Preset, value: string, setter: (v: boolean) => void) => {
    if (preset) {
      // When content changes, clear the corresponding translation cache
      const translations = { ...preset.translations };
      const translationField = field as string;
      if (translations[translationField as keyof typeof translations] !== undefined) {
        translations[translationField as keyof typeof translations] = undefined;
      }
      const updated = { ...preset, [field]: value, translations, updatedAt: Date.now() };
      savePreset(updated);
      setPreset(updated);
      setter(false);
    }
  };

  const handleStartSession = () => {
    router.push(`/chat?preset=${presetId}`);
  };

  return (
    <div className="page-enter space-y-4 md:space-y-5">
      <div className="flex items-center gap-2 md:gap-3">
        <button
          onClick={() => router.push('/presets')}
          className="p-2 -ml-2 md:p-1 md:-ml-0 text-muted-foreground hover:text-foreground transition-colors min-w-[36px] min-h-[36px] md:min-w-0 md:min-h-0 flex items-center justify-center"
        >
          <IconBack className="w-5 h-5" />
        </button>
        <h1 className="text-lg md:text-xl font-semibold text-foreground truncate">{preset.name}</h1>
      </div>

      <Button onClick={handleStartSession} className="w-full gap-1.5" size="lg">
        <IconPlay className="w-4 h-4" /> 开始会话
      </Button>

      {/* Session Settings */}
      <div className="flex flex-wrap items-center gap-3 md:gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-jai-text-secondary">人称视角</span>
          <select
            value={preset.personMode || 'third'}
            onChange={(e) => {
              const updated = { ...preset, personMode: e.target.value as 'first' | 'third', updatedAt: Date.now() };
              savePreset(updated);
              setPreset(updated);
            }}
            className="border border-jai-secondary rounded-md px-2 py-1 text-sm bg-jai-card"
          >
            <option value="third">第三人称</option>
            <option value="first">第一人称</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-jai-text-secondary">思考模式</span>
          <button
            onClick={() => {
              const updated = { ...preset, thinkingEnabled: !preset.thinkingEnabled, updatedAt: Date.now() };
              savePreset(updated);
              setPreset(updated);
            }}
            className={`relative w-10 h-5 rounded-full transition-colors ${preset.thinkingEnabled ? 'bg-jai-thinking' : 'bg-jai-muted'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${preset.thinkingEnabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      <Tabs defaultValue="char" className="w-full">
        <TabsList className="w-full flex overflow-x-auto md:grid md:grid-cols-5 text-xs gap-0.5 p-1 no-scrollbar">
          <TabsTrigger value="char" className="text-xs px-2 md:px-1 whitespace-nowrap shrink-0">Char</TabsTrigger>
          <TabsTrigger value="user" className="text-xs px-2 md:px-1 whitespace-nowrap shrink-0">User</TabsTrigger>
          <TabsTrigger value="greeting" className="text-xs px-2 md:px-1 whitespace-nowrap shrink-0">开场白</TabsTrigger>
          <TabsTrigger value="plot" className="text-xs px-2 md:px-1 whitespace-nowrap shrink-0">剧情</TabsTrigger>
          <TabsTrigger value="memory" className="text-xs px-2 md:px-1 whitespace-nowrap shrink-0">记忆</TabsTrigger>
        </TabsList>

        {/* Char Tab */}
        <TabsContent value="char">
          <Card className="border-jai-card-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">角色卡 (Char)</CardTitle>
                {!isEditingCharInfo && (
                  <Button onClick={() => setIsEditingCharInfo(true)} variant="outline" size="sm">
                    编辑
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditingCharInfo ? (
                <div className="space-y-2">
                  <Textarea
                    value={editCharInfo}
                    onChange={(e) => setEditCharInfo(e.target.value)}
                    className="min-h-[120px] text-sm"
                    placeholder="输入角色信息..."
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => handleSave('charInfo', editCharInfo, setIsEditingCharInfo)} size="sm">保存</Button>
                    <Button onClick={() => { setEditCharInfo(preset.charInfo); setIsEditingCharInfo(false); }} variant="outline" size="sm">取消</Button>
                  </div>
                </div>
              ) : (
                <FlipCard
                  content={preset.charInfo}
                  title="角色卡"
                  emptyText="暂无角色信息，点击编辑添加"
                  cachedTranslation={preset.translations?.charInfo}
                  onTranslationReady={(t) => updateTranslation('charInfo', t)}
                  onContentChanged={() => clearTranslation('charInfo')}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Tab */}
        <TabsContent value="user">
          <Card className="border-jai-card-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">User 卡</CardTitle>
            </CardHeader>
            <CardContent>
              <FlipCard
                content={preset.userCard}
                title="User 卡"
                mono
                emptyText="暂无 User 卡"
                cachedTranslation={preset.translations?.userCard}
                onTranslationReady={(t) => updateTranslation('userCard', t)}
                onContentChanged={() => clearTranslation('userCard')}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Greeting Tab */}
        <TabsContent value="greeting">
          <Card className="border-jai-card-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">开场白 (Greeting)</CardTitle>
                {!isEditingGreeting && (
                  <Button onClick={() => setIsEditingGreeting(true)} variant="outline" size="sm">
                    编辑
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditingGreeting ? (
                <div className="space-y-2">
                  <Textarea
                    value={editGreeting}
                    onChange={(e) => setEditGreeting(e.target.value)}
                    className="min-h-[120px] text-sm"
                    placeholder="输入开场白，用于设定角色初次登场场景..."
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => handleSave('greeting', editGreeting, setIsEditingGreeting)} size="sm">保存</Button>
                    <Button onClick={() => { setEditGreeting(preset.greeting); setIsEditingGreeting(false); }} variant="outline" size="sm">取消</Button>
                  </div>
                </div>
              ) : (
                <FlipCard
                  content={preset.greeting}
                  title="开场白"
                  emptyText="暂无开场白，点击编辑添加"
                  cachedTranslation={preset.translations?.greeting}
                  onTranslationReady={(t) => updateTranslation('greeting', t)}
                  onContentChanged={() => clearTranslation('greeting')}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plot Tab */}
        <TabsContent value="plot">
          <Card className="border-jai-card-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">剧情概括</CardTitle>
            </CardHeader>
            <CardContent>
              {preset.plotData?.currentMainLineCn ? (
                <p className="text-sm text-jai-text leading-relaxed whitespace-pre-wrap">{preset.plotData.currentMainLineCn}</p>
              ) : preset.plotData?.currentMainLine ? (
                <p className="text-sm text-jai-text leading-relaxed whitespace-pre-wrap">{preset.plotData.currentMainLine}</p>
              ) : (
                <p className="text-sm text-jai-text-secondary">开始会话后，AI 将自动概括剧情</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Memory Tab */}
        <TabsContent value="memory">
          <Card className="border-jai-card-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">长期记忆</CardTitle>
                {!isEditingMemory && (
                  <Button onClick={() => setIsEditingMemory(true)} variant="outline" size="sm">
                    编辑
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditingMemory ? (
                <div className="space-y-2">
                  <Textarea
                    value={editMemory}
                    onChange={(e) => setEditMemory(e.target.value)}
                    className="min-h-[120px] text-sm font-mono"
                    placeholder="<Memory_LTM>&#10;- ...&#10;</Memory_LTM>"
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => handleSave('longTermMemory', editMemory, setIsEditingMemory)} size="sm">保存</Button>
                    <Button onClick={() => { setEditMemory(preset.longTermMemory); setIsEditingMemory(false); }} variant="outline" size="sm">取消</Button>
                  </div>
                </div>
              ) : (
                <FlipCard
                  content={preset.longTermMemory}
                  title="长期记忆"
                  mono
                  emptyText="暂无长期记忆，点击编辑添加"
                  cachedTranslation={preset.translations?.longTermMemory}
                  onTranslationReady={(t) => updateTranslation('longTermMemory', t)}
                  onContentChanged={() => clearTranslation('longTermMemory')}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
