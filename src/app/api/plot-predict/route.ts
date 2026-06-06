import { NextRequest } from 'next/server';
import { callDeepSeek, validateApiKey, WRITING_STYLE_INSTRUCTION } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      charInfo, userCard, chatHistory, longTermMemory, plotDirection,
      messageCount, directionKeyword, personMode,
      selectedPrediction, // if provided, generate a User reply advancing that direction
      apiKey
    } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    // Mode 1: Generate predictions
    if (!selectedPrediction) {
      const personInstruction = personMode === 'first'
        ? 'Write from the FIRST PERSON perspective (I / me / my).'
        : 'Write from the THIRD PERSON perspective (he / she / they).';

      const isNearClimax = messageCount >= 20;
      const twistInstruction = isNearClimax
        ? `\n\nIMPORTANT: The conversation has ${messageCount} messages, which suggests the story is approaching a climactic point. You MUST include a 4th prediction as a "stage transition" — a major shift like scene change, conflict escalation, relationship transformation, or unexpected event. This goes in the "twist" field of the JSON.`
        : '';

      const keywordInstruction = directionKeyword
        ? `\n\nPREFERRED DIRECTION: The user wants the plot to move toward "${directionKeyword}". Adjust your predictions accordingly.`
        : '';

      const systemPrompt = `You are a plot prediction assistant for JanitorAI roleplay. Generate 3 possible plot directions from the User's perspective.

${personInstruction}

CONTEXT:
- Character (Char): ${charInfo || '(not provided)'}
- User Persona: ${userCard || '(not provided)'}
${longTermMemory ? `- Long-term Memory: ${longTermMemory}` : ''}
${plotDirection ? `- Current Plot Direction: ${plotDirection}` : ''}

CURRENT SCENE:
${chatHistory || '(This is the beginning of the story)'}
${twistInstruction}${keywordInstruction}

STYLE: Western TV series or film. Tense, natural pacing, no dragging. Each prediction should be a concrete action the User could take — not vague or passive.

OUTPUT FORMAT: Return a JSON object with NO markdown formatting, NO code blocks, just raw JSON:
{
  "predictions": [
    "First prediction: 1-2 sentences about what User could do.",
    "Second prediction: 1-2 sentences, logically different from the first.",
    "Third prediction: 1-2 sentences, different from both above."
  ]${isNearClimax ? ',\n  "twist": "A stage-transition prediction: a major shift in the story."' : ''}
}

RULES:
- Each prediction must be from the User's perspective (what User can do or say).
- The 3 predictions must have clearly different core actions/emotions.
- No dramatic words like "suddenly", "unexpectedly", "collapse", "destiny".
- Think like a screenwriter choosing between scene branches: grounded, logical, film-like.
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
