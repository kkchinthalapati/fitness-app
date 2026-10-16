import { useState } from "react";
import { useAppStore } from "../store/appStore";
import type { MealType, SavedMeal, SavedMealItem, Unit } from "../types";
import { MEAL_LABELS } from "../types";

export function SavedMealsModal({
  onClose,
  defaultMeal = "lunch",
}: {
  onClose: () => void;
  defaultMeal?: MealType;
}) {
  const savedMeals = useAppStore((s) => s.savedMeals);
  const logSavedMeal = useAppStore((s) => s.logSavedMeal);
  const saveMeal = useAppStore((s) => s.saveMeal);
  const deleteSavedMeal = useAppStore((s) => s.deleteSavedMeal);
  const searchFoods = useAppStore((s) => s.searchFoods);

  const [selectedMealType, setSelectedMealType] = useState<MealType>(defaultMeal);
  const [isCreating, setIsCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New combo plate form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newItems, setNewItems] = useState<SavedMealItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const searchResults = searchQuery.trim() ? searchFoods(searchQuery).slice(0, 5) : [];

  function addItemToNewCombo(foodId: string, foodName: string) {
    setNewItems((prev) => [
      ...prev,
      { foodId, foodName, quantity: 1, unit: "serving" },
    ]);
    setSearchQuery("");
  }

  function updateNewItemQty(index: number, quantity: number) {
    setNewItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], quantity: Math.max(0.1, quantity) };
      return copy;
    });
  }

  function updateNewItemUnit(index: number, unit: Unit) {
    setNewItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], unit };
      return copy;
    });
  }

  function removeNewItem(index: number) {
    setNewItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveNewCombo() {
    if (!newName.trim() || newItems.length === 0) return;
    const newCombo: SavedMeal = {
      id: `combo-${Date.now()}`,
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      defaultMeal: selectedMealType,
      items: newItems,
      createdAt: Date.now(),
    };
    await saveMeal(newCombo);
    setIsCreating(false);
    setNewName("");
    setNewDesc("");
    setNewItems([]);
    setSuccessMsg(`Combo "${newCombo.name}" saved!`);
    setTimeout(() => setSuccessMsg(null), 2500);
  }

  async function handleLogCombo(mealId: string) {
    await logSavedMeal(mealId, selectedMealType);
    const meal = savedMeals.find((m) => m.id === mealId);
    setSuccessMsg(`Logged "${meal?.name}" (${meal?.items.length} items) to ${MEAL_LABELS[selectedMealType]}!`);
    setTimeout(() => {
      onClose();
    }, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="flex max-h-[90vh] w-full max-w-[520px] flex-col rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Saved Meals & Combo Plates
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Log entire Indian thalis and recurring meal combos with 1 tap
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            ✕
          </button>
        </div>

        {/* Success Banner */}
        {successMsg && (
          <div className="bg-emerald-100 p-2.5 text-center text-xs font-semibold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
            ✓ {successMsg}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto p-5 space-y-4">
          {!isCreating ? (
            <>
              {/* Target Meal Selector */}
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target Meal Slot:
                </span>
                <select
                  value={selectedMealType}
                  onChange={(e) => setSelectedMealType(e.target.value as MealType)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {(Object.keys(MEAL_LABELS) as MealType[]).map((m) => (
                    <option key={m} value={m}>
                      {MEAL_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Combo List */}
              <div className="space-y-3">
                {savedMeals.map((meal) => (
                  <div
                    key={meal.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {meal.name}
                        </h4>
                        {meal.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {meal.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteSavedMeal(meal.id)}
                        className="text-xs text-slate-400 hover:text-red-600 transition"
                        title="Delete combo"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Items chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {meal.items.map((item, idx) => (
                        <span
                          key={idx}
                          className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {item.quantity} {item.unit} {item.foodName}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={() => handleLogCombo(meal.id)}
                      className="w-full rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 transition"
                    >
                      Log All {meal.items.length} Items to {MEAL_LABELS[selectedMealType]}
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setIsCreating(true)}
                className="w-full rounded-xl border border-dashed border-violet-300 bg-violet-50 py-3 text-xs font-bold text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300 transition"
              >
                + Create New Combo Plate
              </button>
            </>
          ) : (
            /* Create New Combo Form */
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                New Combo Plate
              </h3>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Combo Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. My Andhra Dinner Plate"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Description (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Roti with rajma and salad"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              {/* Items in new combo */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Items in Combo ({newItems.length})
                </label>
                <div className="mt-2 space-y-2">
                  {newItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800"
                    >
                      <span className="truncate flex-1 text-xs font-bold text-slate-900 dark:text-white">
                        {item.foodName}
                      </span>
                      <input
                        type="number"
                        step="0.5"
                        min="0.25"
                        value={item.quantity}
                        onChange={(e) => updateNewItemQty(idx, parseFloat(e.target.value) || 1)}
                        className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                      <select
                        value={item.unit}
                        onChange={(e) => updateNewItemUnit(idx, e.target.value as Unit)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      >
                        <option value="serving">serving</option>
                        <option value="piece">piece</option>
                        <option value="katori">katori</option>
                        <option value="ladle">ladle</option>
                        <option value="cup">cup</option>
                        <option value="glass">glass</option>
                        <option value="tbsp">tbsp</option>
                        <option value="tsp">tsp</option>
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                      </select>
                      <button
                        onClick={() => removeNewItem(idx)}
                        className="text-xs text-red-500 hover:text-red-700 px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Food search to add */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Add Foods to Combo
                </label>
                <input
                  type="text"
                  placeholder="Search foods to include (e.g. rice, dal, roti)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />

                {searchResults.length > 0 && (
                  <div className="mt-2 space-y-1 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                    {searchResults.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => addItemToNewCombo(f.id, f.name)}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span className="truncate font-medium">{f.name}</span>
                        <span className="text-violet-600 dark:text-violet-400 font-bold">+ Add</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveNewCombo}
                  disabled={!newName.trim() || newItems.length === 0}
                  className="flex-1 rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 transition"
                >
                  Save Combo Plate
                </button>
                <button
                  onClick={() => setIsCreating(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-700 dark:border-slate-800 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
