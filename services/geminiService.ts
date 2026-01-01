import { GoogleGenAI } from "@google/genai";
import { Trade } from "../types";

// Funkcja pomocnicza do inicjalizacji AI z najnowszym kluczem
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeTrades = async (trades: Trade[]): Promise<string> => {
  if (trades.length === 0) return "Dodaj transakcje, aby uzyskać analizę AI!";

  const tradesSummary = trades.map(t => ({
    symbol: t.symbol,
    type: t.type,
    status: t.status,
    pnl: t.pnl,
    pct: t.pnlPercentage,
    notes: t.notes
  }));

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Używamy modelu Pro dla lepszej analizy finansowej
      contents: `Przeanalizuj moją historię handlu kryptowalutami. Skup się na: 
      1. Skuteczności strategii (Win Rate).
      2. Zarządzaniu ryzykiem (czy straty nie są zbyt duże względem zysków).
      3. Sugestiach dotyczących konkretnych par (np. czy lepiej idzie mi na BTC czy ETH).
      Oto dane: ${JSON.stringify(tradesSummary)}`,
      config: {
        systemInstruction: "Jesteś profesjonalnym analitykiem quant i trenerem tradingu. Udzielasz zwięzłych, technicznych porad po polsku. Używaj terminologii tradingowej (RR, Drawdown, EMA itp.).",
        temperature: 0.7,
      },
    });

    return response.text || "Analityk AI nie wygenerował odpowiedzi. Spróbuj ponownie.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Błąd połączenia z analitykiem AI. Upewnij się, że klucz API_KEY jest poprawnie skonfigurowany w Vercel.";
  }
};