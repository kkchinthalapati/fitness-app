import type { Food, Unit } from "../types.ts";
import { UNIT_TO_GRAMS } from "../types.ts";

export function computeGrams(food: Food, quantity: number, unit: Unit): number {
  if (unit === "g") return quantity;
  if (unit === "kg") return quantity * 1000;

  // 1. Serving unit ALWAYS resolves to canonical food.servingGrams
  if (unit === "serving") {
    return quantity * food.servingGrams;
  }

  const density = food.densityGml ?? (food.unitConversions?.ml as number | undefined) ?? (food.category === "beverage" ? 1.0 : 1.0);

  // 2. Liquid volume (ml) strictly respects density
  if (unit === "ml") {
    return quantity * density;
  }

  // 3. Explicit food-specific unit conversion
  if (food.unitConversions && food.unitConversions[unit] !== undefined) {
    return quantity * (food.unitConversions[unit] as number);
  }
  if (unit === "tsp") {
    // 1 tsp = 5 ml
    return quantity * 5 * density;
  }
  if (unit === "tbsp") {
    // 1 tbsp = 15 ml
    return quantity * 15 * density;
  }
  if (unit === "glass") {
    // 1 glass = 250 ml
    return quantity * 250 * density;
  }
  if (unit === "ladle") {
    // 1 standard Indian ladle = 80 ml (approx 80g for gravies/dal/sambar)
    return quantity * 80 * density;
  }
  if (unit === "cup") {
    // 1 cup = 240 ml for liquid/density; fallback to UNIT_TO_GRAMS.cup (180g)
    if (food.densityGml !== undefined || food.category === "beverage") {
      return quantity * 240 * density;
    }
    if (food.servingDescription.toLowerCase().includes("cup")) {
      return quantity * food.servingGrams;
    }
    return quantity * (UNIT_TO_GRAMS.cup || 180);
  }

  // 4. Indian household bowls / katori
  if (unit === "katori") {
    if (food.servingDescription.toLowerCase().includes("katori")) {
      return quantity * food.servingGrams;
    }
    return quantity * (UNIT_TO_GRAMS.katori || 150);
  }
  if (unit === "bowl") {
    if (food.servingDescription.toLowerCase().includes("bowl")) {
      return quantity * food.servingGrams;
    }
    return quantity * (UNIT_TO_GRAMS.bowl || 200);
  }

  // 5. Piece / Slice
  if (unit === "slice") {
    if (food.servingDescription.toLowerCase().includes("slice")) {
      return quantity * food.servingGrams;
    }
    return quantity * (UNIT_TO_GRAMS.slice || 35);
  }
  if (unit === "piece") {
    return quantity * food.servingGrams;
  }

  return quantity * (UNIT_TO_GRAMS[unit] || food.servingGrams);
}

export function computeEntry(food: Food, quantity: number, unit: Unit) {
  const grams = computeGrams(food, quantity, unit);
  const factor = grams / food.servingGrams;
  const micros = food.micronutrients
    ? {
        calcium_mg: food.micronutrients.calcium_mg !== undefined ? Math.max(0, food.micronutrients.calcium_mg * factor) : undefined,
        iron_mg: food.micronutrients.iron_mg !== undefined ? Math.max(0, food.micronutrients.iron_mg * factor) : undefined,
        potassium_mg: food.micronutrients.potassium_mg !== undefined ? Math.max(0, food.micronutrients.potassium_mg * factor) : undefined,
        sodium_mg: food.micronutrients.sodium_mg !== undefined ? Math.max(0, food.micronutrients.sodium_mg * factor) : undefined,
        vitamin_c_mg: food.micronutrients.vitamin_c_mg !== undefined ? Math.max(0, food.micronutrients.vitamin_c_mg * factor) : undefined,
      }
    : undefined;

  return {
    calories: Math.max(0, food.calories * factor),
    protein: Math.max(0, food.protein * factor),
    carbs: Math.max(0, food.carbs * factor),
    fat: Math.max(0, food.fat * factor),
    fiber: food.fiber !== undefined ? Math.max(0, food.fiber * factor) : undefined,
    micronutrients: micros,
    grams,
  };
}
