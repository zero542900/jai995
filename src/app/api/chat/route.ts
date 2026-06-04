import { NextRequest } from 'next/server';
import { callDeepSeek, createSSEStream, handleAPIError, validateApiKey, streamResponse } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, apiKey, thinkingEnabled, systemPrompt } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    const allMessages: { role: string; content: string }[] = [];
    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt });
    }
    allMessages.push(...messages);

    const model = thinkingEnabled ? 'deepseek-reasoner' : 'deepseek-chat';
    const temperature = thinkingEnabled ? undefined : 0.9;

    const response = await callDeepSeek({ apiKey, messages: allMessages, model, temperature });
    return streamResponse(createSSEStream(response));
  } catch (error) {
    return handleAPIError(error);
  }
}
