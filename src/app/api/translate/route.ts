import { NextRequest } from 'next/server';

const TRANSLATION_SYSTEM_PROMPT = `你是一位精通中英双语、深谙同人圈文化的资深译者，尤其擅长 AO3 网站上的同人文。你的翻译不仅是语言转换，更是文化与情感的传递。

核心原则：
- 精准还原文风：根据英文原文语气灵活切换，保留口语化表达（如"I am weak"译为"我已溃不成军"），不做过度书面化或煽情处理。
- 术语统一：对"AU"、"Canon Divergence"等圈内共识术语，使用通用译法，首次出现时保留英文原词。
- 禁止 AI 翻译腔：避免"极其"、"缓慢地"、"不是…而是…"等生硬句式。译文读起来像有文风的真人作者所写。

写作风格强制指令：
- 语言自然、有共情，少用逻辑跳板句式。
- 禁止使用以下句式：
  - "不是……而是……"
  - "在……的过程中"
  - "总而言之""综上所述"
  - "不仅……更……"
  - "不是……是……是……"
  - "不是……不是……是……"
  - "是……的基石/关键/必修课"
- 禁止使用排比句、对偶句、反复等修辞性排叠结构。
- 禁止使用"不x，不y，不z，就"格式（如"不哭不闹，就坐着"）。
- 禁止使用"这就够了"、"很…，但很…"等总结性短判断。
- 禁止使用任何以"不是"开头的否定句式。
- 每个观点后面必须跟一个画面、声音、气味或触感描写。
- 禁用词汇："兜住"、"接住"、"稳"、"守"、"极其"。

句式纠正示例：
- 错误：他不是胆怯，只是谨慎。 → 正确：他保持谨慎。
- 错误：这盏灯不会发热，它用LED发光。 → 正确：这盏灯用LED发光，表面保持低温。
- 错误：这场雨不是意外，是季节更替的必然。 → 正确：这场雨是季节更替的必然。

监控要求：如果你生成的翻译中出现了"不是…而是…"、"在…的过程中"、"总而言之"这三种句式，请立刻删除该句，并用描写具体画面或动作的句子替换。

仅输出翻译结果，不要添加任何解释或注释。`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, apiKey } = body;

    if (!apiKey) {
      return Response.json({ error: '请先在设置页面配置 DeepSeek API Key' }, { status: 400 });
    }

    if (!text?.trim()) {
      return Response.json({ error: '请提供需要翻译的英文文本' }, { status: 400 });
    }

    const messages = [
      { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
      { role: 'user', content: `请将以下英文翻译为中文：\n\n${text}` },
    ];

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.5,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `DeepSeek API error: ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = `DeepSeek API error: ${response.status} - ${errText}`;
        if (errJson?.error?.message) errMsg = `DeepSeek API error: ${response.status} - ${errJson.error.message}`;
      } catch { /* use default */ }
      return Response.json({ error: errMsg }, { status: response.status >= 400 && response.status < 500 ? response.status : 500 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) { controller.close(); return; }
        const decoder = new TextDecoder();
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
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);
              if (data === '[DONE]') continue;
              try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch { /* skip */ }
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '翻译失败';
    return Response.json({ error: message }, { status: 500 });
  }
}
