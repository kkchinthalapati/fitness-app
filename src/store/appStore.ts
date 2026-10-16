import { create } from "zustand";
import { dbOps, DEFAULT_SETTINGS } from "../db";
import { SEED_FOODS } from "../data/seedFoods";
import type { Food, FoodEntry, AppSettings } from "../types";

function todayStr(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

interface AppState {
  foods: Food[];
  entries: FoodEntry[];
  settings: AppSettings;
  selectedDate: string;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setDate: (d: string) => Promise<void>;
  addEntry: (e: FoodEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  upsertFood: (f: Food) => Promise<void>;
  deleteFood: (id: string) => Promise<void>;
  updateSettings: (s: Partial<AppSettings>) => Promise<void>;
  searchFoods: (q: string) => Food[];
}

export const useAppStore = create<AppState>((set, get) => ({
  foods: [],
  entries: [],
  settings: DEFAULT_SETTINGS,
  selectedDate: todayStr(),
  hydrated: false,

  hydrate: async () => {
    let foods = await dbOps.getAllFoods();
    const SEED_VERSION = "2026-10-16-v2";
    const currentVersion = localStorage.getItem("fitness-seed-version");

    if (foods.length === 0) {
      await dbOps.putFoods(SEED_FOODS);
      foods = [...SEED_FOODS];
      localStorage.setItem("fitness-seed-version", SEED_VERSION);
    } else if (currentVersion !== SEED_VERSION) {
      // Preserve custom / AI foods, replace seed items with verified nutrition data
      const customFoods = foods.filter((f) => f.source !== "seed");
      const combined = [...SEED_FOODS, ...customFoods];
      await dbOps.putFoods(combined);
      foods = combined;
      localStorage.setItem("fitness-seed-version", SEED_VERSION);
    }
    const settings = (await dbOps.getSettings()) || DEFAULT_SETTINGS;
    // persist defaults if missing
    if (!(await dbOps.getSettings())) await dbOps.putSettings(settings);
    const entries = await dbOps.getEntriesByDate(todayStr());
    // sync localStorage gemini key to settings.geminiApiKey for UI
    const lsKey = localStorage.getItem("fitness-gemini-key");
    const lsModel = localStorage.getItem("fitness-gemini-model");
    if (lsKey !== null) settings.geminiApiKey = lsKey;
    if (lsModel) settings.geminiModel = lsModel;
    set({ foods, settings, entries, selectedDate: todayStr(), hydrated: true });
  },

  setDate: async (d: string) => {
    const entries = await dbOps.getEntriesByDate(d);
    set({ selectedDate: d, entries });
  },

  addEntry: async (e: FoodEntry) => {
    await dbOps.putEntry(e);
    const { selectedDate } = get();
    if (e.date === selectedDate) set((s) => ({ entries: [...s.entries, e] }));
  },

  deleteEntry: async (id: string) => {
    await dbOps.deleteEntry(id);
    set((s) => ({ entries: s.entries.filter((x) => x.id !== id) }));
  },

  upsertFood: async (f: Food) => {
    await dbOps.putFood(f);
    set((s) => {
      const idx = s.foods.findIndex((x) => x.id === f.id);
      if (idx >= 0) {
        const copy = [...s.foods];
        copy[idx] = f;
        return { foods: copy };
      }
      return { foods: [...s.foods, f] };
    });
  },

  deleteFood: async (id: string) => {
    await dbOps.deleteFood(id);
    set((s) => ({ foods: s.foods.filter((f) => f.id !== id) }));
  },

  updateSettings: async (patch: Partial<AppSettings>) => {
    const next = { ...get().settings, ...patch };
    await dbOps.putSettings(next);
    if (patch.geminiApiKey !== undefined) localStorage.setItem("fitness-gemini-key", patch.geminiApiKey);
    if (patch.geminiModel !== undefined) localStorage.setItem("fitness-gemini-model", patch.geminiModel);
    set({ settings: next });
  },

  searchFoods: (q: string) => {
    const { foods } = get();
    const query = q.toLowerCase().trim();
    if (!query) return foods.slice(0, 50);
    const scored = foods
      .map((f) => {
        const name = f.name.toLowerCase();
        let score = 999;
        if (name === query) score = 0;
        else if (name.startsWith(query)) score = 1;
        else if (name.includes(query)) score = 2;
        else if (f.localName?.toLowerCase().includes(query)) score = 3;
        // custom foods rank slightly higher for same match
        if (f.isCustom && score < 999) score -= 0.5;
        return { f, score };
      })
      .filter((x) => x.score < 999)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.f);
    return scored.slice(0, 50);
  },
}));
