import type { Food, FoodEntry, Micronutrients, Recipe, RecipeIngredient, Unit } from "../types.ts";
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
  const factor = food.servingGrams > 0 ? grams / food.servingGrams : 0;
  const m = food.micronutrients;

  const micros = m
    ? {
        calcium_mg: m.calcium_mg !== undefined ? Math.max(0, m.calcium_mg * factor) : undefined,
        iron_mg: m.iron_mg !== undefined ? Math.max(0, m.iron_mg * factor) : undefined,
        potassium_mg: m.potassium_mg !== undefined ? Math.max(0, m.potassium_mg * factor) : undefined,
        sodium_mg: m.sodium_mg !== undefined ? Math.max(0, m.sodium_mg * factor) : undefined,
        vitamin_c_mg: m.vitamin_c_mg !== undefined ? Math.max(0, m.vitamin_c_mg * factor) : undefined,
        magnesium_mg: m.magnesium_mg !== undefined ? Math.max(0, m.magnesium_mg * factor) : undefined,
        zinc_mg: m.zinc_mg !== undefined ? Math.max(0, m.zinc_mg * factor) : undefined,
        folate_ug: m.folate_ug !== undefined ? Math.max(0, m.folate_ug * factor) : undefined,
        vitamin_a_ug: m.vitamin_a_ug !== undefined ? Math.max(0, m.vitamin_a_ug * factor) : undefined,
        vitamin_d_ug: m.vitamin_d_ug !== undefined ? Math.max(0, m.vitamin_d_ug * factor) : undefined,
        vitamin_b12_ug: m.vitamin_b12_ug !== undefined ? Math.max(0, m.vitamin_b12_ug * factor) : undefined,
        saturated_fat_g: m.saturated_fat_g !== undefined ? Math.max(0, m.saturated_fat_g * factor) : undefined,
        sugars_g: m.sugars_g !== undefined ? Math.max(0, m.sugars_g * factor) : undefined,
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

/**
 * Computes full total & per-serving nutrition for a recipe.
 */
export function computeRecipeTotals(
  ingredients: RecipeIngredient[],
  servings: number,
  cookedWeightGrams?: number
): {
  totalGrams: number;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber?: number;
  totalMicronutrients?: Micronutrients;
  perServingGrams: number;
  perServingCalories: number;
  perServingProtein: number;
  perServingCarbs: number;
  perServingFat: number;
  perServingFiber?: number;
  perServingMicronutrients?: Micronutrients;
} {
  const safeServings = Math.max(1, servings);
  let totalGrams = 0;
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let hasFiber = false;
  let totalFiber = 0;

  const totalMicros: Micronutrients = {};
  let hasMicros = false;

  for (const ing of ingredients) {
    totalGrams += ing.grams;
    totalCalories += ing.calories;
    totalProtein += ing.protein;
    totalCarbs += ing.carbs;
    totalFat += ing.fat;
    if (ing.fiber !== undefined) {
      hasFiber = true;
      totalFiber += ing.fiber;
    }
    if (ing.micronutrients) {
      hasMicros = true;
      const m = ing.micronutrients;
      if (m.calcium_mg !== undefined) totalMicros.calcium_mg = (totalMicros.calcium_mg || 0) + m.calcium_mg;
      if (m.iron_mg !== undefined) totalMicros.iron_mg = (totalMicros.iron_mg || 0) + m.iron_mg;
      if (m.potassium_mg !== undefined) totalMicros.potassium_mg = (totalMicros.potassium_mg || 0) + m.potassium_mg;
      if (m.sodium_mg !== undefined) totalMicros.sodium_mg = (totalMicros.sodium_mg || 0) + m.sodium_mg;
      if (m.vitamin_c_mg !== undefined) totalMicros.vitamin_c_mg = (totalMicros.vitamin_c_mg || 0) + m.vitamin_c_mg;
      if (m.magnesium_mg !== undefined) totalMicros.magnesium_mg = (totalMicros.magnesium_mg || 0) + m.magnesium_mg;
      if (m.zinc_mg !== undefined) totalMicros.zinc_mg = (totalMicros.zinc_mg || 0) + m.zinc_mg;
      if (m.folate_ug !== undefined) totalMicros.folate_ug = (totalMicros.folate_ug || 0) + m.folate_ug;
      if (m.vitamin_a_ug !== undefined) totalMicros.vitamin_a_ug = (totalMicros.vitamin_a_ug || 0) + m.vitamin_a_ug;
      if (m.vitamin_d_ug !== undefined) totalMicros.vitamin_d_ug = (totalMicros.vitamin_d_ug || 0) + m.vitamin_d_ug;
      if (m.vitamin_b12_ug !== undefined) totalMicros.vitamin_b12_ug = (totalMicros.vitamin_b12_ug || 0) + m.vitamin_b12_ug;
      if (m.saturated_fat_g !== undefined) totalMicros.saturated_fat_g = (totalMicros.saturated_fat_g || 0) + m.saturated_fat_g;
      if (m.sugars_g !== undefined) totalMicros.sugars_g = (totalMicros.sugars_g || 0) + m.sugars_g;
    }
  }

  const perServingGrams = cookedWeightGrams && cookedWeightGrams > 0
    ? Math.round(cookedWeightGrams / safeServings)
    : Math.round(totalGrams / safeServings);

  const perServingMicros: Micronutrients = {};
  if (hasMicros) {
    for (const [k, v] of Object.entries(totalMicros)) {
      if (v !== undefined) {
        // @ts-ignore
        perServingMicros[k] = v / safeServings;
      }
    }
  }

  return {
    totalGrams: Math.round(totalGrams),
    totalCalories: Math.round(totalCalories * 10) / 10,
    totalProtein: Math.round(totalProtein * 10) / 10,
    totalCarbs: Math.round(totalCarbs * 10) / 10,
    totalFat: Math.round(totalFat * 10) / 10,
    totalFiber: hasFiber ? Math.round(totalFiber * 10) / 10 : undefined,
    totalMicronutrients: hasMicros ? totalMicros : undefined,
    perServingGrams,
    perServingCalories: Math.round((totalCalories / safeServings) * 10) / 10,
    perServingProtein: Math.round((totalProtein / safeServings) * 10) / 10,
    perServingCarbs: Math.round((totalCarbs / safeServings) * 10) / 10,
    perServingFat: Math.round((totalFat / safeServings) * 10) / 10,
    perServingFiber: hasFiber ? Math.round((totalFiber / safeServings) * 10) / 10 : undefined,
    perServingMicronutrients: hasMicros ? perServingMicros : undefined,
  };
}

/**
 * Converts a saved Recipe into a Food representation for logging and search.
 */
export function recipeToFood(recipe: Recipe): Food {
  return {
    id: recipe.id,
    name: recipe.name,
    category: "custom",
    calories: recipe.perServingCalories,
    protein: recipe.perServingProtein,
    carbs: recipe.perServingCarbs,
    fat: recipe.perServingFat,
    fiber: recipe.perServingFiber,
    servingDescription: `1 serving (~${recipe.perServingGrams}g of ${recipe.servings} total)`,
    servingGrams: recipe.perServingGrams || 100,
    isApproximate: false,
    isCustom: true,
    source: "recipe",
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
    notes: recipe.description || recipe.notes,
    micronutrients: recipe.perServingMicronutrients,
    dietaryPreference: "veg",
    unitConversions: {
      g: 1,
      serving: recipe.perServingGrams || 100,
    },
  };
}

/**
 * Computes aggregated nutrition for an array of FoodEntry items.
 */
export function computeDailyTotals(entries: FoodEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
      fiber: acc.fiber + (e.fiber || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
}

/**
 * Checks Atwater discrepancy between reported calories and 4P + 4C + 9F + 2Fib.
 */
export function checkAtwaterDiscrepancy(food: Food) {
  const p = food.protein || 0;
  const c = food.carbs || 0;
  const f = food.fat || 0;
  const fib = food.fiber || 0;
  const atwater = 4 * p + 4 * c + 9 * f + 2 * fib;
  const diff = Math.abs(food.calories - atwater);
  const percentDiff = atwater > 0 ? (diff / atwater) * 100 : 0;
  return {
    reportedCalories: food.calories,
    atwaterCalories: Math.round(atwater),
    difference: Math.round(diff),
    percentDiff: Math.round(percentDiff),
    isSignificant: diff > Math.max(35, atwater * 0.25),
  };
}
