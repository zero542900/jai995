import { NextRequest } from 'next/server';
import { callDeepSeek, validateApiKey, WRITING_STYLE_INSTRUCTION, MARKDOWN_FORMAT_INSTRUCTION, resolveModelParams } from '@/lib/deepseek';

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

    const stream = response.body!;
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') continue;
              if (!trimmed.startsWith('data: ')) continue;
              try {
                const json = JSON.parse(trimmed.slice(6));
                const content = json.choices?.[0]?.delta?.content;
                const reasoning = json.choices?.[0]?.delta?.reasoning_content;
                if (content || reasoning) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: content || '', reasoning: reasoning || '' })}\n\n`));
                }
              } catch { /* skip */ }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Stream error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
