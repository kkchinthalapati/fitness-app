import { useMemo, useState } from "react";
import { useAppStore } from "../store/appStore";
import { TotalsBar } from "../components/TotalsBar";
import { FoodSearch } from "../components/FoodSearch";
import { CameraButton } from "../components/CameraButton";
import type { Food, FoodEntry, MealType, Unit } from "../types";
import { MEAL_LABELS, UNIT_TO_GRAMS } from "../types";

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

function computeEntry(food: Food, quantity: number, unit: Unit) {
  let grams: number;
  if (unit === "piece" || unit === "serving") grams = food.servingGrams * quantity;
  else grams = UNIT_TO_GRAMS[unit] * quantity;
  const factor = grams / food.servingGrams;
  return {
    calories: food.calories * factor,
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
    grams,
  };
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

  const grouped = useMemo(() => {
    const g: Record<MealType, FoodEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    for (const e of entries) g[e.meal].push(e);
    return g;
  }, [entries]);

  function handlePick(food: Food) {
    setSelectedFood(food);
    setQty(1);
    setUnit(food.servingDescription.includes("piece") ? "piece" : "serving");
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
    <div className="mx-auto max-w-[560px] p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Fitness App</h1>
        <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold text-white">Private · Local only</span>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
        <button onClick={() => setDate(addDays(selectedDate, -1))} className="rounded-xl px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800">‹ Prev</button>
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{selectedDate}</div>
          <div className="text-xs text-slate-500">{isToday ? "Today" : new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, { weekday: "long" })}</div>
        </div>
        <button
          onClick={() => setDate(addDays(selectedDate, 1))}
          disabled={selectedDate >= todayStr}
          className="rounded-xl px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
        >
          Next ›
        </button>
      </div>

      <button
        onClick={() => setDate(todayStr)}
        className="w-full rounded-xl border border-slate-200 bg-white py-2 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        Go to Today
      </button>

      <TotalsBar />

      {showAdd && selectedFood && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/30">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-violet-900 dark:text-violet-100">{selectedFood.name}</div>
              <div className="text-xs text-violet-700 dark:text-violet-300">{selectedFood.servingDescription} · {selectedFood.calories} kcal</div>
            </div>
            <button onClick={() => setShowAdd(false)} className="text-sm text-violet-700">✕</button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <label className="col-span-1">
              <div className="text-xs text-slate-600 dark:text-slate-300">Qty</div>
              <input
                type="number"
                min={0.25}
                step={0.25}
                value={qty}
                onChange={(e) => setQty(Math.max(0.25, Number(e.target.value) || 1))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="col-span-1">
              <div className="text-xs text-slate-600 dark:text-slate-300">Unit</div>
              <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                <option value="serving">serving</option>
                <option value="piece">piece</option>
                <option value="g">g</option>
                <option value="katori">katori</option>
                <option value="cup">cup</option>
                <option value="bowl">bowl</option>
                <option value="tbsp">tbsp</option>
                <option value="tsp">tsp</option>
                <option value="ml">ml</option>
              </select>
            </label>
            <label className="col-span-1">
              <div className="text-xs text-slate-600 dark:text-slate-300">Meal</div>
              <select value={meal} onChange={(e) => setMeal(e.target.value as MealType)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
                {(Object.keys(MEAL_LABELS) as MealType[]).map((m) => (
                  <option key={m} value={m}>{MEAL_LABELS[m]}</option>
                ))}
              </select>
            </label>
          </div>

          {preview && (
            <div className="mt-3 rounded-xl bg-white p-3 text-sm dark:bg-slate-900">
              <div className="font-semibold text-slate-900 dark:text-white">{Math.round(preview.calories)} kcal · P {preview.protein.toFixed(1)} C {preview.carbs.toFixed(1)} F {preview.fat.toFixed(1)}</div>
              <div className="text-xs text-slate-500">≈ {Math.round(preview.grams)}g total</div>
            </div>
          )}

          <button onClick={handleAdd} className="mt-3 w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white">
            Add to {MEAL_LABELS[meal]}
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Add Food</h2>
        <div className="mt-3">
          <FoodSearch onPickFood={handlePick} />
        </div>
      </div>

      <CameraButton onEstimate={handlePick} />

      <div className="space-y-3">
        {(Object.keys(MEAL_LABELS) as MealType[]).map((m) => (
          <div key={m} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{MEAL_LABELS[m]}</h3>
              <span className="text-xs text-slate-500">{grouped[m].reduce((a, e) => a + e.calories, 0) | 0} kcal</span>
            </div>
            {grouped[m].length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No entries yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {grouped[m].map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-white">{e.foodName}</div>
                      <div className="text-xs text-slate-500">{e.quantity} {e.unit} · {Math.round(e.calories)} kcal · P {e.protein.toFixed(1)} C {e.carbs.toFixed(1)} F {e.fat.toFixed(1)}</div>
                    </div>
                    <button onClick={() => deleteEntry(e.id)} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-red-600 border border-slate-200 dark:bg-slate-900 dark:border-slate-700">Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
