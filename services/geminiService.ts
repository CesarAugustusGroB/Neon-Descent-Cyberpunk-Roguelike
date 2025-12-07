import { GoogleGenAI } from "@google/genai";
import { PlayerStats, RoomCardData, RoomType } from "../types";

// Initialize Gemini
// NOTE: API Key is assumed to be in process.env.API_KEY as per instructions.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Uses the high-reasoning Gemini 3 Pro model to analyze the current game state
 * and suggest the optimal move.
 */
export const getTacticalAnalysis = async (
  floor: number,
  player: PlayerStats,
  cards: RoomCardData[]
): Promise<string> => {
  try {
    const modelId = "gemini-3-pro-preview";

    const prompt = `
You are a high-level tactical AI assistant for a cyberpunk roguelike game called "Neon Descent".
Your goal is to ensure the user's survival (Integrity/HP) and maximize their growth (Power/RAM).

CURRENT STATE:
Floor Depth: ${floor} (Difficulty scales exponentially)
Player Integrity (HP): ${player.hp} / ${player.maxHp}
Player RAM (Power): ${player.power}
Player Firewall (Shield): ${player.shield}
Network Security Alert Level: ${player.securityAlert}% (High alert = Enemies deal significantly more damage!)
Credits (Crypto): ${player.credits}
Installed Modules: ${player.modules.map(m => m.name).join(', ') || "None"}

AVAILABLE NODES (Choices):
${cards.map((c, i) => `
Option ${i + 1}: [${c.type}] - ${c.name}
   - Description: ${c.description}
   - Next Layer Scout: It leads to [${c.nextScoutInfo.join(', ')}]
`).join('\n')}

GAME RULES:
- ALERT LEVEL: Avoiding combat (Rest, Treasure, Merchant) INCREASES Alert. Combat DECREASES Alert. High alert makes enemies deadly.
- COMBAT: Damage = (EnemyAttack * AlertMultiplier) - PlayerShield.
- MODULES: Passive buffs that change strategy.
- MERCHANT: Spend Crypto to buy Modules or Repair.

TASK:
Think deeply about the risk vs reward. 
- Is the Alert Level too high? You might need to fight an Enemy to lower it.
- Do you have enough Crypto for a Merchant?
- Consider the "Next Layer Scout" info carefully.

Provide a concise, tactical recommendation on which Option (1, 2, or 3) to pick and WHY. Be strategic.
    `.trim();

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        thinkingConfig: {
          thinkingBudget: 32768, // Max budget for deep reasoning
        },
        // Do NOT set maxOutputTokens when using thinkingBudget as per instructions
      },
    });

    return response.text || "Connection to tactical mainframe failed.";
  } catch (error) {
    console.error("AI Analysis Failed:", error);
    return "Tactical mainframe offline. Unable to process neural link.";
  }
};

/**
 * Generates a flavorful cyberpunk event description and outcome.
 * Uses a faster model for better responsiveness, but still "smart".
 */
export const generateEventFlavor = async (floor: number): Promise<{ title: string; description: string; effectText: string }> => {
  try {
    // Using Flash for speed on flavor text
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a short, single-paragraph cyberpunk "random event" encounter for floor ${floor} of a digital dungeon. 
      Also provide a 1-sentence resolution of what happened (e.g., player found a glitched credit drive).
      Return JSON format: { "title": "string", "description": "string", "effectText": "string" }`,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("No text");
    return JSON.parse(text);
  } catch (e) {
    return {
      title: "Glitch Node",
      description: "You encounter a corrupted data sector. Static fills your vision.",
      effectText: "You managed to salvage some data."
    };
  }
};