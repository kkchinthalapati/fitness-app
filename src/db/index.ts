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
}

const DB_NAME = "fitness-app-db";
const DB_VERSION = 2;

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
};

export const DEFAULT_PROFILE: UserProfile = {
  name: "Karthik",
  age: 15,
  gender: "male",
  heightCm: 168,
  weightKg: 58,
  activityLevel: "moderate",
  goalType: "maintain",
  deficitTargetKcal: 300,
};

export const DEFAULT_SETTINGS: AppSettings = {
  calorieGoal: 2200,
  proteinGoal: 120,
  carbsGoal: 280,
  fatGoal: 65,
  fiberGoal: 32,
  waterGoalMl: 2500,
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
