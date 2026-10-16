import type { GeminiEstimate } from "../types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

function getApiKey(): string {
  // localStorage key; also check vite env as fallback
  const fromStorage = localStorage.getItem("fitness-gemini-key");
  if (fromStorage) return fromStorage;
  // @ts-ignore vite env
  return import.meta.env?.VITE_GEMINI_API_KEY || "";
}

const ESTIMATE_PROMPT = `You are a nutrition estimator for Indian foods. Given a food name (and optionally an image), return JSON ONLY with this exact shape:
{
  "foodName": "string",
  "servingDescription": "e.g. 1 katori (~150g) or 1 piece (~40g)",
  "servingGrams": 150,
  "calories": 180,
  "protein": 5,
  "carbs": 25,
  "fat": 6,
  "confidence": "low" | "medium" | "high",
  "reasoning": "brief note"
}
Rules:
- Estimate for one typical serving. Include servingGrams numeric.
- calories, protein, carbs, fat are for that serving.
- Confidence low if uncertain or obscure dish.
- Return ONLY JSON, no markdown, no extra text.`;

const LABEL_PROMPT = `You are a nutrition label reader. Given an image of a nutrition label, extract per-serving values. Return JSON ONLY:
{
  "foodName": "product name from label",
  "servingDescription": "serving size from label e.g. per 100g or per 30g serving",
  "servingGrams": 100,
  "calories": 200,
  "protein": 5,
  "carbs": 30,
  "fat": 8,
  "confidence": "high",
  "reasoning": "extracted from label"
}
If no label is visible, treat as plate estimation with confidence low. Return ONLY JSON.`;


async function callGemini(
  model: string,
  apiKey: string,
  contents: unknown[],
  isLabel: boolean
): Promise<GeminiEstimate> {
  const prompt = isLabel ? LABEL_PROMPT : ESTIMATE_PROMPT;
  const url = `${API_BASE}/models/${model}:generateContent?key=${apiKey}`;

  // inject system instruction as first content
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }, ...contents],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    let msg = errText;
    try {
      const j = JSON.parse(errText);
      msg = j.error?.message || errText;
    } catch {}
    throw new Error(`Gemini API error (${res.status}): ${msg}`);
  }

  const data = await res.json();
  const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini. Check API key and model.");
  let parsed: GeminiEstimate;
  try {
    parsed = JSON.parse(text);
  } catch {
    // try extracting json block
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Failed to parse Gemini JSON: " + text.slice(0, 300));
    parsed = JSON.parse(m[0]);
  }
  // validate basics
  if (
    typeof parsed.calories !== "number" ||
    typeof parsed.protein !== "number" ||
    typeof parsed.carbs !== "number" ||
    typeof parsed.fat !== "number"
  ) {
    throw new Error("Gemini returned invalid nutrition numbers");
  }
  if (!parsed.servingGrams) parsed.servingGrams = 100;
  if (!parsed.confidence) parsed.confidence = "low";
  return parsed;
}

export async function estimateFromText(query: string, modelOverride?: string): Promise<GeminiEstimate> {
  const key = getApiKey();
  if (!key) throw new Error("Gemini API key not set. Go to Settings to add your key.");
  const model = modelOverride || localStorage.getItem("fitness-gemini-model") || "gemini-2.0-flash";
  return callGemini(model, key, [{ role: "user", parts: [{ text: `Estimate nutrition for: ${query}` }] }], false);
}

export async function estimateFromImage(
  base64: string,
  mimeType: string,
  hint?: string,
  isLabel = false,
  modelOverride?: string
): Promise<GeminiEstimate> {
  const key = getApiKey();
  if (!key) throw new Error("Gemini API key not set. Go to Settings to add your key.");
  const model = modelOverride || localStorage.getItem("fitness-gemini-model") || "gemini-2.0-flash";
  const textPart = hint ? `Hint: ${hint}. ${isLabel ? "Read the nutrition label." : "Estimate this plate."}` : isLabel ? "Read the nutrition label in the image." : "Estimate the food in the image.";
  return callGemini(
    model,
    key,
    [
      {
        role: "user",
        parts: [
          { text: textPart },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    isLabel
  );
}

export function saveApiKey(key: string, model: string) {
  localStorage.setItem("fitness-gemini-key", key);
  localStorage.setItem("fitness-gemini-model", model);
}

export function getStoredApiKey() {
  return {
    key: localStorage.getItem("fitness-gemini-key") || "",
    model: localStorage.getItem("fitness-gemini-model") || "gemini-2.0-flash",
  };
}
