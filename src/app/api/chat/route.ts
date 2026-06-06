import { NextRequest } from 'next/server';
import { callDeepSeek, createSSEStream, handleAPIError, validateApiKey, streamResponse } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, apiKey, thinkingEnabled, systemPrompt } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    const model = thinkingEnabled ? 'deepseek-reasoner' : 'deepseek-chat';
    const temperature = thinkingEnabled ? undefined : 0.9;

    const response = await callDeepSeek({ apiKey, messages, systemPrompt, model, temperature });
    return streamResponse(createSSEStream(response));
  } catch (error) {
    return handleAPIError(error);
  }
}
