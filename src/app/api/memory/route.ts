import { NextRequest } from 'next/server';
import { callDeepSeek, validateApiKey, CHINESE_OUTPUT_INSTRUCTION, resolveModelParams, streamResponse, createSSEStream } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { charInfo, userCard, chatHistory, longTermMemory, apiKey, mainLinePrompt, thinkingEnabled, modelChoice } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    const systemPrompt = `You are a roleplay memory summarization assistant for JanitorAI. Generate a long-term memory entry from the CHAR's perspective — this memory will be pasted into the Bot's (Char's) long-term memory field on JanitorAI.

CORE PRINCIPLE: The memory must be written from {{char}}'s point of view, as {{char}}'s own memory about {{user}}. It should cover what {{char}} observes, feels, and remembers about {{user}}.

IMPORTANT NAMING RULE: Always use {{char}} and {{user}} as placeholders instead of any actual character names. JanitorAI will automatically replace these with the correct names at runtime. Do NOT use any specific names.

PERSPECTIVE: Always use THIRD PERSON perspective with {{char}} and {{user}} as names (e.g. "{{char}} noticed that {{user}} was...", "{{char}} felt a shift in {{user}}'s demeanor..."). Do NOT use first person ("I").

COGNITIVE BOUNDARY (STRICT):
- Record only what {{char}} directly perceives through senses: what {{char}} sees, hears, feels (physical touch), or smells/tastes in the scene.
- If {{user}} is hiding something from {{char}}, {{char}} can only record the observable behavioral cues (e.g., "{{user}} avoided eye contact," "{{user}}'s voice wavered"), NOT the hidden truth itself. {{char}} does NOT know what {{user}} is concealing.
- If {{char}} speculates or suspects something, clearly frame it as {{char}}'s speculation (e.g., "{{char}} suspected {{user}} was holding something back"), not as known fact.
- CRITICAL DISTINCTION: {{char}} can only record what is SENSORILY PERCEIVABLE in the scene. If {{user}}'s internal thoughts, hidden motives, or secret backstory are revealed in {{user}}'s private narration but NOT expressed through dialogue, facial expressions, body language, or other observable signals that {{char}} could detect, do NOT include them. When in doubt, ask: "Could {{char}} see, hear, feel, smell, or taste this?" If no — omit it.

CONTEXT:
- Character ({{char}}): ${charInfo || '(not provided)'}
- User Persona ({{user}}): ${userCard || '(not provided)'}
${longTermMemory ? `- **Existing Long-term Memory (MUST merge and compress)**:\n${longTermMemory}` : ''}
- If any of the above fields are empty or contain unexpanded variable placeholders, treat them as "No existing information" and proceed solely from the current scene.

CURRENT SCENE:
${chatHistory || '(This is the beginning of the story)'}

INSTRUCTIONS:
${longTermMemory ? `MERGE & COMPRESS: You MUST merge the existing long-term memory with the new events from the current scene. Do NOT simply append — integrate old and new information into a single unified summary. Remove redundancies, compress details that are no longer relevant, and keep only what matters for future interactions. Total output MUST NOT exceed 3000 words.` : `If no existing long-term memory is present: This is the first memory entry. Generate a foundational summary from the current scene, establishing baseline observations about {{user}}'s traits, current state, and the initial relationship dynamic. No merging is needed.`}

When compression is required, retain information in this priority order:
1. Unresolved plot threads, secrets, and foreshadowing
2. Significant changes in {{user}}'s emotional state, personality, or behavior
3. Major relationship shifts between {{char}} and {{user}}
4. Concrete events with lasting consequences
Discard: routine pleasantries, repeated interactions without new development, transient mood swings that have since resolved.

The memory should include:
- {{user}}'s current emotional/physical state as observed by {{char}}
- Key events that happened (both old and new)
- Important interactions between {{char}} and {{user}}
- Any character development or changes in {{user}}
- {{char}}'s relationship status with {{user}}

Format:
<Memory_LTM>
[Concise but detailed summary of key facts, events, and states from {{char}}'s perspective about {{user}}]
</Memory_LTM>

Keep it detailed and comprehensive — this will be used as context for the Bot in future conversations, so nuance and sensory detail are valuable.

FORMAT INTEGRITY CHECK (MANDATORY LOOP):
Before finalizing output, scan the entire memory content. If ANY broken placeholder is found ({{}}, {{char}, {user}, etc.), repair it immediately and rescan. Only proceed to output when ZERO broken placeholders remain.

${mainLinePrompt || ''}

${CHINESE_OUTPUT_INSTRUCTION}`;

    const { model, thinking } = resolveModelParams(modelChoice, thinkingEnabled);

    const response = await callDeepSeek({
      apiKey,
      model,
      thinking,
      messages: [{ role: 'user', content: 'Generate a long-term memory summary from {{char}}\'s perspective about {{user}} based on the current conversation context.' }],
      systemPrompt,
      stream: true,
      maxTokens: 6000,
    });

    return streamResponse(createSSEStream(response));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
