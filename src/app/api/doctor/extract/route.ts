import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeek } from '@/lib/deepseek';

const EXTRACT_PROMPT = `You are a medical memory extraction system. Given a conversation between a patient and Dr. House, extract structured memory entries for long-term retention.

RULES:
1. Only extract medically relevant information: symptoms, medications, habits, body changes, diet, mental health observations, cycle-related info
2. Each entry must have: category, tags (keywords), content (1-2 sentence summary)
3. Categories: symptom, medication, cycle, diet, mental, general
4. Tags should be specific keywords in the original language (Chinese or English)
5. If the conversation contains no medically relevant new information, return empty array
6. Do NOT extract: greetings, jokes, meta-conversation, House's personality
7. If a new observation updates/contradicts a previous one, mark it with "replaces_tag" containing the tag it supersedes
8. Content should be factual, concise, and in the same language as the conversation

Return ONLY a JSON array, no other text:
[{"category":"symptom","tags":["头痛","经期前"],"content":"患者经期前偏头痛，自行服用布洛芬"},{"category":"medication","tags":["布洛芬"],"content":"患者经期头痛时服用布洛芬","replaces_tag":"布洛芬"}]

Or empty if nothing to extract:
[]`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation, apiKey } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'API Key is required' }, { status: 400 });
    }

    if (!conversation || typeof conversation !== 'string') {
      return NextResponse.json({ entries: [] });
    }

    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: EXTRACT_PROMPT },
        { role: 'user', content: conversation },
      ],
      stream: false,
      temperature: 0.1,
      maxTokens: 500,
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '[]';

    // Parse the JSON array from the response
    let entries;
    try {
      // Try to extract JSON from the response (might have markdown code blocks)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      entries = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      entries = [];
    }

    if (!Array.isArray(entries)) entries = [];

    // Validate entries
    const validCategories = ['symptom', 'medication', 'cycle', 'diet', 'mental', 'general'];
    const validEntries = entries.filter((e: Record<string, unknown>) =>
      e.category && validCategories.includes(e.category as string) &&
      e.tags && Array.isArray(e.tags) &&
      e.content && typeof e.content === 'string'
    );

    return NextResponse.json({ entries: validEntries });
  } catch {
    return NextResponse.json({ error: 'Memory extraction failed' }, { status: 500 });
  }
}
