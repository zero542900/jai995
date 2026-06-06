import { NextRequest } from 'next/server';
import { callDeepSeek, validateApiKey, CHINESE_OUTPUT_INSTRUCTION, WRITING_STYLE_INSTRUCTION } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { charInfo, userCard, chatHistory, longTermMemory, personMode, apiKey } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    const personInstruction = personMode === 'third'
      ? 'Summarize from the THIRD PERSON perspective (he / she / they / User\'s name).'
      : 'Summarize from the FIRST PERSON perspective (I / me / my).';

    const systemPrompt = `You are a roleplay memory summarization assistant for JanitorAI. Generate a long-term memory entry from the USER's perspective.

CORE PRINCIPLE: The memory must be from the User's perspective — covering the User's personality, current state, key events, and relationship with the Char.

${personInstruction}

CONTEXT:
- Character (Char): ${charInfo || '(not provided)'}
- User Persona: ${userCard || '(not provided)'}
${longTermMemory ? `- Previous Long-term Memory: ${longTermMemory}` : ''}

CURRENT SCENE:
${chatHistory || '(This is the beginning of the story)'}

INSTRUCTIONS:
Generate a concise long-term memory summary in the <Memory_LTM> format commonly used in JanitorAI. The memory should include:
- User's current emotional/physical state
- Key events that happened in this session
- Important interactions with the Char
- Any character development or changes
- Relationship status with the Char

Format:
<Memory_LTM>
[Concise summary of key facts, events, and states from the User's perspective]
</Memory_LTM>

Keep it concise but comprehensive — this will be used as context in future conversations.

${CHINESE_OUTPUT_INSTRUCTION}`;

    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Generate a long-term memory summary from the User\'s perspective based on the current conversation context.' }],
      systemPrompt,
      stream: true,
      temperature: 0.5,
      maxTokens: 1500,
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
