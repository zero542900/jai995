import { NextRequest } from 'next/server';
import { callDeepSeek, validateApiKey, WRITING_STYLE_INSTRUCTION, MARKDOWN_FORMAT_INSTRUCTION, resolveModelParams, createSSEStream, streamResponse } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brief, charInfo, userCard, userPersonality, chatHistory, longTermMemory, personMode, apiKey, mainLinePrompt, thinkingEnabled, modelChoice } = body;

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

    const systemPrompt = `You are a creative roleplay writing assistant for JanitorAI. Polish and moderately expand a brief outline into a vivid, complete passage from the USER's perspective.

CORE PRINCIPLE: The expanded content must be from the User's perspective — what the User says or does.

[视角规则 - 最高优先级]
1. 你可以使用的叙事视角只有两种，由用户原文决定：
   - {{user}} 的视角（第一人称或第三人称，取决于原文）
   - 原文中明确出现的某个配角的视角
2. 绝对禁止使用 {{char}} 的视角。禁止以下所有行为：
   - 描述 {{char}} 的内心感受、心理活动、未说出口的想法
   - 描述 {{char}} 独自一人时的行为或状态（{{user}} 不在场时）
   - 以 {{char}} 为叙事主体描写其动作、表情、语气（除非 {{user}} 正在观察，且只描述 {{user}} 能看到的表面）
   - 出现 "{{char}} felt..."、"{{char}} thought..."、"{{char}} realized..." 等心理动词
3. 如果原文是 {{user}} 视角，扩写时只能描述 {{user}} 的感官体验：看到什么、听到什么、闻到什么、触到什么、身体感受如何。{{char}} 的行为只能作为 {{user}} 观察到的外部现象出现。
4. 如果原文是配角视角，同理只描述该配角的感官体验，{{char}} 只能作为被观察的外部对象。

${personInstruction}
- 禁止 OOC（Out of Character）。扩写内容必须严格保持在角色设定内，不得跳出角色、打破第四面墙或以作者身份发言。
- 如果原文是第三人称，保持第三人称；如果原文是第一人称，保持第一人称。始终以 {{user}} 的视角叙述，使内容更符合其口吻。
${mainLinePrompt ? `\nMAIN STORYLINE:\n${mainLinePrompt}` : ''}

CONTEXT:
- Character (Char): ${charInfo || '(not provided)'}
- User Persona: ${userCard || userPersonality || '(not provided)'}
${longTermMemory ? `- Long-term Memory: ${longTermMemory}` : ''}

CURRENT SCENE:
${chatHistory || '(This is the beginning of the story)'}

BRIEF OUTLINE TO EXPAND:
${brief}

INSTRUCTIONS:
Expand this brief outline into a polished, complete passage from the User's perspective.
Do NOT invent major events or new dialogue.
Follow the user's outline strictly.
Keep the output within 400-600 words.

${WRITING_STYLE_INSTRUCTION}

${MARKDOWN_FORMAT_INSTRUCTION}

Output ONLY the expanded English passage. Do NOT include Chinese translation.`;

    const { model, thinking } = resolveModelParams(modelChoice, thinkingEnabled);

    const response = await callDeepSeek({
      apiKey,
      model,
      thinking,
      messages: [{ role: 'user', content: `Expand this brief outline into a complete passage from the User's perspective:\n\n${brief}` }],
      systemPrompt,
      stream: true,
      maxTokens: thinkingEnabled ? 2500 : 900,
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
