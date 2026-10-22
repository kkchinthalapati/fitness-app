import { openDB, type DBSchema } from "idb";
import type {
  Food,
  FoodEntry,
  AppSettings,
  WorkoutEntry,
  SavedMeal,
  WeightEntry,
  WaterEntry,
  UserProfile,
  Recipe,
} from "../types.ts";

interface FitnessDB extends DBSchema {
  foods: {
    key: string;
    value: Food;
    indexes: { "by-name": string; "by-category": string };
  };
  entries: {
    key: string;
    value: FoodEntry;
    indexes: { "by-date": string; "by-foodId": string };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
  workouts: {
    key: string;
    value: WorkoutEntry;
    indexes: { "by-date": string };
  };
  savedMeals: {
    key: string;
    value: SavedMeal;
  };
  weightEntries: {
    key: string;
    value: WeightEntry;
    indexes: { "by-date": string };
  };
  waterEntries: {
    key: string;
    value: WaterEntry;
    indexes: { "by-date": string };
  };
  recipes: {
    key: string;
    value: Recipe;
    indexes: { "by-name": string };
  };
}

const DB_NAME = "fitness-app-db";
export const DB_VERSION = 3;

export function getDB() {
  return openDB<FitnessDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("foods")) {
        const foodStore = db.createObjectStore("foods", { keyPath: "id" });
        foodStore.createIndex("by-name", "name");
        foodStore.createIndex("by-category", "category");
      }
      if (!db.objectStoreNames.contains("entries")) {
        const entryStore = db.createObjectStore("entries", { keyPath: "id" });
        entryStore.createIndex("by-date", "date");
        entryStore.createIndex("by-foodId", "foodId");
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings");
      }
      if (!db.objectStoreNames.contains("workouts")) {
        const workoutStore = db.createObjectStore("workouts", { keyPath: "id" });
        workoutStore.createIndex("by-date", "date");
      }
      if (!db.objectStoreNames.contains("savedMeals")) {
        db.createObjectStore("savedMeals", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("weightEntries")) {
        const weightStore = db.createObjectStore("weightEntries", { keyPath: "id" });
        weightStore.createIndex("by-date", "date");
      }
      if (!db.objectStoreNames.contains("waterEntries")) {
        const waterStore = db.createObjectStore("waterEntries", { keyPath: "id" });
        waterStore.createIndex("by-date", "date");
      }
      if (!db.objectStoreNames.contains("recipes")) {
        const recipeStore = db.createObjectStore("recipes", { keyPath: "id" });
        recipeStore.createIndex("by-name", "name");
      }
    },
  });
}

