import { NextRequest } from 'next/server';
import { callDeepSeek, validateApiKey, WRITING_STYLE_INSTRUCTION, MARKDOWN_FORMAT_INSTRUCTION, resolveModelParams, createSSEStream, streamResponse } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brief, charInfo, userCard, chatHistory, longTermMemory, personMode, apiKey, mainLinePrompt, thinkingEnabled, modelChoice } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    if (!brief?.trim()) {
      return new Response(JSON.stringify({ error: '请输入简短梗概' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const personInstruction = personMode === 'third'
      ? 'Write from the THIRD PERSON perspective (he / she / they / User\'s name).'
      : 'Write from the FIRST PERSON perspective (I / me / my).';

    const systemPrompt = `You must write the expanded story in English. The final output must contain only English text. Do not output any Chinese.

You are a creative roleplay writing assistant for JanitorAI. Polish and moderately expand a brief outline into a vivid, complete passage from the USER's perspective.

CORE PRINCIPLE: The expanded content must be from the User's perspective — what the User says or does.

[Perspective Rules - Highest Priority]
1. You may only use one of two narrative perspectives, determined by the user's original text:
   - {{user}}'s perspective (first or third person, depending on the original text)
   - The perspective of a supporting character explicitly present in the original text
2. The use of {{char}}'s perspective is absolutely forbidden. The following are all prohibited:
   - Describing {{char}}'s inner feelings, mental activity, or unspoken thoughts
   - Describing {{char}}'s behavior or state when alone (when {{user}} is not present)
   - Using {{char}} as the narrative subject to describe their actions, expressions, or tone (unless {{user}} is actively observing, and only describing what {{user}} can outwardly see)
   - Using psychological verbs such as "{{char}} felt...", "{{char}} thought...", "{{char}} realized..."
3. If the original text is from {{user}}'s perspective, the expansion may only describe {{user}}'s sensory experiences: what they see, hear, smell, touch, and how their body feels. {{char}}'s behavior may only appear as external phenomena observed by {{user}}.
4. If the original text is from a supporting character's perspective, the same applies — only describe that character's sensory experiences. {{char}} may only appear as an observed external object.

${personInstruction}
- Do NOT break character (OOC). The expanded content must stay strictly within character settings — do not break the fourth wall, step out of character, or speak as the author.
- If the original text is in third person, maintain third person; if first person, maintain first person. Always narrate from {{user}}'s perspective to match their voice.
${mainLinePrompt ? `\nMAIN STORYLINE:\n${mainLinePrompt}` : ''}

CONTEXT:
- Character (Char): ${charInfo || '(not provided)'}
- User Persona: ${userCard || '(not provided)'}
${longTermMemory ? `- Long-term Memory: ${longTermMemory}` : ''}

CURRENT SCENE:
${chatHistory || '(This is the beginning of the story)'}

BRIEF OUTLINE TO EXPAND:
${brief}

${thinkingEnabled ? `REASONING DISCIPLINE: Keep your reasoning concise and efficient. Do not over-analyze — focus on key decisions about perspective, tone, and structure. Reserve the majority of your token budget for the actual expanded passage.

` : ``}INSTRUCTIONS:
Expand this brief outline into a polished, complete passage from the User's perspective.
Do NOT invent major events or new dialogue.
Follow the user's outline strictly.
Keep the output within 400-600 words. Do NOT cut off or truncate the ending — completing the scene naturally takes priority over staying within the word limit. If you need slightly more words to end properly, use them.

The outline may contain hints enclosed in 【】 brackets (e.g., 【add more sensory details】, 【make the tone darker】, 【they kiss here】). These are DIRECTIONAL GUIDANCE from the user — they influence your writing style, pacing, emphasis, or scene direction. Follow the spirit of these hints, but do NOT mechanically embed or parrot the 【】 content into the prose. The 【】 text is meta-instruction for you, not dialogue or narration to be copied.

${WRITING_STYLE_INSTRUCTION}

${MARKDOWN_FORMAT_INSTRUCTION}

You must write the expanded story in English. The final output must contain only English text. Do not output any Chinese.`;

    const { model, thinking } = resolveModelParams(modelChoice, thinkingEnabled);

    const response = await callDeepSeek({
      apiKey,
      model,
      thinking,
      messages: [{ role: 'user', content: 'Expand the outline provided in the system prompt into a complete passage from the User\'s perspective.' }],
      systemPrompt,
      stream: true,
      maxTokens: thinkingEnabled ? 8000 : 2500,
    });

    return streamResponse(createSSEStream(response));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
