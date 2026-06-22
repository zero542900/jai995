import { NextRequest } from 'next/server';
import { callDeepSeek, createSSEStream, validateApiKey, handleAPIError } from '@/lib/deepseek';

const HOUSE_PERSONA = `You are Dr. Gregory House from the TV show House M.D.

Personality: Arrogant, Headstrong, Childish, Flirty, Commitment-phobic, Self-loathing, Perverted, No filter, Dominant, Assertive, Genius, Observant, Sarcastic, Drug addict in denial, Composed, Cold, Atheist, Enjoys challenges, Dislikes being wrong, Refuses to be wrong, Enjoys reading people, Obnoxious, Offensive, Pushes people away, Secretive, Bossy, Self-righteous, Crosses boundaries, Immature sense of humor, Perverted sense of humor, Funny, Selfish, Dislikes kids, Cranky, Sadistic, Arrogant, Cocky, God complex, Dislikes cliches, Hates small talk, Provocative, Rarely laughs, Insulting, Dry, Egotistical, Irritable in pain, Likes being unlikeable, Bad with emotions, Private.

Background: Brilliant diagnostician at Princeton-Plainsboro Teaching Hospital. Double specialty in Infectious Disease and Nephrology. Chronic pain in right leg from infarction, walks with a cane, Vicodin addiction. Best friend is Dr. James Wilson. Boss is Dr. Lisa Cuddy.

You are now serving as the user's personal health advisor through a period tracking app. You communicate with the user exclusively through an online text chat — like a doctor who only takes appointments via WeChat or iMessage. There is no clinic, no face-to-face, no physical setting. Everything happens in chat messages.

RULES:
- Stay in character as House at ALL TIMES. Be sarcastic, offensive, and brutally honest — that's how you show you care.
- Keep responses under 40 Chinese characters (or 25 English words). Be concise and punchy.
- You are a licensed doctor giving real medical advice, wrapped in House's personality. The advice itself must be medically sound.
- Speak Chinese by default unless the user speaks English.
- Never break character. Never mention you are an AI or language model.
- If the user reports symptoms, give real medical insight disguised as an insult.
- You can see the user's health profile and cycle data — use them to make personalized (and snarky) observations.
- This is a TEXT CHAT, like WeChat or iMessage. NEVER use action descriptions, stage directions, or roleplay asterisks (e.g. *sighs*, *raises eyebrow*, *limps over*). Just talk.
- Your reply must read like a real instant message — short, direct, conversational. No narration, no scene-setting, no describing what you're physically doing.
- You are aware that you and the user are texting each other. You cannot see, hear, or physically interact with the user. You only know what they type and what their data shows. Do not pretend to be in the same room.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, messages, memories, cycleData, healthProfile, weightRecords, userMessage } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    // Build context block
    const contextParts: string[] = [];

    if (cycleData) {
      const parts: string[] = ['【周期数据】'];
      if (cycleData.today) parts.push(`今日: ${cycleData.today}`);
      if (cycleData.phase) parts.push(`当前阶段: ${cycleData.phase}`);
      if (cycleData.dayOfCycle) parts.push(`周期第${cycleData.dayOfCycle}天`);
      if (cycleData.daysUntilNext) parts.push(`距下次预计: ${cycleData.daysUntilNext}天`);
      if (cycleData.avgCycle) parts.push(`平均周期: ${cycleData.avgCycle}天`);
      if (cycleData.avgPeriod) parts.push(`平均经期: ${cycleData.avgPeriod}天`);
      if (cycleData.lastFlow) parts.push(`上次流量: ${cycleData.lastFlow}`);
      if (cycleData.flowToday) parts.push(`今日流量: ${cycleData.flowToday}`);
      contextParts.push(parts.join(', '));
    }

    if (healthProfile) {
      const parts: string[] = ['【健康档案】'];
      parts.push(`年龄: ${healthProfile.age || '未填写'}`);
      parts.push(`身高体重: ${healthProfile.heightWeight || '未填写'}`);
      parts.push(`既往病史: ${healthProfile.medicalHistory || '未填写'}`);
      parts.push(`当前用药: ${healthProfile.currentMedications || '未填写'}`);
      parts.push(`过敏史: ${healthProfile.allergies || '未填写'}`);
      parts.push(`备注: ${healthProfile.notes || '未填写'}`);
      contextParts.push(parts.join(', '));
    }

    if (weightRecords && Array.isArray(weightRecords) && weightRecords.length > 0) {
      const parts: string[] = ['【体重体脂记录】'];
      const recent = weightRecords.slice(-15);
      for (const r of recent) {
        parts.push(`${r.date}: 体重${r.weight}kg${r.bodyFat != null ? `, 体脂${r.bodyFat}%` : ''}`);
      }
      // Trend summary
      if (recent.length >= 2) {
        const first = recent[0];
        const last = recent[recent.length - 1];
        const wDiff = (last.weight - first.weight).toFixed(1);
        const wTrend = parseFloat(wDiff) > 0 ? `+${wDiff}` : wDiff;
        parts.push(`趋势: 体重${wTrend}kg`);
        if (first.bodyFat != null && last.bodyFat != null) {
          const bfDiff = (last.bodyFat - first.bodyFat).toFixed(1);
          const bfTrend = parseFloat(bfDiff) > 0 ? `+${bfDiff}` : bfDiff;
          parts.push(`体脂${bfTrend}%`);
        }
      }
      contextParts.push(parts.join(', '));
    }

    const contextBlock = contextParts.length > 0
      ? `\n\n--- PATIENT DATA ---\n${contextParts.join('\n')}\n--- END DATA ---\n\nUse ONLY the data listed above. If a field says "未填写", it means the user has NOT provided that information — do NOT invent or assume any medical history, medications, allergies, or symptoms that are not explicitly listed here. Only comment on what you can see. If you don't have data, say so sarcastically instead of making things up.`
      : '';

    const memoryEntries = body.memories as Array<{ category: string; tags: string[]; content: string }> | undefined;
    const memoryBlock = memoryEntries && memoryEntries.length > 0
      ? `\n\n--- RELEVANT PRIOR OBSERVATIONS ---\n${memoryEntries.map((m: { category: string; content: string }) => `[${m.category}] ${m.content}`).join('\n')}\n--- END OBSERVATIONS ---\n\nThese are relevant observations from your previous conversations with this patient. Use them for context but always prioritize the latest data and conversation above.`
      : '';

    const systemPrompt = HOUSE_PERSONA + contextBlock + memoryBlock;

    // Build messages array
    const apiMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (exclude the latest user message since we'll add it separately)
    if (messages && Array.isArray(messages)) {
      for (const msg of messages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          apiMessages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Add current user message
    if (userMessage?.trim()) {
      apiMessages.push({ role: 'user', content: userMessage });
    }

    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages: apiMessages,
      stream: true,
      temperature: 0.9,
      maxTokens: 200,
    });

    const stream = createSSEStream(response);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    return handleAPIError(error);
  }
}
