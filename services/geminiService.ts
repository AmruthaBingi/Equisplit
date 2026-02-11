
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Expense, User } from "../types";

// Helper for Base64 to Uint8Array for PCM audio, matching provided guideline implementation
const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const analyzeExpenses = async (expenses: Expense[], users: User[]) => {
  // Always use process.env.API_KEY directly and use current GenAI patterns
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';
  
  const ledgerSummary = expenses.map(e => ({
    description: e.description,
    amount: e.amount,
    payer: users.find(u => u.id === e.paidBy)?.name,
    tag: e.tag,
    splits: e.splits.map(s => ({
      name: users.find(u => u.id === s.userId)?.name,
      share: s.amount
    }))
  }));

  const prompt = `Analyze this group ledger for fairness and anomalies. 
  Ledger: ${JSON.stringify(ledgerSummary)}`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: "You are an objective group auditor. Provide a JSON analysis with: anomalies (list), fairnessReview (string), and tips (list).",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            anomalies: { type: Type.ARRAY, items: { type: Type.STRING } },
            fairnessReview: { type: Type.STRING },
            tips: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          propertyOrdering: ["anomalies", "fairnessReview", "tips"],
        }
      }
    });

    // Access .text property directly as per guidelines
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};

export const chatWithAuditor = async (history: { role: string, parts: { text: string }[] }[], newMessage: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';
  const chat = ai.chats.create({
    model,
    history: history,
    config: {
      systemInstruction: "You are the 'EquiSplit AI Auditor'. Help users resolve group expense disputes. Be objective and refer to specific transaction logic."
    }
  });

  const response = await chat.sendMessage({ message: newMessage });
  return response.text;
};

export const scanReceipt = async (base64Image: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Use gemini-3-flash-preview for multimodal text extraction tasks instead of imaging models
  const model = 'gemini-3-flash-preview';
  const prompt = "Extract receipt details: amount, description, and category.";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            description: { type: Type.STRING },
            category: { type: Type.STRING }
          },
          propertyOrdering: ["amount", "description", "category"],
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Receipt Scan Error:", error);
    return null;
  }
};

export const generateSettlementVoice = async (text: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this settlement summary clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return decode(base64Audio);
    }
    return null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
};
