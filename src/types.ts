export type FoodCategory =
  | "south_indian"
  | "north_indian"
  | "staple"
  | "ingredient"
  | "snack"
  | "beverage"
  | "branded"
  | "international"
  | "custom";

export type Unit =
  | "g"
  | "kg"
  | "ml"
  | "cup"
  | "katori"
  | "bowl"
  | "ladle"
  | "piece"
  | "slice"
  | "glass"
  | "serving"
  | "tbsp"
  | "tsp";

export interface FoodProvenance {
  sourceName: string;
  sourceId?: string;
  verified: boolean;
  confidence: "high" | "medium" | "approximate";
  notes?: string;
}

export interface Micronutrients {
  calcium_mg?: number;
  iron_mg?: number;
  potassium_mg?: number;
  sodium_mg?: number;
  vitamin_c_mg?: number;
  magnesium_mg?: number;
  zinc_mg?: number;
  folate_ug?: number;
  vitamin_a_ug?: number;
  vitamin_d_ug?: number;
  vitamin_b12_ug?: number;
  saturated_fat_g?: number;
  sugars_g?: number;
}

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
  source: "seed" | "custom" | "ai" | "recipe";
  createdAt: number;
  updatedAt: number;

  brand?: string;
  aliases?: string[];
  dietaryPreference?: "veg" | "vegan" | "non_veg";
  densityGml?: number;
  unitConversions?: Partial<Record<Unit, number>>;
  provenance?: FoodProvenance;
  micronutrients?: Micronutrients;
  isFavorite?: boolean;
  notes?: string;
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
  fiber?: number;
  micronutrients?: Micronutrients;
  grams?: number;
  date: string; // YYYY-MM-DD
  meal: MealType;
  notes?: string;
  createdAt: number;
}

export interface RecipeIngredient {
  foodId: string;
  foodName: string;
  quantity: number;
  unit: Unit;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  micronutrients?: Micronutrients;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  servings: number;
  cookedWeightGrams?: number;
  ingredients: RecipeIngredient[];
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
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  fiberGoal?: number;
  geminiApiKey: string;
  geminiModel: string;
  userProfile?: UserProfile;
  waterGoalMl?: number;
  theme?: "system" | "light" | "dark";
  hideExerciseCalories?: boolean;
  enableWeightTracking?: boolean;
  stravaClientId?: string;
  stravaClientSecret?: string;
  stravaAccessToken?: string;
  stravaRefreshToken?: string;
  stravaTokenExpiresAt?: number;
  stravaAutoSyncEnabled?: boolean;
  stravaLastSyncTime?: number;
}

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type GoalType =
  | "maintain"
  | "nourish"
  | "mild_deficit"
  | "deficit"
  | "mild_surplus"
  | "custom";

export interface UserProfile {
  name: string;
  age: number; // e.g. 15 for Karthik (Grade 9)
  gender: "male" | "female";
  heightCm: number; // e.g. 168 cm
  weightKg: number; // e.g. 58 kg
  activityLevel: ActivityLevel;
  goalType: GoalType;
  customCalorieTarget?: number;
  deficitTargetKcal?: number; // e.g. 300, 500
}

export type WorkoutType =
  | "running"
  | "cycling"
  | "badminton"
  | "cricket"
  | "gym"
  | "swimming"
  | "walking"
  | "other";

export interface StrengthSet {
  setNumber: number;
  reps: number;
  weightKg?: number;
  completed?: boolean;
}

export interface StrengthExerciseLog {
  exerciseId: string;
  exerciseName: string;
  sets: StrengthSet[];
  notes?: string;
}

export interface WorkoutEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: WorkoutType;
  durationMinutes: number;
  caloriesBurned: number;
  distanceKm?: number;
  paceMinPerKm?: number;
  avgHeartRate?: number;
  perceivedEffort?: number; // RPE 1-10
  exercises?: StrengthExerciseLog[];
  source: "manual" | "strava_gpx" | "strava_tcx" | "strava_json" | "strava_api";
  stravaActivityId?: string;
  notes?: string;
  createdAt: number;
}

export interface WaterEntry {
  id: string;
  date: string; // YYYY-MM-DD
  amountMl: number;
  createdAt: number;
}

export interface SavedMealItem {
  foodId: string;
  foodName: string;
  quantity: number;
  unit: Unit;
}

export interface SavedMeal {
  id: string;
  name: string;
  description?: string;
  items: SavedMealItem[];
  defaultMeal: MealType;
  createdAt: number;
}

export interface WeightEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
  waistCm?: number;
  bodyFatPct?: number;
  notes?: string;
  createdAt: number;
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

export const WORKOUT_LABELS: Record<WorkoutType, string> = {
  badminton: "Badminton",
  cricket: "Cricket",
  running: "Running",
  cycling: "Cycling",
  gym: "Gym / Strength",
  swimming: "Swimming",
  walking: "Walking",
  other: "Other Workout",
};

export const UNIT_LABELS: Record<Unit, string> = {
  g: "grams (g)",
  kg: "kilograms (kg)",
  ml: "milliliters (ml)",
  cup: "cup",
  katori: "katori",
  bowl: "bowl",
  ladle: "ladle",
  piece: "piece",
  slice: "slice",
  glass: "glass",
  serving: "serving",
  tbsp: "tbsp",
  tsp: "tsp",
};

export const UNIT_TO_GRAMS: Record<Unit, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  cup: 180,
  katori: 150,
  bowl: 200,
  ladle: 80,
  piece: 1, // fallback; replaced by food-specific piece weight or food.servingGrams
  slice: 35,
  glass: 250,
  serving: 1, // replaced by food.servingGrams
  tbsp: 15,
  tsp: 5,
};
