import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ICMR_TEEN_RDA,
  computeDailyMicronutrients,
} from "../src/utils/micronutrients.ts";
import type { Food, FoodEntry } from "../src/types.ts";

describe("Cronometer-Grade Micronutrients & ICMR Teen RDA", () => {
  test("ICMR RDA targets for adolescent boys (13-17 yr)", () => {
    assert.equal(ICMR_TEEN_RDA.calcium_mg.rda, 1000);
    assert.equal(ICMR_TEEN_RDA.iron_mg.rda, 16);
    assert.equal(ICMR_TEEN_RDA.potassium_mg.rda, 3500);
    assert.equal(ICMR_TEEN_RDA.sodium_mg.rda, 2000);
    assert.equal(ICMR_TEEN_RDA.vitamin_c_mg.rda, 70);
    assert.equal(ICMR_TEEN_RDA.fiber.rda, 32);
    assert.equal(ICMR_TEEN_RDA.protein.rda, 54);
  });

  test("Daily micronutrient aggregation and status assessment", () => {
    const mockFood: Food = {
      id: "food_palak_dal",
      name: "Palak Dal",
      category: "south_indian",
      calories: 140,
      protein: 8,
      carbs: 18,
      fat: 3,
      fiber: 5,
      servingDescription: "1 katori (~150g)",
      servingGrams: 150,
      isApproximate: false,
      isCustom: false,
      source: "seed",
      createdAt: 0,
      updatedAt: 0,
      micronutrients: {
        calcium_mg: 120,
        iron_mg: 3.5,
        potassium_mg: 450,
        sodium_mg: 350,
        vitamin_c_mg: 25,
      },
    };

    const foodsMap = new Map<string, Food>([[mockFood.id, mockFood]]);

    const entries: FoodEntry[] = [
      {
        id: "e1",
        foodId: mockFood.id,
        foodName: mockFood.name,
        quantity: 2, // 2 katoris
        unit: "katori",
        calories: 280,
        protein: 16,
        carbs: 36,
        fat: 6,
        fiber: 10,
        micronutrients: {
          calcium_mg: 240,
          iron_mg: 7.0,
          potassium_mg: 900,
          sodium_mg: 700,
          vitamin_c_mg: 50,
        },
        date: "2026-10-16",
        meal: "lunch",
        createdAt: 0,
      },
    ];

    const { totals, reports } = computeDailyMicronutrients(entries, foodsMap);

    assert.equal(totals.protein, 16);
    assert.equal(totals.fiber, 10);
    assert.equal(totals.calcium_mg, 240);
    assert.equal(totals.iron_mg, 7.0);
    assert.equal(totals.vitamin_c_mg, 50);

    // Verify report structure
    const calciumReport = reports.find((r) => r.key === "calcium_mg");
    assert.ok(calciumReport);
    assert.equal(calciumReport!.current, 240);
    assert.equal(calciumReport!.target, 1000);
    assert.equal(calciumReport!.percentage, 24);
    assert.equal(calciumReport!.status, "low"); // < 60%
    assert.equal(calciumReport!.topSources.length, 1);
    assert.equal(calciumReport!.topSources[0].foodName, "Palak Dal");

    const vitCReport = reports.find((r) => r.key === "vitamin_c_mg");
    assert.ok(vitCReport);
    assert.equal(vitCReport!.percentage, Math.round((50 / 70) * 100)); // 71%
    assert.equal(vitCReport!.status, "good");
  });

  test("Multiple logs of same food are grouped and unified in topSources ranking", () => {
    const mockMilk: Food = {
      id: "food_cow_milk",
      name: "Cow Milk",
      category: "beverage",
      calories: 130,
      protein: 6.4,
      carbs: 9.6,
      fat: 7.2,
      servingDescription: "1 glass (200ml)",
      servingGrams: 200,
      isApproximate: false,
      isCustom: false,
      source: "seed",
      createdAt: 0,
      updatedAt: 0,
      micronutrients: { calcium_mg: 240 },
    };

    const foodsMap = new Map<string, Food>([[mockMilk.id, mockMilk]]);

    // User drinks milk in morning (breakfast) and at night (dinner)
    const entries: FoodEntry[] = [
      {
        id: "m1",
        foodId: mockMilk.id,
        foodName: "Cow Milk",
        quantity: 1,
        unit: "glass",
        calories: 130,
        protein: 6.4,
        carbs: 9.6,
        fat: 7.2,
        micronutrients: { calcium_mg: 240 },
        date: "2026-10-16",
        meal: "breakfast",
        createdAt: 0,
      },
      {
        id: "m2",
        foodId: mockMilk.id,
        foodName: "Cow Milk",
        quantity: 1,
        unit: "glass",
        calories: 130,
        protein: 6.4,
        carbs: 9.6,
        fat: 7.2,
        micronutrients: { calcium_mg: 240 },
        date: "2026-10-16",
        meal: "dinner",
        createdAt: 0,
      },
    ];

    const { totals, reports } = computeDailyMicronutrients(entries, foodsMap);
    assert.equal(totals.calcium_mg, 480);

    const calciumReport = reports.find((r) => r.key === "calcium_mg");
    assert.ok(calciumReport);
    // Should have only 1 unified top source for Cow Milk with 480mg (100%), not two duplicate 240mg entries
    assert.equal(calciumReport!.topSources.length, 1);
    assert.equal(calciumReport!.topSources[0].foodName, "Cow Milk");
    assert.equal(calciumReport!.topSources[0].amount, 480);
    assert.equal(calciumReport!.topSources[0].pctOfTotal, 100);
  });
});
