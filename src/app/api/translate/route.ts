import { NextRequest } from 'next/server';
import { WRITING_STYLE_INSTRUCTION } from '@/lib/deepseek';

const TRANSLATION_SYSTEM_PROMPT = `你是一位精通中英双语、深谙同人圈文化的资深译者，尤其擅长 AO3 网站上的同人文。你的翻译不仅是语言转换，更是文化与情感的传递。

核心原则：
- 精准还原文风：根据英文原文语气灵活切换，保留口语化表达，不做过度书面化或煽情处理。
- 术语统一：对"AU"、"Canon Divergence"等圈内共识术语，使用通用译法，首次出现时保留英文原词。
- 禁止 AI 翻译腔：避免生硬的直译句式。译文读起来像有文风的真人作者所写。

${WRITING_STYLE_INSTRUCTION}

仅输出翻译结果，不要添加任何解释或注释。`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, apiKey, thinkingEnabled } = body;

    if (!apiKey) {
      return Response.json({ error: '请先在设置页面配置 DeepSeek API Key' }, { status: 400 });
    }

    if (!text?.trim()) {
      return Response.json({ error: '请提供需要翻译的英文文本' }, { status: 400 });
    }

    const messages = [
      { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
      { role: 'user', content: `请将以下英文翻译为中文：\n\n${text}` },
    ];

    // Non-streaming request for translation (short content, simpler and more reliable)
    const model = thinkingEnabled ? 'deepseek-reasoner' : 'deepseek-chat';
    const temperature = thinkingEnabled ? undefined : 0.5;
    const requestBody: Record<string, unknown> = {
      model,
      messages,
      stream: false,
    };
    if (temperature !== undefined) {
      requestBody.temperature = temperature;
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `DeepSeek API error: ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.error?.message) errMsg = errJson.error.message;
      } catch { /* use default */ }
      return Response.json({ error: errMsg }, { status: response.status >= 400 && response.status < 500 ? response.status : 500 });
    }

    const data = await response.json();
    const translation = data.choices?.[0]?.message?.content || '';
    const reasoning = data.choices?.[0]?.message?.reasoning_content || '';

    return Response.json({ translation, reasoning });
  } catch (error) {
    const message = error instanceof Error ? error.message : '翻译失败';
    return Response.json({ error: message }, { status: 500 });
  }
}
