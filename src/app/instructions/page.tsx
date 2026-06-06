'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconCopy, IconTrash, IconCheck, IconBook } from '@/components/icons';
import { getInstructions, deleteInstruction, createInstruction, seedInstructions } from '@/lib/storage';
import type { Instruction } from '@/lib/types';

export default function InstructionsPage() {
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [newContent, setNewContent] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadInstructions = useCallback(() => {
    setInstructions(getInstructions());
  }, []);

  useEffect(() => {
    seedInstructions();
    loadInstructions();
  }, [loadInstructions]);

  const handleCopy = useCallback(async (instruction: Instruction) => {
    try {
      await navigator.clipboard.writeText(instruction.content);
      setCopiedId(instruction.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = instruction.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(instruction.id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  }, []);

  const handleDelete = useCallback(
    (id: string, name: string) => {
      if (confirm(`确定删除指令「${name}」吗？`)) {
        deleteInstruction(id);
        loadInstructions();
      }
    },
    [loadInstructions],
  );

  const handleCreate = useCallback(() => {
    if (!newName.trim() || !newContent.trim()) return;
    createInstruction(newName.trim(), newContent.trim(), newSummary.trim() || newName.trim());
    setNewName('');
    setNewSummary('');
    setNewContent('');
    setShowCreate(false);
    loadInstructions();
  }, [newName, newSummary, newContent, loadInstructions]);

  return (
    <div className="page-enter space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">指令库</h1>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
          <IconBook className="w-4 h-4" />
          新增指令
        </Button>
      </div>

      {/* 新增指令表单 */}
      {showCreate && (
        <Card className="border-primary/30 bg-card">
          <CardContent className="pt-5 space-y-3">
            <input
              type="text"
              placeholder="指令名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="text"
              placeholder="中文简介（卡片上显示的描述，选填，默认使用名称）"
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <textarea
              placeholder="完整指令内容"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setShowCreate(false); setNewName(''); setNewSummary(''); setNewContent(''); }}>
                取消
              </Button>
              <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || !newContent.trim()}>
                保存
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 指令卡片列表 */}
      {instructions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <IconBook className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm">还没有指令</p>
          <p className="text-xs mt-1">点击右上角「新增指令」添加</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {instructions.map((instruction) => (
            <Card
              key={instruction.id}
              className="group border-border hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
            >
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Link
                    href={`/instructions/${instruction.id}`}
                    className="flex-1 min-w-0"
                  >
                    <h3 className="font-semibold text-sm text-foreground truncate">
                      {instruction.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {instruction.summary || instruction.name}
                    </p>
                  </Link>
                </div>

                {/* 操作按钮行 */}
                <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border/50">
                  <button
                    onClick={() => handleCopy(instruction)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                    title="复制指令内容"
                  >
                    {copiedId === instruction.id ? (
                      <>
                        <IconCheck className="w-3.5 h-3.5 text-jai-success" />
                        <span className="text-jai-success">已复制</span>
                      </>
                    ) : (
                      <>
                        <IconCopy className="w-3.5 h-3.5" />
                        <span>复制</span>
                      </>
                    )}
                  </button>
                  <div className="flex-1" />
                  <Link
                    href={`/instructions/${instruction.id}`}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    编辑
                  </Link>
                  <button
                    onClick={() => handleDelete(instruction.id, instruction.name)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                    title="删除"
                  >
                    <IconTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
