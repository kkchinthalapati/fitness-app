import { useMemo, useState } from "react";
import { useAppStore } from "../store/appStore";
import { TotalsBar } from "../components/TotalsBar";
import { FoodSearch } from "../components/FoodSearch";
import { CameraButton } from "../components/CameraButton";
import { QuickLogBox } from "../components/QuickLogBox";
import { FrequentSuggestions } from "../components/FrequentSuggestions";
import { SavedMealsModal } from "../components/SavedMealsModal";
import { WorkoutsCard } from "../components/WorkoutsCard";
import { WaterTracker } from "../components/WaterTracker";
import type { Food, FoodEntry, MealType, Unit } from "../types";
import { MEAL_LABELS } from "../types";
import { computeEntry } from "../utils/nutrition";

function getTodayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateStr: string, delta: number) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + delta);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function DailyLog() {
  const selectedDate = useAppStore((s) => s.selectedDate);
  const entries = useAppStore((s) => s.entries);
  const setDate = useAppStore((s) => s.setDate);
  const addEntry = useAppStore((s) => s.addEntry);
  const deleteEntry = useAppStore((s) => s.deleteEntry);

  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState<Unit>("serving");
  const [meal, setMeal] = useState<MealType>("lunch");
  const [showAdd, setShowAdd] = useState(false);
  const [showSavedMeals, setShowSavedMeals] = useState(false);

  const grouped = useMemo(() => {
    const g: Record<MealType, FoodEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    for (const e of entries) g[e.meal].push(e);
    return g;
  }, [entries]);

  function handlePick(food: Food, suggestedMeal?: MealType) {
    setSelectedFood(food);
    setQty(1);
    if (suggestedMeal) setMeal(suggestedMeal);
    const desc = food.servingDescription.toLowerCase();
    let initialUnit: Unit = "serving";
    if (desc.includes("slice")) initialUnit = "slice";
    else if (desc.includes("ladle")) initialUnit = "ladle";
    else if (
      desc.includes("piece") ||
      desc.includes("idli") ||
      desc.includes("dosa") ||
      desc.includes("roti") ||
      desc.includes("biscuit") ||
      desc.includes("cookie") ||
      desc.includes("egg")
    )
      initialUnit = "piece";
    else if (desc.includes("katori")) initialUnit = "katori";
    else if (desc.includes("glass") || desc.includes("tumbler")) initialUnit = "glass";
    else if (desc.includes("cup")) initialUnit = "cup";
    else if (desc.includes("bowl")) initialUnit = "bowl";
    else if (desc.includes("tbsp")) initialUnit = "tbsp";
    else if (desc.includes("tsp")) initialUnit = "tsp";
    else if (desc.includes("ml")) initialUnit = "ml";
    else if (desc.includes("100 g") || desc.includes("100g")) initialUnit = "g";
    setUnit(initialUnit);
    setShowAdd(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleAdd() {
    if (!selectedFood) return;
    const comp = computeEntry(selectedFood, qty, unit);
    const entry: FoodEntry = {
      id: `e-${Date.now()}`,
      foodId: selectedFood.id,
      foodName: selectedFood.name,
      quantity: qty,
      unit,
      calories: comp.calories,
      protein: comp.protein,
      carbs: comp.carbs,
      fat: comp.fat,
      fiber: comp.fiber,
      micronutrients: comp.micronutrients,
      grams: comp.grams,
      date: selectedDate,
      meal,
      createdAt: Date.now(),
    };
    await addEntry(entry);
    setShowAdd(false);
    setSelectedFood(null);
  }

  const preview = selectedFood ? computeEntry(selectedFood, qty, unit) : null;
  const todayStr = getTodayStr();
  const isToday = selectedDate === todayStr;

  return (
    <div className="mx-auto max-w-[560px] p-4 pb-28 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-base text-white shadow-sm font-black">
            ⚡
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Fitness App
            </h1>
            <p className="text-[10px] text-slate-400">
              Private · Cronometer & Strava Hybrid
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSavedMeals(true)}
            className="flex items-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300 transition"
          >
            <span>🍱</span> Combos
          </button>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-slate-800">
            Local Only
          </span>
        </div>
      </div>

      {/* Date Navigation Bar */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-2 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={() => setDate(addDays(selectedDate, -1))}
          className="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
        >
          ‹ Prev
        </button>
        <div className="text-center">
          <div className="text-sm font-bold text-slate-900 dark:text-white">
            {selectedDate}
          </div>
          <div className="text-[11px] text-slate-500">
            {isToday
              ? "Today"
              : new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
          </div>
        </div>
        <button
          onClick={() => setDate(addDays(selectedDate, 1))}
          disabled={selectedDate >= todayStr}
          className="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800 transition"
        >
          Next ›
        </button>
      </div>

      {!isToday && (
        <button
          onClick={() => setDate(todayStr)}
          className="w-full rounded-xl border border-slate-200 bg-white py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-xs"
        >
          Jump to Today
        </button>
      )}

      {/* 1. Core Energy Balance & Calorie Deficit Bar */}
      <TotalsBar />

      {/* 2. Zero-Latency Multi-Item Quick Log Box */}
      <QuickLogBox defaultMeal={meal} />

      {/* 3. Time-of-Day Suggestions & Frequent Foods */}
      <FrequentSuggestions onPickFood={(f, m) => handlePick(f, m)} />

      {/* 4. Workouts & Strava Integration Card */}
      <WorkoutsCard />

      {/* 5. Hydration & Water Tracker Card */}
      <WaterTracker />

      {/* Add Food Modal / Form */}
      {showAdd && selectedFood && (
        <div className="rounded-3xl border border-violet-200 bg-violet-50/70 p-5 shadow-lg dark:border-violet-900 dark:bg-violet-950/30 animate-fadeIn space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-violet-950 dark:text-violet-100">
                {selectedFood.name}
              </div>
              <div className="text-xs text-violet-700 dark:text-violet-300">
                {selectedFood.servingDescription} · {selectedFood.calories} kcal
              </div>
            </div>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-full p-1 text-violet-700 hover:bg-violet-200 dark:hover:bg-violet-900"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-1">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">Qty</div>
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={qty}
                onChange={(e) => setQty(Math.max(0.25, Number(e.target.value) || 1))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="col-span-1">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">Unit</div>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="serving">serving</option>
                <option value="piece">piece</option>
                <option value="slice">slice</option>
                <option value="katori">katori</option>
                <option value="bowl">bowl</option>
                <option value="ladle">ladle</option>
                <option value="cup">cup</option>
                <option value="glass">glass</option>
                <option value="tbsp">tbsp</option>
                <option value="tsp">tsp</option>
                <option value="g">g</option>
                <option value="ml">ml</option>
              </select>
            </label>
            <label className="col-span-1">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">Meal</div>
              <select
                value={meal}
                onChange={(e) => setMeal(e.target.value as MealType)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                {(Object.keys(MEAL_LABELS) as MealType[]).map((m) => (
                  <option key={m} value={m}>
                    {MEAL_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {preview && (
            <div className="rounded-2xl bg-white p-3.5 text-xs shadow-xs dark:bg-slate-900">
              <div className="font-bold text-slate-900 dark:text-white">
                {Math.round(preview.calories)} kcal · P {preview.protein.toFixed(1)}g · C{" "}
                {preview.carbs.toFixed(1)}g · F {preview.fat.toFixed(1)}g
                {preview.fiber !== undefined ? ` · Fib ${preview.fiber.toFixed(1)}g` : ""}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                ≈ {Math.round(preview.grams)}g total portion weight
              </div>
            </div>
          )}

          <button
            onClick={handleAdd}
            className="w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-md hover:bg-violet-700 transition"
          >
            Add to {MEAL_LABELS[meal]}
          </button>
        </div>
      )}

      {/* Search & Food Database Filter */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Food Database & Search
        </h2>
        <FoodSearch onPickFood={(f) => handlePick(f)} />
      </div>

      {/* AI Camera Button */}
      <CameraButton onEstimate={(f) => handlePick(f)} />

      {/* Grouped Daily Entries By Meal */}
      <div className="space-y-3 pt-2">
        {(Object.keys(MEAL_LABELS) as MealType[]).map((m) => {
          const mealCalories = grouped[m].reduce((a, e) => a + e.calories, 0);
          const mealProtein = grouped[m].reduce((a, e) => a + e.protein, 0);

          return (
            <div
              key={m}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {MEAL_LABELS[m]}
                  </h3>
                  <div className="text-[11px] text-slate-500">
                    P {Math.round(mealProtein)}g
                  </div>
                </div>
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {Math.round(mealCalories)} kcal
                </span>
              </div>

              {grouped[m].length === 0 ? (
                <p className="mt-2.5 text-xs text-slate-400">No items logged yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {grouped[m].map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-slate-900 dark:text-white">
                          {e.foodName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {e.quantity} {e.unit} · {Math.round(e.calories)} kcal · P{" "}
                          {e.protein.toFixed(1)}g C {e.carbs.toFixed(1)}g F {e.fat.toFixed(1)}g
                          {e.fiber !== undefined ? ` · Fib ${e.fiber.toFixed(1)}g` : ""}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteEntry(e.id)}
                        className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 transition"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Saved Meals Combo Modal */}
      {showSavedMeals && (
        <SavedMealsModal
          defaultMeal={meal}
          onClose={() => setShowSavedMeals(false)}
        />
      )}
    </div>
  );
}
