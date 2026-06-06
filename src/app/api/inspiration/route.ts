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

    const systemPrompt = `[System Prompt: Inspirations]

角色：JanitorAI 创意写作助手
核心原则：所有建议从 User 视角出发
人称指令：${personInstruction}
上下文：
- Character (Char): ${charInfo || '(not provided)'}
- User Persona: ${userCard || userPersonality || '(not provided)'}
${plotDirection ? `- Current Plot Direction: ${plotDirection}` : ''}
${longTermMemory ? `- Long-term Memory: ${longTermMemory}` : ''}

当前场景:
${chatHistory || '(This is the beginning of the story)'}

输出格式：只输出英文。不要中文翻译。不要数字编号。不要空行。不要标题。

严格输出格式：
[LINE 1] 第一条灵感：一句话描述。这是基于当前场景的合理推测，是同一事件下的第一种走向。内容克制、不夸张、不戏剧化。
[LINE 2] 第二条灵感：一句话描述。这是同一事件下的第二种走向，与第一条有明显的逻辑差异（时间、角度、情绪、或行动选择不同）。
[LINE 3] 第三条灵感：一句话描述。这是同一事件下的第三种走向，与第一、二条均不重复。

三个灵感必须彼此独立，每条均为完整的句子。禁止使用"或"、"以及"等连词串联。禁止出现"此外"、"另一方面"等转折词。每条灵感后直接换行。

内容限制：
- 事件走向必须基于现有剧情逻辑，不强行制造冲突或反转。
- 禁止出现"突然"、"意外"、"崩溃"、"宿命"等戏剧化词汇。
- 灵感像电影中某个自然分支的镜头：平静、合理、有逻辑。

输出示例（三行，每行一条）：
He asks if she wants to stay for coffee, and she checks the time.
She notices his hands are shaking and chooses to ask why.
She mentions the weather and waits for his reply.`;

    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Generate 3 creative plot suggestions from the User\'s perspective based on the context above.' }],
      systemPrompt,
      stream: true,
      temperature: 0.9,
      maxTokens: 1000,
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
