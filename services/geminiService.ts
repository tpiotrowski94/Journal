
import { GoogleGenAI, Type } from "@google/genai";
import { Trade, TradeType, TradeStatus, MarginMode } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    const ai = getAI();
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
    return "Error generating AI analysis.";
  }
};

export const parseBatchTransactions = async (fills: any[]): Promise<Partial<Trade>[]> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Convert these Hyperliquid user fills into a list of consolidated Trade objects.
      RAW FILLS DATA: ${JSON.stringify(fills)}`,
      config: {
        systemInstruction: `You are a Hyperliquid L1 Transaction Parser.
        TASK:
        1. Analyze the list of "fills". 
        2. Group fills of the same "coin" that occurred near the same time into logical Trade entries.
        3. "side" 'B' means Buy, 'S' means Sell. 
        4. If a position starts with 'B', it's a LONG. If it starts with 'S', it's a SHORT.
        5. Calculate the average price (px) and total size (sz) for each consolidated trade.
        6. Generate a stable 'externalId' by concatenating the symbol and the timestamp of the earliest fill in the group.
        7. If fills show both an entry and a corresponding exit (e.g., Buy 1 BTC then Sell 1 BTC), consolidate into a CLOSED trade with an 'exitPrice'.
        8. Assume standard leverage (use 1 if not detectable) and isolation.
        9. Output ONLY the JSON array.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              externalId: { type: Type.STRING },
              symbol: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["LONG", "SHORT"] },
              entryPrice: { type: Type.NUMBER },
              exitPrice: { type: Type.NUMBER, nullable: true },
              amount: { type: Type.NUMBER },
              fees: { type: Type.NUMBER },
              date: { type: Type.STRING, description: "ISO format date of the first fill" },
              leverage: { type: Type.NUMBER }
            },
            required: ["externalId", "symbol", "type", "entryPrice", "amount", "fees", "date", "leverage"]
          }
        }
      },
    });

    const text = response.text?.trim() || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Batch AI Parsing Error:", error);
    return [];
  }
};
