import { NextRequest } from 'next/server';
import { callDeepSeek, createSimpleSSEStream, handleAPIError, validateApiKey, streamResponse, TRANSLATION_INSTRUCTION } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brief, charInfo, userCard, userPersonality, plotDirection, chatHistory, longTermMemory, apiKey } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    const systemPrompt = `You are a creative roleplay writer. Expand a brief plot outline into a complete, immersive dialogue passage from the User's perspective.

RULES:
1. Write in English, cinematic and immersive style — like an American TV show or movie.
2. The expanded dialogue should feel natural, in-character, and advance the story.
3. Include the User's actions (in *asterisks*) and spoken dialogue.
4. Stay consistent with the world setting, character dynamics, and User's personality.
5. The output should be a single dialogue turn/action from the User — roughly 100-200 words.
6. Do NOT write the Character's response — only the User's action and dialogue.
7. Always read the recent 5-10 messages for context before generating.
8. If there is a "Latest JAI Reply" in the context, use it as the primary scene reference.

WORLD & CHARACTER CONTEXT:
${charInfo}

USER PERSONA:
${userCard}

User personality preferences: ${userPersonality}

${longTermMemory ? `LONG-TERM MEMORY:\n${longTermMemory}\n` : ''}
${plotDirection ? `CURRENT PLOT DIRECTION:\n${plotDirection}\n` : ''}${TRANSLATION_INSTRUCTION}`;

    const userMessage = `Here is the brief outline to expand:
"${brief}"

Current conversation context:
${chatHistory || '(This is the beginning of the story)'}

Expand this into a complete User dialogue/action turn:`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await callDeepSeek({ apiKey, messages, temperature: 0.9, maxTokens: 3000 });
    return streamResponse(createSimpleSSEStream(response));
  } catch (error) {
    return handleAPIError(error);
  }
}
