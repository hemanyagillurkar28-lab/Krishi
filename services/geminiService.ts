
import { GoogleGenAI, Type } from "@google/genai";
import { ParsedIntent, IntentType, Language } from "../types";

// Helper to safely initialize AI
const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY is not defined in process.env");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

const modelName = "gemini-3-flash-preview";

const parsingSchema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: [IntentType.ACTIVITY, IntentType.TRANSACTION, IntentType.SOIL_TEST, IntentType.QUERY, IntentType.UNKNOWN],
      description: "Classification of voice command. Use QUERY for asking about money, prediction, or status."
    },
    confidence: { type: Type.NUMBER },
    data: {
      type: Type.OBJECT,
      properties: {
        activity_type: { type: Type.STRING },
        crop: { type: Type.STRING },
        area: { type: Type.NUMBER },
        amount: { type: Type.NUMBER },
        transaction_type: { type: Type.STRING, enum: ["INCOME", "EXPENSE"] },
        category: { type: Type.STRING },
        raw_text: { type: Type.STRING }
      }
    },
    confirmation_message: {
      type: Type.STRING,
      description: "Summarize the action or the requested info in the user's native tongue."
    }
  },
  required: ["intent", "data", "confirmation_message"]
};

export const parseVoiceCommand = async (text: string, lang: Language): Promise<ParsedIntent> => {
  if (!text) throw new Error("No text provided");
  
  const ai = getAIClient();
  if (!ai) return mockParse(text, lang);

  const langName = lang === Language.HINDI ? 'Pure Hindi' 
                 : lang === Language.MARATHI ? 'Pure Marathi' 
                 : lang === Language.GUJARATI ? 'Pure Gujarati'
                 : 'English';

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: `You are a regional farming assistant for Indian farmers.
      Analyze the input and return JSON. 
      Today is ${new Date().toLocaleDateString()}.
      
      If the user is asking a question about their profit, budget, or prediction, set intent to 'QUERY'.
      
      CRITICAL: The 'confirmation_message' MUST be written in ${langName} script. 
      DO NOT mix English words into the ${langName} confirmation.
      Example Marathi: "मी नोंदवले: आज २ एकरात कांदा लावला." 
      Example Hindi: "मैने नोट किया: आज २ एकड़ में प्याज लगाया।"
      Example Gujarati: "મેં નોંધ્યું: આજે ૨ એકરમાં ડુંગળી વાવી."
      
      User input: "${text}"
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: parsingSchema,
        temperature: 0.1
      }
    });

    const jsonText = response.text;
    return JSON.parse(jsonText || '{}') as ParsedIntent;
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      intent: IntentType.UNKNOWN,
      confidence: 0,
      data: { raw_text: text },
      confirmation_message: lang === Language.GUJARATI ? "કંઈક ભૂલ થઈ છે." : lang === Language.MARATHI ? "काहीतरी चूक झाली." : "कुछ गलत हो गया।"
    };
  }
};

const mockParse = (text: string, lang: Language): ParsedIntent => {
  let msg = "Processing complete.";
  if (lang === Language.HINDI) msg = "मैंने नोट किया: २ एकड़ में टमाटर की बुवाई।";
  if (lang === Language.MARATHI) msg = "मी नोंदवले: २ एकरात टोमॅटो लावले.";
  if (lang === Language.GUJARATI) msg = "મેં નોંધ્યું: ૨ એકરમાં ટામેટાની વાવણી.";
  
  return {
    intent: IntentType.ACTIVITY,
    confidence: 0.9,
    data: { activity_type: 'Sowing', crop: 'Tomato', area: 2, raw_text: text },
    confirmation_message: msg
  };
};
