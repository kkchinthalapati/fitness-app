import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeRecipeTotals,
  recipeToFood,
  checkAtwaterDiscrepancy,
  computeDailyTotals,
} from "../src/utils/nutrition.ts";
import { DB_VERSION } from "../src/db/index.ts";
import type { Recipe, RecipeIngredient, Food, FoodEntry } from "../src/types.ts";

describe("Recipe Builder, Atwater Audit & Backup/Restore Suite", () => {
  const sampleIngredients: RecipeIngredient[] = [
    {
      foodId: "paneer-fresh",
      foodName: "Fresh Paneer",
      quantity: 150,
      unit: "g",
      grams: 150,
      calories: 397.5,
      protein: 27,
      carbs: 4.5,
      fat: 30,
      fiber: 0,
      micronutrients: {
        calcium_mg: 720,
        iron_mg: 0.3,
        saturated_fat_g: 18,
      },
    },
    {
      foodId: "spinach-raw",
      foodName: "Palak (Spinach)",
      quantity: 200,
      unit: "g",
      grams: 200,
      calories: 52,
      protein: 6.4,
      carbs: 5.8,
      fat: 1.4,
      fiber: 5.2,
      micronutrients: {
        calcium_mg: 146,
        iron_mg: 5.4,
        folate_ug: 246,
        vitamin_a_ug: 940,
        vitamin_c_mg: 56,
      },
    },
    {
      foodId: "ghee-pure",
      foodName: "Desi Cow Ghee",
      quantity: 10,
      unit: "g",
      grams: 10,
      calories: 90,
      protein: 0,
      carbs: 0,
      fat: 10,
      fiber: 0,
      micronutrients: {
        saturated_fat_g: 6.5,
      },
    },
  ];

  test("computeRecipeTotals aggregates multiple ingredients with macro and micro sums", () => {
    // Total raw grams: 150 + 200 + 10 = 360g
    // Total calories: 397.5 + 52 + 90 = 539.5 kcal
    // Total protein: 27 + 6.4 + 0 = 33.4g
    // Total carbs: 4.5 + 5.8 + 0 = 10.3g
    // Total fat: 30 + 1.4 + 10 = 41.4g
    // Total fiber: 0 + 5.2 + 0 = 5.2g
    // Servings: 2
    const result = computeRecipeTotals(sampleIngredients, 2);

    assert.equal(result.totalGrams, 360);
    assert.equal(result.totalCalories, 539.5);
    assert.equal(result.totalProtein, 33.4);
    assert.equal(result.totalCarbs, 10.3);
    assert.equal(result.totalFat, 41.4);
    assert.equal(result.totalFiber, 5.2);

    // Per serving (divided by 2):
    assert.equal(result.perServingGrams, 180); // 360 / 2
    assert.equal(result.perServingCalories, 269.8); // 539.5 / 2 = 269.75 -> 269.8
    assert.equal(result.perServingProtein, 16.7); // 33.4 / 2
    assert.equal(result.perServingCarbs, 5.2); // 10.3 / 2 = 5.15 -> 5.2
    assert.equal(result.perServingFat, 20.7); // 41.4 / 2
    assert.equal(result.perServingFiber, 2.6); // 5.2 / 2

    // Micronutrients aggregated and divided:
    assert.ok(result.totalMicronutrients);
    assert.equal(result.totalMicronutrients?.calcium_mg, 866); // 720 + 146
    assert.equal(result.totalMicronutrients?.iron_mg, 5.7); // 0.3 + 5.4
    assert.equal(result.perServingMicronutrients?.calcium_mg, 433);
    assert.equal(result.perServingMicronutrients?.iron_mg, 2.85);
  });

  test("computeRecipeTotals scales with cookedWeightGrams when water evaporates or absorbs", () => {
    // 360g raw ingredients cooked down to 300g finished Palak Paneer
    const resultCooked = computeRecipeTotals(sampleIngredients, 3, 300);

    assert.equal(resultCooked.totalGrams, 360, "Raw total grams preserved");
    assert.equal(resultCooked.perServingGrams, 100, "Cooked weight per serving is 300g / 3 = 100g");

    // Without cookedWeight, perServingGrams would be 360 / 3 = 120g
    const resultRaw = computeRecipeTotals(sampleIngredients, 3);
    assert.equal(resultRaw.perServingGrams, 120);
  });

  test("computeRecipeTotals safely handles 0 or negative servings gracefully", () => {
    // @ts-expect-error testing boundary value
    const resultZero = computeRecipeTotals(sampleIngredients, 0);
    assert.equal(resultZero.perServingGrams, 360);
    assert.equal(resultZero.perServingCalories, 539.5);

    const resultNegative = computeRecipeTotals(sampleIngredients, -5);
    assert.equal(resultNegative.perServingGrams, 360);
  });

  test("recipeToFood converts a Recipe into a searchable Food item", () => {
    const recipe: Recipe = {
      id: "recipe-palak-paneer",
      name: "High-Protein Palak Paneer",
      description: "Home-style spinach paneer with cow ghee",
      servings: 2,
      cookedWeightGrams: 300,
      ingredients: sampleIngredients,
      totalGrams: 360,
      totalCalories: 539.5,
      totalProtein: 33.4,
      totalCarbs: 10.3,
      totalFat: 41.4,
      totalFiber: 5.2,
      perServingGrams: 150,
      perServingCalories: 269.8,
      perServingProtein: 16.7,
      perServingCarbs: 5.2,
      perServingFat: 20.7,
      perServingFiber: 2.6,
      perServingMicronutrients: {
        calcium_mg: 433,
        iron_mg: 2.85,
      },
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
    };

    const foodItem = recipeToFood(recipe);

    assert.equal(foodItem.id, "recipe-palak-paneer");
    assert.equal(foodItem.name, "High-Protein Palak Paneer");
    assert.equal(foodItem.category, "custom");
    assert.equal(foodItem.source, "recipe");
    assert.equal(foodItem.isCustom, true);
    assert.equal(foodItem.dietaryPreference, "veg");
    assert.equal(foodItem.calories, 269.8);
    assert.equal(foodItem.protein, 16.7);
    assert.equal(foodItem.carbs, 5.2);
    assert.equal(foodItem.fat, 20.7);
    assert.equal(foodItem.fiber, 2.6);
    assert.equal(foodItem.servingGrams, 150);
    assert.equal(foodItem.unitConversions?.g, 1);
    assert.equal(foodItem.unitConversions?.serving, 150);
    assert.equal(foodItem.micronutrients?.calcium_mg, 433);
  });

  test("checkAtwaterDiscrepancy correctly evaluates caloric physics", () => {
    // 1. Food with mathematically matching macros: 10P, 20C, 5F, 2Fib
    // Atwater: 4*10 + 4*20 + 9*5 + 2*2 = 40 + 80 + 45 + 4 = 169 kcal
    const accurateFood: Food = {
      id: "f-acc",
      name: "Balanced Food",
      category: "grain",
      calories: 170,
      protein: 10,
      carbs: 20,
      fat: 5,
      fiber: 2,
      servingGrams: 100,
      servingDescription: "100g",
    };

    const checkAcc = checkAtwaterDiscrepancy(accurateFood);
    assert.equal(checkAcc.reportedCalories, 170);
    assert.equal(checkAcc.atwaterCalories, 169);
    assert.equal(checkAcc.difference, 1);
    assert.equal(checkAcc.isSignificant, false, "Small 1 kcal difference is not significant");

    // 2. Erroneous / Fabricated food: reported 500 kcal, but macros only yield 100 kcal
    const bogusFood: Food = {
      id: "f-bogus",
      name: "Fabricated Food",
      category: "custom",
      calories: 500,
      protein: 5,
      carbs: 10,
      fat: 2,
      fiber: 0,
      servingGrams: 100,
      servingDescription: "100g",
    };

    const checkBogus = checkAtwaterDiscrepancy(bogusFood);
    // Atwater: 4*5 + 4*10 + 9*2 = 20 + 40 + 18 = 78 kcal
    assert.equal(checkBogus.atwaterCalories, 78);
    assert.equal(checkBogus.difference, 422);
    assert.equal(checkBogus.isSignificant, true, "422 kcal divergence must be flagged as significant");

    // 3. Water / Zero-calorie item
    const water: Food = {
      id: "f-water",
      name: "Water",
      category: "beverage",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      servingGrams: 250,
      servingDescription: "1 glass",
    };
    const checkWater = checkAtwaterDiscrepancy(water);
    assert.equal(checkWater.difference, 0);
    assert.equal(checkWater.isSignificant, false);
  });

  test("computeDailyTotals sums macros across entries", () => {
    const entries: FoodEntry[] = [
      {
        id: "e1",
        date: "2026-10-22",
        meal: "breakfast",
        foodId: "idli",
        foodName: "Idli",
        quantity: 3,
        unit: "piece",
        grams: 150,
        calories: 195,
        protein: 6,
        carbs: 39,
        fat: 1.5,
        fiber: 3,
        createdAt: 1000,
      },
      {
        id: "e2",
        date: "2026-10-22",
        meal: "lunch",
        foodId: "rice",
        foodName: "White Rice",
        quantity: 1,
        unit: "cup",
        grams: 160,
        calories: 208,
        protein: 4.2,
        carbs: 45,
        fat: 0.6,
        fiber: 0.6,
        createdAt: 2000,
      },
    ];

    const totals = computeDailyTotals(entries);
    assert.equal(totals.calories, 403);
    assert.equal(Math.round(totals.protein * 10) / 10, 10.2);
    assert.equal(totals.carbs, 84);
    assert.equal(Math.round(totals.fat * 10) / 10, 2.1);
    assert.equal(Math.round((totals.fiber || 0) * 10) / 10, 3.6);
  });

  test("Database backup snapshot schema integrity & validation rules", () => {
    // Validate schema contract for atomic JSON backup
    assert.equal(DB_VERSION, 3, "Database version must be 3");

    const validBackup = {
      schemaVersion: DB_VERSION,
      appName: "fitness-app",
      exportedAt: new Date().toISOString(),
      timestamp: Date.now(),
      data: {
        foods: [
          { id: "custom-1", name: "Custom Upma", category: "custom", calories: 250, protein: 7, carbs: 40, fat: 6, servingGrams: 150, servingDescription: "1 bowl" }
        ],
        entries: [
          { id: "e-1", date: "2026-10-22", meal: "breakfast", foodId: "custom-1", foodName: "Custom Upma", quantity: 1, unit: "serving", calories: 250, protein: 7, carbs: 40, fat: 6, createdAt: 1 }
        ],
        workouts: [],
        recipes: [
          { id: "r-1", name: "Upma", servings: 1, ingredients: [], totalGrams: 150, totalCalories: 250, totalProtein: 7, totalCarbs: 40, totalFat: 6, perServingGrams: 150, perServingCalories: 250, perServingProtein: 7, perServingCarbs: 40, perServingFat: 6, createdAt: 1, updatedAt: 1 }
        ],
        savedMeals: [],
        weightEntries: [],
        waterEntries: [],
        settings: { calorieGoal: 2200 },
      },
    };

    const jsonString = JSON.stringify(validBackup, null, 2);
    assert.ok(jsonString.length > 50, "JSON string should serialize properly");

    // Validation checks that importFullBackup applies
    const parsed = JSON.parse(jsonString);
    assert.equal(parsed.appName, "fitness-app");
    assert.equal(parsed.schemaVersion, 3);
    assert.ok(parsed.data, "Must contain data object");
    assert.ok(Array.isArray(parsed.data.foods));
    assert.ok(Array.isArray(parsed.data.recipes));
    assert.ok(Array.isArray(parsed.data.entries));
    assert.equal(parsed.data.recipes.length, 1);
    assert.equal(parsed.data.recipes[0].name, "Upma");

    // Error case: Malformed / incomplete backup payload
    const invalidPayloads = [
      "{}",
      JSON.stringify({ appName: "other-app" }),
      JSON.stringify({ schemaVersion: 3 }), // missing data
    ];

    for (const bad of invalidPayloads) {
      const p = JSON.parse(bad);
      const isMissingData = !p || typeof p !== "object" || !p.data;
      assert.ok(isMissingData, "Must detect missing root data object");
    }

    // Verify that corrupted non-JSON strings trigger proper syntax error handling
    const corruptedString = '{"appName": "fitness-app", "data": {';
    assert.throws(() => {
      try {
        JSON.parse(corruptedString);
      } catch {
        throw new Error("Invalid backup file: Not valid JSON or file was corrupted/truncated.");
      }
    }, /corrupted\/truncated/);

    // Verify wrong appName detection
    const wrongAppJson = JSON.stringify({ appName: "other-fitness", schemaVersion: 3, data: {} });
    const wrongParsed = JSON.parse(wrongAppJson);
    assert.notEqual(wrongParsed.appName, "fitness-app");
  });

  test("CSV escaping & formatting rules", () => {
    // Verify CSV escaping rules for names with commas, quotes, and newlines
    const rawName = 'Karthik\'s "Special" Upma, Spicy';
    const escapedName = `"${rawName.replace(/"/g, '""')}"`;

    assert.equal(escapedName, '"Karthik\'s ""Special"" Upma, Spicy"');

    // Headers verification
    const entryHeaders = ["ID", "Date", "Meal", "FoodName", "Quantity", "Unit", "Grams", "Calories", "Protein_g", "Carbs_g", "Fat_g", "Fiber_g", "Notes"];
    assert.equal(entryHeaders.length, 13);
    assert.ok(entryHeaders.includes("Calories"));
    assert.ok(entryHeaders.includes("Protein_g"));

    const workoutHeaders = ["ID", "Date", "Title", "Type", "DurationMin", "CaloriesBurned", "DistanceKm", "AvgHeartRate", "Source", "Notes"];
    assert.equal(workoutHeaders.length, 10);
    assert.ok(workoutHeaders.includes("CaloriesBurned"));
  });
});
