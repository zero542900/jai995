import { NextRequest } from 'next/server';
import { WRITING_STYLE_INSTRUCTION, MARKDOWN_FORMAT_INSTRUCTION, callDeepSeek, validateApiKey, handleAPIError } from '@/lib/deepseek';

const TRANSLATION_SYSTEM_PROMPT = `你是一位精通中英双语、深谙同人圈文化的资深译者，尤其擅长 AO3 网站上的同人文。你的翻译不仅是语言转换，更是文化与情感的传递。

核心原则：
- 精准还原文风：根据英文原文语气灵活切换，保留口语化表达，不做过度书面化或煽情处理。
- 术语统一：对"AU"、"Canon Divergence"等圈内共识术语，使用通用译法，首次出现时保留英文原词。
- 禁止 AI 翻译腔：避免生硬的直译句式。译文读起来像有文风的真人作者所写。

${WRITING_STYLE_INSTRUCTION}

仅输出翻译结果，不要添加任何解释或注释。

${MARKDOWN_FORMAT_INSTRUCTION}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, apiKey, context } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: '请提供需要翻译的英文文本' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contextPrompt = context
      ? `\n\n【对话上下文】（仅供理解语境，绝对不要翻译以下上下文内容）\n${context}\n`
      : '';

    const messages = [
      { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
      { role: 'user', content: `请将下方【待翻译文本】翻译为中文。${contextPrompt}\n【待翻译文本】\n${text}` },
    ];

    // 翻译不需要思考模式，强制使用 deepseek-chat + 不开启 thinking
    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages,
      stream: false,
    });

    const data = await response.json();
    const translation = data?.choices?.[0]?.message?.content || '';

    if (!translation) {
      return new Response(JSON.stringify({ error: '翻译结果为空，请重试' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ translation }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return handleAPIError(error);
  }
}
