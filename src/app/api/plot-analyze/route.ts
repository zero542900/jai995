import { NextRequest } from 'next/server';
import { callDeepSeek, validateApiKey } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatHistory, apiKey } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    const systemPrompt = `You are a plot analysis assistant for JanitorAI roleplay. Analyze the current story state and return a concise summary.

CURRENT SCENE:
${chatHistory || '(This is the beginning of the story)'}

INSTRUCTIONS:
Analyze the current scene and return a JSON object with the following fields:

1. "mainLineName" (string): A concise name for the current main storyline, 2-6 words. Like a TV episode title. Examples: "Power Reversal", "Silent Confession", "The Unraveling", "Crossfire Trust"

2."mainLineNameCn" (string): Chinese title that captures the essence of the English mainLineName. Prioritize conciseness and narrative tone over word-for-word accuracy.

3. "progressDesc" (string): 1-2 sentences describing where the story currently stands. English. Cinematic, concise. No embellishment, no emotional manipulation.

4. "progressDescCn" (string): Chinese translation of progressDesc. Follow global writing style constraints if applicable.

OUTPUT:
Return ONLY the JSON object. No markdown code blocks, no explanations.`;

    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Analyze the current story and return the structured data.' }],
      systemPrompt,
      stream: false,
      temperature: 0.6,
      maxTokens: 500,
    });

    const apiResponse = await response.json();
    const aiContent = apiResponse?.choices?.[0]?.message?.content || '';

    if (!aiContent) {
      return new Response(JSON.stringify({ error: 'AI output empty, please retry' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse AI content as JSON
    let jsonStr = aiContent;
    const codeBlockMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'AI output format error, please retry' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      // Validate required fields
      if (!parsed.mainLineName) {
        return new Response(JSON.stringify({ error: 'AI output incomplete, please retry' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(parsed), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'AI output parse error, please retry' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const isAuthError = message.includes('401') || message.includes('authentication') || message.includes('invalid');
    return new Response(JSON.stringify({ error: message }), {
      status: isAuthError ? 401 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
