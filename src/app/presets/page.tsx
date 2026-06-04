'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getPresets, deletePreset } from '@/lib/storage';
import type { Preset } from '@/lib/types';

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

  const truncate = (text: string, max: number) => {
    if (!text) return '—';
    return text.length > max ? text.slice(0, max) + '...' : text;
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
        <Card className="border-pink-100">
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
          {presets.map((preset) => (
            <Card
              key={preset.id}
              className="border-pink-100 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group"
            >
              <Link href={`/presets/${preset.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                      {preset.name}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(preset.id, preset.name);
                      }}
                      className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      <span className="text-foreground/60">Char:</span>{' '}
                      {truncate(preset.charInfo, 60)}
                    </p>
                    <p>
                      <span className="text-foreground/60">User:</span>{' '}
                      {truncate(preset.userCard, 60)}
                    </p>
                    {preset.plotDirection && (
                      <p>
                        <span className="text-foreground/60">剧情:</span>{' '}
                        {truncate(preset.plotDirection, 40)}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