export const dbOps = {
  // --- Foods ---
  async getAllFoods(): Promise<Food[]> {
    const db = await getDB();
    return db.getAll("foods");
  },
  async searchFoods(query: string): Promise<Food[]> {
    const q = query.toLowerCase().trim();
    if (!q) return dbOps.getAllFoods();
    const db = await getDB();
    const all = await db.getAll("foods");
    return all.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.localName && f.localName.toLowerCase().includes(q)) ||
        (f.brand && f.brand.toLowerCase().includes(q)) ||
        (f.aliases && f.aliases.some((a) => a.toLowerCase().includes(q)))
    );
  },
  async getFood(id: string) {
    const db = await getDB();
    return db.get("foods", id);
  },
  async putFood(food: Food) {
    const db = await getDB();
    await db.put("foods", food);
  },
  async putFoods(foods: Food[]) {
    const db = await getDB();
    const tx = db.transaction("foods", "readwrite");
    await Promise.all(foods.map((f) => tx.store.put(f)));
    await tx.done;
  },
  async deleteFood(id: string) {
    const db = await getDB();
    await db.delete("foods", id);
  },

  // --- Food Entries ---
  async getEntriesByDate(date: string): Promise<FoodEntry[]> {
    const db = await getDB();
    return db.getAllFromIndex("entries", "by-date", date);
  },
  async getAllEntries(): Promise<FoodEntry[]> {
    const db = await getDB();
    return db.getAll("entries");
  },
  async putEntry(entry: FoodEntry) {
    const db = await getDB();
    await db.put("entries", entry);
  },
  async deleteEntry(id: string) {
    const db = await getDB();
    await db.delete("entries", id);
  },

  // --- Workouts ---
  async getWorkoutsByDate(date: string): Promise<WorkoutEntry[]> {
    const db = await getDB();
    return db.getAllFromIndex("workouts", "by-date", date);
  },
  async getAllWorkouts(): Promise<WorkoutEntry[]> {
    const db = await getDB();
    return db.getAll("workouts");
  },
  async putWorkout(workout: WorkoutEntry) {
    const db = await getDB();
    await db.put("workouts", workout);
  },
  async deleteWorkout(id: string) {
    const db = await getDB();
    await db.delete("workouts", id);
  },

  // --- Saved Meals ---
  async getAllSavedMeals(): Promise<SavedMeal[]> {
    const db = await getDB();
    return db.getAll("savedMeals");
  },
  async putSavedMeal(meal: SavedMeal) {
    const db = await getDB();
    await db.put("savedMeals", meal);
  },
  async deleteSavedMeal(id: string) {
    const db = await getDB();
    await db.delete("savedMeals", id);
  },

  // --- Weight Tracker ---
  async getAllWeightEntries(): Promise<WeightEntry[]> {
    const db = await getDB();
    return db.getAll("weightEntries");
  },
  async putWeightEntry(entry: WeightEntry) {
    const db = await getDB();
    await db.put("weightEntries", entry);
  },
  async deleteWeightEntry(id: string) {
    const db = await getDB();
    await db.delete("weightEntries", id);
  },

  // --- Water Tracker ---
  async getWaterByDate(date: string): Promise<WaterEntry[]> {
    const db = await getDB();
    return db.getAllFromIndex("waterEntries", "by-date", date);
  },
  async getAllWaterEntries(): Promise<WaterEntry[]> {
    const db = await getDB();
    return db.getAll("waterEntries");
  },
  async putWaterEntry(entry: WaterEntry) {
    const db = await getDB();
    await db.put("waterEntries", entry);
  },
  async deleteWaterEntry(id: string) {
    const db = await getDB();
    await db.delete("waterEntries", id);
  },

  // --- Settings ---
  async getSettings(): Promise<AppSettings | undefined> {
    const db = await getDB();
    return db.get("settings", "app");
  },
  async putSettings(settings: AppSettings) {
    const db = await getDB();
    await db.put("settings", settings, "app");
  },

  // --- Recipes ---
  async getAllRecipes(): Promise<Recipe[]> {
    const db = await getDB();
    return db.getAll("recipes");
  },
  async getRecipe(id: string): Promise<Recipe | undefined> {
    const db = await getDB();
    return db.get("recipes", id);
  },
  async putRecipe(recipe: Recipe) {
    const db = await getDB();
    await db.put("recipes", recipe);
  },
  async deleteRecipe(id: string) {
    const db = await getDB();
    await db.delete("recipes", id);
  },

  // --- Backup & Restore ---
  async exportFullBackup(): Promise<string> {
    const db = await getDB();
    const [foods, entries, workouts, savedMeals, weightEntries, waterEntries, recipes, settings] =
      await Promise.all([
        db.getAll("foods"),
        db.getAll("entries"),
        db.getAll("workouts"),
        db.getAll("savedMeals"),
        db.getAll("weightEntries"),
        db.getAll("waterEntries"),
        db.getAll("recipes"),
        db.get("settings", "app"),
      ]);

    const backup = {
      schemaVersion: DB_VERSION,
      appName: "fitness-app",
      exportedAt: new Date().toISOString(),
      timestamp: Date.now(),
      data: {
        foods,
        entries,
        workouts,
        savedMeals,
        weightEntries,
        waterEntries,
        recipes,
        settings,
      },
    };
    return JSON.stringify(backup, null, 2);
  },

  async importFullBackup(jsonStr: string): Promise<{
    success: boolean;
    counts: Record<string, number>;
  }> {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error("Invalid backup file: Not valid JSON or file was corrupted/truncated.");
    }

    if (!parsed || typeof parsed !== "object" || !parsed.data) {
      throw new Error("Invalid backup file: Missing root data object.");
    }
    if (parsed.appName && parsed.appName !== "fitness-app") {
      throw new Error(`Incompatible backup source: App name "${parsed.appName}" does not match "fitness-app".`);
    }
    const data = parsed.data;
    const db = await getDB();

    const counts: Record<string, number> = {
      foods: 0,
      entries: 0,
      workouts: 0,
      savedMeals: 0,
      weightEntries: 0,
      waterEntries: 0,
      recipes: 0,
    };

    if (Array.isArray(data.foods) && data.foods.length > 0) {
      const tx = db.transaction("foods", "readwrite");
      for (const item of data.foods) {
        if (item && item.id && typeof item.name === "string" && typeof item.calories === "number") {
          const existing = await tx.store.get(item.id);
          if (existing && existing.name.toLowerCase() !== item.name.toLowerCase()) {
            item.id = `food-imported-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          }
          await tx.store.put(item);
          counts.foods++;
        }
      }
      await tx.done;
    }

    if (Array.isArray(data.entries) && data.entries.length > 0) {
      const tx = db.transaction("entries", "readwrite");
      for (const item of data.entries) {
        if (item && item.id && item.date && item.meal) {
          await tx.store.put(item);
          counts.entries++;
        }
      }
      await tx.done;
    }

    if (Array.isArray(data.workouts) && data.workouts.length > 0) {
      const tx = db.transaction("workouts", "readwrite");
      for (const item of data.workouts) {
        if (item && item.id && item.date && item.type) {
          await tx.store.put(item);
          counts.workouts++;
        }
      }
      await tx.done;
    }

    if (Array.isArray(data.savedMeals) && data.savedMeals.length > 0) {
      const tx = db.transaction("savedMeals", "readwrite");
      for (const item of data.savedMeals) {
        if (item && item.id && item.name && Array.isArray(item.items)) {
          await tx.store.put(item);
          counts.savedMeals++;
        }
      }
      await tx.done;
    }

    if (Array.isArray(data.weightEntries) && data.weightEntries.length > 0) {
      const tx = db.transaction("weightEntries", "readwrite");
      for (const item of data.weightEntries) {
        if (item && item.id && item.date && typeof item.weightKg === "number") {
          await tx.store.put(item);
          counts.weightEntries++;
        }
      }
      await tx.done;
    }

    if (Array.isArray(data.waterEntries) && data.waterEntries.length > 0) {
      const tx = db.transaction("waterEntries", "readwrite");
      for (const item of data.waterEntries) {
        if (item && item.id && item.date && typeof item.amountMl === "number") {
          await tx.store.put(item);
          counts.waterEntries++;
        }
      }
      await tx.done;
    }

    if (Array.isArray(data.recipes) && data.recipes.length > 0) {
      const tx = db.transaction("recipes", "readwrite");
      for (const item of data.recipes) {
        if (item && item.id && typeof item.name === "string" && Array.isArray(item.ingredients)) {
          const existing = await tx.store.get(item.id);
          if (existing && existing.name.toLowerCase() !== item.name.toLowerCase()) {
            item.id = `recipe-imported-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          }
          await tx.store.put(item);
          counts.recipes++;
        }
      }
      await tx.done;
    }

    if (data.settings && typeof data.settings === "object") {
      const current = (await db.get("settings", "app")) || DEFAULT_SETTINGS;
      await db.put("settings", { ...current, ...data.settings }, "app");
    }

    return { success: true, counts };
  },

  async exportToCSV(type: "entries" | "workouts" | "weights"): Promise<string> {
    const db = await getDB();
    if (type === "entries") {
      const entries = await db.getAll("entries");
      const headers = ["ID", "Date", "Meal", "FoodName", "Quantity", "Unit", "Grams", "Calories", "Protein_g", "Carbs_g", "Fat_g", "Fiber_g", "Notes"];
      const rows = entries.map((e) => [
        `"${e.id}"`,
        `"${e.date}"`,
        `"${e.meal}"`,
        `"${(e.foodName || "").replace(/"/g, '""')}"`,
        e.quantity,
        `"${e.unit}"`,
        e.grams ?? "",
        e.calories.toFixed(1),
        e.protein.toFixed(1),
        e.carbs.toFixed(1),
        e.fat.toFixed(1),
        e.fiber !== undefined ? e.fiber.toFixed(1) : "",
        `"${(e.notes || "").replace(/"/g, '""')}"`,
      ]);
      return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    } else if (type === "workouts") {
      const workouts = await db.getAll("workouts");
      const headers = ["ID", "Date", "Title", "Type", "DurationMin", "CaloriesBurned", "DistanceKm", "AvgHeartRate", "Source", "Notes"];
      const rows = workouts.map((w) => [
        `"${w.id}"`,
        `"${w.date}"`,
        `"${(w.title || "").replace(/"/g, '""')}"`,
        `"${w.type}"`,
        w.durationMinutes,
        w.caloriesBurned,
        w.distanceKm ?? "",
        w.avgHeartRate ?? "",
        `"${w.source}"`,
        `"${(w.notes || "").replace(/"/g, '""')}"`,
      ]);
      return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    } else {
      const weights = await db.getAll("weightEntries");
      const headers = ["ID", "Date", "WeightKg", "WaistCm", "BodyFatPct", "Notes"];
      const rows = weights.map((w) => [
        `"${w.id}"`,
        `"${w.date}"`,
        w.weightKg,
        w.waistCm ?? "",
        w.bodyFatPct ?? "",
        `"${(w.notes || "").replace(/"/g, '""')}"`,
      ]);
      return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    }
  },

  async getStorageStats(): Promise<{
    recordCounts: Record<string, number>;
    usageBytes?: number;
    quotaBytes?: number;
  }> {
    const db = await getDB();
    const [foods, entries, workouts, savedMeals, weightEntries, waterEntries, recipes] =
      await Promise.all([
        db.count("foods"),
        db.count("entries"),
        db.count("workouts"),
        db.count("savedMeals"),
        db.count("weightEntries"),
        db.count("waterEntries"),
        db.count("recipes"),
      ]);

    let usageBytes: number | undefined;
    let quotaBytes: number | undefined;
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        usageBytes = est.usage;
        quotaBytes = est.quota;
      } catch {
        // ignore
      }
    }

    return {
      recordCounts: {
        foods,
        entries,
        workouts,
        savedMeals,
        weightEntries,
        waterEntries,
        recipes,
      },
      usageBytes,
      quotaBytes,
    };
  },
};

export const DEFAULT_PROFILE: UserProfile = {
  name: "Karthik",
  age: 15,
  gender: "male",
  heightCm: 168,
  weightKg: 58,
  activityLevel: "moderate",
  goalType: "nourish",
  deficitTargetKcal: 0,
};

export const DEFAULT_SETTINGS: AppSettings = {
  calorieGoal: 2200,
  proteinGoal: 120,
  carbsGoal: 280,
  fatGoal: 65,
  fiberGoal: 32,
  waterGoalMl: 2500,
  theme: "system",
  hideExerciseCalories: false,
  enableWeightTracking: true,
  geminiApiKey: "",
  geminiModel: "gemini-2.0-flash",
  userProfile: DEFAULT_PROFILE,
  stravaClientId: "287967",
  stravaClientSecret: "4e5277e47eadf563ba357e841f19c0b6894d45a6",
  stravaAccessToken: "c64eb5e4e0c6d7e41afaacf4d83511c5a8947a09",
  stravaRefreshToken: "a0f7ea4d083d4a7b285377706b199f58f55a7907",
  stravaTokenExpiresAt: 1792336897,
  stravaAutoSyncEnabled: true,
};
