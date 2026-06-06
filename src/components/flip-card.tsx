'use client';

import { useState, useEffect, useRef } from 'react';
import { copyToClipboard } from '@/lib/utils';
import { getApiKey } from '@/lib/storage';

interface FlipCardProps {
  /** 英文原文 */
  content: string;
  /** 卡片标题（如"角色卡"、"User 卡"等） */
  title: string;
  /** 是否使用等宽字体 */
  mono?: boolean;
  /** 最大高度 */
  maxHeight?: string;
  /** 翻译为空时的提示 */
  emptyText?: string;
  /** 外部缓存的翻译（如 preset.translations.charInfo），有则直接使用，不再调 API */
  cachedTranslation?: string;
  /** 翻译完成后的回调，用于将翻译写回持久化存储 */
  onTranslationReady?: (translation: string) => void;
  /** 原文变化时回调，用于清除持久化的翻译缓存 */
  onContentChanged?: () => void;
}

export default function FlipCard({
  content,
  title,
  mono = false,
  maxHeight = '60vh',
  emptyText = '暂无内容',
  cachedTranslation,
  onTranslationReady,
  onContentChanged,
}: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  // 优先使用外部缓存，否则使用内部状态
  const [localTranslation, setLocalTranslation] = useState('');
  const [translating, setTranslating] = useState(false);
  const prevContentRef = useRef(content);

  // 当 content 变化时（编辑保存后），重置翻译缓存
  useEffect(() => {
    if (prevContentRef.current !== content) {
      setLocalTranslation('');
      prevContentRef.current = content;
      onContentChanged?.();
    }
  }, [content, onContentChanged]);

  // 最终使用的翻译：外部缓存优先，否则用内部状态
  const translation = cachedTranslation || localTranslation;

  const handleFlip = async () => {
    if (!flipped && !translation && content) {
      // First flip — fetch translation
      setTranslating(true);
      try {
        const apiKey = getApiKey();
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: content, apiKey }),
        });
        const data = await res.json();
        if (data.translation) {
          setLocalTranslation(data.translation);
          // 回调外部持久化
          onTranslationReady?.(data.translation);
        }
      } catch {
        // Translation failed, still flip
      } finally {
        setTranslating(false);
      }
    }
    setFlipped(!flipped);
  };

  if (!content) {
    return (
      <div className="bg-muted/30 rounded-lg p-4 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  const displayContent = flipped ? (translation || '翻译中...') : content;
  const isEnglish = !flipped;

  return (
    <div className="space-y-2">
      <div
        className={`relative rounded-lg border transition-all duration-300 ${
          flipped ? 'border-violet-200 bg-violet-50/30' : 'border-pink-100 bg-muted/30'
        }`}
      >
        {/* Language badge */}
        <div className="flex items-center justify-between px-3 pt-2">
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
              flipped
                ? 'bg-violet-100 text-violet-600'
                : 'bg-pink-100 text-pink-600'
            }`}
          >
            {flipped ? '中文' : 'English'}
          </span>
          <span className="text-[11px] text-muted-foreground">{title}</span>
        </div>

        {/* Content */}
        <div
          className={`p-3 overflow-y-auto ${mono ? 'font-mono text-[13px]' : 'text-sm'} leading-relaxed whitespace-pre-wrap`}
          style={{ maxHeight }}
        >
          {translating ? (
            <span className="text-muted-foreground animate-pulse">翻译中...</span>
          ) : (
            displayContent
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleFlip}
          disabled={translating}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium border border-pink-200 text-pink-600 hover:bg-pink-50 transition-colors disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
          {flipped ? '查看原文' : '查看中文'}
        </button>
        <button
          onClick={() => copyToClipboard(isEnglish ? content : translation)}
          disabled={!displayContent}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium border border-pink-200 text-pink-600 hover:bg-pink-50 transition-colors disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          复制
        </button>
      </div>
    </div>
  );
}
