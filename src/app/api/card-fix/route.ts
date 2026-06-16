import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeek } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const { userCard, issues, apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: '请先配置 API Key' }, { status: 400 });
    }
    if (!userCard || !issues || !Array.isArray(issues) || issues.length === 0) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const systemPrompt = `You are a character card fixer for roleplay (JanitorAI style). You will receive:
1. An original User card
2. A list of issues to fix

Your task:
- Fix ONLY the issues listed. Do NOT change anything else.
- Maintain the same template format as the original card (same # sections, same **Field**: structure).
- Keep the same writing style (Western RP, third person, present tense).
- Keep the same language (English).
- For contradictions: resolve by choosing the more specific/detailed version, or merge them into a nuanced trait. Do NOT simply delete one side.
- For inconsistencies: adjust the User card to fit the Char card's worldview.
- For missing fields: fill in content that is consistent with the rest of the card.

Output the complete fixed User card. Do NOT add any explanation, comments, or markdown code blocks. Just the card itself.`;

    const issuesText = issues
      .map(
        (issue: { type: string; severity: string; fields: string[]; description: string; suggestion: string },
        ) =>
          `- [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.description}\n  Fields: ${issue.fields.join(', ')}\n  Suggestion: ${issue.suggestion}`,
      )
      .join('\n\n');

    const userMessage = `【Original User Card】\n${userCard}\n\n【Issues to Fix】\n${issuesText}\n\nPlease fix the above issues and output the complete corrected User card.`;

    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      maxTokens: 3000,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `修正失败: ${response.status} - ${errorText}` }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    if (!content.trim()) {
      return NextResponse.json({ error: '修正结果为空' }, { status: 500 });
    }

    return NextResponse.json({ fixedCard: content.trim() });
  } catch (error) {
    console.error('Card fix error:', error);
    return NextResponse.json({ error: '自动修正失败' }, { status: 500 });
  }
}
