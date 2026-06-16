import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeek } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const { content, apiKey } = await request.json();

    if (!content || !apiKey) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const systemPrompt = `你是指令总结助手。用户会给你一段 AI 指令文本，你需要用一句简短的中文（20-40字）概括这条指令的核心作用。
要求：
- 只输出总结句，不要任何解释或标号
- 不要用"该指令"开头，直接说作用
- 示例：限制角色只用{{user}}视角，禁止描写{{char}}内心`;

    const response = await callDeepSeek({
      messages: [
        { role: 'user', content },
      ],
      systemPrompt,
      apiKey,
      model: 'deepseek-chat',
      maxTokens: 100,
      temperature: 0.3,
      stream: false,
    });

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content?.trim() || '';
    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Instruction summary error:', error);
    return NextResponse.json({ error: '总结生成失败' }, { status: 500 });
  }
}
