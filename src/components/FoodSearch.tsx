import { useState } from "react";
import type { Food, FoodCategory } from "../types";
import { useAppStore } from "../store/appStore";
import { estimateFromText } from "../services/gemini";

const CATEGORY_CHIPS: { label: string; value: FoodCategory | "all" }[] = [
  { label: "All", value: "all" },
  { label: "South Indian", value: "south_indian" },
  { label: "Branded", value: "branded" },
  { label: "International", value: "international" },
  { label: "North Indian", value: "north_indian" },
  { label: "Snacks", value: "snack" },
  { label: "Staples", value: "staple" },
  { label: "Ingredients", value: "ingredient" },
  { label: "Beverages", value: "beverage" },
];

export function FoodSearch({ onPickFood, onAiEstimate }: {
  onPickFood: (food: Food) => void;
  onAiEstimate?: (food: Food) => void;
}) {
  const searchFoods = useAppStore((s) => s.searchFoods);
  const upsertFood = useAppStore((s) => s.upsertFood);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FoodCategory | "all">("all");
  const [vegOnly, setVegOnly] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const results = searchFoods(query, { category: selectedCategory, vegOnly });

  async function handleAiFallback() {
    if (!query.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const est = await estimateFromText(query.trim());
      const food: Food = {
        id: `ai-${Date.now()}`,
        name: est.foodName,
        category: "custom",
        calories: est.calories,
        protein: est.protein,
        carbs: est.carbs,
        fat: est.fat,
        servingDescription: est.servingDescription,
        servingGrams: est.servingGrams,
        isApproximate: est.confidence !== "high",
        isCustom: true,
        source: "ai",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        dietaryPreference: "veg",
      };
      // auto-save AI estimate to personal DB for instant next time
      await upsertFood(food);
      onPickFood(food);
      onAiEstimate?.(food);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setAiError(msg);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search foods (e.g. idli, amul, heinz, dosa)..."
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-10 text-[15px] outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-violet-400"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
      </div>

      {/* Category filters & Veg toggle */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        <button
          type="button"
          onClick={() => setVegOnly(!vegOnly)}
          className={`shrink-0 rounded-full px-3 py-1 font-medium transition ${
            vegOnly
              ? "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700"
              : "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
          }`}
        >
          {vegOnly ? "🌱 Veg Only" : "All Foods"}
        </button>
        {CATEGORY_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setSelectedCategory(chip.value)}
            className={`shrink-0 rounded-full px-3 py-1 font-medium transition ${
              selectedCategory === chip.value
                ? "bg-violet-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {query.trim() && results.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm text-amber-900 dark:text-amber-200">No local match for “{query}”.</p>
          <button
            onClick={handleAiFallback}
            disabled={aiLoading}
            className="mt-3 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {aiLoading ? "Asking Gemini..." : "Estimate with AI (Gemini)"}
          </button>
          {aiError && <p className="mt-2 text-sm text-red-600 dark:text-red-400 break-words">{aiError}</p>}
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">Requires API key in Settings. AI estimate is saved to your foods for next time.</p>
        </div>
      )}

      <div className="flex flex-col gap-2 max-h-[42vh] overflow-auto pr-1">
        {results.map((f) => (
          <button
            key={f.id}
            onClick={() => onPickFood(f)}
            className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-violet-300 dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">{f.name}</span>
                {f.brand && (
                  <span className="shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
                    {f.brand}
                  </span>
                )}
                {f.dietaryPreference === "non_veg" && (
                  <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200">
                    non-veg
                  </span>
                )}
                {f.isApproximate && (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    approx
                  </span>
                )}
                {f.isCustom && (
                  <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                    my food
                  </span>
                )}
              </div>
              {f.localName && (
                <div className="text-[11px] text-slate-400 dark:text-slate-500">{f.localName}</div>
              )}
              <div className="truncate text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {f.servingDescription} · {Math.round(f.calories)} kcal · P {f.protein} C {f.carbs} F {f.fat}
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">Add</span>
          </button>
        ))}
        {query.trim() && results.length > 0 && (
          <button
            onClick={handleAiFallback}
            disabled={aiLoading}
            className="rounded-xl border border-dashed border-violet-300 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-700 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300"
          >
            {aiLoading ? "Estimating..." : `Not seeing it? Estimate "${query}" with AI`}
          </button>
        )}
        {aiError && query.trim() && results.length > 0 && (
          <p className="text-sm text-red-600 dark:text-red-400 break-words">{aiError}</p>
        )}
      </div>
    </div>
  );
}
