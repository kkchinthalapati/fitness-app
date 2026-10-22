import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  const foods = useAppStore((s) => s.foods);
  const setDate = useAppStore((s) => s.setDate);
  const addEntry = useAppStore((s) => s.addEntry);
  const updateEntry = useAppStore((s) => s.updateEntry);
  const deleteEntry = useAppStore((s) => s.deleteEntry);
  const undoDeleteEntry = useAppStore((s) => s.undoDeleteEntry);
  const duplicateEntry = useAppStore((s) => s.duplicateEntry);
  const moveEntry = useAppStore((s) => s.moveEntry);
  const copyMealFromDate = useAppStore((s) => s.copyMealFromDate);
  const copyDayFromDate = useAppStore((s) => s.copyDayFromDate);

  // Add Food Form State
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState<Unit>("serving");
  const [meal, setMeal] = useState<MealType>("breakfast");
  const [entryNotes, setEntryNotes] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showSavedMeals, setShowSavedMeals] = useState(false);
  const [showSearchBox, setShowSearchBox] = useState(false);

  // Edit Entry Modal State
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editUnit, setEditUnit] = useState<Unit>("serving");
  const [editMeal, setEditMeal] = useState<MealType>("lunch");
  const [editNotes, setEditNotes] = useState("");

  // Inspect Food Modal State
  const [inspectingFood, setInspectingFood] = useState<Food | null>(null);

  // Undo Toast State
  const [undoToast, setUndoToast] = useState<{ id: string; name: string } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const g: Record<MealType, FoodEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    for (const e of entries) g[e.meal].push(e);
    return g;
  }, [entries]);

  const foodsMap = useMemo(() => {
    const map = new Map<string, Food>();
    for (const f of foods) map.set(f.id, f);
    return map;
  }, [foods]);

  function handlePick(food: Food, suggestedMeal?: MealType) {
    setSelectedFood(food);
    setQty(1);
    setEntryNotes("");
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
    setShowSearchBox(false);
  }

  function handleAddForMeal(targetMeal: MealType) {
    setMeal(targetMeal);
    setShowSearchBox(true);
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
      notes: entryNotes.trim() || undefined,
      createdAt: Date.now(),
    };
    await addEntry(entry);
    setShowAdd(false);
    setSelectedFood(null);
    setEntryNotes("");
  }

  function handleStartEdit(entry: FoodEntry) {
    setEditingEntry(entry);
    setEditQty(entry.quantity);
    setEditUnit(entry.unit);
    setEditMeal(entry.meal);
    setEditNotes(entry.notes || "");
  }

  async function handleSaveEdit() {
    if (!editingEntry) return;
    const food = foodsMap.get(editingEntry.foodId);
    let comp = {
      calories: editingEntry.calories,
      protein: editingEntry.protein,
      carbs: editingEntry.carbs,
      fat: editingEntry.fat,
      fiber: editingEntry.fiber,
      micronutrients: editingEntry.micronutrients,
      grams: editingEntry.grams,
    };

    if (food) {
      comp = computeEntry(food, editQty, editUnit);
    } else {
      const factor = editingEntry.quantity > 0 ? editQty / editingEntry.quantity : 1;
      comp.calories = editingEntry.calories * factor;
      comp.protein = editingEntry.protein * factor;
      comp.carbs = editingEntry.carbs * factor;
      comp.fat = editingEntry.fat * factor;
      if (comp.fiber !== undefined) comp.fiber = comp.fiber * factor;
    }

    const updated: FoodEntry = {
      ...editingEntry,
      quantity: editQty,
      unit: editUnit,
      meal: editMeal,
      calories: comp.calories,
      protein: comp.protein,
      carbs: comp.carbs,
      fat: comp.fat,
      fiber: comp.fiber,
      micronutrients: comp.micronutrients,
      grams: comp.grams,
      notes: editNotes.trim() || undefined,
    };

    await updateEntry(updated);
    setEditingEntry(null);
  }

  async function handleDeleteWithUndo(entry: FoodEntry) {
    await deleteEntry(entry.id);
    setUndoToast({ id: entry.id, name: entry.foodName });
    setTimeout(() => {
      setUndoToast((prev) => (prev?.id === entry.id ? null : prev));
    }, 6000);
  }

  async function handleUndo() {
    if (!undoToast) return;
    await undoDeleteEntry();
    setUndoToast(null);
  }

  async function handleCopyYesterdayMeal(targetMeal: MealType) {
    const yesterday = addDays(selectedDate, -1);
    const count = await copyMealFromDate(yesterday, targetMeal, selectedDate);
    if (count > 0) {
      setCopyFeedback(`Copied ${count} item(s) from yesterday's ${MEAL_LABELS[targetMeal]}!`);
    } else {
      setCopyFeedback(`No items found in yesterday's ${MEAL_LABELS[targetMeal]}.`);
    }
    setTimeout(() => setCopyFeedback(null), 3000);
  }

  async function handleCopyEntireYesterday() {
    const yesterday = addDays(selectedDate, -1);
    const count = await copyDayFromDate(yesterday, selectedDate);
    if (count > 0) {
      setCopyFeedback(`Copied all ${count} food items from yesterday!`);
    } else {
      setCopyFeedback(`No food items found logged on yesterday (${yesterday}).`);
    }
    setTimeout(() => setCopyFeedback(null), 3000);
  }

  const preview = selectedFood ? computeEntry(selectedFood, qty, unit) : null;
  const todayStr = getTodayStr();
  const isToday = selectedDate === todayStr;

  return (
    <div className="mx-auto max-w-[640px] p-4 pb-28 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-base text-white shadow-sm font-black">
            ⚡
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Daily Diary
            </h1>
            <p className="text-[10px] text-slate-400">
              Private · Cronometer-Grade Local Nutrition
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
          <button
            onClick={() => setShowSearchBox(!showSearchBox)}
            className="flex items-center gap-1 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-violet-700 transition"
          >
            <span>+</span> Food
          </button>
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
          <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
            <span>{selectedDate}</span>
            {isToday && (
              <span className="rounded-md bg-violet-100 px-1.5 py-0.2 text-[10px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                Today
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDate(addDays(selectedDate, 1))}
            className="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            Next ›
          </button>
        </div>
      </div>

      {/* Quick Action Strip */}
      <div className="flex gap-2 text-xs font-semibold">
        {!isToday && (
          <button
            onClick={() => setDate(todayStr)}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-2xs"
          >
            Jump to Today
          </button>
        )}
        <button
          onClick={handleCopyEntireYesterday}
          className="flex-1 rounded-xl border border-slate-200 bg-white py-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-2xs"
        >
          📋 Copy All Yesterday
        </button>
        <Link
          to="/recipes"
          className="flex-1 rounded-xl border border-slate-200 bg-white py-1.5 text-center text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-2xs"
        >
          🍲 Recipes
        </Link>
      </div>

      {copyFeedback && (
        <div className="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2 text-xs font-semibold text-violet-800 dark:bg-violet-950 dark:border-violet-900 dark:text-violet-300 animate-fadeIn">
          {copyFeedback}
        </div>
      )}

      {/* Undo Toast Notification */}
      {undoToast && (
        <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-[500px] flex items-center justify-between rounded-2xl bg-slate-900 p-3.5 text-xs text-white shadow-xl dark:bg-white dark:text-slate-900 animate-fadeIn">
          <span>Deleted <strong>{undoToast.name}</strong></span>
          <button
            onClick={handleUndo}
            className="rounded-lg bg-violet-600 px-3 py-1 font-bold text-white hover:bg-violet-500 transition"
          >
            Undo
          </button>
        </div>
      )}

      {/* 1. Core Energy Balance & Calorie Nutrition Bar */}
      <TotalsBar />

      {/* Add Food Form (Rendered when food is selected) */}
      {showAdd && selectedFood && (
        <div className="rounded-3xl border border-violet-200 bg-violet-50/70 p-5 shadow-lg dark:border-violet-900 dark:bg-violet-950/30 animate-fadeIn space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                Add to Daily Log
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {selectedFood.name}
              </h2>
              {selectedFood.localName && (
                <p className="text-xs text-slate-500">{selectedFood.localName}</p>
              )}
            </div>
            <button
              onClick={() => {
                setShowAdd(false);
                setSelectedFood(null);
              }}
              className="text-slate-400 hover:text-slate-600 text-sm p-1"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Quantity
              </label>
              <input
                type="number"
                step="0.5"
                min="0.1"
                value={qty}
                onChange={(e) => setQty(Math.max(0.1, parseFloat(e.target.value) || 1))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Serving Unit
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="serving">serving ({selectedFood.servingDescription})</option>
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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Meal Category
              </label>
              <select
                value={meal}
                onChange={(e) => setMeal(e.target.value as MealType)}
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
                Notes (optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Extra chutney, less ghee"
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          {preview && (
            <div className="rounded-2xl border border-violet-100 bg-white p-3 dark:border-violet-900/40 dark:bg-slate-900/60 text-xs space-y-1">
              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                <span>Calculated Nutrition:</span>
                <span className="text-violet-600 dark:text-violet-400">
                  {Math.round(preview.calories)} kcal
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                Protein {preview.protein.toFixed(1)}g · Carbs {preview.carbs.toFixed(1)}g · Fat {preview.fat.toFixed(1)}g
                {preview.fiber !== undefined ? ` · Fiber ${preview.fiber.toFixed(1)}g` : ""}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                ≈ {Math.round(preview.grams)}g portion mass
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

      {/* Expandable Food Database Search Bar */}
      {showSearchBox && (
        <div className="rounded-3xl border border-violet-200 bg-white p-5 shadow-lg dark:border-violet-900 dark:bg-slate-900 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Search Food for {MEAL_LABELS[meal]}
            </h2>
            <button
              onClick={() => setShowSearchBox(false)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕ Close
            </button>
          </div>
          <FoodSearch onPickFood={(f) => handlePick(f, meal)} />
        </div>
      )}

      {/* 2. Grouped Daily Entries By Meal (Placed front and center!) */}
      <div className="space-y-3">
        {(Object.keys(MEAL_LABELS) as MealType[]).map((m) => {
          const mealCalories = grouped[m].reduce((a, e) => a + e.calories, 0);
          const mealProtein = grouped[m].reduce((a, e) => a + e.protein, 0);

          return (
            <div
              key={m}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-2.5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {MEAL_LABELS[m]}
                    </h3>
                    <button
                      onClick={() => handleCopyYesterdayMeal(m)}
                      className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 transition"
                      title="Copy this meal from yesterday"
                    >
                      + Copy Yesterday
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    P {Math.round(mealProtein)}g
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {Math.round(mealCalories)} kcal
                  </span>
                  <button
                    onClick={() => handleAddForMeal(m)}
                    className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/60 dark:text-violet-300 transition font-black text-sm"
                    title={`Add food to ${MEAL_LABELS[m]}`}
                  >
                    +
                  </button>
                </div>
              </div>

              {grouped[m].length === 0 ? (
                <div className="py-2.5 flex items-center justify-between text-xs text-slate-400">
                  <span>No foods logged yet for {MEAL_LABELS[m]}.</span>
                  <button
                    onClick={() => handleAddForMeal(m)}
                    className="font-semibold text-violet-600 hover:underline dark:text-violet-400"
                  >
                    + Add Food
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {grouped[m].map((e) => (
                    <div
                      key={e.id}
                      className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              const food = foodsMap.get(e.foodId);
                              if (food) setInspectingFood(food);
                            }}
                            className="text-left font-bold text-xs text-slate-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 truncate block"
                          >
                            {e.foodName}
                          </button>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {e.quantity} {e.unit} ({e.grams ? `~${e.grams}g` : ""}) · {Math.round(e.calories)} kcal · P {e.protein.toFixed(1)}g C {e.carbs.toFixed(1)}g F {e.fat.toFixed(1)}g
                            {e.fiber !== undefined ? ` · Fib ${e.fiber.toFixed(1)}g` : ""}
                          </div>
                          {e.notes && (
                            <div className="text-[10px] text-slate-400 italic mt-0.5">
                              "{e.notes}"
                            </div>
                          )}
                        </div>

                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 shrink-0">
                          {Math.round(e.calories)} kcal
                        </span>
                      </div>

                      {/* Entry Action Buttons */}
                      <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-700/60 pt-1.5 text-[11px]">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStartEdit(e)}
                            className="font-semibold text-violet-600 hover:underline dark:text-violet-400"
                          >
                            Edit
                          </button>
                          <span className="text-slate-300">·</span>
                          <button
                            onClick={() => duplicateEntry(e.id)}
                            className="font-semibold text-slate-600 hover:underline dark:text-slate-300"
                          >
                            Duplicate
                          </button>
                          <span className="text-slate-300">·</span>
                          {/* Quick Move Dropdown */}
                          <select
                            value={e.meal}
                            onChange={(ev) => moveEntry(e.id, ev.target.value as MealType)}
                            className="bg-transparent text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium cursor-pointer"
                          >
                            {(Object.keys(MEAL_LABELS) as MealType[]).map((mt) => (
                              <option key={mt} value={mt}>
                                Move: {MEAL_LABELS[mt]}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          onClick={() => handleDeleteWithUndo(e)}
                          className="font-semibold text-red-500 hover:text-red-700 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. Natural Multi-Item Quick Log Box */}
      <QuickLogBox defaultMeal={meal} />

      {/* 4. Time-of-Day Suggestions & Frequent Foods */}
      <FrequentSuggestions onPickFood={(f, m) => handlePick(f, m)} />

      {/* 5. Workouts & Strava Integration Card */}
      <WorkoutsCard />

      {/* 6. Hydration & Water Tracker Card */}
      <WaterTracker />

      {/* 7. AI Camera Button */}
      <CameraButton onEstimate={(f) => handlePick(f)} />

      {/* EDIT ENTRY MODAL */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit {editingEntry.foodName}
              </h3>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Quantity
                  <input
                    type="number"
                    step="0.5"
                    min={0.1}
                    value={editQty}
                    onChange={(e) => setEditQty(Math.max(0.1, parseFloat(e.target.value) || 1))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Unit
                  <select
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value as Unit)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
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
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Meal
                </label>
                <select
                  value={editMeal}
                  onChange={(e) => setEditMeal(e.target.value as MealType)}
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
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Notes..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow hover:bg-violet-700 transition"
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOD DETAIL INSPECTOR MODAL */}
      {inspectingFood && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {inspectingFood.name}
                </h3>
                {inspectingFood.localName && (
                  <p className="text-xs text-slate-400">{inspectingFood.localName}</p>
                )}
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Reference: {inspectingFood.servingDescription} ({inspectingFood.servingGrams}g)
                </div>
              </div>
              <button
                onClick={() => setInspectingFood(null)}
                className="rounded-full p-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60 text-xs space-y-1">
              <div className="font-bold text-slate-900 dark:text-white">
                {inspectingFood.calories} kcal · P {inspectingFood.protein}g · C {inspectingFood.carbs}g · F {inspectingFood.fat}g
                {inspectingFood.fiber !== undefined ? ` · Fib ${inspectingFood.fiber}g` : ""}
              </div>
              {inspectingFood.provenance && (
                <div className="text-[10px] text-slate-400 pt-1">
                  Source: {inspectingFood.provenance.sourceName} ({inspectingFood.provenance.confidence} confidence)
                </div>
              )}
            </div>

            {inspectingFood.micronutrients && Object.keys(inspectingFood.micronutrients).length > 0 && (
              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-700 dark:text-slate-300">Laboratory Micronutrients:</div>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                  {inspectingFood.micronutrients.calcium_mg !== undefined && (
                    <div>Calcium: {inspectingFood.micronutrients.calcium_mg} mg</div>
                  )}
                  {inspectingFood.micronutrients.iron_mg !== undefined && (
                    <div>Iron: {inspectingFood.micronutrients.iron_mg} mg</div>
                  )}
                  {inspectingFood.micronutrients.potassium_mg !== undefined && (
                    <div>Potassium: {inspectingFood.micronutrients.potassium_mg} mg</div>
                  )}
                  {inspectingFood.micronutrients.sodium_mg !== undefined && (
                    <div>Sodium: {inspectingFood.micronutrients.sodium_mg} mg</div>
                  )}
                  {inspectingFood.micronutrients.vitamin_c_mg !== undefined && (
                    <div>Vitamin C: {inspectingFood.micronutrients.vitamin_c_mg} mg</div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => setInspectingFood(null)}
              className="w-full rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow hover:bg-violet-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

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
