import { NextRequest } from 'next/server';
import { callDeepSeek, createSimpleSSEStream, handleAPIError, validateApiKey, streamResponse } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { charInfo, userCard, chatHistory, longTermMemory, apiKey } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    const systemPrompt = `You are an expert at summarizing roleplay conversations into concise long-term memory entries for JanitorAI.

RULES:
1. Output the long-term memory in JanitorAI's <Memory_LTM> format.
2. The memory should capture: key events, relationship developments, important facts, character states, and unresolved plot threads.
3. Be concise but comprehensive — each point should be a single sentence.
4. Write in English.
5. Preserve any existing memory points and update/add new ones.
6. Use this exact format:

<Memory_LTM>
- [Key event or fact 1]
- [Relationship development 2]
- [Important detail 3]
...
</Memory_LTM>

WORLD & CHARACTER CONTEXT:
${charInfo}

USER PERSONA:
${userCard}`;

    const userMessage = `Based on the conversation below, generate or update the long-term memory entry.

${longTermMemory ? `Existing long-term memory:\n${longTermMemory}\n` : ''}

Conversation to summarize:
${chatHistory || '(No conversation yet)'}

Generate the <Memory_LTM> entry:`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await callDeepSeek({ apiKey, messages, temperature: 0.5, maxTokens: 2048 });
    return streamResponse(createSimpleSSEStream(response));
  } catch (error) {
    return handleAPIError(error);
  }
}
