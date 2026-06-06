'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IconCheck, IconKey } from '@/components/icons';
import { getApiKey, setApiKey } from '@/lib/storage';

export default function SettingsPage() {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');

  useEffect(() => {
    const stored = getApiKey();
    if (stored) {
      setMaskedKey(stored.slice(0, 6) + '***' + stored.slice(-4));
      setSaved(true);
    }
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

  return (
    <div className="page-enter space-y-6">
      <h1 className="text-xl font-semibold text-foreground">设置</h1>

      <Card className="border-jai-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-1.5"><IconKey className="w-4 h-4 text-jai-secondary" /> DeepSeek API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            输入你的 DeepSeek API Key，Key 仅保存在本地浏览器中，不会上传到任何服务器。
          </p>

          {saved && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <IconCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-emerald-700">
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
