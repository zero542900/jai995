import { NextRequest } from 'next/server';
import { callDeepSeek, validateApiKey, WRITING_STYLE_INSTRUCTION } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { charInfo, userCard, chatHistory, longTermMemory, plotDirection, apiKey, stylePrompt, mainLinePrompt } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    const systemPrompt = `You are a plot analysis assistant for JanitorAI roleplay. Analyze the current story state and return structured data.

CONTEXT:
- Character (Char): ${charInfo || '(not provided)'}
- User Persona: ${userCard || '(not provided)'}
${longTermMemory ? `- Long-term Memory: ${longTermMemory}` : ''}
${plotDirection ? `- Current Plot Direction: ${plotDirection}` : ''}

CURRENT SCENE:
${chatHistory || '(This is the beginning of the story)'}

${stylePrompt ? `\nSTYLE INSTRUCTION:\n${stylePrompt}\n` : ''}
${mainLinePrompt ? `\nMAIN LINE INSTRUCTION:\n${mainLinePrompt}\n` : ''}

INSTRUCTIONS:
Analyze the current story and return a JSON object with the following fields:

1. "mainLineName" (string): A concise name for the current main storyline, 2-6 words. Like a TV episode title. Examples: "Power Reversal", "Silent Confession", "The Unraveling", "Crossfire Trust"

2. "mainLineNameCn" (string): Chinese translation of the mainLineName. Natural, evocative, not literal. Examples: "权力逆转", "沉默的告白", "瓦解", "交叉火力下的信任"

3. "stage" (string): Current story stage, using one of these formats:
   - "Act 1·Foundation" / "第一幕·奠基"
   - "Act 2·Rising" / "第二幕·攀升"
   - "Act 3·Climax" / "第三幕·高潮"
   - "Finale·Aftermath" / "终幕·余波"

4. "stageCn" (string): Chinese translation of the stage.

5. "progressDesc" (string): 1-2 sentences describing where the story currently stands. English. Cinematic, concise.

6. "progressDescCn" (string): Chinese translation of progressDesc.

7. "suggestedKeywords": An object with exactly these 4 keys, each containing 3-5 keyword strings that are RELEVANT to the current story context:
   - "ending": Suggested ending direction keywords (e.g., "HE", "BE", "Open ending", specific to this story)
   - "relation": Suggested relationship dynamic keywords (e.g., "Push-pull", "Trust crisis", specific to current dynamics)
   - "scene": Suggested scene keywords (e.g., specific locations or settings that would fit the current story direction)
   - "stage": Suggested stage transition keywords (what stage the story might move into next)

CRITICAL RULES FOR KEYWORDS:
- Keywords must be SPECIFIC to this story, not generic. "HE through mutual sacrifice" is better than just "HE".
- Each keyword should be 2-8 characters.
- Mix Chinese and English freely — use whichever language feels more natural for that keyword.
- Keywords should suggest FUTURE directions, not describe what already happened.

${WRITING_STYLE_INSTRUCTION}

OUTPUT FORMAT: Return ONLY a JSON object, no markdown, no code blocks, no extra text:
{
  "mainLineName": "...",
  "mainLineNameCn": "...",
  "stage": "...",
  "stageCn": "...",
  "progressDesc": "...",
  "progressDescCn": "...",
  "suggestedKeywords": {
    "ending": ["...", "...", "..."],
    "relation": ["...", "...", "..."],
    "scene": ["...", "...", "..."],
    "stage": ["...", "...", "..."]
  }
}`;

    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'Analyze the current story and return the structured data.' }],
      systemPrompt,
      stream: false,
      temperature: 0.6,
      maxTokens: 800,
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
      if (!parsed.mainLineName || !parsed.suggestedKeywords) {
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
