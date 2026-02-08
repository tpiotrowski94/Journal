
import { GoogleGenAI, Type } from "@google/genai";
import { Trade, TradeType, TradeStatus, MarginMode } from "../types";

// Always create a new instance with the latest API key from process.env.API_KEY
// to ensure usage of the most up-to-date configuration.
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeTrades = async (trades: Trade[]): Promise<string> => {
  if (trades.length === 0) return "Dodaj transakcje, aby uzyskać analizę AI!";

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
      contents: `Przeanalizuj moje wyniki tradingu na Hyperliquid/Bullpen.
      Dane transakcji: ${JSON.stringify(tradesSummary.slice(0, 20))}`,
      config: {
        systemInstruction: "Jesteś profesjonalnym analitykiem Hyperliquid. Mówisz po polsku. Skup się na psychologii i zarządzaniu ryzykiem.",
        temperature: 0.7,
      },
    });

    // Access .text property directly as per latest SDK guidelines
    return response.text || "Brak odpowiedzi AI.";
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return "Błąd podczas analizy wyników przez AI.";
  }
};

export const parseBatchTransactions = async (fills: any[]): Promise<Partial<Trade>[]> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Przekształć poniższą listę wypełnień (fills) z giełdy Hyperliquid na listę obiektów Trade.
      Dane surowe: ${JSON.stringify(fills)}`,
      config: {
        systemInstruction: `Jesteś parserem Hyperliquid L1. 
        ZASADY:
        1. Grupuj fills o tym samym symbolu i zbliżonym czasie w JEDEN obiekt Trade.
        2. Side 'B' to kupno, 'S' to sprzedaż. Jeśli najpierw jest 'B', to LONG. Jeśli najpierw 'S', to SHORT.
        3. 'sz' to ilość (amount).
        4. 'px' to cena (price).
        5. 'fee' to prowizja.`,
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
    return JSON.parse(text);
  } catch (error) {
    console.error("Batch AI Error:", error);
    return [];
  }
};

// Added missing parseOnChainTransaction function to handle single transaction text parsing
// and resolve the export error in components/TradeForm.tsx.
export const parseOnChainTransaction = async (rawData: string): Promise<Partial<Trade> | null> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Przetwórz surowe dane transakcji z Hyperliquid i zwróć obiekt Trade. Dane: ${rawData}`,
      config: {
        systemInstruction: "Jesteś parserem Hyperliquid L1. Wyodrębnij szczegóły transakcji i zwróć je w formacie JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            symbol: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["LONG", "SHORT"] },
            entryPrice: { type: Type.NUMBER },
            amount: { type: Type.NUMBER },
            fees: { type: Type.NUMBER },
            fundingFees: { type: Type.NUMBER },
            leverage: { type: Type.NUMBER },
            date: { type: Type.STRING }
          },
          required: ["symbol", "type", "entryPrice", "amount", "fees", "date", "leverage"]
        }
      },
    });

    const text = response.text?.trim();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error("AI Parse Error:", error);
    return null;
  }
};
