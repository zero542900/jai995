'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconTrash, IconGrip } from '@/components/icons';
import { getPresets, deletePreset, getSessionsByPreset, reorderPresets } from '@/lib/storage';
import type { Preset } from '@/lib/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortablePresetCard({
  preset,
  onDelete,
  truncate,
  getSessionStatus,
  isSelected,
  onSelect,
}: {
  preset: Preset;
  onDelete: (id: string, name: string) => void;
  truncate: (text: string, max: number) => string;
  getSessionStatus: (presetId: string) => { label: string; color: string };
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: preset.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  };

  const status = getSessionStatus(preset.id);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(preset.id)}
      className={`border-jai-card-border hover:border-primary/40 hover:shadow-sm cursor-pointer group ${isDragging ? 'opacity-50 z-50 shadow-lg' : ''} ${isSelected ? 'border-jai-accent ring-1 ring-jai-accent/30' : ''}`}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            <div
              className="cursor-grab active:cursor-grabbing text-jai-text-secondary/40 hover:text-jai-text-secondary transition-colors shrink-0 flex items-center justify-center w-7 h-7 -ml-1 -mt-0.5 rounded hover:bg-jai-muted touch-none"
              {...attributes}
              {...listeners}
            >
              <IconGrip className="w-3.5 h-3.5" />
            </div>
            <Link href={`/presets/${preset.id}`} onClick={e => e.stopPropagation()} className="min-w-0">
              <h3 className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                {preset.name}
              </h3>
            </Link>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(preset.id, preset.name);
            }}
            className="text-muted-foreground hover:text-destructive md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1.5"
          >
            <IconTrash className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground pl-5">
          <p>
            <span className="text-foreground/60">Char:</span>{' '}
            {truncate(preset.charInfo, 100)}
          </p>
          <p>
            <span className="text-foreground/60">性格:</span>{' '}
            {truncate(preset.userPersonality, 100)}
          </p>
          {(preset.plotData?.currentMainLineCn || preset.plotData?.currentMainLine) && (
            <p>
              <span className="text-foreground/60">剧情:</span>{' '}
              {truncate(preset.plotData.currentMainLineCn || preset.plotData.currentMainLine, 60)}
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
}

function DetailPanel({ preset, truncate }: { preset: Preset | null; truncate: (text: string, max: number) => string }) {
  if (!preset) {
    return (
      <Card className="border-jai-card-border h-full">
        <CardContent className="py-16 text-center">
          <p className="text-sm text-muted-foreground">点击左侧预设查看详情</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-jai-card-border h-full">
      <CardContent className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-200px)]">
        <div>
          <h3 className="text-sm font-semibold text-jai-accent">{preset.name}</h3>
        </div>

        <div className="space-y-2.5">
          <div>
            <div className="text-[11px] font-medium text-jai-text-secondary uppercase tracking-wide mb-1">Char 信息</div>
            <p className="text-xs text-jai-text leading-relaxed whitespace-pre-wrap bg-jai-muted/50 rounded-lg p-2.5">
              {preset.charInfo || '—'}
            </p>
          </div>

          <div>
            <div className="text-[11px] font-medium text-jai-text-secondary uppercase tracking-wide mb-1">性格要求</div>
            <p className="text-xs text-jai-text leading-relaxed whitespace-pre-wrap bg-jai-muted/50 rounded-lg p-2.5">
              {preset.userPersonality || '—'}
            </p>
          </div>

          <div>
            <div className="text-[11px] font-medium text-jai-text-secondary uppercase tracking-wide mb-1">User 卡</div>
            <p className="text-xs text-jai-text leading-relaxed whitespace-pre-wrap bg-jai-muted/50 rounded-lg p-2.5 max-h-[150px] overflow-y-auto">
              {preset.userCard || '—'}
            </p>
          </div>

          {preset.longTermMemory && (
            <div>
              <div className="text-[11px] font-medium text-jai-text-secondary uppercase tracking-wide mb-1">长期记忆</div>
              <p className="text-xs text-jai-text leading-relaxed whitespace-pre-wrap bg-jai-muted/50 rounded-lg p-2.5 max-h-[150px] overflow-y-auto">
                {preset.longTermMemory}
              </p>
            </div>
          )}

          {(preset.plotData?.currentMainLine || preset.plotData?.currentMainLineCn) && (
            <div>
              <div className="text-[11px] font-medium text-jai-text-secondary uppercase tracking-wide mb-1">剧情主线</div>
              <p className="text-xs text-jai-text leading-relaxed whitespace-pre-wrap bg-jai-muted/50 rounded-lg p-2.5">
                {preset.plotData.currentMainLineCn || preset.plotData.currentMainLine}
              </p>
              {preset.plotData.progressDesc && (
                <p className="text-[11px] text-jai-text-secondary mt-1.5">
                  {preset.plotData.progressDescCn || preset.plotData.progressDesc}
                </p>
              )}
            </div>
          )}

          {preset.greeting && (
            <div>
              <div className="text-[11px] font-medium text-jai-text-secondary uppercase tracking-wide mb-1">开场白</div>
              <p className="text-xs text-jai-text leading-relaxed whitespace-pre-wrap bg-jai-muted/50 rounded-lg p-2.5 max-h-[150px] overflow-y-auto">
                {preset.greeting}
              </p>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-jai-card-border">
          <Link href={`/presets/${preset.id}`}>
            <Button size="sm" className="w-full">进入预设</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        if (selectedId === id) setSelectedId(null);
        loadPresets();
      }
    },
    [loadPresets, selectedId],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = presets.findIndex((p) => p.id === active.id);
    const newIndex = presets.findIndex((p) => p.id === over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const newPresets = arrayMove(presets, oldIndex, newIndex);
    setPresets(newPresets);
    reorderPresets(newPresets.map((p) => p.id));
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

  const selectedPreset = presets.find(p => p.id === selectedId) || null;

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
        <div className="flex gap-4 md:flex-row flex-col">
          {/* Left: Card List */}
          <div className="flex-1 min-w-0">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={presets.map((p) => p.id)} strategy={rectSortingStrategy}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {presets.map((preset) => (
                    <SortablePresetCard
                      key={preset.id}
                      preset={preset}
                      onDelete={handleDelete}
                      truncate={truncate}
                      getSessionStatus={getSessionStatus}
                      isSelected={selectedId === preset.id}
                      onSelect={setSelectedId}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Right: Detail Panel (PC only) */}
          <div className="hidden md:block w-[340px] shrink-0 sticky top-4 self-start">
            <DetailPanel preset={selectedPreset} truncate={truncate} />
          </div>
        </div>
      )}
    </div>
  );
}
