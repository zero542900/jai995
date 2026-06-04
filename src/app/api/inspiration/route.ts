import { NextRequest } from 'next/server';
import { callDeepSeek, createSimpleSSEStream, handleAPIError, validateApiKey, streamResponse, TRANSLATION_INSTRUCTION } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { charInfo, userCard, userPersonality, plotDirection, chatHistory, longTermMemory, apiKey } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    const systemPrompt = `You are a creative roleplay story director. Based on the world, character, and current story context, generate 3 compelling plot directions from the User's perspective.

RULES:
1. Each direction should be a brief, evocative description (2-3 sentences).
2. Write in English, cinematic and immersive tone.
3. Consider the world setting, character dynamics, and User's personality.
4. Make each direction distinct and interesting — different tones (tense, emotional, mysterious, etc.).
5. Format as numbered list (1. 2. 3.).
6. Always read the recent 5-10 messages for context before generating.
7. If there is a "Latest JAI Reply" in the context, use it as the primary scene reference.

WORLD & CHARACTER CONTEXT:
${charInfo}

USER PERSONA:
${userCard}

User personality preferences: ${userPersonality}

${longTermMemory ? `LONG-TERM MEMORY:\n${longTermMemory}\n` : ''}
${plotDirection ? `CURRENT PLOT DIRECTION:\n${plotDirection}\n` : ''}${TRANSLATION_INSTRUCTION}`;

    const userMessage = `Based on the current conversation and context, suggest 3 new plot directions for the User to pursue.

Current conversation context:
${chatHistory || '(This is the beginning of the story)'}

Generate 3 distinct, compelling plot directions:`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await callDeepSeek({ apiKey, messages, temperature: 1.0, maxTokens: 3000 });
    return streamResponse(createSimpleSSEStream(response));
  } catch (error) {
    return handleAPIError(error);
  }
}
