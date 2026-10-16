import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateWeightProjection,
  calculateBMI,
  computeWeightRollingAverage,
} from "../src/utils/weightTrends.ts";
import { DEFAULT_SAVED_MEALS } from "../src/store/appStore.ts";
import type { WeightEntry } from "../src/types.ts";

describe("Weight Tracker, Projections & QoL Saved Meals Suite", () => {
  test("Weight deficit projection based on 7,700 kcal rule", () => {
    const currentWeight = 58.0;
    const avgDeficit = 500; // 500 kcal daily deficit

    const proj = calculateWeightProjection(currentWeight, avgDeficit);
    // Weekly loss = (500 * 7) / 7700 = 3500 / 7700 = -0.45 kg/wk
    assert.equal(proj.weeklyChangeKg, -0.45);
    // In 4 weeks: 58.0 - (0.45 * 4) = 58.0 - 1.80 = 56.2 kg
    assert.equal(proj.projectedWeight4WeeksKg, 56.2);
    // In 8 weeks: 58.0 - (0.45 * 8) = 58.0 - 3.60 = 54.4 kg
    assert.equal(proj.projectedWeight8WeeksKg, 54.4);
  });

  test("BMI calculation with Asian-Indian cutoffs", () => {
    const res = calculateBMI(58, 168);
    // 58 / (1.68 * 1.68) = 20.5
    assert.equal(res.bmi, 20.5);
    assert.equal(res.category, "healthy");

    const underweightRes = calculateBMI(45, 170);
    assert.equal(underweightRes.category, "underweight");
  });

  test("Rolling 7-day weight average calculation", () => {
    const sampleEntries: WeightEntry[] = [
      { id: "w1", date: "2026-10-10", weightKg: 58.5, createdAt: 0 },
      { id: "w2", date: "2026-10-11", weightKg: 58.2, createdAt: 0 },
      { id: "w3", date: "2026-10-12", weightKg: 58.0, createdAt: 0 },
      { id: "w4", date: "2026-10-13", weightKg: 57.9, createdAt: 0 },
      { id: "w5", date: "2026-10-14", weightKg: 58.1, createdAt: 0 },
      { id: "w6", date: "2026-10-15", weightKg: 57.8, createdAt: 0 },
      { id: "w7", date: "2026-10-16", weightKg: 57.6, createdAt: 0 },
    ];

    const rolling = computeWeightRollingAverage(sampleEntries);
    assert.equal(rolling.length, 7);
    // Last entry should average all 7 days: (58.5+58.2+58.0+57.9+58.1+57.8+57.6)/7 = 406.1/7 = 58.01 -> 58.0
    assert.equal(rolling[6].rollingAvgKg, 58.0);
  });

  test("Default saved meals (Combo plates) integrity", () => {
    assert.ok(DEFAULT_SAVED_MEALS.length >= 3);

    const thali = DEFAULT_SAVED_MEALS.find((m) => m.id === "combo-telugu-thali");
    assert.ok(thali);
    assert.equal(thali!.items.length, 5);
    assert.ok(thali!.items.some((i) => i.foodName.toLowerCase().includes("rice")));
    assert.ok(thali!.items.some((i) => i.foodName.toLowerCase().includes("pappu")));
    assert.ok(thali!.items.some((i) => i.foodName.toLowerCase().includes("sambar")));
    assert.ok(thali!.items.some((i) => i.foodName.toLowerCase().includes("curd")));
    assert.ok(thali!.items.some((i) => i.foodName.toLowerCase().includes("ghee")));

    const breakfast = DEFAULT_SAVED_MEALS.find((m) => m.id === "combo-south-indian-breakfast");
    assert.ok(breakfast);
    assert.ok(breakfast!.items.some((i) => i.foodName.toLowerCase().includes("idli")));
    assert.ok(breakfast!.items.some((i) => i.foodName.toLowerCase().includes("vada")));

    const fuel = DEFAULT_SAVED_MEALS.find((m) => m.id === "combo-pre-workout-fuel");
    assert.ok(fuel);
    assert.ok(fuel!.items.some((i) => i.foodName.toLowerCase().includes("banana")));
    assert.ok(fuel!.items.some((i) => i.foodName.toLowerCase().includes("milk")));
    assert.ok(fuel!.items.some((i) => i.foodName.toLowerCase().includes("almond")));
  });

  test("Weight surplus projection for lean bulking", () => {
    const currentWeight = 58.0;
    const avgSurplus = -250; // negative deficit = surplus
    const proj = calculateWeightProjection(currentWeight, avgSurplus);
    assert.ok(proj.weeklyChangeKg > 0, "Weekly change should be positive for calorie surplus");
    assert.ok(proj.projectedWeight4WeeksKg > currentWeight);
  });
});
