import { NextRequest } from 'next/server';
import { callDeepSeek, validateApiKey, CHINESE_OUTPUT_INSTRUCTION, WRITING_STYLE_INSTRUCTION } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brief, charInfo, userCard, userPersonality, plotDirection, chatHistory, longTermMemory, personMode, apiKey } = body;

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

    const systemPrompt = `You are a creative roleplay writing assistant for JanitorAI. Expand a brief outline into a vivid, complete passage from the USER's perspective.

CORE PRINCIPLE: The expanded content must be from the User's perspective — what the User says or does.

${personInstruction}

CONTEXT:
- Character (Char): ${charInfo || '(not provided)'}
- User Persona: ${userCard || userPersonality || '(not provided)'}
${plotDirection ? `- Current Plot Direction: ${plotDirection}` : ''}
${longTermMemory ? `- Long-term Memory: ${longTermMemory}` : ''}

CURRENT SCENE:
${chatHistory || '(This is the beginning of the story)'}

BRIEF OUTLINE TO EXPAND:
${brief}

INSTRUCTIONS:
Expand this brief outline into a complete, vivid passage (2-5 paragraphs) from the User's perspective. Include:
- Dialogue (what the User says)
- Actions and body language
- Internal thoughts or feelings
- Environmental details

Write naturally and cinematically, like a Western RP novel. No anime/manga style.

${CHINESE_OUTPUT_INSTRUCTION}`;

    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: `Expand this brief outline into a complete passage from the User's perspective:\n\n${brief}` }],
      systemPrompt,
      stream: true,
      temperature: 0.85,
      maxTokens: 2000,
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
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
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
