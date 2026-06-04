import { NextRequest } from 'next/server';
import { callDeepSeek, createSSEStream, handleAPIError, validateApiKey, streamResponse } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { charInfo, userPersonality, greeting, apiKey } = body;

    const keyError = validateApiKey(apiKey);
    if (keyError) return keyError;

    const systemPrompt = `You are an expert character card creator for JanitorAI roleplay. You create immersive, Western-cinematic-style User persona cards.

RULES:
1. Write in the voice of an American TV show or movie narrator — NOT anime, NOT Chinese classical style.
2. Based on the Character card's world/setting, infer a fitting identity for the User. For example:
   - If the character is a wizard, the User could be a bard, mercenary, or alchemist — NOT a modern office worker.
   - If the character is a sci-fi captain, the User could be a rogue engineer or alien diplomat.
3. The User card must be written in English using the JanitorAI W++ format.
4. Make the User's personality, background, and motivations complement and create interesting dynamics with the Character.
5. Include: Name, Age, Gender, Species/Race, Appearance, Personality, Background, Likes, Dislikes, Speech Style, and Relationship Dynamic with the Character.
6. Be creative, specific, and immersive. Avoid generic traits.
7. You MUST also write an opening greeting (Greeting) — a short narrative paragraph (2-4 sentences) from the User's perspective that sets the scene for the roleplay. It should feel cinematic and immediately immerse the reader.

OUTPUT FORMAT - Use this template:
[Character("{{user}}")]
[Nickname("...")]
[Age("...")]
[Gender("...")]
[Species("...")]
[Personality("...")]
[Appearance("...")]
[Background("...")]
[Likes("...")]
[Dislikes("...")]
[Speech("...")]
[Relationship("...")]
[Description("A comprehensive paragraph describing who {{user}} is, their place in the world, and how they connect to the character.")]

[Greeting("An opening narrative from the User's perspective that sets the scene. 2-4 cinematic sentences that draw the reader in.")]`;

    const userMessage = `Here is the Character card information:\n\n${charInfo}\n\nHere are the User personality requirements:\n\n${userPersonality}${greeting ? `\n\nHere is the desired opening greeting direction:\n\n${greeting}` : ''}\n\nGenerate a complete User persona card following the rules and template above. The User should fit naturally into the Character's world and create compelling roleplay dynamics. Make sure the Greeting feels cinematic and immersive.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await callDeepSeek({ apiKey, messages, temperature: 0.9 });
    return streamResponse(createSSEStream(response));
  } catch (error) {
    return handleAPIError(error);
  }
}
