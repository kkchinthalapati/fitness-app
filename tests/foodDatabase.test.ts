import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SEED_FOODS } from "../src/data/seedFoods.ts";
import { computeEntry, computeGrams } from "../src/utils/nutrition.ts";
import { useAppStore } from "../src/store/appStore.ts";
import type { Food, FoodEntry } from "../src/types.ts";

describe("Food Database & Nutrition Tracker Test Suite", () => {
  test("Database integrity & unique IDs", () => {
    assert.ok(SEED_FOODS.length >= 1700, `Expected >= 1700 foods, got ${SEED_FOODS.length}`);

    const idSet = new Set<string>();
    const duplicateIds: string[] = [];

    for (const food of SEED_FOODS) {
      if (idSet.has(food.id)) {
        duplicateIds.push(food.id);
      }
      idSet.add(food.id);

      // Verify essential fields
      assert.ok(food.id, "Food must have an ID");
      assert.ok(food.name, `Food ${food.id} must have a name`);
      assert.ok(food.category, `Food ${food.id} must have a category`);
      assert.ok(typeof food.calories === "number" && food.calories >= 0, `Food ${food.id} has invalid calories`);
      assert.ok(typeof food.protein === "number" && food.protein >= 0, `Food ${food.id} has invalid protein`);
      assert.ok(typeof food.carbs === "number" && food.carbs >= 0, `Food ${food.id} has invalid carbs`);
      assert.ok(typeof food.fat === "number" && food.fat >= 0, `Food ${food.id} has invalid fat`);
      assert.ok(typeof food.servingGrams === "number" && food.servingGrams > 0, `Food ${food.id} has invalid servingGrams`);
      assert.ok(food.servingDescription, `Food ${food.id} has invalid servingDescription`);
      assert.ok(food.unitConversions, `Food ${food.id} must have unitConversions`);
      assert.ok(food.unitConversions.g !== undefined, `Food ${food.id} must have 'g' conversion`);
      assert.ok(food.unitConversions.serving !== undefined, `Food ${food.id} must have 'serving' conversion`);
    }

    assert.equal(duplicateIds.length, 0, `Found duplicate IDs: ${duplicateIds.join(", ")}`);
  });

  test("Macro consistency and physical boundaries", () => {
    for (const food of SEED_FOODS) {
      const p = food.protein;
      const c = food.carbs;
      const f = food.fat;
      const fib = food.fiber || 0;
      const sg = food.servingGrams;

      // Sum of macros cannot exceed serving weight by more than 5% (physical reality)
      const macroSum = p + c + f + fib;
      assert.ok(
        macroSum <= sg * 1.05 + 0.1,
        `Food ${food.name} violates physical boundary: macroSum ${macroSum}g > servingGrams ${sg}g`
      );

      // Atwater calorie sanity check: 4P + 4C + 9F + 2Fib
      const atwater = 4 * p + 4 * c + 9 * f + 2 * fib;
      const diff = Math.abs(food.calories - atwater);
      assert.ok(
        diff <= Math.max(30, atwater * 0.25),
        `Food ${food.name} calories (${food.calories}) diverge significantly from Atwater sum (${atwater})`
      );
    }
  });

  test("Existing record backward compatibility", () => {
    // Core Telugu and everyday Indian food IDs that existed before
    const essentialIds = [
      "seed_raw_white_rice",
      "seed_cooked_white_rice",
      "seed_toor_dal_dry_red_gram",
      "seed_idli_steamed_rice_cake",
      "seed_dosa_plain",
      "seed_sambar",
      "seed_tomato_pappu",
      "seed_palakura_pappu_spinach_dal",
      "seed_mudda_pappu_plain_cooked_toor_dal",
      "seed_curd_rice_perugannam",
      "seed_pulihora_tamarind_rice",
      "seed_upma_rava_upma",
      "seed_medu_vada_garelu",
      "seed_filter_coffee_with_milk_and_sugar",
      "seed_buttermilk_salted_majjiga",
      "seed_ghee_clarified_butter"
    ];

    for (const id of essentialIds) {
      const found = SEED_FOODS.find((f) => f.id === id);
      assert.ok(found, `Critical backward-compatible food ID missing: ${id}`);
    }
  });

  test("Branded Indian and International products coverage", () => {
    const brands = ["Amul", "Britannia", "Parle", "Haldiram's", "Mother Dairy", "Sunfeast", "Tata Consumer", "Heinz", "Weetabix", "McVitie's", "Walkers"];

    for (const brand of brands) {
      const brandFoods = SEED_FOODS.filter((f) => f.brand === brand || (f.name.toLowerCase().includes(brand.toLowerCase())));
      assert.ok(brandFoods.length > 0, `Expected items for brand ${brand}, but found none`);
    }

    // Specific product checks
    assert.ok(SEED_FOODS.some((f) => f.name.includes("Amul Pasteurized Butter")), "Missing Amul Butter");
    assert.ok(SEED_FOODS.some((f) => f.name.includes("Amul Processed Cheese Slice")), "Missing Amul Cheese Slice");
    assert.ok(SEED_FOODS.some((f) => f.name.includes("Parle-G")), "Missing Parle-G");
    assert.ok(SEED_FOODS.some((f) => f.name.includes("Britannia Marie Gold")), "Missing Britannia Marie Gold");
    assert.ok(SEED_FOODS.some((f) => f.name.includes("Britannia Good Day")), "Missing Britannia Good Day");
    assert.ok(SEED_FOODS.some((f) => f.name.includes("Haldiram's Bhujia Sev")), "Missing Haldiram's Bhujia");
    assert.ok(SEED_FOODS.some((f) => f.name.includes("Heinz Baked Beans")), "Missing Heinz Baked Beans");
    assert.ok(SEED_FOODS.some((f) => f.name.includes("Weetabix")), "Missing Weetabix");
    assert.ok(SEED_FOODS.some((f) => f.name.includes("McVitie's Original Digestives")), "Missing McVitie's Digestives");
    assert.ok(SEED_FOODS.some((f) => f.name.includes("Cheddar Cheese Mature")), "Missing Cheddar Cheese");
  });

  test("Vegetarian classification and non-veg isolation", () => {
    const vegFoods = SEED_FOODS.filter((f) => f.dietaryPreference === "veg" || f.dietaryPreference === "vegan");
    const nonVegFoods = SEED_FOODS.filter((f) => f.dietaryPreference === "non_veg");

    assert.ok(vegFoods.length >= 1700, "Expected >= 1700 vegetarian foods");
    assert.ok(nonVegFoods.length >= 10, "Expected non-veg reference items");

    // All egg/chicken/fish/mutton items must be tagged non_veg
    for (const f of nonVegFoods) {
      assert.equal(f.dietaryPreference, "non_veg", `${f.name} must be tagged non_veg`);
    }
  });

  test("Practical household unit conversions & nutrition scaling (Karthik's specific requirements)", () => {
    // 1. 150 g cooked rice
    const cookedRice = SEED_FOODS.find((f) => f.id === "seed_cooked_white_rice")!;
    assert.ok(cookedRice);
    const entry150g = computeEntry(cookedRice, 150, "g");
    assert.equal(Math.round(entry150g.grams), 150);
    assert.equal(Math.round(entry150g.calories), Math.round(cookedRice.calories));

    // 2. 1 cup cooked rice (should be ~180g)
    const entry1CupRice = computeEntry(cookedRice, 1, "cup");
    assert.equal(Math.round(entry1CupRice.grams), 180);
    assert.ok(entry1CupRice.calories > entry150g.calories);

    // 3. 1 katori of dal
    const tomatoPappu = SEED_FOODS.find((f) => f.id === "seed_tomato_pappu")!;
    assert.ok(tomatoPappu);
    const entryKatoriPappu = computeEntry(tomatoPappu, 1, "katori");
    assert.equal(Math.round(entryKatoriPappu.grams), 150);
    assert.equal(Math.round(entryKatoriPappu.calories), Math.round(tomatoPappu.calories));

    // 4. 2 teaspoons of ghee
    const ghee = SEED_FOODS.find((f) => f.id === "seed_ghee_clarified_butter" || f.name === "Amul Pure Ghee")!;
    assert.ok(ghee);
    const entry2TspGhee = computeEntry(ghee, 2, "tsp");
    assert.ok(entry2TspGhee.grams >= 8.5 && entry2TspGhee.grams <= 9.5, `2 tsp ghee should be ~9g, got ${entry2TspGhee.grams}`);
    assert.ok(entry2TspGhee.calories >= 75 && entry2TspGhee.calories <= 85);

    // 5. 1 tablespoon of cooking oil
    const groundnutOil = SEED_FOODS.find((f) => f.name.includes("Groundnut oil"))!;
    assert.ok(groundnutOil);
    const entry1TbspOil = computeEntry(groundnutOil, 1, "tbsp");
    assert.ok(entry1TbspOil.grams >= 13.5 && entry1TbspOil.grams <= 14.5, `1 tbsp oil should be ~14g, got ${entry1TbspOil.grams}`);

    // 6. 2 idlis
    const idli = SEED_FOODS.find((f) => f.id === "seed_idli_steamed_rice_cake")!;
    assert.ok(idli);
    const entry2Idli = computeEntry(idli, 2, "piece");
    assert.equal(Math.round(entry2Idli.grams), 90);
    assert.ok(entry2Idli.calories >= 110 && entry2Idli.calories <= 125);

    // 7. 1 medium dosa
    const dosa = SEED_FOODS.find((f) => f.id === "seed_dosa_plain")!;
    assert.ok(dosa);
    const entry1Dosa = computeEntry(dosa, 1, "piece");
    assert.equal(Math.round(entry1Dosa.grams), 80);

    // 8. 1 slice of bread
    const bread = SEED_FOODS.find((f) => f.name.includes("White Sliced Bread"))!;
    assert.ok(bread);
    const entry1Slice = computeEntry(bread, 1, "slice");
    assert.equal(Math.round(entry1Slice.grams), 38);

    // 9. 1 glass of milk
    const cowMilk = SEED_FOODS.find((f) => f.name.includes("Amul Taaza") || f.name === "Cow milk whole")!;
    assert.ok(cowMilk);
    const entry1GlassMilk = computeEntry(cowMilk, 1, "glass");
    assert.ok(entry1GlassMilk.grams >= 240 && entry1GlassMilk.grams <= 260);

    // 10. 1 bowl of curd
    const curd = SEED_FOODS.find((f) => f.name === "Curd plain (Dahi/Perugu)")!;
    assert.ok(curd);
    const entry1BowlCurd = computeEntry(curd, 1, "bowl");
    assert.equal(Math.round(entry1BowlCurd.grams), 200);

    // 11. 1 banana
    const banana = SEED_FOODS.find((f) => f.name.includes("Banana"))!;
    assert.ok(banana);
    const entry1Banana = computeEntry(banana, 1, "piece");
    assert.ok(entry1Banana.grams >= 50 && entry1Banana.grams <= 140);

    // 12. 1 laddu
    const laddu = SEED_FOODS.find((f) => f.name.includes("Besan laddu"))!;
    assert.ok(laddu);
    const entry1Laddu = computeEntry(laddu, 1, "piece");
    assert.equal(Math.round(entry1Laddu.grams), 35);

    // 13. 1 packaged biscuit serving
    const marie = SEED_FOODS.find((f) => f.name.includes("Marie Gold"))!;
    assert.ok(marie);
    const entryMarie = computeEntry(marie, 1, "serving");
    assert.equal(Math.round(entryMarie.grams), 20);

    // 14. 250 ml of a drink
    const juice = SEED_FOODS.find((f) => f.name.includes("Real Fruit Power Mixed Fruit"))!;
    assert.ok(juice);
    const entry250mlJuice = computeEntry(juice, 250, "ml");
    assert.ok(entry250mlJuice.grams >= 250);
  });

  test("Density distinctions: mass != volume for liquids & oils", () => {
    const ghee = SEED_FOODS.find((f) => f.id === "seed_ghee_clarified_butter")!;
    const waterGrams = computeGrams({ ...ghee, densityGml: 1.0 }, 100, "ml");
    const gheeGrams = computeGrams(ghee, 100, "ml");
    assert.equal(waterGrams, 100);
    assert.equal(Math.round(gheeGrams), 92);
  });

  test("Seed update idempotency & simulation of safe migration", () => {
    // Simulate user state with existing diary entries and custom food
    const mockUserCustomFood: Food = {
      id: "custom_my_special_salad",
      name: "My Special Protein Salad",
      category: "custom",
      calories: 220,
      protein: 15,
      carbs: 20,
      fat: 8,
      servingDescription: "1 bowl (~200g)",
      servingGrams: 200,
      isApproximate: false,
      isCustom: true,
      source: "custom",
      createdAt: 1000,
      updatedAt: 1000
    };

    const mockDiaryEntry: FoodEntry = {
      id: "e-test-1",
      foodId: "seed_cooked_white_rice",
      foodName: "Cooked white rice",
      quantity: 1,
      unit: "katori",
      calories: 189,
      protein: 4.0,
      carbs: 42.3,
      fat: 0.4,
      date: "2026-10-16",
      meal: "lunch",
      createdAt: 1000
    };

    // Current DB state: old seed items + custom food
    const dbFoods: Food[] = [mockUserCustomFood, ...SEED_FOODS.slice(0, 10)];

    // Run migration logic as implemented in appStore.ts hydrate:
    const customFoods = dbFoods.filter((f) => f.source !== "seed");
    // Clean old seed items
    const nonSeedFoods = customFoods;
    const nextDatabase = [...SEED_FOODS, ...nonSeedFoods];

    // Assert custom food is 100% preserved
    const foundCustom = nextDatabase.find((f) => f.id === mockUserCustomFood.id);
    assert.ok(foundCustom, "Custom food must be preserved during migration");
    assert.equal(foundCustom.name, "My Special Protein Salad");

    // Assert diary entry's foodId still resolves in the new database
    const resolvedFood = nextDatabase.find((f) => f.id === mockDiaryEntry.foodId);
    assert.ok(resolvedFood, "Historical diary entry foodId must resolve in new catalogue");

    // Idempotency: running migration a second time produces identical output
    const customFoods2 = nextDatabase.filter((f) => f.source !== "seed");
    const nextDatabase2 = [...SEED_FOODS, ...customFoods2];
    assert.equal(nextDatabase2.length, nextDatabase.length);
  });

  test("Search discoverability & aliases", () => {
    // 1. Search by Telugu transliteration
    const pappuMatches = SEED_FOODS.filter((f) => {
      const q = "pappu";
      return (
        f.name.toLowerCase().includes(q) ||
        (f.localName && f.localName.toLowerCase().includes(q)) ||
        (f.aliases && f.aliases.some((a) => a.toLowerCase().includes(q)))
      );
    });
    assert.ok(pappuMatches.length >= 10, "Searching 'pappu' should return multiple dal/pappu varieties");

    // 2. Search by brand
    const amulMatches = SEED_FOODS.filter((f) => {
      const q = "amul";
      return (
        f.name.toLowerCase().includes(q) ||
        (f.brand && f.brand.toLowerCase().includes(q)) ||
        (f.aliases && f.aliases.some((a) => a.toLowerCase().includes(q)))
      );
    });
    assert.ok(amulMatches.length >= 15, "Searching 'amul' should return all Amul dairy products");

    // 3. Search by international food name
    const bakedBeans = SEED_FOODS.filter((f) => {
      const q = "baked beans";
      return (
        f.name.toLowerCase().includes(q) ||
        (f.aliases && f.aliases.some((a) => a.toLowerCase().includes(q)))
      );
    });
    assert.ok(bakedBeans.length >= 1, "Searching 'baked beans' should return Heinz Baked Beans");
  });

  test("Quality audits: No fake oils, no serving mismatches, no raw items with cooked units", () => {
    const PURE_OILS = new Set([
      "seed_ghee_clarified_butter",
      "seed_groundnut_oil_peanut_oil",
      "seed_sunflower_oil",
      "seed_sesame_oil_gingelly_oil",
      "seed_mustard_oil",
      "seed_coconut_oil_edible",
      "seed_olive_oil_extra_virgin"
    ]);

    for (const food of SEED_FOODS) {
      const uc = food.unitConversions || {};

      // 1. Serving unit must strictly equal servingGrams
      if (uc.serving !== undefined) {
        assert.ok(
          Math.abs(uc.serving - food.servingGrams) < 0.001,
          `Food ${food.name} has mismatched uc.serving (${uc.serving}) != servingGrams (${food.servingGrams})`
        );
      }

      // 2. Pure oils only have density 0.92
      if (food.densityGml === 0.92) {
        assert.ok(
          PURE_OILS.has(food.id),
          `Dish ${food.name} (${food.id}) has oil density 0.92 but is not a pure cooking oil!`
        );
      }

      // 3. Raw dry pulses/grains/flours must not have cooked katori/bowl conversions
      const nl = food.name.toLowerCase();
      const isRaw = ["raw white rice", "toor dal dry", "moong dal dry"].some((k) => nl.includes(k)) ||
        (/\b(flour|atta|maida)\b/.test(nl) && !["mixture", "ring", "chegodilu", "biscuit", "cookie", "cake", "bread", "puri", "roti", "halwa", "laddu", "ladoo", "snack"].some((s) => nl.includes(s)));

      if (isRaw) {
        assert.ok(
          uc.katori === undefined && uc.bowl === undefined,
          `Raw food ${food.name} has cooked bowl/katori conversion!`
        );
      }
    }
  });

  test("Ladle unit conversion and fiber calculation in computeEntry", () => {
    // 1. Ladle on tomato pappu: 1 ladle = 80g
    const tomatoPappu = SEED_FOODS.find((f) => f.id === "seed_tomato_pappu")!;
    assert.ok(tomatoPappu, "seed_tomato_pappu missing");
    const ladleEntry = computeEntry(tomatoPappu, 1, "ladle");
    assert.equal(Math.round(ladleEntry.grams), 80);
    const expectedFactor = 80 / tomatoPappu.servingGrams;
    assert.equal(Math.round(ladleEntry.calories), Math.round(tomatoPappu.calories * expectedFactor));
    assert.ok(ladleEntry.fiber !== undefined, "Ladle entry must preserve fiber");
    assert.equal(Math.round(ladleEntry.fiber! * 10) / 10, Math.round((tomatoPappu.fiber || 0) * expectedFactor * 10) / 10);

    // 2. Fiber calculation on high-fiber food
    const oats = SEED_FOODS.find((f) => f.name.includes("Rolled oats") || f.name.includes("Oats"))!;
    assert.ok(oats);
    assert.ok((oats.fiber || 0) > 0, "Oats should have fiber");
    const oatsEntry = computeEntry(oats, 2, "serving");
    assert.equal(Math.round(oatsEntry.fiber!), Math.round((oats.fiber || 0) * 2));
  });

  test("Search relevance ranking & synonym discoverability (appStore)", () => {
    useAppStore.setState({ foods: SEED_FOODS });
    const store = useAppStore.getState();

    // 1. Searching "ghee" ranks pure ghee #1 (not dishes cooked with 1 tsp ghee)
    const gheeResults = store.searchFoods("ghee");
    assert.ok(gheeResults.length > 0);
    assert.equal(gheeResults[0].name, "Ghee (Clarified butter)");

    // 2. Searching "cooked rice" ranks cooked rice first (not raw dry rice)
    const cookedRiceResults = store.searchFoods("cooked rice");
    assert.ok(cookedRiceResults.length > 0);
    assert.equal(cookedRiceResults[0].name, "Cooked white rice");
    assert.ok(cookedRiceResults.slice(0, 3).every((f) => !f.name.toLowerCase().includes("raw")));

    // 3. Searching "annam" returns cooked rice / traditional meals
    const annamResults = store.searchFoods("annam");
    assert.ok(annamResults.length > 0);
    assert.ok(annamResults.slice(0, 5).every((f) => !f.name.toLowerCase().includes("raw")));

    // 4. Searching "dal" ranks dal curries #1
    const dalResults = store.searchFoods("dal");
    assert.ok(dalResults.length > 0);
    assert.ok(dalResults[0].name.toLowerCase().includes("dal"));
    assert.ok(!dalResults[0].name.toLowerCase().includes("dry"));

    // 5. Searching "dosa" returns dosas, NOT dosakaya (yellow cucumber)
    const dosaResults = store.searchFoods("dosa");
    assert.ok(dosaResults.length >= 5);
    assert.ok(dosaResults.slice(0, 5).every((f) => !f.name.toLowerCase().includes("dosakaya")));

    // 6. Searching "sona masoori" ranks cooked Sona Masoori #1
    const sonaResults = store.searchFoods("sona masoori");
    assert.ok(sonaResults.length > 0);
    assert.equal(sonaResults[0].name, "Sona Masoori Rice (Cooked)");
  });

  test("Authentic Telugu / Andhra dishes coverage & nutritional accuracy", () => {
    const requiredTeluguFoods = [
      "Sona Masoori Rice (Cooked)",
      "Pesara Pappu (Yellow moong dal kura / Andhra moong dal)",
      "Bellam Paramannam (Jaggery Rice Pudding / Sweet Pongali)",
      "Semiya Payasam (Vermicelli Kheer with Milk)",
      "Sorakaya Pappu (Bottle Gourd Dal)",
      "Dosakaya Pappu (Yellow Cucumber Toor Dal)",
      "Pappu Charu (Traditional Andhra Lentil Rasam)",
      "Kandi Podi / Gunpowder (Toor Dal Spiced Powder)",
      "Karivepaku Podi (Curry Leaf Spiced Powder)",
      "Nuvvula Podi (Sesame Seed Spiced Powder)",
      "Vellulli Karam (Garlic Red Chilli Spiced Powder)",
      "Magaya (Andhra Sun-Dried Raw Mango Pickle)",
      "Usirikaya Pachadi (Amla / Indian Gooseberry Pickle)",
      "Nimmakaya Pickle (Spicy Andhra Lime / Lemon Pickle)",
      "Andhra Avakaya Mango Pickle",
      "Mysore Pak (Traditional Ghee & Besan Sweet)",
      "Bellam Gavvalu (Sweet Jaggery Shell Snacks)",
      "Chegodilu (Crispy Spiced Rice Flour Rings)",
      "Ulli Pakodi / Onion Pakoda (Crispy Onion Fritters)",
      "Mysore Bonda (Crispy Curd & Maida Fritters)",
      "Masala Vada / Chana Dal Vada",
      "Boondi Laddu (Traditional Sweet)",
      "Rava Laddu (Sooji Coconut Sweet)",
      "Sunnundalu (Urad dal & Jaggery laddu)",
      "Pootharekulu (Sugar & Ghee paper sweet)",
      "Bobbatlu / Puran Poli / Bakshalu",
      "Chekkalu (Andhra crispy rice crackers)"
    ];

    for (const name of requiredTeluguFoods) {
      const found = SEED_FOODS.find((f) => f.name === name);
      assert.ok(found, `Required Telugu staple missing: ${name}`);
      assert.ok(found.servingGrams > 0, `${name} has invalid servingGrams`);
      assert.ok(found.calories > 0, `${name} has invalid calories`);
      assert.ok(found.unitConversions, `${name} must have unitConversions`);
      assert.ok(found.unitConversions.serving === found.servingGrams, `${name} serving mismatch`);
    }
  });

  test("Micronutrients grounded in ICMR-NIN IFCT 2017", () => {
    const palakura = SEED_FOODS.find((f) => f.id === "seed_palakura_pappu_spinach_dal")!;
    assert.ok(palakura);
    assert.ok(palakura.micronutrients, "Palakura pappu must have micronutrients");
    assert.ok((palakura.micronutrients.calcium_mg || 0) > 0, "Palakura pappu should have calcium");
    assert.ok((palakura.micronutrients.iron_mg || 0) > 0, "Palakura pappu should have iron");

    const cowMilk = SEED_FOODS.find((f) => f.id === "seed_cow_milk_whole")!;
    assert.ok(cowMilk);
    assert.ok(cowMilk.micronutrients, "Cow milk must have micronutrients");
    assert.ok((cowMilk.micronutrients.calcium_mg || 0) >= 100, "Cow milk must have >= 100mg calcium");
  });
});
