import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  splitMultiItemText,
  parseSinglePhrase,
  parseQuickLogText,
} from "../src/utils/quickLogParser.ts";
import { useAppStore } from "../src/store/appStore.ts";
import { SEED_FOODS } from "../src/data/seedFoods.ts";

describe("Multi-Item Quick Log Natural Text Parser", () => {
  test("String splitting across various conjunctions and delimiters", () => {
    const raw = "2 idli with 1 ladle sambar and 1 tsp ghee";
    const chunks = splitMultiItemText(raw);
    assert.deepEqual(chunks, ["2 idli", "1 ladle sambar", "1 tsp ghee"]);

    const withCommasAndPlus = "3 chapati + 1 katori dal, 1 tbsp curd & 1 cup tea";
    const chunks2 = splitMultiItemText(withCommasAndPlus);
    assert.deepEqual(chunks2, ["3 chapati", "1 katori dal", "1 tbsp curd", "1 cup tea"]);

    const multiline = "2 dosa\n1 bowl upma\n1 filter coffee";
    const chunks3 = splitMultiItemText(multiline);
    assert.deepEqual(chunks3, ["2 dosa", "1 bowl upma", "1 filter coffee"]);
  });

  test("Parsing single phrases with units, quantities and fractions", () => {
    const p1 = parseSinglePhrase("2 idli");
    assert.equal(p1.quantity, 2);
    assert.equal(p1.foodQuery, "idli");

    const p2 = parseSinglePhrase("1 ladle sambar");
    assert.equal(p2.quantity, 1);
    assert.equal(p2.unit, "ladle");
    assert.equal(p2.foodQuery, "sambar");

    const p3 = parseSinglePhrase("1 tsp ghee");
    assert.equal(p3.quantity, 1);
    assert.equal(p3.unit, "tsp");
    assert.equal(p3.foodQuery, "ghee");

    const pFrac = parseSinglePhrase("1/2 cup curd");
    assert.equal(pFrac.quantity, 0.5);
    assert.equal(pFrac.unit, "cup");
    assert.equal(pFrac.foodQuery, "curd");

    const pWord = parseSinglePhrase("half katori dal");
    assert.equal(pWord.quantity, 0.5);
    assert.equal(pWord.unit, "katori");
    assert.equal(pWord.foodQuery, "dal");

    const pGrams = parseSinglePhrase("150 g paneer");
    assert.equal(pGrams.quantity, 150);
    assert.equal(pGrams.unit, "g");
    assert.equal(pGrams.foodQuery, "paneer");
  });

  test("Full multi-item text parser against live search engine", () => {
    // Populate store in memory
    useAppStore.setState({ foods: SEED_FOODS });
    const searchFn = (q: string) => useAppStore.getState().searchFoods(q, { vegOnly: false });

    const input = "2 idli with 1 ladle sambar and 1 tsp ghee";
    const parsed = parseQuickLogText(input, searchFn);

    assert.equal(parsed.length, 3, "Expected 3 parsed items");

    // Check item 1: 2 idli
    assert.equal(parsed[0].quantity, 2);
    assert.ok(parsed[0].matchedFood, "Should match idli");
    assert.ok(parsed[0].matchedFood!.name.toLowerCase().includes("idli"));
    assert.equal(parsed[0].unit, "piece");
    assert.ok(parsed[0].calories > 70 && parsed[0].calories < 140, `Idli calories: ${parsed[0].calories}`);

    // Check item 2: 1 ladle sambar
    assert.equal(parsed[1].quantity, 1);
    assert.equal(parsed[1].unit, "ladle");
    assert.ok(parsed[1].matchedFood, "Should match sambar");
    assert.ok(parsed[1].matchedFood!.name.toLowerCase().includes("sambar"));
    assert.ok(parsed[1].calories > 40 && parsed[1].calories < 120, `Sambar calories: ${parsed[1].calories}`);

    // Check item 3: 1 tsp ghee
    assert.equal(parsed[2].quantity, 1);
    assert.equal(parsed[2].unit, "tsp");
    assert.ok(parsed[2].matchedFood, "Should match ghee");
    assert.ok(parsed[2].matchedFood!.name.toLowerCase().includes("ghee"));
    // 1 tsp ghee = ~4.5g (density 0.905) = ~38.5 kcal
    assert.ok(parsed[2].calories >= 35 && parsed[2].calories <= 50, `Ghee calories: ${parsed[2].calories}`);
  });

  test("Plurals, multiplier 2x, spoon synonyms and unicode fractions", () => {
    useAppStore.setState({ foods: SEED_FOODS });
    const searchFn = (q: string) => useAppStore.getState().searchFoods(q, { vegOnly: false });

    // 1. Plural nouns matching: "2 idlis", "3 rotis", "2 dosas", "2 bananas"
    const pPlural = parseQuickLogText("2 idlis", searchFn);
    assert.equal(pPlural.length, 1);
    assert.equal(pPlural[0].quantity, 2);
    assert.ok(pPlural[0].matchedFood, "Should match 'idlis' to Idli");
    assert.ok(pPlural[0].matchedFood!.name.toLowerCase().includes("idli"));
    assert.equal(pPlural[0].unit, "piece");

    const pRotis = parseQuickLogText("3 rotis", searchFn);
    assert.equal(pRotis.length, 1);
    assert.ok(pRotis[0].matchedFood, "Should match 'rotis' to Roti/Chapati");
    assert.equal(pRotis[0].unit, "piece");

    // 2. Spoon unit synonyms: "1 spoon ghee", "2 spoons sugar"
    const pSpoon = parseQuickLogText("1 spoon ghee", searchFn);
    assert.equal(pSpoon.length, 1);
    assert.equal(pSpoon[0].unit, "tsp");
    assert.ok(pSpoon[0].matchedFood, "Should match ghee with spoon unit");

    // 3. Multiplier syntax: "2x idli with 1 ladle sambar"
    const pMult = parseQuickLogText("2x idli with 1 ladle sambar", searchFn);
    assert.equal(pMult.length, 2);
    assert.equal(pMult[0].quantity, 2);
    assert.ok(pMult[0].matchedFood!.name.toLowerCase().includes("idli"));

    // 4. Unicode fraction: "½ cup curd" and "1½ roti"
    const pUni1 = parseSinglePhrase("½ cup curd");
    assert.equal(pUni1.quantity, 0.5);
    assert.equal(pUni1.unit, "cup");

    const pUni2 = parseSinglePhrase("1½ roti");
    assert.equal(pUni2.quantity, 1.5);

    // 5. Decimal without leading zero: ".5 cup milk"
    const pDec = parseSinglePhrase(".5 cup milk");
    assert.equal(pDec.quantity, 0.5);
    assert.equal(pDec.unit, "cup");

    // 6. Compound numbers: "1 and a half katori dal"
    const pCompound = splitMultiItemText("1 and a half katori dal + 2 idlis");
    assert.equal(pCompound.length, 2);
    assert.ok(pCompound[0].includes("1.5"));
  });
});
