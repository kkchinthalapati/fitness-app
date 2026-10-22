import { useState, useMemo } from "react";
import { useAppStore } from "../store/appStore";
import { checkAtwaterDiscrepancy } from "../utils/nutrition";
import type { Food, FoodCategory } from "../types";

const emptyFood = (): Omit<Food, "id" | "createdAt" | "updatedAt"> => ({
  name: "",
  category: "custom",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  servingDescription: "1 serving (~100g)",
  servingGrams: 100,
  isApproximate: false,
  isCustom: true,
  source: "custom",
});

const CATEGORY_TABS: { label: string; value: FoodCategory | "all" }[] = [
  { label: "All", value: "all" },
  { label: "South Indian", value: "south_indian" },
  { label: "North Indian", value: "north_indian" },
  { label: "Staples", value: "staple" },
  { label: "Branded", value: "branded" },
  { label: "Snacks", value: "snack" },
  { label: "Beverages", value: "beverage" },
  { label: "Custom", value: "custom" },
];

export function FoodDatabase() {
  const foods = useAppStore((s) => s.foods);
  const upsertFood = useAppStore((s) => s.upsertFood);
  const deleteFood = useAppStore((s) => s.deleteFood);
  const toggleFavoriteFood = useAppStore((s) => s.toggleFavoriteFood);

  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | "all">("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [editing, setEditing] = useState<Food | null>(null);
  const [inspecting, setInspecting] = useState<Food | null>(null);
  const [draft, setDraft] = useState<ReturnType<typeof emptyFood>>(emptyFood());
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    let list = foods;
    if (favoritesOnly) {
      list = list.filter((f) => Boolean(f.isFavorite));
    }
    if (selectedCategory !== "all") {
      list = list.filter((f) => f.category === selectedCategory);
    }
    if (!q.trim()) return list;

    const qq = q.toLowerCase().trim();
    return list.filter((f) => {
      return (
        f.name.toLowerCase().includes(qq) ||
        (f.localName?.toLowerCase().includes(qq) ?? false) ||
        (f.brand?.toLowerCase().includes(qq) ?? false) ||
        (f.aliases?.some((a) => a.toLowerCase().includes(qq)) ?? false)
      );
    });
  }, [foods, q, selectedCategory, favoritesOnly]);

  const duplicateCandidate = useMemo(() => {
    if (!draft.name.trim() || !showForm) return null;
    const trimmed = draft.name.trim().toLowerCase();
    return foods.find(
      (f) => f.id !== editing?.id && f.name.toLowerCase() === trimmed
    );
  }, [draft.name, showForm, foods, editing]);

  function openNew() {
    setEditing(null);
    setDraft(emptyFood());
    setShowForm(true);
  }

  function openEdit(f: Food) {
    setEditing(f);
    setDraft({
      name: f.name,
      localName: f.localName,
      category: f.category,
      calories: f.calories,
      protein: f.protein,
      carbs: f.carbs,
      fat: f.fat,
      fiber: f.fiber,
      servingDescription: f.servingDescription,
      servingGrams: f.servingGrams,
      isApproximate: f.isApproximate,
      isCustom: true,
      source: f.source === "seed" ? "custom" : f.source,
      brand: f.brand,
    });
    setShowForm(true);
  }

  async function save() {
    if (!draft.name.trim()) return;
    const food: Food = {
      ...(editing || {}),
      id: editing ? editing.id : `custom-${Date.now()}`,
      name: draft.name.trim(),
      localName: draft.localName?.trim() || undefined,
      brand: draft.brand?.trim() || undefined,
      category: draft.category,
      calories: Math.max(0, Number(draft.calories) || 0),
      protein: Math.max(0, Number(draft.protein) || 0),
      carbs: Math.max(0, Number(draft.carbs) || 0),
      fat: Math.max(0, Number(draft.fat) || 0),
      fiber: draft.fiber !== undefined ? Math.max(0, Number(draft.fiber)) : undefined,
      servingDescription: draft.servingDescription,
      servingGrams: Math.max(1, Number(draft.servingGrams) || 100),
      isApproximate: Boolean(draft.isApproximate),
      isCustom: true,
      source: "custom",
      createdAt: editing ? editing.createdAt : Date.now(),
      updatedAt: Date.now(),
      unitConversions: editing?.unitConversions || {
        g: 1,
        serving: Math.max(1, Number(draft.servingGrams) || 100),
      },
    };

    await upsertFood(food);
    setShowForm(false);
  }

  return (
    <div className="mx-auto max-w-[640px] p-4 pb-28 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Food Database</h1>
          <p className="text-xs text-slate-500">
            {foods.length} laboratory verified & Indian regional foods · Offline local-first
          </p>
        </div>
        <button
          onClick={openNew}
          className="rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700 transition"
        >
          + New Food
        </button>
      </div>

      {/* Search Input & Favorites Toggle */}
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter foods by name, brand, or Telugu alias..."
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs dark:border-slate-700 dark:bg-slate-900 shadow-2xs"
        />
        <button
          type="button"
          onClick={() => setFavoritesOnly(!favoritesOnly)}
          className={`rounded-xl px-3.5 py-2.5 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
            favoritesOnly
              ? "bg-amber-500 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          <span>★</span>
          <span>Favorites</span>
        </button>
      </div>

      {/* Category Chips Bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORY_TABS.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              selectedCategory === cat.value
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* CREATE / EDIT FOOD FORM */}
      {showForm && (
        <div className="rounded-3xl border border-violet-200 bg-white p-5 shadow-lg dark:border-violet-900 dark:bg-slate-900 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {editing ? `Edit: ${editing.name}` : "Create Custom Food"}
            </h2>
            <button
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Food name (e.g. Grandma's Avakaya Pickle, High Protein Paneer)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />
            {duplicateCandidate && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="font-bold flex items-center gap-1.5">
                  <span>⚠️</span> Duplicate Food Detected
                </div>
                <div className="text-[11px] mt-0.5">
                  “{duplicateCandidate.name}” already exists in your database ({Math.round(duplicateCandidate.calories)} kcal, {duplicateCandidate.servingDescription}). Saving will create an additional food record.
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input
                value={draft.localName || ""}
                onChange={(e) => setDraft({ ...draft, localName: e.target.value })}
                placeholder="Local / Telugu name (e.g. Pappu)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
              <input
                value={draft.brand || ""}
                onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                placeholder="Brand (optional, e.g. Amul)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Category
                <select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value as FoodCategory })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="south_indian">South Indian</option>
                  <option value="north_indian">North Indian</option>
                  <option value="branded">Branded</option>
                  <option value="staple">Staple</option>
                  <option value="ingredient">Ingredient</option>
                  <option value="snack">Snack</option>
                  <option value="beverage">Beverage</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Serving grams
                <input
                  type="number"
                  value={draft.servingGrams}
                  onChange={(e) => setDraft({ ...draft, servingGrams: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
            </div>

            <input
              value={draft.servingDescription}
              onChange={(e) => setDraft({ ...draft, servingDescription: e.target.value })}
              placeholder="Serving description (e.g. 1 katori (~150g) or 2 pieces (~60g))"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
            />

            <div className="grid grid-cols-5 gap-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                kcal
                <input
                  type="number"
                  value={draft.calories}
                  onChange={(e) => setDraft({ ...draft, calories: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Protein (g)
                <input
                  type="number"
                  step="0.1"
                  value={draft.protein}
                  onChange={(e) => setDraft({ ...draft, protein: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Carbs (g)
                <input
                  type="number"
                  step="0.1"
                  value={draft.carbs}
                  onChange={(e) => setDraft({ ...draft, carbs: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Fat (g)
                <input
                  type="number"
                  step="0.1"
                  value={draft.fat}
                  onChange={(e) => setDraft({ ...draft, fat: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Fiber (g)
                <input
                  type="number"
                  step="0.1"
                  value={draft.fiber || ""}
                  onChange={(e) => setDraft({ ...draft, fiber: e.target.value ? Number(e.target.value) : undefined })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-1.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={save}
              className="flex-1 rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow hover:bg-violet-700 transition"
            >
              Save Food
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* FOOD CARDS LIST */}
      <div className="space-y-2.5">
        {filtered.slice(0, 150).map((f) => {
          const atwater = checkAtwaterDiscrepancy(f);
          return (
            <div
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Favorite Star Button */}
                <button
                  type="button"
                  onClick={() => toggleFavoriteFood(f.id)}
                  className={`text-base transition ${
                    f.isFavorite ? "text-amber-500 scale-110" : "text-slate-300 hover:text-slate-500"
                  }`}
                  title={f.isFavorite ? "Remove favorite" : "Mark as favorite"}
                >
                  ★
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setInspecting(f)}
                      className="truncate text-sm font-semibold text-slate-900 dark:text-white hover:text-violet-600 dark:hover:text-violet-400 text-left"
                    >
                      {f.name}
                    </button>
                    {f.brand && (
                      <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
                        {f.brand}
                      </span>
                    )}
                    {f.dietaryPreference === "non_veg" && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-800 dark:bg-red-900/40 dark:text-red-200">
                        non-veg
                      </span>
                    )}
                    {f.source === "recipe" && (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                        recipe
                      </span>
                    )}
                  </div>
                  {f.localName && (
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                      {f.localName}
                    </div>
                  )}
                  <div className="truncate text-xs text-slate-500 mt-0.5">
                    {f.servingDescription} · {Math.round(f.calories)} kcal · P {f.protein}g C {f.carbs}g F {f.fat}g
                    {f.fiber !== undefined ? ` · Fib ${f.fiber}g` : ""}
                    {atwater.isSignificant && (
                      <span className="ml-1.5 text-[10px] text-slate-400 font-medium">
                        (Atwater: ~{atwater.atwaterCalories} kcal)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 gap-1 items-center">
                <button
                  onClick={() => setInspecting(f)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  View
                </button>
                <button
                  onClick={() => openEdit(f)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  Edit
                </button>
                {f.isCustom && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete custom food "${f.name}"?`)) deleteFood(f.id);
                    }}
                    className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 dark:bg-red-950/30 transition"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <p className="text-center text-xs text-slate-400 py-4">
          Showing {Math.min(150, filtered.length)} of {filtered.length} foods
        </p>
      </div>

      {/* INSPECT FOOD MODAL */}
      {inspecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {inspecting.name}
                </h3>
                {inspecting.localName && (
                  <p className="text-xs text-slate-400">{inspecting.localName}</p>
                )}
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Reference: {inspecting.servingDescription} ({inspecting.servingGrams}g)
                </div>
              </div>
              <button
                onClick={() => setInspecting(null)}
                className="rounded-full p-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60 text-xs space-y-1">
              <div className="font-bold text-slate-900 dark:text-white">
                {inspecting.calories} kcal · P {inspecting.protein}g · C {inspecting.carbs}g · F {inspecting.fat}g
                {inspecting.fiber !== undefined ? ` · Fib ${inspecting.fiber}g` : ""}
              </div>
              {inspecting.provenance && (
                <div className="text-[10px] text-slate-400 pt-1">
                  Source: {inspecting.provenance.sourceName} ({inspecting.provenance.confidence} confidence)
                </div>
              )}
            </div>

            {inspecting.micronutrients && Object.keys(inspecting.micronutrients).length > 0 && (
              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-700 dark:text-slate-300">
                  Laboratory Micronutrients (per {inspecting.servingGrams}g):
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                  {inspecting.micronutrients.calcium_mg !== undefined && (
                    <div>Calcium: {inspecting.micronutrients.calcium_mg} mg</div>
                  )}
                  {inspecting.micronutrients.iron_mg !== undefined && (
                    <div>Iron: {inspecting.micronutrients.iron_mg} mg</div>
                  )}
                  {inspecting.micronutrients.potassium_mg !== undefined && (
                    <div>Potassium: {inspecting.micronutrients.potassium_mg} mg</div>
                  )}
                  {inspecting.micronutrients.sodium_mg !== undefined && (
                    <div>Sodium: {inspecting.micronutrients.sodium_mg} mg</div>
                  )}
                  {inspecting.micronutrients.vitamin_c_mg !== undefined && (
                    <div>Vitamin C: {inspecting.micronutrients.vitamin_c_mg} mg</div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={() => setInspecting(null)}
              className="w-full rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow hover:bg-violet-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
