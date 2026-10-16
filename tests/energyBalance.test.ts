import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateBMR,
  calculateTDEE,
  calculateTargetCalories,
  computeEnergyBalance,
} from "../src/utils/energyBalance.ts";
import type { UserProfile } from "../src/types.ts";

describe("Energy Balance & Calorie Deficit Engine", () => {
  const karthikProfile: UserProfile = {
    name: "Karthik",
    age: 15,
    gender: "male",
    heightCm: 168,
    weightKg: 58,
    activityLevel: "moderate",
    goalType: "maintain",
    deficitTargetKcal: 300,
  };

  test("BMR calculation using Mifflin-St Jeor equation", () => {
    // Male: 10 * 58 + 6.25 * 168 - 5 * 15 + 5
    // 580 + 1050 - 75 + 5 = 1560 kcal
    const bmr = calculateBMR(karthikProfile);
    assert.equal(bmr, 1560, `Expected 1560 kcal BMR for Karthik, got ${bmr}`);

    const femaleProfile: UserProfile = {
      name: "Ananya",
      age: 15,
      gender: "female",
      heightCm: 160,
      weightKg: 50,
      activityLevel: "light",
      goalType: "maintain",
    };
    // Female: 10 * 50 + 6.25 * 160 - 5 * 15 - 161
    // 500 + 1000 - 75 - 161 = 1264 kcal
    const bmrFemale = calculateBMR(femaleProfile);
    assert.equal(bmrFemale, 1264);
  });

  test("TDEE calculation with activity multipliers", () => {
    // BMR 1560 * 1.55 (moderate) = 2418
    const tdee = calculateTDEE(karthikProfile);
    assert.equal(tdee, 2418);

    const activeProfile: UserProfile = { ...karthikProfile, activityLevel: "active" };
    // 1560 * 1.725 = 2691
    assert.equal(calculateTDEE(activeProfile), 2691);

    const sedentaryProfile: UserProfile = { ...karthikProfile, activityLevel: "sedentary" };
    // 1560 * 1.2 = 1872
    assert.equal(calculateTDEE(sedentaryProfile), 1872);
  });

  test("Target calorie computation based on goal type", () => {
    const maintainTarget = calculateTargetCalories(karthikProfile);
    assert.equal(maintainTarget, 2418);

    const mildDeficitProfile: UserProfile = { ...karthikProfile, goalType: "mild_deficit" };
    assert.equal(calculateTargetCalories(mildDeficitProfile), 2418 - 250); // 2168

    const deficitProfile: UserProfile = { ...karthikProfile, goalType: "deficit", deficitTargetKcal: 400 };
    assert.equal(calculateTargetCalories(deficitProfile), 2418 - 400); // 2018

    const surplusProfile: UserProfile = { ...karthikProfile, goalType: "mild_surplus" };
    assert.equal(calculateTargetCalories(surplusProfile), 2418 + 250); // 2668
  });

  test("Net calories and Deficit / Surplus calculation", () => {
    // Karthik consumes 2200 kcal from food, burns 450 kcal playing badminton
    const intake = 2200;
    const exerciseBurn = 450;
    const summary = computeEnergyBalance(karthikProfile, intake, exerciseBurn);

    // Net Calories = 2200 - 450 = 1750 kcal
    assert.equal(summary.netCalories, 1750);
    // TDEE is 2418
    // Daily Deficit = 2418 - 1750 = 668 kcal deficit
    assert.equal(summary.dailyDeficitSurplus, 668);
    assert.equal(summary.status, "deficit");
    assert.equal(summary.deficitKcal, 668);

    // Surplus scenario: 3000 kcal intake, 100 kcal burn
    const surplusSummary = computeEnergyBalance(karthikProfile, 3000, 100);
    assert.equal(surplusSummary.netCalories, 2900);
    // 2418 - 2900 = -482 kcal (surplus)
    assert.equal(surplusSummary.dailyDeficitSurplus, -482);
    assert.equal(surplusSummary.status, "surplus");
    assert.equal(surplusSummary.deficitKcal, 482);

    // Balanced scenario: 2400 kcal intake, 0 burn
    const balancedSummary = computeEnergyBalance(karthikProfile, 2418, 0);
    assert.equal(balancedSummary.status, "balanced");
  });
});
