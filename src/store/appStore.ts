import { create } from "zustand";
import { dbOps, DEFAULT_SETTINGS } from "../db/index.ts";
import { SEED_FOODS } from "../data/seedFoods.ts";
import type {
  Food,
  FoodEntry,
  AppSettings,
  FoodCategory,
  WorkoutEntry,
  SavedMeal,
  WeightEntry,
  WaterEntry,
  MealType,
} from "../types.ts";
import { parseQuickLogText, toSingular, type ParsedQuickLogItem } from "../utils/quickLogParser.ts";
import { computeEntry } from "../utils/nutrition.ts";
import {
  syncStravaActivities,
  exchangeStravaToken,
  type StravaSyncResult,
} from "../utils/strava.ts";

function todayStr(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

let inFlightStravaSync: Promise<StravaSyncResult> | null = null;

export const DEFAULT_SAVED_MEALS: SavedMeal[] = [
  {
    id: "combo-telugu-thali",
    name: "Telugu Vegetarian Thali",
    description: "Steamed rice, palakura spinach dal, sambar, fresh curd & pure cow ghee",
    defaultMeal: "lunch",
    createdAt: 1700000000000,
    items: [
      { foodId: "seed_cooked_white_rice", foodName: "Cooked white rice", quantity: 1.5, unit: "cup" },
      { foodId: "seed_palakura_pappu_spinach_dal", foodName: "Palakura pappu (Spinach dal)", quantity: 1, unit: "katori" },
      { foodId: "seed_sambar", foodName: "Sambar", quantity: 1, unit: "ladle" },
      { foodId: "seed_curd_plain_dahi_perugu", foodName: "Curd plain (Dahi/Perugu)", quantity: 1, unit: "katori" },
      { foodId: "seed_ghee_clarified_butter", foodName: "Ghee (Clarified butter)", quantity: 1, unit: "tsp" },
    ],
  },
  {
    id: "combo-south-indian-breakfast",
    name: "South Indian Breakfast Plate",
    description: "Steamed soft idlis, crunchy medu vada, piping sambar & fresh coconut chutney",
    defaultMeal: "breakfast",
    createdAt: 1700000000000,
    items: [
      { foodId: "seed_idli_steamed_rice_cake", foodName: "Idli (Steamed rice cake)", quantity: 3, unit: "piece" },
      { foodId: "seed_medu_vada_garelu", foodName: "Medu vada (Garelu)", quantity: 1, unit: "piece" },
      { foodId: "seed_sambar", foodName: "Sambar", quantity: 1, unit: "ladle" },
      { foodId: "seed_coconut_chutney_kobbari_pacchi", foodName: "Coconut chutney (Kobbari pacchadi)", quantity: 2, unit: "tbsp" },
    ],
  },
  {
    id: "combo-pre-workout-fuel",
    name: "Teen Active Fuel (Pre-Workout)",
    description: "Natural high-energy boost: Banana, whole milk glass & raw almonds",
    defaultMeal: "snack",
    createdAt: 1700000000000,
    items: [
      { foodId: "seed_banana_fresh_kela", foodName: "Banana fresh (Kela)", quantity: 1, unit: "piece" },
      { foodId: "seed_cow_milk_whole", foodName: "Cow milk whole", quantity: 1, unit: "glass" },
      { foodId: "seed_almonds", foodName: "Almonds", quantity: 8, unit: "piece" },
    ],
  },
];

interface AppState {
  foods: Food[];
  entries: FoodEntry[];
  workouts: WorkoutEntry[];
  waterEntries: WaterEntry[];
  savedMeals: SavedMeal[];
  weightEntries: WeightEntry[];
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
  searchFoods: (
    q: string,
    options?: { category?: FoodCategory | "all"; vegOnly?: boolean }
  ) => Food[];

  // Workouts & Strava
  addWorkout: (w: WorkoutEntry) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  syncStravaWorkouts: () => Promise<StravaSyncResult>;

  // Water Tracker
  addWater: (amountMl: number, date?: string) => Promise<void>;
  setWater: (amountMl: number, date?: string) => Promise<void>;

  // Saved Meals / Combo Plates
  saveMeal: (meal: SavedMeal) => Promise<void>;
  deleteSavedMeal: (id: string) => Promise<void>;
  logSavedMeal: (savedMealId: string, mealType?: MealType, date?: string) => Promise<void>;

  // Weight & Body Measurement
  addWeightEntry: (w: WeightEntry) => Promise<void>;
  deleteWeightEntry: (id: string) => Promise<void>;

  // Non-AI QoL Features
  getFrequentFoods: (meal?: MealType) => Food[];
  quickLogText: (text: string, meal: MealType) => Promise<ParsedQuickLogItem[]>;
}

export const useAppStore = create<AppState>((set, get) => ({
  foods: [],
  entries: [],
  workouts: [],
  waterEntries: [],
  savedMeals: [],
  weightEntries: [],
  settings: DEFAULT_SETTINGS,
  selectedDate: todayStr(),
  hydrated: false,

  hydrate: async () => {
    let foods = await dbOps.getAllFoods();
    const SEED_VERSION = "2026-10-16-v4";
    const currentVersion = localStorage.getItem("fitness-seed-version");

    if (foods.length === 0) {
      await dbOps.putFoods(SEED_FOODS);
      foods = [...SEED_FOODS];
      localStorage.setItem("fitness-seed-version", SEED_VERSION);
    } else if (currentVersion !== SEED_VERSION) {
      // Preserve custom / AI foods, replace seed items with verified nutrition data
      const customFoods = foods.filter((f) => f.source !== "seed");
      const oldSeedFoods = foods.filter((f) => f.source === "seed");
      for (const old of oldSeedFoods) {
        await dbOps.deleteFood(old.id);
      }
      const combined = [...SEED_FOODS, ...customFoods];
      await dbOps.putFoods(combined);
      foods = combined;
      localStorage.setItem("fitness-seed-version", SEED_VERSION);
    }

    const loadedSettings = await dbOps.getSettings();
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...(loadedSettings || {}),
      userProfile: {
        ...DEFAULT_SETTINGS.userProfile!,
        ...(loadedSettings?.userProfile || {}),
      },
    };

    // Check for Strava OAuth redirect callback (?code=... or ?error=...)
    if (typeof window !== "undefined" && window.location?.search) {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const oauthError = urlParams.get("error");

      if (code) {
        try {
          const clientId =
            settings.stravaClientId || localStorage.getItem("fitness-strava-client-id");
          const clientSecret =
            settings.stravaClientSecret || localStorage.getItem("fitness-strava-client-secret");
          if (clientId && clientSecret) {
            const tokenResp = await exchangeStravaToken(clientId, clientSecret, code);
            settings.stravaClientId = clientId;
            settings.stravaClientSecret = clientSecret;
            settings.stravaAccessToken = tokenResp.access_token;
            settings.stravaRefreshToken = tokenResp.refresh_token;
            settings.stravaTokenExpiresAt = tokenResp.expires_at;
            settings.stravaAutoSyncEnabled = true;

            localStorage.removeItem("fitness-strava-client-id");
            localStorage.removeItem("fitness-strava-client-secret");
          }
        } catch (err) {
          console.error("Failed to exchange Strava OAuth authorization code:", err);
        } finally {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("code");
          cleanUrl.searchParams.delete("scope");
          cleanUrl.searchParams.delete("state");
          cleanUrl.searchParams.delete("error");
          window.history.replaceState(
            {},
            document.title,
            cleanUrl.pathname + cleanUrl.search + cleanUrl.hash
          );
        }
      } else if (oauthError) {
        console.warn("Strava OAuth authorization was rejected or returned an error:", oauthError);
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("error");
        cleanUrl.searchParams.delete("state");
        window.history.replaceState(
          {},
          document.title,
          cleanUrl.pathname + cleanUrl.search + cleanUrl.hash
        );
      }
    }

    if (
      !settings.stravaClientId ||
      settings.stravaClientId !== "287967" ||
      settings.stravaRefreshToken !== "a0f7ea4d083d4a7b285377706b199f58f55a7907"
    ) {
      settings.stravaClientId = "287967";
      settings.stravaClientSecret = "4e5277e47eadf563ba357e841f19c0b6894d45a6";
      settings.stravaRefreshToken = "a0f7ea4d083d4a7b285377706b199f58f55a7907";
      settings.stravaAccessToken = "c64eb5e4e0c6d7e41afaacf4d83511c5a8947a09";
      settings.stravaTokenExpiresAt = 1792336897;
      settings.stravaAutoSyncEnabled = true;
    }

    await dbOps.putSettings(settings);

    const today = todayStr();
    const entries = await dbOps.getEntriesByDate(today);
    const workouts = await dbOps.getWorkoutsByDate(today);
    const waterEntries = await dbOps.getWaterByDate(today);

    let savedMeals = await dbOps.getAllSavedMeals();
    if (savedMeals.length === 0) {
      for (const sm of DEFAULT_SAVED_MEALS) {
        await dbOps.putSavedMeal(sm);
      }
      savedMeals = [...DEFAULT_SAVED_MEALS];
    }

    const weightEntries = await dbOps.getAllWeightEntries();

    // sync localStorage gemini key to settings.geminiApiKey for UI
    const lsKey = localStorage.getItem("fitness-gemini-key");
    const lsModel = localStorage.getItem("fitness-gemini-model");
    if (lsKey !== null) settings.geminiApiKey = lsKey;
    if (lsModel) settings.geminiModel = lsModel;

    set({
      foods,
      settings,
      entries,
      workouts,
      waterEntries,
      savedMeals,
      weightEntries,
      selectedDate: today,
      hydrated: true,
    });

    // Background auto-sync if auto-sync is enabled and credentials exist
    if (
      settings.stravaAutoSyncEnabled &&
      (settings.stravaRefreshToken || settings.stravaAccessToken)
    ) {
      setTimeout(() => {
        get().syncStravaWorkouts().catch((err) => {
          console.warn("Strava auto-sync during hydrate failed:", err);
        });
      }, 0);
    }
  },

  setDate: async (d: string) => {
    const entries = await dbOps.getEntriesByDate(d);
    const workouts = await dbOps.getWorkoutsByDate(d);
    const waterEntries = await dbOps.getWaterByDate(d);
    set({ selectedDate: d, entries, workouts, waterEntries });
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
    const current = get().settings;
    const next: AppSettings = {
      ...current,
      ...patch,
      userProfile: patch.userProfile
        ? { ...(current.userProfile || DEFAULT_SETTINGS.userProfile!), ...patch.userProfile }
        : current.userProfile,
    };
    await dbOps.putSettings(next);
    if (patch.geminiApiKey !== undefined)
      localStorage.setItem("fitness-gemini-key", patch.geminiApiKey);
    if (patch.geminiModel !== undefined)
      localStorage.setItem("fitness-gemini-model", patch.geminiModel);
    set({ settings: next });
  },

  addWorkout: async (w: WorkoutEntry) => {
    await dbOps.putWorkout(w);
    const { selectedDate } = get();
    if (w.date === selectedDate) {
      set((s) => ({ workouts: [...s.workouts, w] }));
    }
  },

  deleteWorkout: async (id: string) => {
    await dbOps.deleteWorkout(id);
    set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) }));
  },

  syncStravaWorkouts: async (): Promise<StravaSyncResult> => {
    if (inFlightStravaSync) {
      return inFlightStravaSync;
    }

    inFlightStravaSync = (async () => {
      try {
        const state = get();
        const settings = state.settings;
        const userWeightKg = settings.userProfile?.weightKg || 58;
        const allExisting = await dbOps.getAllWorkouts();

        const result = await syncStravaActivities({
          clientId: settings.stravaClientId,
          clientSecret: settings.stravaClientSecret,
          accessToken: settings.stravaAccessToken,
          refreshToken: settings.stravaRefreshToken,
          tokenExpiresAt: settings.stravaTokenExpiresAt,
          userWeightKg,
          existingWorkouts: allExisting,
          onTokenRefreshed: async (tokens) => {
            await get().updateSettings({
              stravaAccessToken: tokens.accessToken,
              stravaRefreshToken: tokens.refreshToken,
              stravaTokenExpiresAt: tokens.expiresAt,
            });
          },
        });

        if (result.syncedWorkouts.length > 0) {
          for (const workout of result.syncedWorkouts) {
            await dbOps.putWorkout(workout);
          }
          const currentDate = get().selectedDate;
          const addedForSelectedDate = result.syncedWorkouts.filter(
            (w) => w.date === currentDate
          );
          if (addedForSelectedDate.length > 0) {
            set((s) => {
              const existingIds = new Set(s.workouts.map((w) => w.id));
              const uniqueNew = addedForSelectedDate.filter((w) => !existingIds.has(w.id));
              return { workouts: [...s.workouts, ...uniqueNew] };
            });
          }
        }

        await get().updateSettings({
          stravaLastSyncTime: Date.now(),
        });

        return result;
      } finally {
        inFlightStravaSync = null;
      }
    })();

    return inFlightStravaSync;
  },

  setWater: async (amountMl: number, targetDate?: string) => {
    const date = targetDate || get().selectedDate;
    const existing = await dbOps.getWaterByDate(date);
    if (existing.length > 0) {
      const updated: WaterEntry = { ...existing[0], amountMl: Math.max(0, amountMl) };
      await dbOps.putWaterEntry(updated);
      if (date === get().selectedDate) set({ waterEntries: [updated] });
    } else {
      const newEntry: WaterEntry = {
        id: `water-${Date.now()}`,
        date,
        amountMl: Math.max(0, amountMl),
        createdAt: Date.now(),
      };
      await dbOps.putWaterEntry(newEntry);
      if (date === get().selectedDate) set({ waterEntries: [newEntry] });
    }
  },

  addWater: async (amountMl: number, targetDate?: string) => {
    const date = targetDate || get().selectedDate;
    const existing = await dbOps.getWaterByDate(date);
    const currentAmount = existing.length > 0 ? existing[0].amountMl : 0;
    const newAmount = Math.max(0, currentAmount + amountMl);

    if (existing.length > 0) {
      const updated: WaterEntry = { ...existing[0], amountMl: newAmount };
      await dbOps.putWaterEntry(updated);
      if (date === get().selectedDate) set({ waterEntries: [updated] });
    } else {
      const newEntry: WaterEntry = {
        id: `water-${Date.now()}`,
        date,
        amountMl: newAmount,
        createdAt: Date.now(),
      };
      await dbOps.putWaterEntry(newEntry);
      if (date === get().selectedDate) set({ waterEntries: [newEntry] });
    }
  },

  saveMeal: async (meal: SavedMeal) => {
    await dbOps.putSavedMeal(meal);
    set((s) => {
      const idx = s.savedMeals.findIndex((m) => m.id === meal.id);
      if (idx >= 0) {
        const copy = [...s.savedMeals];
        copy[idx] = meal;
        return { savedMeals: copy };
      }
      return { savedMeals: [...s.savedMeals, meal] };
    });
  },

  deleteSavedMeal: async (id: string) => {
    await dbOps.deleteSavedMeal(id);
    set((s) => ({ savedMeals: s.savedMeals.filter((m) => m.id !== id) }));
  },

  logSavedMeal: async (savedMealId: string, mealType?: MealType, date?: string) => {
    const { savedMeals, foods, selectedDate, addEntry } = get();
    const meal = savedMeals.find((m) => m.id === savedMealId);
    if (!meal) return;

    const targetDate = date || selectedDate;
    const targetMeal = mealType || meal.defaultMeal;

    for (const item of meal.items) {
      const food = foods.find((f) => f.id === item.foodId);
      if (!food) continue;
      const comp = computeEntry(food, item.quantity, item.unit);
      const entry: FoodEntry = {
        id: `e-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        foodId: food.id,
        foodName: food.name,
        quantity: item.quantity,
        unit: item.unit,
        calories: comp.calories,
        protein: comp.protein,
        carbs: comp.carbs,
        fat: comp.fat,
        fiber: comp.fiber,
        micronutrients: comp.micronutrients,
        grams: comp.grams,
        date: targetDate,
        meal: targetMeal,
        createdAt: Date.now(),
      };
      await addEntry(entry);
    }
  },

  addWeightEntry: async (w: WeightEntry) => {
    const existing = get().weightEntries.find((x) => x.id === w.id || x.date === w.date);
    const entryToSave: WeightEntry = existing ? { ...w, id: existing.id } : w;
    await dbOps.putWeightEntry(entryToSave);
    set((s) => {
      const existingIdx = s.weightEntries.findIndex(
        (x) => x.id === entryToSave.id || x.date === entryToSave.date
      );
      if (existingIdx >= 0) {
        const copy = [...s.weightEntries];
        copy[existingIdx] = entryToSave;
        return { weightEntries: copy };
      }
      return { weightEntries: [...s.weightEntries, entryToSave] };
    });
  },

  deleteWeightEntry: async (id: string) => {
    await dbOps.deleteWeightEntry(id);
    set((s) => ({ weightEntries: s.weightEntries.filter((w) => w.id !== id) }));
  },

  getFrequentFoods: (meal?: MealType): Food[] => {
    const { entries, foods } = get();
    const filteredEntries = meal ? entries.filter((e) => e.meal === meal) : entries;
    const countMap = new Map<string, number>();

    for (const e of filteredEntries) {
      countMap.set(e.foodId, (countMap.get(e.foodId) || 0) + 1);
    }

    const sortedFoodIds = [...countMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    const result: Food[] = [];
    for (const id of sortedFoodIds) {
      const f = foods.find((food) => food.id === id);
      if (f) result.push(f);
      if (result.length >= 6) break;
    }

    // If no recent history for this meal, supply top staples from database
    if (result.length === 0) {
      const defaults = meal === "breakfast"
        ? ["seed_idli_steamed_rice_cake", "seed_dosa_plain", "seed_upma_rava_upma", "seed_sambar"]
        : meal === "lunch" || meal === "dinner"
        ? ["seed_cooked_white_rice", "seed_sambar", "seed_curd_plain_dahi_perugu", "seed_palakura_pappu_spinach_dal"]
        : ["seed_banana_fresh_kela", "seed_roasted_chana_putnala_pappu", "seed_cow_milk_whole"];

      for (const id of defaults) {
        const f = foods.find((food) => food.id === id);
        if (f) result.push(f);
      }
    }

    return result;
  },

  quickLogText: async (text: string, meal: MealType): Promise<ParsedQuickLogItem[]> => {
    const { searchFoods, addEntry, selectedDate } = get();
    const parsed = parseQuickLogText(text, (q) => searchFoods(q, { vegOnly: false }));

    for (const item of parsed) {
      if (item.matchedFood) {
        const entry: FoodEntry = {
          id: `quick-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          foodId: item.matchedFood.id,
          foodName: item.matchedFood.name,
          quantity: item.quantity,
          unit: item.unit,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiber: item.fiber,
          grams: item.grams,
          date: selectedDate,
          meal,
          createdAt: Date.now(),
        };
        await addEntry(entry);
      }
    }

    return parsed;
  },

  searchFoods: (
    q: string,
    options?: { category?: FoodCategory | "all"; vegOnly?: boolean }
  ) => {
    const { foods } = get();
    let candidates = foods || [];
    if (options?.category && options.category !== "all") {
      candidates = candidates.filter((f) => f.category === options.category);
    }
    if (options?.vegOnly) {
      candidates = candidates.filter((f) => f.dietaryPreference !== "non_veg");
    }

    const query = q.toLowerCase().trim();
    if (!query) return candidates.slice(0, 50);

    const querySingular = toSingular(query);
    const queryTokens = query.split(/\s+/).filter(Boolean);
    const singularTokens = queryTokens.map(toSingular);

    const scored = candidates
      .map((f) => {
        const name = f.name.toLowerCase();
        const local = f.localName?.toLowerCase() || "";
        const brand = f.brand?.toLowerCase() || "";
        const aliases = (f.aliases || []).map((a) => a.toLowerCase());

        const nameWords = name.split(/[\s(),/]+/).filter(Boolean);
        const aliasWords = aliases.flatMap((a) => a.split(/[\s(),/]+/).filter(Boolean));
        const brandWords = brand.split(/[\s(),/]+/).filter(Boolean);

        let score = 999;
        // Exact full matches (including singular form e.g. "idlis" matches "idli")
        if (name === query || name === querySingular) {
          score = 0;
        } else if (brand === query || brand === querySingular) {
          score = 0.1;
        } else if (
          name.startsWith(query + " ") ||
          name.startsWith(query + " (") ||
          name.startsWith(query + ",") ||
          name.startsWith(query + "-") ||
          name.startsWith(querySingular + " ") ||
          name.startsWith(querySingular + " (") ||
          name.startsWith(querySingular + ",") ||
          name.startsWith(querySingular + "-")
        ) {
          score = 0.2;
        } else if (
          nameWords.includes(query) ||
          nameWords.some((w) => toSingular(w) === querySingular)
        ) {
          score = 0.3;
        } else if (
          aliases.includes(query) ||
          aliases.some((a) => toSingular(a) === querySingular)
        ) {
          score = 0.35;
        } else if (
          queryTokens.length > 1 &&
          queryTokens.every((t, i) =>
            nameWords.includes(t) ||
            nameWords.some(
              (w) =>
                toSingular(w) === singularTokens[i] ||
                w.startsWith(t) ||
                w.startsWith(singularTokens[i])
            )
          )
        ) {
          score = 0.4;
        } else if (name.includes(query) || name.includes(querySingular)) {
          score = 0.5;
        } else if (
          nameWords.some((w) => w.startsWith(query) || w.startsWith(querySingular))
        ) {
          score = 0.6;
        } else if (
          brand &&
          (brand.startsWith(query + " ") ||
            brand === query ||
            brand.startsWith(querySingular + " ") ||
            brand === querySingular)
        ) {
          score = 0.7;
        } else if (
          aliases.some(
            (a) =>
              a.startsWith(query + " ") ||
              a === query ||
              a.startsWith(querySingular + " ") ||
              a === querySingular
          )
        ) {
          score = 0.8;
        } else if (
          queryTokens.length > 1 &&
          queryTokens.every((t, i) =>
            nameWords.some(
              (w) =>
                w === t ||
                toSingular(w) === singularTokens[i] ||
                w.startsWith(t) ||
                w.startsWith(singularTokens[i])
            ) ||
            brandWords.some(
              (w) =>
                w === t ||
                toSingular(w) === singularTokens[i] ||
                w.startsWith(t) ||
                w.startsWith(singularTokens[i])
            ) ||
            aliasWords.some(
              (w) =>
                w === t ||
                toSingular(w) === singularTokens[i] ||
                w.startsWith(t) ||
                w.startsWith(singularTokens[i])
            )
          )
        ) {
          score = 0.9;
        } else if (brand && (brand.includes(query) || brand.includes(querySingular))) {
          score = 1.2;
        } else if (
          aliases.some((a) => a.includes(query) || a.includes(querySingular))
        ) {
          score = 1.4;
        } else if (local.includes(query) || local.includes(querySingular)) {
          score = 2.0;
        } else {
          const allTokensMatchPrefix = queryTokens.every((t, i) =>
            nameWords.some(
              (w) => w.startsWith(t) || w.startsWith(singularTokens[i])
            ) ||
            brandWords.some(
              (w) => w.startsWith(t) || w.startsWith(singularTokens[i])
            ) ||
            aliasWords.some(
              (w) => w.startsWith(t) || w.startsWith(singularTokens[i])
            ) ||
            local.includes(t) ||
            local.includes(singularTokens[i])
          );
          if (allTokensMatchPrefix) {
            score = 2.2;
          } else {
            const allMatchLoose = queryTokens.every((t, i) =>
              name.includes(t) ||
              name.includes(singularTokens[i]) ||
              local.includes(t) ||
              local.includes(singularTokens[i]) ||
              brand.includes(t) ||
              brand.includes(singularTokens[i]) ||
              aliases.some(
                (a) => a.includes(t) || a.includes(singularTokens[i])
              )
            );
            if (allMatchLoose) score = 2.8;
          }
        }

        if (f.category === "staple" && score < 999) score -= 0.05;
        if (f.isCustom && score < 999) score -= 0.15;
        return { f, score };
      })
      .filter((x) => x.score < 999)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.f);

    return scored.slice(0, 50);
  },
}));
