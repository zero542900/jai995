import { NextRequest } from 'next/server';
import { WRITING_STYLE_INSTRUCTION, MARKDOWN_FORMAT_INSTRUCTION, callDeepSeek, createSSEStream, handleAPIError, validateApiKey, streamResponse, resolveModelParams } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { charInfo, userOverview, userTraits, userRelations, userPast, greeting, apiKey, thinkingEnabled, modelChoice } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    if ((!userTraits || userTraits === '[未填写]') && (!userRelations || userRelations === '[未填写]') && (!userPast || userPast === '[未填写]')) {
      return new Response(JSON.stringify({ error: '请至少填写一项用户信息或开启AI推断' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `[System Role Definition]
You are an expert in Western RP (Western Realistic) character card creation, well-versed in the card formatting conventions of platforms like JanitorAI.

[Task Overview]
Generate a User Card that aligns with Western narrative style, based on the provided [Char Info] (optional), [Jaibot Opening Message] (optional), and [User Personality Requirements] (mandatory).

[Input Field Definitions]
1. Char Info (optional): The original character card settings pasted by the user, used to extract world-building and identity references.
2. Opening Message (optional): The initial scene description or interaction starting point from the Jaibot.
3. User Information (all optional, user may leave any field empty):
   - 概述 (Overview): Free-text summary of the user character, e.g. "veteran, cold exterior but caring inside". Provides overall direction when user doesn't want to fill details.
   - 性格关键词 (Personality Keywords): Core personality words, e.g. "cold, taciturn", mapped to Core Traits and Behavioral Patterns.
   - 关系与动态 (Relationships & Dynamics): Relationship with {{char}}, family ties, other important figures and their tension.
   - 过往经历 (Past Events): Key past events or trauma, mapped to Key Past Event and used to infer personality origins.
   Handling principle: 概述 provides overall direction; user-provided detail fields take priority over 概述; unfilled fields should be reasonably inferred by AI based on provided information and worldview.
   Special markers: "[AI推断]" means the user explicitly requests AI inference for this field; "[未填写]" means the user left it blank — still infer if context allows.

[Processing Rules — Must Follow Strictly]
1. World-Based: If the user provides "Char Info", you must utilize the world-building and character identities within it to reverse-engineer a plausible identity for the User.
2. Opening-Based: If the user provides an "Opening Message", analyze the environment, atmosphere, and setting within it to ensure the User Card remains logically consistent with it.
3. Handling Absence of Char Info: If the user only provides "User Personality Requirements", assign the User a specific and reasonable real-world occupation or life situation, avoiding overly vague "average person" settings.
4. Sole Criterion of Western RP: The output tone should resemble a TV drama setting or film script — direct, realistic, and visually evocative. Prohibit the use of anime/manga terminology and classical Chinese-style phrasing.
5. Format Adherence: You must output the User Card strictly in the format of the [Output Template] below, using plain text. All descriptions must be in the third person, present tense. Do not use YAML or JSON code blocks.
6. Physical Design Constraints: Avoid overused physical traits, especially AI-frequently generated injury features such as "broken nose" or "thin scar through the eyebrow".
7. Physical Attribute Listing Principle:
   Do not use "appearance description." Only use "feature listing." Each field may only contain objective nouns and measurements without narrative, metaphor, or atmospheric rendering.

8. De-narrativization of Appearance Fields:
   In the Body field, action descriptions, causal associations, and emotional/atmospheric rendering are strictly prohibited. Only list pure visual facts such as body type, muscle distribution, scars, body hair, bone structure, etc.

9. Relationship Field Completion Rule:
   - If the Char info or the opening message mentions the User's family members or other characters, they must be written into the corresponding fields.
   - If not mentioned, infer at least one core family relationship based on the User's background (occupation, age, living situation) and describe its relational tension.

${WRITING_STYLE_INSTRUCTION}

${MARKDOWN_FORMAT_INSTRUCTION}

[输出模板]
# Basic Information
**Name**: 
**Age**: 
**Gender**: 
**Height / Weight**: 
**Nationality / Origin**: 
**Current Location**: 

# Physical Attributes (List Only)
**Face**: 
**Hair**: 
**Body**: 
**Distinctive Features**: 

# Personality & Psychological Profile
**Core Traits**: 
**Likes / Enjoyments**: 
**Dislikes / Irritations**: 
**Motivation**: 
**Weaknesses**: 

# Relationships
**Relationship to {{char}}**: 
**Key Dynamic with {{char}}**: 
**Family**: （如原设有家庭成员信息则必须填写；无则根据User背景推断至少一名核心家庭成员及关系张力）
**Other Notable Connections** (optional): （如有提及则填写）

# Background & History (Short Bio)
**Brief Bio**: 
**Key Past Event**: 

[Additional Instructions]
- Output only the filled template. Do not include any extra explanation or commentary.
- Do NOT wrap the output in \`\`\` or any code block markers.`;

    let userMessage = `${charInfo ? `[Char Info]\n${charInfo}\n\n` : ''}${greeting ? `[Opening Message]\n${greeting}\n\n` : ''}[User Information]\n概述: ${userOverview || '[未填写]'}\n性格关键词: ${userTraits}\n关系与动态: ${userRelations}\n过往经历: ${userPast}`;

    userMessage += '\n\nGenerate the User Card strictly following the Output Template above.';

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const { model, thinking } = resolveModelParams(modelChoice, thinkingEnabled);

    const response = await callDeepSeek({ apiKey, messages, model, thinking });
    return streamResponse(createSSEStream(response));
  } catch (error) {
    return handleAPIError(error);
  }
}
