import { NextRequest } from 'next/server';
import { callDeepSeek, validateApiKey, CHINESE_OUTPUT_INSTRUCTION } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { charInfo, userCard, chatHistory, longTermMemory, plotDirection, apiKey, stylePrompt, mainLinePrompt } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    const systemPrompt = `You are a plot analysis assistant for JanitorAI roleplay. Generate a "Previously on..." style plot summary based on the current conversation.

CONTEXT:
- Character (Char): ${charInfo || '(not provided)'}
- User Persona: ${userCard || '(not provided)'}
${longTermMemory ? `- Long-term Memory: ${longTermMemory}` : ''}
${plotDirection ? `- Current Plot Direction: ${plotDirection}` : ''}

CURRENT SCENE:
${chatHistory || '(This is the beginning of the story)'}

INSTRUCTIONS:
Generate a concise plot summary in the style of "Previously on..." (like a TV series recap). The summary should include:
- Key events that have happened
- Current relationship dynamics between Char and User
- Active conflicts or tensions
- Emotional atmosphere and mood
- Where the story currently stands

Write in English, cinematic and concise. Think HBO recap, not academic summary. 2-4 sentences max.

${stylePrompt ? `\nSTYLE INSTRUCTION:\n${stylePrompt}\n` : ''}
${mainLinePrompt ? `\nMAIN LINE INSTRUCTION:\n${mainLinePrompt}\n` : ''}
${CHINESE_OUTPUT_INSTRUCTION}`;

    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Generate a plot summary based on the current scene.' }],
      systemPrompt,
      stream: true,
      temperature: 0.5,
      maxTokens: 800,
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
          const errorMsg = error instanceof Error ? error.message : 'Stream error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
