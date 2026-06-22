import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeek } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, existingSummary, apiKey } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key is required' }, { status: 400 });
    }

    const systemPrompt = `You are a medical assistant summarizing chat records between a patient and Dr. House (an online doctor).
Summarize the conversation into a concise medical note (200-300 words in Chinese).
Focus on: symptoms reported, diagnoses/suspicions, medications mentioned, health trends, and any notable advice from House.
${existingSummary ? `\nPrevious summary (incorporate and update):\n${existingSummary}\n` : ''}
Output ONLY the summary text, no preamble.`;

    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      stream: false,
      temperature: 0.3,
      maxTokens: 500,
    });

    const data = await response.json();
    const summary = data?.choices?.[0]?.message?.content || '';

    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ error: 'Summary generation failed' }, { status: 500 });
  }
}
