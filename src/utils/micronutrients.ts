import type { Food, FoodEntry, Micronutrients } from "../types.ts";
import { computeEntry } from "./nutrition.ts";

export interface NutrientRDA {
  name: string;
  unit: string;
  rda: number;
  upperLimit?: number;
  isUpperLimitOnly?: boolean;
  category: "mineral" | "vitamin" | "macro";
  description: string;
}

/**
 * ICMR-NIN 2020 Recommended Dietary Allowances (RDA) for Indian adolescents (13-17 years old male).
 */
export const ICMR_TEEN_RDA: Record<keyof Micronutrients | "fiber" | "protein", NutrientRDA> = {
  protein: {
    name: "Protein",
    unit: "g",
    rda: 54, // ICMR baseline (fitness goal is higher, e.g. 100-120g)
    category: "macro",
    description: "Tissue repair, muscle development, and teenage growth spurt",
  },
  fiber: {
    name: "Dietary Fiber",
    unit: "g",
    rda: 32,
    category: "macro",
    description: "Gut microbiome, sustained energy, insulin sensitivity",
  },
  calcium_mg: {
    name: "Calcium",
    unit: "mg",
    rda: 1000,
    upperLimit: 2500,
    category: "mineral",
    description: "Peak bone mineral density accumulation during adolescence",
  },
  iron_mg: {
    name: "Iron",
    unit: "mg",
    rda: 16,
    upperLimit: 45,
    category: "mineral",
    description: "Hemoglobin synthesis, oxygen transport, cognitive energy",
  },
  potassium_mg: {
    name: "Potassium",
    unit: "mg",
    rda: 3500,
    category: "mineral",
    description: "Electrolyte balance, muscle contractions, fluid regulation",
  },
  sodium_mg: {
    name: "Sodium",
    unit: "mg",
    rda: 2000, // Safe upper limit
    upperLimit: 2000,
    isUpperLimitOnly: true,
    category: "mineral",
    description: "Safe upper limit for cardiovascular health and hydration balance",
  },
  vitamin_c_mg: {
    name: "Vitamin C",
    unit: "mg",
    rda: 70,
    upperLimit: 1800,
    category: "vitamin",
    description: "Non-heme iron absorption enhancer (critical for vegetarian diets), immunity",
  },
};

export interface NutrientReportItem {
  key: keyof Micronutrients | "fiber" | "protein";
  name: string;
  unit: string;
  current: number;
  target: number;
  percentage: number;
  status: "optimal" | "good" | "low" | "excess";
  topSources: { foodName: string; amount: number; pctOfTotal: number }[];
  description: string;
}

export function computeDailyMicronutrients(
  entries: FoodEntry[],
  foodsMap: Map<string, Food>
): {
  totals: Record<keyof Micronutrients | "fiber" | "protein", number>;
  reports: NutrientReportItem[];
} {
  const totals: Record<keyof Micronutrients | "fiber" | "protein", number> = {
    protein: 0,
    fiber: 0,
    calcium_mg: 0,
    iron_mg: 0,
    potassium_mg: 0,
    sodium_mg: 0,
    vitamin_c_mg: 0,
  };

  const sources: Record<
    keyof Micronutrients | "fiber" | "protein",
    { foodName: string; amount: number }[]
  > = {
    protein: [],
    fiber: [],
    calcium_mg: [],
    iron_mg: [],
    potassium_mg: [],
    sodium_mg: [],
    vitamin_c_mg: [],
  };

  for (const entry of entries) {
    // Protein
    totals.protein += entry.protein || 0;
    if (entry.protein > 0) {
      sources.protein.push({ foodName: entry.foodName, amount: entry.protein });
    }

    // Fiber
    const fib = entry.fiber || 0;
    totals.fiber += fib;
    if (fib > 0) {
      sources.fiber.push({ foodName: entry.foodName, amount: fib });
    }

    // Micronutrients from entry or food
    let micros = entry.micronutrients;
    if (!micros && foodsMap.has(entry.foodId)) {
      const food = foodsMap.get(entry.foodId)!;
      const comp = computeEntry(food, entry.quantity, entry.unit);
      micros = comp.micronutrients;
    }

    if (micros) {
      if (micros.calcium_mg) {
        totals.calcium_mg += micros.calcium_mg;
        sources.calcium_mg.push({ foodName: entry.foodName, amount: micros.calcium_mg });
      }
      if (micros.iron_mg) {
        totals.iron_mg += micros.iron_mg;
        sources.iron_mg.push({ foodName: entry.foodName, amount: micros.iron_mg });
      }
      if (micros.potassium_mg) {
        totals.potassium_mg += micros.potassium_mg;
        sources.potassium_mg.push({ foodName: entry.foodName, amount: micros.potassium_mg });
      }
      if (micros.sodium_mg) {
        totals.sodium_mg += micros.sodium_mg;
        sources.sodium_mg.push({ foodName: entry.foodName, amount: micros.sodium_mg });
      }
      if (micros.vitamin_c_mg) {
        totals.vitamin_c_mg += micros.vitamin_c_mg;
        sources.vitamin_c_mg.push({ foodName: entry.foodName, amount: micros.vitamin_c_mg });
      }
    }
  }

  // Generate structured report
  const keys: (keyof Micronutrients | "fiber" | "protein")[] = [
    "protein",
    "fiber",
    "calcium_mg",
    "iron_mg",
    "vitamin_c_mg",
    "potassium_mg",
    "sodium_mg",
  ];

  const reports: NutrientReportItem[] = keys.map((k) => {
    const meta = ICMR_TEEN_RDA[k];
    const current = Math.round(totals[k] * 10) / 10;
    const target = meta.rda;
    const pct = Math.round((current / target) * 100);

    let status: "optimal" | "good" | "low" | "excess" = "good";
    if (meta.isUpperLimitOnly) {
      status = current > target ? "excess" : "optimal";
    } else {
      if (pct >= 90) status = "optimal";
      else if (pct >= 60) status = "good";
      else status = "low";
    }

    // Aggregate amounts by foodName so multiple logs of same food are unified
    const aggregatedMap = new Map<string, number>();
    for (const s of sources[k]) {
      aggregatedMap.set(s.foodName, (aggregatedMap.get(s.foodName) || 0) + s.amount);
    }

    // Sort top 3 food sources
    const foodSources = [...aggregatedMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([foodName, amount]) => ({
        foodName,
        amount: Math.round(amount * 10) / 10,
        pctOfTotal: current > 0 ? Math.round((amount / current) * 100) : 0,
      }));

    return {
      key: k,
      name: meta.name,
      unit: meta.unit,
      current,
      target,
      percentage: pct,
      status,
      topSources: foodSources,
      description: meta.description,
    };
  });

  return { totals, reports };
}
