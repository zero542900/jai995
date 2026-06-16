'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconTrash, IconGrip } from '@/components/icons';
import { getPresets, deletePreset, getSessionsByPreset, reorderPresets } from '@/lib/storage';
import type { Preset } from '@/lib/types';

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragCounterRef = useRef(0);

  const loadPresets = useCallback(() => {
    setPresets(getPresets());
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      if (confirm(`确定删除预设「${name}」吗？相关会话也会一并删除。`)) {
        deletePreset(id);
        loadPresets();
      }
    },
    [loadPresets],
  );

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragEnter = (idx: number) => {
    dragCounterRef.current++;
    setOverIdx(idx);
  };

  const handleDragLeave = () => {
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setOverIdx(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setOverIdx(null);
      dragCounterRef.current = 0;
      return;
    }
    const newPresets = [...presets];
    const [moved] = newPresets.splice(dragIdx, 1);
    newPresets.splice(idx, 0, moved);
    setPresets(newPresets);
    reorderPresets(newPresets.map((p) => p.id));
    setDragIdx(null);
    setOverIdx(null);
    dragCounterRef.current = 0;
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
    dragCounterRef.current = 0;
  };

  const truncate = (text: string, max: number) => {
    if (!text) return '—';
    return text.length > max ? text.slice(0, max) + '...' : text;
  };

  const getSessionStatus = (presetId: string) => {
    const sessions = getSessionsByPreset(presetId);
    if (sessions.length === 0) return { label: '未打开', color: 'text-muted-foreground' };
    const hasMessages = sessions.some((s) => s.messages.length > 0);
    if (hasMessages) return { label: '会话进行中（记忆已存）', color: 'text-jai-success' };
    return { label: '未打开', color: 'text-muted-foreground' };
  };

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">预设库</h1>
        <Link href="/">
          <Button size="sm" variant="outline">
            + 新建预设
          </Button>
        </Link>
      </div>

      {presets.length === 0 ? (
        <Card className="border-jai-card-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-3">还没有保存的预设</p>
            <Link href="/">
              <Button variant="outline" size="sm">
                去生成 User 卡
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {presets.map((preset, idx) => {
            const status = getSessionStatus(preset.id);
            const isDragging = dragIdx === idx;
            const isDragOver = overIdx === idx && dragIdx !== idx;
            return (
              <Card
                key={preset.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragEnter={() => handleDragEnter(idx)}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                className={`border-jai-card-border hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group ${isDragging ? 'opacity-40 scale-[0.97]' : ''} ${isDragOver ? 'border-primary/60 shadow-md ring-1 ring-primary/20' : ''}`}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-1.5 flex-1 min-w-0">
                      <div
                        className="mt-0.5 cursor-grab active:cursor-grabbing text-jai-text-secondary/40 hover:text-jai-text-secondary transition-colors shrink-0"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <IconGrip className="w-3.5 h-3.5" />
                      </div>
                      <Link href={`/presets/${preset.id}`} className="min-w-0">
                        <h3 className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                          {preset.name}
                        </h3>
                      </Link>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(preset.id, preset.name);
                      }}
                      className="text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1.5"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground pl-5">
                    <p>
                      <span className="text-foreground/60">Char:</span>{' '}
                      {truncate(preset.charInfo, 60)}
                    </p>
                    <p>
                      <span className="text-foreground/60">User:</span>{' '}
                      {truncate(preset.userCard, 60)}
                    </p>
                    {(preset.plotData?.currentMainLineCn || preset.plotData?.currentMainLine) && (
                      <p>
                        <span className="text-foreground/60">剧情:</span>{' '}
                        {truncate(preset.plotData.currentMainLineCn || preset.plotData.currentMainLine, 40)}
                      </p>
                    )}
                  </div>
                  <div className="pt-1 border-t border-jai-muted ml-5">
                    <span className={`text-[11px] ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
