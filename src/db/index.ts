import { openDB, type DBSchema } from "idb";
import type { Food, FoodEntry, AppSettings } from "../types";

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
}

const DB_NAME = "fitness-app-db";
const DB_VERSION = 1;

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
    },
  });
}

export const dbOps = {
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
        (f.localName && f.localName.toLowerCase().includes(q))
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
  async getSettings(): Promise<AppSettings | undefined> {
    const db = await getDB();
    return db.get("settings", "app");
  },
  async putSettings(settings: AppSettings) {
    const db = await getDB();
    await db.put("settings", settings, "app");
  },
};

export const DEFAULT_SETTINGS: AppSettings = {
  calorieGoal: 2000,
  proteinGoal: 120,
  carbsGoal: 250,
  fatGoal: 65,
  geminiApiKey: "",
  geminiModel: "gemini-2.0-flash",
};
