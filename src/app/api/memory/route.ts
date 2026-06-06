import { NextRequest } from 'next/server';
import { callDeepSeek, validateApiKey, CHINESE_OUTPUT_INSTRUCTION, WRITING_STYLE_INSTRUCTION } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { charInfo, userCard, chatHistory, longTermMemory, apiKey } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    const systemPrompt = `You are a roleplay memory summarization assistant for JanitorAI. Generate a long-term memory entry from the CHAR's perspective — this memory will be pasted into the Bot's (Char's) long-term memory field on JanitorAI.

CORE PRINCIPLE: The memory must be written from {{char}}'s point of view, as {{char}}'s own memory about {{user}}. It should cover what {{char}} observes, feels, and remembers about {{user}}.

IMPORTANT NAMING RULE: Always use {{char}} and {{user}} as placeholders instead of any actual character names. JanitorAI will automatically replace these with the correct names at runtime. Do NOT use any specific names.

PERSPECTIVE: Always use THIRD PERSON perspective with {{char}} and {{user}} as names (e.g. "{{char}} noticed that {{user}} was...", "{{char}} felt a shift in {{user}}'s demeanor..."). Do NOT use first person ("I").

CONTEXT:
- Character ({{char}}): ${charInfo || '(not provided)'}
- User Persona ({{user}}): ${userCard || '(not provided)'}
${longTermMemory ? `- Previous Long-term Memory: ${longTermMemory}` : ''}

CURRENT SCENE:
${chatHistory || '(This is the beginning of the story)'}

INSTRUCTIONS:
Generate a concise long-term memory summary in the <Memory_LTM> format commonly used in JanitorAI. The memory should include:
- {{user}}'s current emotional/physical state as observed by {{char}}
- Key events that happened in this session
- Important interactions between {{char}} and {{user}}
- Any character development or changes in {{user}}
- {{char}}'s relationship status with {{user}}

Format:
<Memory_LTM>
[Concise summary of key facts, events, and states from {{char}}'s perspective about {{user}}]
</Memory_LTM>

Keep it concise but comprehensive — this will be used as context for the Bot in future conversations.

${CHINESE_OUTPUT_INSTRUCTION}`;

    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Generate a long-term memory summary from {{char}}\'s perspective about {{user}} based on the current conversation context.' }],
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
