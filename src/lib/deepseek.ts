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
[文风约束 - 全局通用]
以下约束同时适用于英文和中文输出中的叙述性段落。在需要将原文展开为完整句子时必须遵守。简短的要害式短语（如单个形容词列举）不需要套用这些规则。
- 禁用词汇：你不得在任何上下文中使用以下词语——"兜住"、"接住"、"稳"、"守"、"极其"。
- 禁止使用以下句式："不是……而是……"、"在……的过程中"、"总而言之"、"综上所述"、"不仅……更……"、"不是……是……是……"、"不是……不是……是……"、"是……的基石/关键/必修课"。
- 禁止使用排比句、对偶句、反复等修辞性排叠结构。
- 禁止使用"不x，不y，不z，就"格式。
- 禁止使用"这就够了"、"很…，但很…"等总结性短判断。
- 禁止使用任何以"不是"开头的否定句式。
- 如果你发现某段输出中出现了上述禁用句式，不得以删除内容作为处理方式。你必须用一段新的、符合以上约束的完整描写来替换它。
- Simile & Metaphor Restriction: Do NOT use poetic or abstract similes/metaphors. If a comparison is essential, it must be concrete and drawn from the immediate physical setting or the character's direct experience. When in doubt, state the fact plainly instead of using figurative language.
- Ending & Termination Rule: All generated text MUST end on a concrete action, sensory detail, or a short line of dialogue. Strictly forbidden to conclude with any form of summary, moralizing, foreshadowing, or editorial judgment (e.g., "Things were about to change irreversibly," "A new chapter was beginning," "This foreshadowed..."). The output must cut off sharply at a factual or sensory beat. 严禁在结尾使用"事情正在起变化"、"新的篇章即将开启"、"这预示着"等评判性语句。`;

// Markdown format rules - for narrative outputs only (expand/memory/translate/chat), NOT for structured templates (generate)
export const MARKDOWN_FORMAT_INSTRUCTION = `
[Markdown 格式规则]
- 加粗（**text**）：仅用于角色台词的语气强调，或叙事段落中需要突出的关键动作、物件。不得用于普通叙述句的整句加粗。
- 斜体（*text*）：仅用于角色内心独白、未说出口的心理活动，或旁白中的气氛渲染。不得用于台词本身。
- 行内代码/短信（\`text\`）：仅用于短信内容、纸条文字、电子屏幕显示、系统提示等非口头对话的文本。使用时光杆一对反引号包裹，不得用于角色说出的台词。
- 分隔线（*** 或 ---）：仅用于场景转换或时间跳跃。光杆输入三个星号或连字符，前后各空一行，不得添加额外文字。
- 引用块（>）：仅用于呈现长篇引用内容（如信件全文、报告摘录）。短信等短文本优先使用 \`text\` 格式。
- 禁止使用标题（#）、代码块（\`\`\`）、有序/无序列表等破坏沉浸感的结构化格式。
- 禁止整段加粗或整段斜体。
- 禁止在单一短语上混用加粗与斜体进行多重强调。`;

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
