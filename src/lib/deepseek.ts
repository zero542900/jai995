// DeepSeek API helper - shared by all API routes

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

interface DeepSeekCallOptions {
  apiKey: string;
  messages: { role: string; content: string }[];
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  thinking?: 'enabled' | 'disabled';
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
  const { apiKey, messages, systemPrompt, model = 'deepseek-chat', temperature, maxTokens = 4096, stream = true, thinking } = options;

  const allMessages: { role: string; content: string }[] = [];
  if (systemPrompt) {
    allMessages.push({ role: 'system', content: systemPrompt });
  }
  allMessages.push(...messages);

  const body: Record<string, unknown> = {
    model,
    messages: allMessages,
    stream,
    max_tokens: maxTokens,
  };
  if (temperature !== undefined) {
    body.temperature = temperature;
  }
  if (thinking !== undefined) {
    body.thinking = { type: thinking };
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

/**
 * Resolve model name and thinking param based on user's model preference and thinking toggle.
 * Flash: deepseek-chat / deepseek-reasoner
 * Pro:   deepseek-v4-pro + thinking param
 */
export function resolveModelParams(modelTier: 'flash' | 'pro', thinkingEnabled: boolean) {
  if (modelTier === 'pro') {
    return {
      model: 'deepseek-v4-pro',
      thinking: thinkingEnabled ? 'enabled' as const : 'disabled' as const,
      temperature: undefined as number | undefined,
    };
  }
  // Flash (default)
  if (thinkingEnabled) {
    return {
      model: 'deepseek-reasoner',
      thinking: undefined as 'enabled' | 'disabled' | undefined,
      temperature: undefined as number | undefined,
    };
  }
  return {
    model: 'deepseek-chat',
    thinking: undefined as 'enabled' | 'disabled' | undefined,
    temperature: undefined as number | undefined,
  };
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

// Shared writing style instructions - applies to ALL API routes globally
export const WRITING_STYLE_INSTRUCTION = `
[Style Constraints – Global]

Prohibited Words: You must not use the following words in any context: "hold it all together," "catch," "steady," "guard," "extremely."

Prohibited Sentence Patterns:
Do not use the following constructions: "not... but...", "in the process of...", "in conclusion," "to sum up," "not only... but also...", "not... is... is...", "not... not... is...", "is... the cornerstone / key / required course of...".

Prohibited Rhetorical Structures:
Do not use parallelism, antithesis, repetition, or any other rhetorical stacking structures.

Prohibited Format:
Do not use the "no x, no y, no z, then" format.

Prohibited Concluding Judgments:
Do not use short conclusive judgments such as "that's enough," "very... yet very...".

Prohibited Negation Openers:
Do not use any sentence that begins with a negative "not" construction.

Zero Figurative Language Rule:
7.1 All metaphor, simile, personification, symbolism, hyperbole, metonymy, and analogy are strictly forbidden.
7.2 Any comparative word that triggers association is strictly prohibited, including but not limited to: like, as, as if, as though, similar to, resembling, such as, in the manner of, -like, -esque, seem, appear.
7.3 Descriptions of sensory objects are limited to directly observable or measurable physical properties: shape, size, color, brightness, texture, temperature, humidity, pitch and duration of sound, type of odor, trajectory of motion, speed, force. No comparisons to other objects are permitted.
7.4 Do not project emotions, atmosphere, or other abstract concepts onto objects for figurative description; record only perceptible, concrete phenomena.
7.5 If it is necessary to describe a feeling, use only non-metaphorical physiological responses (e.g., "goosebumps rose on the skin," "the stomach tightened"), and do not explain them with "like" or "as if."

Ending & Termination Rule:
All generated text MUST end on a concrete action, sensory detail, or a short line of dialogue. It is strictly forbidden to conclude with any form of summary, moralizing, foreshadowing, or editorial judgment (e.g., "Things were about to change irreversibly," "A new chapter was beginning," "This foreshadowed..."). The output must cut off sharply at a factual or sensory beat. Do not use endings like "Things are taking a turn," "A new chapter is about to unfold," or "This presages..."

Replacement Rule:
If you discover that any of the above prohibited rules have appeared in a generated passage, you must not handle it by simply deleting the content. You must replace the offending passage with an entirely new, complete description that complies with all the constraints above.`;

// Markdown format rules - for narrative outputs only (expand/memory/translate/chat), NOT for structured templates (generate)
export const MARKDOWN_FORMAT_INSTRUCTION = `
[Markdown Formatting Rules]
(Applies to narrative output only. Structured templates, such as User Cards, are exempt from these restrictions.)

**Bold (\`**text**\`)**: Use only for emphasizing the tone of character dialogue, or for highlighting key actions and objects within narrative passages.

*Italic (\`*text*\`)*: Use only for {{user}}'s internal monologue, unspoken thoughts, or for rendering atmosphere in narration.

Inline Code (\`\`text\`\`): Use only for text messages, notes, or text displayed on electronic screens.

Horizontal Rules (\`***\` or \`---\`): Use only for scene transitions or time jumps.

Blockquotes (\`>\`): Use only for long-form quoted content.

**Prohibited**: Do not use headings (\`#\`), code blocks (\` \`\`\` \`), or ordered/unordered lists.

Do not apply bold or italic formatting to entire paragraphs.

Do not mix bold and italic on a single phrase for multiple emphasis.`;

export const CHINESE_OUTPUT_INSTRUCTION = `
Output format: First output the English content, then on a new line write exactly "===CHINESE===" (this exact marker), then output the Chinese translation below.

${WRITING_STYLE_INSTRUCTION}

${MARKDOWN_FORMAT_INSTRUCTION}`;

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
