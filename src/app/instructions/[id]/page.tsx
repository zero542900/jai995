'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { IconBack, IconSave, IconCopy, IconCheck, IconTrash } from '@/components/icons';
import { getInstruction, updateInstruction, deleteInstruction } from '@/lib/storage';

export default function InstructionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const instruction = getInstruction(id);
    if (!instruction) {
      router.push('/instructions');
      return;
    }
    setName(instruction.name);
    setSummary(instruction.summary);
    setContent(instruction.content);
    setLoaded(true);
  }, [id, router]);

  const handleSave = useCallback(() => {
    if (!name.trim() || !content.trim()) return;
    updateInstruction(id, {
      name: name.trim(),
      summary: summary.trim(),
      content: content.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [id, name, summary, content]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [content]);

  const handleDelete = useCallback(() => {
    if (confirm('确定删除此指令吗？')) {
      deleteInstruction(id);
      router.push('/instructions');
    }
  }, [id, router]);

  if (!loaded) return null;

  return (
    <div className="page-enter space-y-5">
      {/* 顶部操作栏 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/instructions')}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <IconBack className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground flex-1">编辑指令</h1>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
        >
          {copied ? (
            <>
              <IconCheck className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-500">已复制</span>
            </>
          ) : (
            <>
              <IconCopy className="w-4 h-4" />
              复制
            </>
          )}
        </button>
        <Button size="sm" onClick={handleSave} disabled={!name.trim() || !content.trim()} className="gap-1.5">
          <IconSave className="w-4 h-4" />
          {saved ? '已保存' : '保存'}
        </Button>
      </div>

      {/* 指令名称 */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">指令名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="输入指令名称"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* 中文简介 */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">中文简介</label>
        <input
          type="text"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="简要描述这条指令的作用（卡片上展示）"
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* 完整指令内容 */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">指令内容</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="输入完整指令内容"
          rows={14}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
        />
      </div>

      {/* 删除 */}
      <div className="pt-2">
        <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive hover:bg-destructive/5 gap-1.5">
          <IconTrash className="w-4 h-4" />
          删除此指令
        </Button>
      </div>
    </div>
  );
}
