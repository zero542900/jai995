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
  const [editPlot, setEditPlot] = useState('');
  const [editMemory, setEditMemory] = useState('');
  const [editGreeting, setEditGreeting] = useState('');
  const [editCharInfo, setEditCharInfo] = useState('');
  const [isEditingPlot, setIsEditingPlot] = useState(false);
  const [isEditingMemory, setIsEditingMemory] = useState(false);
  const [isEditingGreeting, setIsEditingGreeting] = useState(false);
  const [isEditingCharInfo, setIsEditingCharInfo] = useState(false);

  const loadPreset = useCallback(() => {
    const p = getPreset(presetId);
    if (p) {
      setPreset(p);
      setEditPlot(p.plotDirection);
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

  const handleSave = (field: keyof Preset, value: string, setter: (v: boolean) => void) => {
    if (preset) {
      const updated = { ...preset, [field]: value, updatedAt: Date.now() };
      savePreset(updated);
      setPreset(updated);
      setter(false);
    }
  };

  const handleStartSession = () => {
    router.push(`/chat?preset=${presetId}`);
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

      {/* Session Settings */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">人称视角</span>
          <select
            value={preset.personMode || 'third'}
            onChange={(e) => {
              const updated = { ...preset, personMode: e.target.value as 'first' | 'third', updatedAt: Date.now() };
              savePreset(updated);
              setPreset(updated);
            }}
            className="border border-pink-200 rounded-md px-2 py-1 text-sm bg-white"
          >
            <option value="third">第三人称</option>
            <option value="first">第一人称</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">思考模式</span>
          <button
            onClick={() => {
              const updated = { ...preset, thinkingEnabled: !preset.thinkingEnabled, updatedAt: Date.now() };
              savePreset(updated);
              setPreset(updated);
            }}
            className={`relative w-10 h-5 rounded-full transition-colors ${preset.thinkingEnabled ? 'bg-violet-400' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${preset.thinkingEnabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      <Tabs defaultValue="char" className="w-full">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="char">Char</TabsTrigger>
          <TabsTrigger value="user">User</TabsTrigger>
          <TabsTrigger value="greeting">开场白</TabsTrigger>
          <TabsTrigger value="plot">剧情</TabsTrigger>
          <TabsTrigger value="memory">记忆</TabsTrigger>
        </TabsList>

        {/* Char Tab */}
        <TabsContent value="char">
          <Card className="border-pink-100">
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
                <FlipCard content={preset.charInfo} title="角色卡" emptyText="暂无角色信息，点击编辑添加" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Tab */}
        <TabsContent value="user">
          <Card className="border-pink-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">User 卡</CardTitle>
            </CardHeader>
            <CardContent>
              <FlipCard content={preset.userCard} title="User 卡" mono emptyText="暂无 User 卡" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Greeting Tab */}
        <TabsContent value="greeting">
          <Card className="border-pink-100">
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
                <FlipCard content={preset.greeting} title="开场白" emptyText="暂无开场白，点击编辑添加" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plot Tab */}
        <TabsContent value="plot">
          <Card className="border-pink-100">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">剧情走向</CardTitle>
                {!isEditingPlot && (
                  <Button onClick={() => setIsEditingPlot(true)} variant="outline" size="sm">
                    编辑
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditingPlot ? (
                <div className="space-y-2">
                  <Textarea
                    value={editPlot}
                    onChange={(e) => setEditPlot(e.target.value)}
                    className="min-h-[120px] text-sm"
                    placeholder="输入当前剧情走向..."
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => handleSave('plotDirection', editPlot, setIsEditingPlot)} size="sm">保存</Button>
                    <Button onClick={() => { setEditPlot(preset.plotDirection); setIsEditingPlot(false); }} variant="outline" size="sm">取消</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <FlipCard content={preset.plotDirection} title="剧情走向" emptyText="暂无剧情走向，点击编辑添加" />
                  {preset.plotData && (
                    <div className="space-y-2 text-xs text-gray-500">
                      {preset.plotData.plotStage && (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">阶段:</span>
                          <span>{preset.plotData.plotStage}</span>
                          {preset.plotData.plotStageCn && <span className="text-gray-400">({preset.plotData.plotStageCn})</span>}
                        </div>
                      )}
                      {preset.plotData.progressDesc && (
                        <div>
                          <span className="text-gray-400">进展:</span>
                          <span className="ml-1">{preset.plotData.progressDesc}</span>
                          {preset.plotData.progressDescCn && <span className="text-gray-400 ml-1">({preset.plotData.progressDescCn})</span>}
                        </div>
                      )}
                      {preset.plotData.savedPlotDirections && preset.plotData.savedPlotDirections.length > 1 && (
                        <div>
                          <span className="text-gray-400">已保存走向:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {preset.plotData.savedPlotDirections.map((d, i) => (
                              <span key={i} className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${d.en === preset.plotDirection ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-500'}`}>
                                {d.en} {d.cn && `(${d.cn})`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Memory Tab */}
        <TabsContent value="memory">
          <Card className="border-pink-100">
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
                <FlipCard content={preset.longTermMemory} title="长期记忆" mono emptyText="暂无长期记忆，点击编辑添加" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
