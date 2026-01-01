
import { GoogleGenAI } from "@google/genai";
import { Trade } from "../types";

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
      contents: `Przeanalizuj moje wyniki tradingu. Zwróć uwagę na korelację między stopniem pewności (Confidence 1-5) a faktycznymi zyskami. 
      Dane transakcji: ${JSON.stringify(tradesSummary.slice(0, 20))}`,
      config: {
        systemInstruction: "Jesteś profesjonalnym analitykiem quant i trenerem tradingu. Mówisz konkretnie i po polsku. Analizuj, czy użytkownik ma tendencję do tracenia pieniędzy na setupach o niskiej pewności (Gambling) i czy powinien selektywniej dobierać pozycje.",
        temperature: 0.7,
      },
    });

    return response.text || "Brak odpowiedzi AI.";
  } catch (error) {
    return "Błąd klucza API.";
  }
};
