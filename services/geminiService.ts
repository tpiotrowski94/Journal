
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
      contents: `Parse these Hyperliquid fills into consolidated Trade objects.
      RAW FILLS: ${JSON.stringify(fills)}`,
      config: {
        systemInstruction: `You are a Hyperliquid L1 Transaction Engine. 
        TASK:
        1. Group "fills" by "coin".
        2. A "Trade" is a sequence of fills that opens and potentially closes a position.
        3. If you see 'B' (Buy) followed by 'S' (Sell) for the same coin, group them into ONE Trade with an 'exitPrice'.
        4. If the total size of 'B' fills equals the total size of 'S' fills, the trade is CLOSED.
        5. 'entryPrice' is the weighted average price of opening fills.
        6. 'exitPrice' is the weighted average price of closing fills.
        7. 'externalId' must be "COIN-TIMESTAMP" of the first fill.
        8. 'date' is ISO format of the first fill.
        9. Strictly convert all strings (px, sz, fee) to NUMBERS.
        10. Output ONLY valid JSON array.`,
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
              date: { type: Type.STRING },
              leverage: { type: Type.NUMBER }
            },
            required: ["externalId", "symbol", "type", "entryPrice", "amount", "fees", "date", "leverage"]
          }
        }
      },
    });

    const text = response.text?.trim() || "[]";
    const parsed = JSON.parse(text);
    console.log("[DEBUG] AI Consolidated Trades:", parsed);
    return parsed;
  } catch (error) {
    console.error("Batch AI Parsing Error:", error);
    return [];
  }
};
