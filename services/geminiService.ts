
import { GoogleGenAI } from "@google/genai";
import { Trade } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeTrades = async (trades: Trade[]): Promise<string> => {
  if (trades.length === 0) return "Dodaj transakcje, aby uzyskać analizę AI!";

  const tradesSummary = trades.map(t => ({
    symbol: t.symbol,
    type: t.type,
    pnl: t.pnl,
    pct: t.pnlPercentage,
    notes: t.notes
  }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Przeanalizuj moją historię handlu kryptowalutami i przekaż profesjonalną opinię na temat mojej strategii, zarządzania ryzykiem i typowych błędów. Oto moje ostatnie transakcje: ${JSON.stringify(tradesSummary)}`,
      config: {
        systemInstruction: "Jesteś światowej klasy trenerem tradingu krypto. Udzielaj zwięzłych, konkretnych i opartych na danych porad po polsku. Skup się na psychologii i zarządzaniu ryzykiem.",
        temperature: 0.7,
      },
    });

    return response.text || "Nie udało się wygenerować analizy w tej chwili.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Błąd połączenia z analitykiem AI. Sprawdź swoje połączenie.";
  }
};
