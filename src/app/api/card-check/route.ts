import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeek } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const { charInfo, userCard, greeting, apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: '请先配置 API Key' }, { status: 400 });
    }
    if (!userCard) {
      return NextResponse.json({ error: '缺少 User 卡内容' }, { status: 400 });
    }

    const systemPrompt = `You are a character card consistency checker for roleplay (JanitorAI style). Analyze the provided character data and identify issues in these categories:

1. **Contradiction**: Internal conflicts within the same card (e.g., personality says "cold and distant" but likes include "enthusiastic social gatherings")
2. **Inconsistency**: Conflicts between User card and Char card, or between cards and the greeting scene (e.g., User card says "lives in Tokyo" but Char card's world is medieval fantasy)
3. **Missing**: Important fields that are empty, too vague, or use generic placeholder descriptions (e.g., "varies", "depends on mood", "normal")

For each issue, provide:
- type: "contradiction" | "inconsistency" | "missing"
- severity: "high" | "medium" | "low"
- fields: the specific fields involved (e.g., ["Personality.Core Traits", "Personality.Likes"])
- description: clear explanation of the problem (in Chinese, 1-2 sentences)
- suggestion: concrete fix suggestion (in Chinese, 1 sentence)

Be strict but fair. "Cold but gentle to specific person" is NOT a contradiction — it's a nuanced trait. Only flag genuine logical conflicts or clearly missing information.

Return ONLY a valid JSON object:
{
  "issues": [
    {
      "type": "contradiction|inconsistency|missing",
      "severity": "high|medium|low",
      "fields": ["Section.Field"],
      "description": "问题描述",
      "suggestion": "修改建议"
    }
  ]
}

If no issues found, return: {"issues": []}`;

    let userMessage = `【User 卡】\n${userCard}`;
    if (charInfo) userMessage = `【Char 设定】\n${charInfo}\n\n` + userMessage;
    if (greeting) userMessage += `\n\n【开场白】\n${greeting}`;

    userMessage += '\n\n请检查以上角色卡数据，返回 JSON 格式的问题列表。';

    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      maxTokens: 2000,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `检测失败: ${response.status} - ${errorText}` }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    let parsed;
    try {
      // Try direct parse first
      parsed = JSON.parse(content);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try finding JSON object in the text
        const braceMatch = content.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          parsed = JSON.parse(braceMatch[0]);
        } else {
          return NextResponse.json({ error: 'AI 返回格式异常' }, { status: 500 });
        }
      }
    }

    if (!parsed.issues || !Array.isArray(parsed.issues)) {
      return NextResponse.json({ error: 'AI 返回格式异常' }, { status: 500 });
    }

    return NextResponse.json({ issues: parsed.issues });
  } catch (error) {
    console.error('Card check error:', error);
    return NextResponse.json({ error: '冲突检测失败' }, { status: 500 });
  }
}
