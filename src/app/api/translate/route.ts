import { NextRequest } from 'next/server';
import { WRITING_STYLE_INSTRUCTION, MARKDOWN_FORMAT_INSTRUCTION, callDeepSeek, validateApiKey, handleAPIError } from '@/lib/deepseek';

const TRANSLATION_SYSTEM_PROMPT = `你是一位精通多语种翻译的资深译者，深谙同人圈文化，尤其擅长 AO3 网站上的同人文。你精通英语、德语、法语、西班牙语、葡萄牙语、意大利语、荷兰语、挪威语、瑞典语、丹麦语、芬兰语、波兰语、俄语、日语、韩语等语种，能够准确识别源语言并翻译为自然流畅的中文。你的翻译不仅是语言转换，更是文化与情感的传递。

核心原则：
- 全部翻译：所有非中文内容都必须翻译为中文，不管它是什么语言。逐句处理，不允许因为语言混杂而保留原文不翻。
- 多语言混杂处理：文本可能混合多种语言（如英文叙述+德语对话+挪威语独白）。每句话按各自语言准确翻译，不得跳过任何非中文语句。
- 对话结合上下文：非英语对话必须结合前后叙述理解语境后再翻译，不能孤立翻译导致语义偏差。
- 非英语对话标注语种：角色使用非英语说话时，在对话翻译后标注语种，格式如："你什么意思？"（德语）——让读者知道角色当时在说什么语言。英语对话不标注。
- 精准还原文风：根据原文语气灵活切换，保留口语化表达，不做过度书面化或煽情处理。
- 术语统一：对"AU"、"Canon Divergence"等圈内共识术语，使用通用译法，首次出现时保留原词。
- 无对应中文的词：遇到源语言中无法精确翻译的特有词汇（如德语 Schadenfreude、挪威语 friluftsliv），在译文中首次出现时附原词括号标注。
- 语言特征保留：德语复合词需拆解翻译并保留原词；北欧语言中的方言词需结合上下文推断含义。
- 禁止 AI 翻译腔：避免生硬的直译句式。译文读起来像有文风的真人作者所写。
- 禁止跳过：严禁以"语言混杂"、"无法识别"等理由保留原文不翻。每句话都必须有对应的中文译文。

${WRITING_STYLE_INSTRUCTION}

仅输出翻译结果，不要添加任何解释或注释。

${MARKDOWN_FORMAT_INSTRUCTION}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, apiKey, context } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    if (!text?.trim()) {
      return new Response(JSON.stringify({ error: '请提供需要翻译的文本' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contextPrompt = context
      ? `\n\n【对话上下文】（仅供理解语境，绝对不要翻译以下上下文内容）\n${context}\n`
      : '';

    const messages = [
      { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
      { role: 'user', content: `请将下方【待翻译文本】中的所有非中文内容翻译为中文。文本可能混合多种语言（如英文叙述+其他语言对话），请逐句准确翻译，非英语对话标注语种。${contextPrompt}\n【待翻译文本】\n${text}` },
    ];

    // 翻译不需要思考模式，强制使用 deepseek-chat + 不开启 thinking
    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages,
      stream: false,
    });

    const data = await response.json();
    const translation = data?.choices?.[0]?.message?.content || '';

    if (!translation) {
      return new Response(JSON.stringify({ error: '翻译结果为空，请重试' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ translation }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return handleAPIError(error);
  }
}
