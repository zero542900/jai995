// DeepSeek API helper - shared by all API routes

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

interface DeepSeekCallOptions {
  apiKey: string;
  messages: { role: string; content: string }[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export class DeepSeekAPIError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'DeepSeekAPIError';
    this.statusCode = statusCode;
  }
}

export async function callDeepSeek(options: DeepSeekCallOptions) {
  const { apiKey, messages, model = 'deepseek-chat', temperature, maxTokens = 4096, stream = true } = options;

  const body: Record<string, unknown> = {
    model,
    messages,
    stream,
    max_tokens: maxTokens,
  };
  if (temperature !== undefined) {
    body.temperature = temperature;
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new DeepSeekAPIError(
      `DeepSeek API error: ${response.status} - ${errorText}`,
      response.status,
    );
  }

  return response;
}

export function createSSEStream(response: Response) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (!trimmed.startsWith('data: ')) continue;

            try {
              const json = JSON.parse(trimmed.slice(6));
              const content = json.choices?.[0]?.delta?.content;
              const reasoning = json.choices?.[0]?.delta?.reasoning_content;

              if (content || reasoning) {
                const payload = JSON.stringify({
                  content: content || '',
                  reasoning: reasoning || '',
                });
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
              }
            } catch {
              // skip malformed JSON
            }
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Stream error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
}

export function createSimpleSSEStream(response: Response) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
      if (!reader) { controller.close(); return; }
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
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
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Stream error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });
}

export function handleAPIError(error: unknown): Response {
  if (error instanceof DeepSeekAPIError) {
    // Map upstream errors to appropriate client errors
    const status = error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 502;
    return new Response(JSON.stringify({ error: error.message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const message = error instanceof Error ? error.message : 'Internal error';
  return new Response(JSON.stringify({ error: message }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function validateApiKey(apiKey: string | undefined): Response | null {
  if (!apiKey) {
    return new Response(JSON.stringify({ error: '请先在设置页面配置 DeepSeek API Key' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

export function streamResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// Shared translation instruction for dual-language output
export const TRANSLATION_INSTRUCTION = `

After generating the English content above, you MUST also provide a Chinese translation. Format:
1. First output all English content.
2. Then output exactly "===CHINESE===" on its own line.
3. Then output the Chinese translation of ALL the English content above.

TRANSLATION RULES (strictly follow):
- You are a bilingual translator expert in AO3 fanfiction culture.
- Preserve the original tone — casual stays casual, poetic stays poetic.
- Use established fandom terminology (AU, Canon Divergence etc.), keep English on first mention.
- NO AI translationese: avoid "极其", "缓慢地", "不是…而是…" etc.
- BANNED patterns: "不是……而是……", "在……的过程中", "总而言之", "不仅……更……", any "不是" opening, parallel/rhetorical repetition, "不x不y就z" format, "这就够了".
- BANNED words: "兜住", "接住", "稳", "守", "极其".
- Each observation must be followed by a sensory detail (sight, sound, smell, touch).
- If you catch yourself using banned patterns, delete the sentence and replace with a concrete action/image description.
- Output ONLY the translation, no explanations.`;
