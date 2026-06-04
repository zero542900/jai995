'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IconBack, IconPlay, IconSave } from '@/components/icons';
import { getPreset, savePreset, createSession, saveSession, getSessionsByPreset } from '@/lib/storage';
import type { Preset } from '@/lib/types';

export default function PresetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const presetId = params.id as string;

  const [preset, setPreset] = useState<Preset | null>(null);
  const [editPlot, setEditPlot] = useState('');
  const [editMemory, setEditMemory] = useState('');
  const [editGreeting, setEditGreeting] = useState('');
  const [isEditingPlot, setIsEditingPlot] = useState(false);
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [isEditingGreeting, setIsEditingGreeting] = useState(false);

  const loadPreset = useCallback(() => {
    const p = getPreset(presetId);
    if (p) {
      setPreset(p);
      setEditPlot(p.plotDirection);
      setEditMemory(p.longTermMemory);
      setEditGreeting(p.greeting);
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

  const handleSavePlot = () => {
    if (preset) {
      const updated = { ...preset, plotDirection: editPlot };
      savePreset(updated);
      setPreset(updated);
      setIsEditingPlot(false);
    }
  };

  const handleSaveMemory = () => {
    if (preset) {
      const updated = { ...preset, longTermMemory: editMemory };
      savePreset(updated);
      setPreset(updated);
      setIsEditingMemory(false);
    }
  };

  const handleSaveGreeting = () => {
    if (preset) {
      const updated = { ...preset, greeting: editGreeting };
      savePreset(updated);
      setPreset(updated);
      setIsEditingGreeting(false);
    }
  };

  const handleStartSession = () => {
    const existingSessions = getSessionsByPreset(presetId);
    const sessionName = `${preset.name} - 会话 ${existingSessions.length + 1}`;
    const session = createSession(presetId, sessionName);
    saveSession(session);
    router.push(`/chat?sessionId=${session.id}&presetId=${presetId}`);
  };

  return (
    <div className="page-enter space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/presets')}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <IconBack className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">{preset.name}</h1>
      </div>

      <Button onClick={handleStartSession} className="w-full gap-1.5" size="lg">
        <IconPlay className="w-4 h-4" /> 开始会话
      </Button>

      <Tabs defaultValue="char" className="w-full">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="char">Char</TabsTrigger>
          <TabsTrigger value="user">User</TabsTrigger>
          <TabsTrigger value="greeting">开场白</TabsTrigger>
          <TabsTrigger value="plot">剧情</TabsTrigger>
          <TabsTrigger value="memory">记忆</TabsTrigger>
        </TabsList>

        <TabsContent value="char">
          <Card className="border-pink-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">角色卡 (Char)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg font-mono leading-relaxed max-h-[500px] overflow-y-auto">
                {preset.charInfo || '—'}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user">
          <Card className="border-pink-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">User 卡</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg font-mono leading-relaxed max-h-[500px] overflow-y-auto">
                {preset.userCard || '—'}
              </pre>
              <Button
                onClick={() => navigator.clipboard.writeText(preset.userCard)}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                复制 User 卡
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="greeting">
          <Card className="border-pink-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">开场白 (Greeting)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditingGreeting ? (
                <>
                  <Textarea
                    value={editGreeting}
                    onChange={(e) => setEditGreeting(e.target.value)}
                    className="min-h-[120px] text-sm"
                    placeholder="输入开场白，用于设定角色初次登场场景..."
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSaveGreeting} size="sm">
                      保存
                    </Button>
                    <Button
                      onClick={() => {
                        setEditGreeting(preset.greeting);
                        setIsEditingGreeting(false);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      取消
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap min-h-[60px]">
                    {preset.greeting || '暂无开场白，点击编辑添加'}
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={() => setIsEditingGreeting(true)} variant="outline" size="sm">
                      编辑
                    </Button>
                    {preset.greeting && (
                      <Button
                        onClick={() => navigator.clipboard.writeText(preset.greeting)}
                        variant="outline"
                        size="sm"
                      >
                        复制
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plot">
          <Card className="border-pink-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">剧情走向</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditingPlot ? (
                <>
                  <Textarea
                    value={editPlot}
                    onChange={(e) => setEditPlot(e.target.value)}
                    className="min-h-[120px] text-sm"
                    placeholder="输入当前剧情走向..."
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSavePlot} size="sm">
                      保存
                    </Button>
                    <Button
                      onClick={() => {
                        setEditPlot(preset.plotDirection);
                        setIsEditingPlot(false);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      取消
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap min-h-[60px]">
                    {preset.plotDirection || '暂无剧情走向，点击编辑添加'}
                  </p>
                  <Button onClick={() => setIsEditingPlot(true)} variant="outline" size="sm">
                    编辑
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory">
          <Card className="border-pink-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">长期记忆</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isEditingMemory ? (
                <>
                  <Textarea
                    value={editMemory}
                    onChange={(e) => setEditMemory(e.target.value)}
                    className="min-h-[120px] text-sm font-mono"
                    placeholder="<Memory_LTM>&#10;- ...&#10;</Memory_LTM>"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleSaveMemory} size="sm">
                      保存
                    </Button>
                    <Button
                      onClick={() => {
                        setEditMemory(preset.longTermMemory);
                        setIsEditingMemory(false);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      取消
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono min-h-[60px]">
                    {preset.longTermMemory || '暂无长期记忆，点击编辑添加'}
                  </pre>
                  <Button onClick={() => setIsEditingMemory(true)} variant="outline" size="sm">
                    编辑
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
