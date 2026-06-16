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
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [originalContent, setOriginalContent] = useState('');

  useEffect(() => {
    const instruction = getInstruction(id);
    if (!instruction) {
      router.push('/instructions');
      return;
    }
    setName(instruction.name);
    setSummary(instruction.summary);
    setContent(instruction.content);
    setOriginalContent(instruction.content);
    setLoaded(true);
  }, [id, router]);

  const handleAutoSummarize = useCallback(async () => {
    if (!content.trim()) return;
    const apiKey = localStorage.getItem('jai_api_key');
    if (!apiKey) return;
    setIsSummarizing(true);
    try {
      const res = await fetch('/api/instruction-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), apiKey }),
      });
      const data = await res.json();
      if (data.summary) setSummary(data.summary);
    } catch {
      // silently fail
    }
    setIsSummarizing(false);
  }, [content]);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !content.trim()) return;
    let finalSummary = summary.trim();
    // If content changed and summary is empty or wasn't manually edited, auto-regenerate
    const contentChanged = content.trim() !== originalContent.trim();
    if (contentChanged && !finalSummary) {
      const apiKey = localStorage.getItem('jai_api_key');
      if (apiKey) {
        try {
          const res = await fetch('/api/instruction-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content.trim(), apiKey }),
          });
          const data = await res.json();
          if (data.summary) finalSummary = data.summary;
        } catch {
          // fallback
        }
      }
    }
    updateInstruction(id, {
      name: name.trim(),
      summary: finalSummary,
      content: content.trim(),
    });
    setOriginalContent(content.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [id, name, summary, content, originalContent]);

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
        <div className="flex gap-2">
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="简要描述这条指令的作用（卡片上展示）"
            className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="button"
            onClick={handleAutoSummarize}
            disabled={isSummarizing || !content.trim()}
            className="shrink-0 px-2.5 py-2.5 rounded-lg border border-border text-xs text-jai-text-secondary hover:text-jai-accent hover:border-jai-accent/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSummarizing ? '生成中...' : '自动总结'}
          </button>
        </div>
        {content.trim() !== originalContent.trim() && (
          <p className="text-[10px] text-jai-accent mt-1">指令内容已修改，保存时可自动更新简介</p>
        )}
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
