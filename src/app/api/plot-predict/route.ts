import { NextRequest } from 'next/server';
import { callDeepSeek, validateApiKey, WRITING_STYLE_INSTRUCTION } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      charInfo, userCard, chatHistory, longTermMemory, plotDirection,
      messageCount, directionKeyword, personMode, stylePrompt, mainLinePrompt,
      selectedPrediction, // if provided, generate a User reply advancing that direction
      apiKey
    } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    // Mode 1: Generate predictions
    if (!selectedPrediction) {
      const isNearClimax = messageCount >= 20;
      const twistInstruction = isNearClimax
        ? `\n\nIMPORTANT: The conversation has ${messageCount} messages, which suggests the story is approaching a climactic point. You MUST include a 4th prediction as a "stage transition" — a major shift like scene change, conflict escalation, relationship transformation, or unexpected event. This goes in the "twist" field of the JSON.`
        : '';

      const keywordInstruction = directionKeyword
        ? `\n\nPREFERRED DIRECTION: The user wants the plot to move toward "${directionKeyword}". Adjust your predictions accordingly.`
        : '';

      const styleInstruction = stylePrompt ? `\n\nSTYLE OVERRIDE: ${stylePrompt}` : '';
      const mainLineInstruction = mainLinePrompt ? `\n\nCURRENT MAIN STORYLINE: The user has locked the following main storyline. All predictions must be consistent with this direction: ${mainLinePrompt}` : '';

      const systemPrompt = `You are a plot prediction assistant for JanitorAI roleplay. Generate 3 possible long-term story directions from a GOD'S EYE VIEW (narrator perspective).

${styleInstruction}
${mainLineInstruction}

CONTEXT:
- Character (Char): ${charInfo || '(not provided)'}
- User Persona: ${userCard || '(not provided)'}
${longTermMemory ? `- Long-term Memory: ${longTermMemory}` : ''}
${plotDirection ? `- Current Plot Direction: ${plotDirection}` : ''}

CURRENT SCENE:
${chatHistory || '(This is the beginning of the story)'}
${twistInstruction}${keywordInstruction}

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. Write from GOD'S EYE VIEW — describe where the STORY is heading, not what any character will do.
2. DO NOT predict Char's specific actions. Never write things like "Char will..." or "Char is going to..."
3. DO NOT predict User's specific actions either. This is about story ARCH, not character actions.
4. Focus on: ending possibilities (HE/BE/open), relationship dynamics, power shifts, emotional arcs.
5. Each prediction should be 1-2 sentences describing the MACRO direction of the story.

GOOD examples:
- "This line may lead to HE: trust builds through shared vulnerability, eventual mutual rescue."
- "BE possibility is growing: accumulated silence will crush the relationship, ending with one party leaving for good."
- "Open ending is likely: the relationship deepens but neither will be the first to define it."
- "Power reversal is the core of this line: whoever falls first loses the most in the end."

BAD examples (NEVER write like this):
- "Next round Char will suddenly confess."
- "Char will protect User in the third act."
- "Char will leave the scene in anger."

OUTPUT FORMAT: Return a JSON object with NO markdown formatting, NO code blocks, just raw JSON:
{
  "predictions": [
    { "en": "First prediction in English: 1-2 sentences about the story's overall direction.", "cn": "第一条预测的中文翻译" },
    { "en": "Second prediction in English, a different possible arc.", "cn": "第二条预测的中文翻译" },
    { "en": "Third prediction in English, another distinct possibility.", "cn": "第三条预测的中文翻译" }
  ]${isNearClimax ? ',\n  "twist": "A stage-transition prediction: a major shift in the story arc."' : ''}
}

ADDITIONAL RULES:
- The 3 predictions must represent clearly different story arcs (e.g., HE vs BE vs open ending).
- Think like a screenwriter outlining season arcs: grounded, logical, film-like.
- Output ONLY the JSON object. No other text.`;

      const response = await callDeepSeek({
        apiKey,
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Generate 3 plot predictions based on the context above.' }],
        systemPrompt,
        stream: false,
        temperature: 0.85,
        maxTokens: 600,
      });

      // DeepSeek returns a full API response JSON when stream: false
      const apiResponse = await response.json();
      const aiContent = apiResponse?.choices?.[0]?.message?.content || '';

      if (!aiContent) {
        return new Response(JSON.stringify({ error: 'AI output empty, please retry' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Try to parse the AI content as JSON
      let jsonStr = aiContent;
      // Strip markdown code blocks if present
      const codeBlockMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }
      // Try to find JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return new Response(JSON.stringify({ error: 'AI output format error, please retry' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify(parsed), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'AI output parse error, please retry' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Mode 2: Generate a User reply advancing the selected prediction
    const personInstruction = personMode === 'first'
      ? 'Write from the FIRST PERSON perspective (I / me / my).'
      : 'Write from the THIRD PERSON perspective (he / she / they).';

    const systemPrompt = `You are a creative roleplay writing assistant for JanitorAI. Write a User reply that advances the plot toward a specific direction.

${personInstruction}

CONTEXT:
- Character (Char): ${charInfo || '(not provided)'}
- User Persona: ${userCard || '(not provided)'}
${longTermMemory ? `- Long-term Memory: ${longTermMemory}` : ''}
${plotDirection ? `- Current Plot Direction: ${plotDirection}` : ''}

CURRENT SCENE:
${chatHistory || '(This is the beginning of the story)'}

SELECTED DIRECTION:
${selectedPrediction}

INSTRUCTIONS:
Write a complete, vivid passage (1-3 paragraphs) from the User's perspective that naturally advances the plot toward the selected direction. Include:
- Dialogue (what the User says)
- Actions and body language
- Internal thoughts or feelings
- Environmental details

Write naturally and cinematically, like a Western RP novel. No anime/manga style. Keep it realistic and grounded.

${WRITING_STYLE_INSTRUCTION}

Output format: First output the English content, then on a new line write exactly "===CHINESE===" (this exact marker), then output the Chinese translation below.`;

    const response = await callDeepSeek({
      apiKey,
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: `Write a User reply advancing the plot toward: ${selectedPrediction}` }],
      systemPrompt,
      stream: true,
      temperature: 0.85,
      maxTokens: 2000,
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
          const errorMsg = error instanceof Error ? error.message : 'Stream error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
