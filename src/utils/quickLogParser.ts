import type { Food, Unit } from "../types.ts";
import { computeEntry } from "./nutrition.ts";

export interface ParsedQuickLogItem {
  rawText: string;
  query: string;
  quantity: number;
  unit: Unit;
  matchedFood: Food | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  grams: number;
  confidence: "exact" | "high" | "approx" | "unmatched";
}

export const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const NUMBER_WORDS: Record<string, number> = {
  half: 0.5,
  quarter: 0.25,
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const UNIT_SYNONYMS: Record<string, Unit> = {
  g: "g",
  gram: "g",
  grams: "g",
  gm: "g",
  gms: "g",
  kg: "kg",
  kgs: "kg",
  kilo: "kg",
  kilogram: "kg",
  kilograms: "kg",
  ml: "ml",
  mls: "ml",
  milli: "ml",
  milliliter: "ml",
  milliliters: "ml",
  cup: "cup",
  cups: "cup",
  katori: "katori",
  katoris: "katori",
  bowl: "bowl",
  bowls: "bowl",
  ladle: "ladle",
  ladles: "ladle",
  piece: "piece",
  pieces: "piece",
  pc: "piece",
  pcs: "piece",
  slice: "slice",
  slices: "slice",
  glass: "glass",
  glasses: "glass",
  tumbler: "glass",
  tumblers: "glass",
  serving: "serving",
  servings: "serving",
  plate: "serving",
  plates: "serving",
  scoop: "serving",
  scoops: "serving",
  portion: "serving",
  portions: "serving",
  handful: "serving",
  morsel: "serving",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbs: "tbsp",
  tb: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  spoon: "tsp",
  spoons: "tsp",
  chamach: "tsp",
  spoonful: "tsp",
  spoonfuls: "tsp",
};

export function toSingular(w: string): string {
  const lower = w.toLowerCase();
  if (lower.length <= 3) return lower;
  if (lower.endsWith("ies")) return lower.slice(0, -3) + "y";
  if (
    lower.endsWith("es") &&
    (lower.endsWith("shes") ||
      lower.endsWith("ches") ||
      lower.endsWith("xes") ||
      lower.endsWith("ses") ||
      lower.endsWith("toes"))
  ) {
    return lower.slice(0, -2);
  }
  if (lower.endsWith("s") && !lower.endsWith("ss")) return lower.slice(0, -1);
  return lower;
}

/**
 * Splits input text on delimiters like "with", "and", "+", commas, semicolons, newlines.
 */
export function splitMultiItemText(text: string): string[] {
  // Normalize compound quantities before splitting so "1 and a half katori" doesn't get severed
  let preprocessed = text
    .replace(/\b(\d+)\s+and\s+(?:a\s+)?half\b/gi, (_, n) => `${parseFloat(n) + 0.5}`)
    .replace(/\b(one|two|three|four|five)\s+and\s+(?:a\s+)?half\b/gi, (_, w) => {
      const val = NUMBER_WORDS[w.toLowerCase()] ?? 1;
      return `${val + 0.5}`;
    })
    .replace(/\b(\d+)\s+and\s+(?:a\s+)?quarter\b/gi, (_, n) => `${parseFloat(n) + 0.25}`);

  // Replace delimiters with standard pipe separator
  const normalized = preprocessed
    .replace(/\r\n|\r|\n/g, "|")
    .replace(/\s+with\s+/gi, "|")
    .replace(/\s+and\s+/gi, "|")
    .replace(/\s*\+\s*/g, "|")
    .replace(/\s*&\s*/g, "|")
    .replace(/\s*;\s*/g, "|")
    .replace(/,\s*/g, "|");

  return normalized
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parses a single item phrase (e.g. "2 idlis", "1 ladle sambar", "1 spoon ghee", "half cup curd", "½ cup milk").
 */
export function parseSinglePhrase(phrase: string): {
  quantity: number;
  unit: Unit | null;
  foodQuery: string;
} {
  let clean = phrase.trim();

  let quantity = 1;
  let unit: Unit | null = null;

  // 1. Check for multiplier syntax: "2x idli", "3X dosa"
  clean = clean.replace(/^(\d+(?:\.\d+)?)\s*[xX]\s+/i, "$1 ");

  // 2. Check for unicode fractions: "½ katori", "1½ roti", "1 ½ cup"
  const uniFracMatch = clean.match(/^(\d+)?\s*([½¼¾⅓⅔⅛⅜⅝⅞])\s*(.*)$/);
  if (uniFracMatch) {
    const whole = uniFracMatch[1] ? parseFloat(uniFracMatch[1]) : 0;
    const frac = UNICODE_FRACTIONS[uniFracMatch[2]] || 0.5;
    quantity = whole + frac;
    clean = uniFracMatch[3].trim();
  } else {
    // 3. Check ASCII fraction (e.g., "1/2", "3/4", "1 1/2")
    const fracMatch = clean.match(/^(\d+)?\s*(\d+)\/(\d+)\s*(.*)$/);
    if (fracMatch) {
      const whole = fracMatch[1] ? parseFloat(fracMatch[1]) : 0;
      const num = parseFloat(fracMatch[2]);
      const den = parseFloat(fracMatch[3]);
      if (den > 0) {
        quantity = whole + num / den;
        clean = fracMatch[4].trim();
      }
    } else {
      // 4. Check decimal or integer number at start, including leading period (.5)
      const numMatch = clean.match(/^(\d*\.?\d+)\s*(.*)$/);
      if (numMatch && numMatch[1] !== ".") {
        quantity = parseFloat(numMatch[1]);
        clean = numMatch[2].trim();
      } else {
        // 5. Check number word at start
        const firstWord = clean.split(/\s+/)[0]?.toLowerCase();
        if (firstWord && NUMBER_WORDS[firstWord] !== undefined) {
          quantity = NUMBER_WORDS[firstWord];
          clean = clean.replace(new RegExp(`^${firstWord}\\s*`, "i"), "").trim();
        }
      }
    }
  }

  // Strip leading "x " or "of " e.g. "x idli" or "cup of curd"
  clean = clean.replace(/^(?:x|of)\s+/i, "").trim();

  // Check for unit at start of remainder
  const words = clean.split(/\s+/);
  if (words.length > 0) {
    const candidateUnit = words[0].toLowerCase().replace(/[^a-z]/g, "");
    if (UNIT_SYNONYMS[candidateUnit]) {
      unit = UNIT_SYNONYMS[candidateUnit];
      clean = words.slice(1).join(" ").trim();
    }
  }

  // Strip leading "of " again if unit was stripped (e.g. "katori of curd")
  clean = clean.replace(/^of\s+/i, "").trim();

  // If unit wasn't at the beginning, check if unit is right after the food or trailing:
  // e.g. "sambar 1 ladle" or "curd 1 cup"
  if (!unit) {
    const trailingUnitMatch = clean.match(
      /^(.*?)\s+(katori|bowl|ladle|cup|glass|piece|slice|serving|tbsp|tsp|spoon|chamach|g|ml)s?$/i
    );
    if (trailingUnitMatch) {
      clean = trailingUnitMatch[1].trim();
      const uStr = trailingUnitMatch[2].toLowerCase();
      unit = UNIT_SYNONYMS[uStr] || null;
    }
  }

  return {
    quantity: Math.max(0.1, quantity),
    unit,
    foodQuery: clean.trim(),
  };
}

/**
 * Infers appropriate default unit from food serving description and name if unit wasn't specified.
 */
export function inferDefaultUnit(food: Food): Unit {
  const desc = food.servingDescription.toLowerCase();
  const name = food.name.toLowerCase();
  const text = `${name} ${desc}`;

  if (
    text.includes("piece") ||
    text.includes("idli") ||
    text.includes("dosa") ||
    text.includes("roti") ||
    text.includes("chapati") ||
    text.includes("vada") ||
    text.includes("garelu") ||
    text.includes("biscuit") ||
    text.includes("cookie") ||
    text.includes("egg") ||
    text.includes("banana") ||
    text.includes("apple") ||
    text.includes("paratha") ||
    text.includes("puri") ||
    text.includes("poori")
  ) {
    return "piece";
  }
  if (text.includes("slice")) return "slice";
  if (
    text.includes("ladle") ||
    text.includes("sambar") ||
    text.includes("rasam") ||
    text.includes("curry") ||
    text.includes("dal") ||
    text.includes("pappu")
  ) {
    return "ladle";
  }
  if (text.includes("katori")) return "katori";
  if (
    text.includes("bowl") ||
    text.includes("rice") ||
    text.includes("khichdi") ||
    text.includes("upma") ||
    text.includes("poha")
  ) {
    return "bowl";
  }
  if (
    text.includes("glass") ||
    text.includes("tumbler") ||
    text.includes("milk") ||
    text.includes("chai") ||
    text.includes("coffee") ||
    text.includes("juice") ||
    text.includes("water") ||
    text.includes("lassi") ||
    text.includes("buttermilk")
  ) {
    return "glass";
  }
  if (text.includes("cup")) return "cup";
  if (text.includes("tbsp")) return "tbsp";
  if (
    text.includes("tsp") ||
    text.includes("ghee") ||
    text.includes("oil") ||
    text.includes("sugar") ||
    text.includes("honey") ||
    text.includes("butter")
  ) {
    return "tsp";
  }
  if (text.includes("ml")) return "ml";
  if (text.includes("100 g") || text.includes("100g")) return "g";
  return "serving";
}

/**
 * Parses full multi-item text against food search engine.
 */
export function parseQuickLogText(
  text: string,
  searchFn: (query: string) => Food[]
): ParsedQuickLogItem[] {
  const phrases = splitMultiItemText(text);
  const results: ParsedQuickLogItem[] = [];

  for (const phrase of phrases) {
    const { quantity, unit: parsedUnit, foodQuery } = parseSinglePhrase(phrase);
    if (!foodQuery) continue;

    // Search food in database
    let matches = searchFn(foodQuery);

    // If no direct matches, attempt singular de-stemmed query (e.g. "idlis" -> "idli")
    if (matches.length === 0) {
      const singularQuery = foodQuery.split(/\s+/).map(toSingular).join(" ");
      if (singularQuery !== foodQuery.toLowerCase()) {
        matches = searchFn(singularQuery);
      }
    }

    const matchedFood = matches.length > 0 ? matches[0] : null;

    let finalUnit: Unit =
      parsedUnit || (matchedFood ? inferDefaultUnit(matchedFood) : "serving");

    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    let fiber: number | undefined;
    let grams = 0;
    let confidence: "exact" | "high" | "approx" | "unmatched" = "unmatched";

    if (matchedFood) {
      const comp = computeEntry(matchedFood, quantity, finalUnit);
      calories = comp.calories;
      protein = comp.protein;
      carbs = comp.carbs;
      fat = comp.fat;
      fiber = comp.fiber;
      grams = comp.grams;

      const normQuery = foodQuery.toLowerCase().trim();
      const normSingular = toSingular(normQuery);
      const normName = matchedFood.name.toLowerCase();
      if (normName === normQuery || normName === normSingular) {
        confidence = "exact";
      } else if (
        normName.startsWith(normQuery) ||
        normName.startsWith(normSingular) ||
        (matchedFood.aliases &&
          matchedFood.aliases.some(
            (a) => a.toLowerCase() === normQuery || toSingular(a.toLowerCase()) === normSingular
          ))
      ) {
        confidence = "high";
      } else {
        confidence = "approx";
      }
    }

    results.push({
      rawText: phrase,
      query: foodQuery,
      quantity,
      unit: finalUnit,
      matchedFood,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      grams,
      confidence,
    });
  }

  return results;
}
