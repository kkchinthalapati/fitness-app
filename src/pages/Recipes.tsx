import { useState, useMemo } from "react";
import { useAppStore } from "../store/appStore";
import { computeEntry, computeRecipeTotals } from "../utils/nutrition";
import type { Food, MealType, Recipe, RecipeIngredient, Unit } from "../types";
import { MEAL_LABELS, UNIT_LABELS } from "../types";

export function Recipes() {
  const recipes = useAppStore((s) => s.recipes);
  const saveRecipe = useAppStore((s) => s.saveRecipe);
  const deleteRecipe = useAppStore((s) => s.deleteRecipe);
  const logRecipeServing = useAppStore((s) => s.logRecipeServing);
  const searchFoods = useAppStore((s) => s.searchFoods);
  const selectedDate = useAppStore((s) => s.selectedDate);

  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  // Form State
  const [recipeName, setRecipeName] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState(4);
  const [cookedWeight, setCookedWeight] = useState("");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);

  // Ingredient search & add state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [ingQty, setIngQty] = useState(1);
  const [ingUnit, setIngUnit] = useState<Unit>("g");

  // Log Modal State
  const [loggingRecipe, setLoggingRecipe] = useState<Recipe | null>(null);
  const [logMeal, setLogMeal] = useState<MealType>("lunch");
  const [logServings, setLogServings] = useState(1);
  const [logDate, setLogDate] = useState(selectedDate);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Search results for ingredient selector
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchFoods(searchQuery).slice(0, 8);
  }, [searchQuery, searchFoods]);

  // Live Recipe Nutrition Calculations
  const liveTotals = useMemo(() => {
    const cookedGrams = cookedWeight ? parseFloat(cookedWeight) : undefined;
    return computeRecipeTotals(ingredients, servings, cookedGrams);
  }, [ingredients, servings, cookedWeight]);

  function handleSelectFood(f: Food) {
    setSelectedFood(f);
    setSearchQuery("");
    const desc = f.servingDescription.toLowerCase();
    if (desc.includes("piece")) {
      setIngUnit("piece");
      setIngQty(1);
    } else if (desc.includes("slice")) {
      setIngUnit("slice");
      setIngQty(1);
    } else if (desc.includes("ladle")) {
      setIngUnit("ladle");
      setIngQty(1);
    } else if (desc.includes("katori")) {
      setIngUnit("katori");
      setIngQty(1);
    } else if (desc.includes("cup")) {
      setIngUnit("cup");
      setIngQty(1);
    } else if (desc.includes("tbsp")) {
      setIngUnit("tbsp");
      setIngQty(1);
    } else if (desc.includes("tsp")) {
      setIngUnit("tsp");
      setIngQty(1);
    } else {
      setIngUnit("g");
      setIngQty(f.servingGrams || 100);
    }
  }

  function handleAddIngredient() {
    if (!selectedFood) return;
    const computed = computeEntry(selectedFood, ingQty, ingUnit);
    const newIng: RecipeIngredient = {
      foodId: selectedFood.id,
      foodName: selectedFood.name,
      quantity: ingQty,
      unit: ingUnit,
      grams: Math.round(computed.grams),
      calories: Math.round(computed.calories * 10) / 10,
      protein: Math.round(computed.protein * 10) / 10,
      carbs: Math.round(computed.carbs * 10) / 10,
      fat: Math.round(computed.fat * 10) / 10,
      fiber: computed.fiber !== undefined ? Math.round(computed.fiber * 10) / 10 : undefined,
      micronutrients: computed.micronutrients,
    };

    setIngredients((prev) => [...prev, newIng]);
    setSelectedFood(null);
    setIngQty(1);
  }

  function handleRemoveIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function handleOpenCreate() {
    setEditingRecipeId(null);
    setRecipeName("");
    setDescription("");
    setServings(4);
    setCookedWeight("");
    setIngredients([]);
    setActiveTab("create");
  }

  function handleOpenEdit(r: Recipe) {
    setEditingRecipeId(r.id);
    setRecipeName(r.name);
    setDescription(r.description || "");
    setServings(r.servings);
    setCookedWeight(r.cookedWeightGrams ? String(r.cookedWeightGrams) : "");
    setIngredients([...r.ingredients]);
    setActiveTab("create");
  }

  async function handleDuplicate(r: Recipe) {
    const dup: Recipe = {
      ...r,
      id: `recipe-${Date.now()}`,
      name: `${r.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveRecipe(dup);
    setFeedbackMsg(`Duplicated "${r.name}"!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  }

  async function handleSaveRecipe() {
    if (!recipeName.trim()) {
      alert("Please provide a recipe name.");
      return;
    }
    if (ingredients.length === 0) {
      alert("Please add at least one ingredient.");
      return;
    }

    const cookedGrams = cookedWeight ? parseFloat(cookedWeight) : undefined;
    const totals = computeRecipeTotals(ingredients, servings, cookedGrams);

    const recipeToSave: Recipe = {
      id: editingRecipeId || `recipe-${Date.now()}`,
      name: recipeName.trim(),
      description: description.trim() || undefined,
      servings: Math.max(1, servings),
      cookedWeightGrams: cookedGrams && cookedGrams > 0 ? cookedGrams : undefined,
      ingredients,
      totalGrams: totals.totalGrams,
      totalCalories: totals.totalCalories,
      totalProtein: totals.totalProtein,
      totalCarbs: totals.totalCarbs,
      totalFat: totals.totalFat,
      totalFiber: totals.totalFiber,
      totalMicronutrients: totals.totalMicronutrients,
      perServingGrams: totals.perServingGrams,
      perServingCalories: totals.perServingCalories,
      perServingProtein: totals.perServingProtein,
      perServingCarbs: totals.perServingCarbs,
      perServingFat: totals.perServingFat,
      perServingFiber: totals.perServingFiber,
      perServingMicronutrients: totals.perServingMicronutrients,
      createdAt: editingRecipeId ? (recipes.find((x) => x.id === editingRecipeId)?.createdAt || Date.now()) : Date.now(),
      updatedAt: Date.now(),
    };

    await saveRecipe(recipeToSave);
    setActiveTab("list");
    setFeedbackMsg(`Recipe "${recipeToSave.name}" saved successfully!`);
    setTimeout(() => setFeedbackMsg(null), 3000);
  }

  async function handleConfirmLog() {
    if (!loggingRecipe) return;
    await logRecipeServing(loggingRecipe.id, logServings, logMeal, logDate);
    const msg = `Logged ${logServings} serving(s) of "${loggingRecipe.name}" to ${MEAL_LABELS[logMeal]}!`;
    setLoggingRecipe(null);
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  }

  return (
    <div className="mx-auto max-w-[640px] p-4 pb-28 space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Recipes & Cooked Dishes
          </h1>
          <p className="text-xs text-slate-500">
            Build custom homemade dishes with exact per-serving macro and micronutrient scaling
          </p>
        </div>
        <button
          onClick={activeTab === "list" ? handleOpenCreate : () => setActiveTab("list")}
          className="rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700 transition"
        >
          {activeTab === "list" ? "+ New Recipe" : "View All"}
        </button>
      </div>

      {feedbackMsg && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 animate-fadeIn">
          ✓ {feedbackMsg}
        </div>
      )}

      {/* CREATE / EDIT FORM */}
      {activeTab === "create" && (
        <div className="space-y-4 animate-fadeIn">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {editingRecipeId ? "Edit Recipe" : "Create New Recipe"}
            </h2>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Recipe Name *
                <input
                  type="text"
                  placeholder="e.g. Andhra Palakura Pappu, High-Protein Upma"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Description / Cooking Notes (Optional)
                <input
                  type="text"
                  placeholder="e.g. Mild spice with toor dal, fresh spinach, and 1 tsp ghee tempering"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </label>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Total Yield (Servings) *
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={servings}
                    onChange={(e) => setServings(Math.max(1, parseInt(e.target.value) || 1))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Cooked Weight (Grams, Optional)
                  <input
                    type="number"
                    placeholder="e.g. 750"
                    value={cookedWeight}
                    onChange={(e) => setCookedWeight(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
              </div>
              <p className="text-[11px] text-slate-400">
                If cooked weight is provided, per-serving portion grams will be derived from finished cooked weight rather than raw ingredients.
              </p>
            </div>
          </div>

          {/* INGREDIENTS BUILDER */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Recipe Ingredients ({ingredients.length})
            </h3>

            {/* Selected food input bar */}
            {selectedFood ? (
              <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900 dark:bg-violet-950/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-violet-950 dark:text-violet-100">
                    {selectedFood.name}
                  </div>
                  <button
                    onClick={() => setSelectedFood(null)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Quantity
                    <input
                      type="number"
                      step={0.25}
                      min={0.1}
                      value={ingQty}
                      onChange={(e) => setIngQty(Math.max(0.1, parseFloat(e.target.value) || 1))}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Unit
                    <select
                      value={ingUnit}
                      onChange={(e) => setIngUnit(e.target.value as Unit)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="g">grams (g)</option>
                      <option value="ml">milliliters (ml)</option>
                      <option value="cup">cup</option>
                      <option value="katori">katori</option>
                      <option value="ladle">ladle</option>
                      <option value="bowl">bowl</option>
                      <option value="piece">piece</option>
                      <option value="slice">slice</option>
                      <option value="tbsp">tbsp</option>
                      <option value="tsp">tsp</option>
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleAddIngredient}
                  className="w-full rounded-xl bg-violet-600 py-2 text-xs font-bold text-white shadow hover:bg-violet-700 transition"
                >
                  + Add to Recipe
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search ingredient (e.g. toor dal, onion, spinach, ghee)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                {searchResults.length > 0 && (
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-800 max-h-48 overflow-y-auto shadow-md">
                    {searchResults.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleSelectFood(f)}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-violet-50 dark:hover:bg-violet-950/40 flex items-center justify-between"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {f.name}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                          {f.servingDescription}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Added Ingredients Table */}
            {ingredients.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-slate-800">
                No ingredients added yet. Search above to add ingredients.
              </div>
            ) : (
              <div className="space-y-2">
                {ingredients.map((ing, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">
                        {ing.foodName}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {ing.quantity} {UNIT_LABELS[ing.unit] || ing.unit} ({ing.grams}g) · {Math.round(ing.calories)} kcal · P {ing.protein}g C {ing.carbs}g F {ing.fat}g
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveIngredient(idx)}
                      className="rounded-full p-1 text-slate-400 hover:text-red-600 transition shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* LIVE NUTRITION SUMMARY CARD */}
          <div className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50/70 to-white p-5 shadow-sm dark:border-violet-900 dark:from-violet-950/20 dark:to-slate-900 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
              <span>Recipe Nutrition Breakdown</span>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                {servings} Servings
              </span>
            </h3>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Total Recipe */}
              <div className="rounded-2xl border border-violet-100 bg-white p-3 dark:border-violet-900/60 dark:bg-slate-800/60 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Recipe Yield ({liveTotals.totalGrams}g)
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {Math.round(liveTotals.totalCalories)} kcal
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  P {liveTotals.totalProtein}g · C {liveTotals.totalCarbs}g · F {liveTotals.totalFat}g
                  {liveTotals.totalFiber !== undefined ? ` · Fib ${liveTotals.totalFiber}g` : ""}
                </div>
              </div>

              {/* Per Serving */}
              <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-900 dark:bg-violet-950/40 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                  Per Serving (~{liveTotals.perServingGrams}g)
                </div>
                <div className="text-lg font-black text-violet-950 dark:text-white">
                  {Math.round(liveTotals.perServingCalories)} kcal
                </div>
                <div className="text-xs text-violet-800 dark:text-violet-200">
                  P {liveTotals.perServingProtein}g · C {liveTotals.perServingCarbs}g · F {liveTotals.perServingFat}g
                  {liveTotals.perServingFiber !== undefined ? ` · Fib ${liveTotals.perServingFiber}g` : ""}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveRecipe}
              className="flex-1 rounded-2xl bg-violet-600 py-3 text-sm font-bold text-white shadow-md hover:bg-violet-700 transition"
            >
              Save Recipe
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* RECIPES LIST VIEW */}
      {activeTab === "list" && (
        <div className="space-y-3">
          {recipes.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <span className="text-4xl">🍲</span>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                No Recipes Saved Yet
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Create custom dishes like homemade Telugu dal, vegetable curries, or snacks. When logged to your diary, portions automatically calculate exact nutrition!
              </p>
              <button
                onClick={handleOpenCreate}
                className="mt-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-violet-700 transition"
              >
                + Create Your First Recipe
              </button>
            </div>
          ) : (
            recipes.map((r) => (
              <div
                key={r.id}
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {r.name}
                    </h3>
                    {r.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{r.description}</p>
                    )}
                    <div className="text-[11px] text-slate-400 mt-1">
                      {r.servings} servings · {r.ingredients.length} ingredients · ~{r.perServingGrams}g per serving
                    </div>
                  </div>
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700 dark:bg-violet-950 dark:text-violet-300 border border-violet-100 dark:border-violet-900">
                    {Math.round(r.perServingCalories)} kcal / serving
                  </span>
                </div>

                <div className="rounded-2xl bg-slate-50 p-2.5 dark:bg-slate-800/50 text-xs flex items-center justify-around font-medium text-slate-700 dark:text-slate-300">
                  <span>Protein: <strong className="text-slate-900 dark:text-white">{r.perServingProtein}g</strong></span>
                  <span>Carbs: <strong className="text-slate-900 dark:text-white">{r.perServingCarbs}g</strong></span>
                  <span>Fat: <strong className="text-slate-900 dark:text-white">{r.perServingFat}g</strong></span>
                  {r.perServingFiber !== undefined && (
                    <span>Fiber: <strong className="text-slate-900 dark:text-white">{r.perServingFiber}g</strong></span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(r)}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDuplicate(r)}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete recipe "${r.name}"?`)) deleteRecipe(r.id);
                      }}
                      className="rounded-xl px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                    >
                      Delete
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setLoggingRecipe(r);
                      setLogServings(1);
                      setLogMeal("lunch");
                      setLogDate(selectedDate);
                    }}
                    className="rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 transition"
                  >
                    + Log Serving
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* LOG RECIPE SERVING MODAL */}
      {loggingRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Log Recipe Serving
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{loggingRecipe.name}</p>
              </div>
              <button
                onClick={() => setLoggingRecipe(null)}
                className="rounded-full p-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Number of Servings
                </label>
                <input
                  type="number"
                  step={0.25}
                  min={0.25}
                  value={logServings}
                  onChange={(e) => setLogServings(Math.max(0.25, parseFloat(e.target.value) || 1))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Meal
                </label>
                <select
                  value={logMeal}
                  onChange={(e) => setLogMeal(e.target.value as MealType)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {(Object.keys(MEAL_LABELS) as MealType[]).map((m) => (
                    <option key={m} value={m}>
                      {MEAL_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Date
                </label>
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="rounded-2xl bg-violet-50/70 p-3 text-xs text-violet-950 dark:bg-violet-950/40 dark:text-violet-200">
                <div className="font-bold">
                  {Math.round(loggingRecipe.perServingCalories * logServings)} kcal · P {(loggingRecipe.perServingProtein * logServings).toFixed(1)}g · C {(loggingRecipe.perServingCarbs * logServings).toFixed(1)}g · F {(loggingRecipe.perServingFat * logServings).toFixed(1)}g
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Portion: ~{Math.round(loggingRecipe.perServingGrams * logServings)} grams
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmLog}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow hover:bg-violet-700 transition"
              >
                Log to Diary
              </button>
              <button
                type="button"
                onClick={() => setLoggingRecipe(null)}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
