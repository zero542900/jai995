import { NextRequest } from 'next/server';
import { callDeepSeek, validateApiKey } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { charInfo, userCard, userPersonality, plotDirection, chatHistory, longTermMemory, personMode, apiKey } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    const personInstruction = personMode === 'third'
      ? 'Write from the THIRD PERSON perspective (he / she / they / User\'s name).'
      : 'Write from the FIRST PERSON perspective (I / me / my).';

    const systemPrompt = `Role: JanitorAI Creative Writing Assistant
Perspective: User only
Persona: ${personInstruction}
Context:
- Character (Char): ${charInfo || '(not provided)'}
- User Persona: ${userCard || userPersonality || '(not provided)'}
${plotDirection ? `- Current Plot Direction: ${plotDirection}` : ''}
${longTermMemory ? `- Long-term Memory: ${longTermMemory}` : ''}

Current Scene:
${chatHistory || '(This is the beginning of the story)'}

Output: Three independent lines of inspiration. Each line is a different emotional, subtle reaction from User to the current event. No dramatic words or plot twists. Think film-like, detail-driven.
Format: Strictly separate each line with "===ITEM===" on its own line. No numbered lists. No extra text. Output only three lines. English only.`;

    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Generate 3 creative plot suggestions from the User\'s perspective based on the context above.' }],
      systemPrompt,
      stream: true,
      temperature: 0.9,
      maxTokens: 600,
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
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
