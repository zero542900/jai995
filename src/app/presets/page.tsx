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
}: {
  preset: Preset;
  onDelete: (id: string, name: string) => void;
  truncate: (text: string, max: number) => string;
  getSessionStatus: (presetId: string) => { label: string; color: string };
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: preset.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const status = getSessionStatus(preset.id);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`border-jai-card-border hover:border-primary/40 hover:shadow-sm transition-shadow cursor-pointer group ${isDragging ? 'opacity-50 z-50 shadow-lg' : ''}`}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            <div
              className="mt-0.5 cursor-grab active:cursor-grabbing text-jai-text-secondary/40 hover:text-jai-text-secondary transition-colors shrink-0"
              {...attributes}
              {...listeners}
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
}

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
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
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
