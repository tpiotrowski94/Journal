
import { GoogleGenAI } from "@google/genai";
import { Trade } from "../types";

export const analyzeTrades = async (trades: Trade[]): Promise<string> => {
  if (trades.length === 0) return "Add some trades to get AI insights!";

  const tradesSummary = trades.map(t => ({
    symbol: t.symbol,
    pnl: t.pnl,
    confidence: t.confidence,
    type: t.type,
    notes: t.notes
  }));

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze my trading performance. Trade data: ${JSON.stringify(tradesSummary.slice(0, 20))}`,
      config: {
        systemInstruction: "You are a world-class on-chain trading analyst. Provide psychological feedback and risk management advice based on the user's trading history. Use professional English.",
        temperature: 0.7,
      },
    });
    return response.text || "No AI response available.";
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return "Error generating AI analysis. Ensure your API key is selected.";
  }
};
