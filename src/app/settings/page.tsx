'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IconCheck, IconKey } from '@/components/icons';
import { getApiKey, setApiKey } from '@/lib/storage';
import { THEMES, getCurrentThemeId, applyTheme } from '@/lib/themes';

export default function SettingsPage() {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [currentThemeId, setCurrentThemeId] = useState('rose');

  useEffect(() => {
    const stored = getApiKey();
    if (stored) {
      setMaskedKey(stored.slice(0, 6) + '***' + stored.slice(-4));
      setSaved(true);
    }
    setCurrentThemeId(getCurrentThemeId());
  }, []);

  const handleSave = () => {
    if (!key.trim()) {
      alert('请输入 API Key');
      return;
    }
    setApiKey(key.trim());
    setMaskedKey(key.trim().slice(0, 6) + '***' + key.trim().slice(-4));
    setSaved(true);
    setKey('');
  };

  const handleClear = () => {
    setApiKey('');
    setSaved(false);
    setMaskedKey('');
  };

  const handleThemeChange = (themeId: string) => {
    applyTheme(themeId);
    setCurrentThemeId(themeId);
  };

  return (
    <div className="page-enter space-y-6">
      <h1 className="text-xl font-semibold text-foreground">设置</h1>

      {/* 主题选择 */}
      <Card className="border-jai-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-1.5">
            <svg className="w-4 h-4 text-jai-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            主题配色
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            选择你喜欢的配色方案，切换后立即生效。
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            {THEMES.map((theme) => {
              const isActive = currentThemeId === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => handleThemeChange(theme.id)}
                  className={`
                    relative p-2.5 rounded-xl border-2 transition-all duration-300 text-left
                    ${isActive
                      ? 'border-jai-accent shadow-[0_2px_8px_var(--color-jai-shadow)]'
                      : 'border-jai-card-border hover:border-jai-secondary hover:shadow-[0_2px_8px_var(--color-jai-shadow)]'
                    }
                  `}
                >
                  {/* 大色块预览 - 模拟卡片外观 */}
                  <div
                    className="w-full aspect-[4/3] rounded-lg overflow-hidden mb-2 relative"
                    style={{ backgroundColor: theme.colors['jai-bg'] }}
                  >
                    {/* 模拟卡片 */}
                    <div
                      className="absolute top-1.5 left-1.5 right-1.5 bottom-2.5 rounded-md border"
                      style={{
                        backgroundColor: theme.colors['jai-card'],
                        borderColor: theme.colors['jai-card-border'],
                      }}
                    >
                      {/* 模拟标题行 */}
                      <div className="p-1.5 space-y-1">
                        <div className="h-1 w-3/5 rounded-full" style={{ backgroundColor: theme.colors['jai-accent'] }} />
                        <div className="h-0.5 w-4/5 rounded-full" style={{ backgroundColor: theme.colors['jai-text-secondary'], opacity: 0.4 }} />
                        <div className="h-0.5 w-2/3 rounded-full" style={{ backgroundColor: theme.colors['jai-text-secondary'], opacity: 0.3 }} />
                      </div>
                      {/* 模拟按钮 */}
                      <div className="absolute bottom-1 right-1.5 h-1.5 w-1/3 rounded-full" style={{ backgroundColor: theme.colors['jai-secondary'] }} />
                    </div>
                    {/* 模拟输入框 */}
                    <div
                      className="absolute bottom-0.5 left-1.5 right-1.5 h-1.5 rounded-sm"
                      style={{ backgroundColor: theme.colors['jai-input-bg'] }}
                    />
                  </div>

                  {/* 主题名称 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-jai-text leading-tight">{theme.name}</div>
                      <div className="text-[10px] text-jai-text-secondary leading-tight">{theme.nameEn}</div>
                    </div>
                    {isActive && (
                      <div className="flex-shrink-0 w-4 h-4 rounded-full bg-jai-success flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* API Key 设置 */}
      <Card className="border-jai-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-1.5"><IconKey className="w-4 h-4 text-jai-secondary" /> DeepSeek API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            输入你的 DeepSeek API Key，Key 仅保存在本地浏览器中，不会上传到任何服务器。
          </p>

          {saved && (
            <div className="flex items-center gap-2 p-3 bg-jai-success/10 border border-jai-success/30 rounded-lg">
              <IconCheck className="w-4 h-4 text-jai-success" />
              <span className="text-sm text-jai-success">
                已保存 Key: <code className="font-mono">{maskedKey}</code>
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="sk-..."
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="flex-1"
            />
            <Button onClick={handleSave}>保存</Button>
            {saved && (
              <Button onClick={handleClear} variant="outline">
                清除
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
