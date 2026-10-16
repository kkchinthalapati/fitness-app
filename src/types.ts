export type FoodCategory =
  | "south_indian"
  | "north_indian"
  | "staple"
  | "ingredient"
  | "snack"
  | "beverage"
  | "custom";

export type Unit =
  | "g"
  | "kg"
  | "ml"
  | "cup"
  | "katori"
  | "bowl"
  | "piece"
  | "serving"
  | "tbsp"
  | "tsp";

export interface Food {
  id: string;
  name: string;
  localName?: string;
  category: FoodCategory;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  servingDescription: string;
  servingGrams: number;
  isApproximate: boolean;
  isCustom: boolean;
  source: "seed" | "custom" | "ai";
  createdAt: number;
  updatedAt: number;
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface FoodEntry {
  id: string;
  foodId: string;
  foodName: string;
  quantity: number;
  unit: Unit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string; // YYYY-MM-DD
  meal: MealType;
  createdAt: number;
}

export interface AppSettings {
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  geminiApiKey: string;
  geminiModel: string;
}

export interface GeminiEstimate {
  foodName: string;
  servingDescription: string;
  servingGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: "low" | "medium" | "high";
  reasoning?: string;
}

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

export const UNIT_LABELS: Record<Unit, string> = {
  g: "grams (g)",
  kg: "kilograms (kg)",
  ml: "milliliters (ml)",
  cup: "cup",
  katori: "katori",
  bowl: "bowl",
  piece: "piece",
  serving: "serving",
  tbsp: "tbsp",
  tsp: "tsp",
};

export const UNIT_TO_GRAMS: Record<Unit, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  cup: 150,
  katori: 150,
  bowl: 200,
  piece: 1, // will be replaced by food.servingGrams
  serving: 1, // replaced by food.servingGrams
  tbsp: 15,
  tsp: 5,
};
