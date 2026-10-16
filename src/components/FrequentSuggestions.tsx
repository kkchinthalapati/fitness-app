import { useMemo } from "react";
import { useAppStore } from "../store/appStore";
import type { Food, MealType } from "../types";

function getAutoMealType(): MealType {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15.5) return "lunch";
  if (hour >= 15.5 && hour < 18.5) return "snack";
  return "dinner";
}

export function FrequentSuggestions({ onPickFood }: { onPickFood: (food: Food, suggestedMeal: MealType) => void }) {
  const getFrequentFoods = useAppStore((s) => s.getFrequentFoods);
  const currentMeal = useMemo(() => getAutoMealType(), []);
  const frequentList = useMemo(() => getFrequentFoods(currentMeal), [getFrequentFoods, currentMeal]);

  const mealGreeting = {
    breakfast: "🌅 Morning Fuel (Breakfast)",
    lunch: "☀️ Afternoon Lunch Staples",
    snack: "🎾 Post-School / Pre-Workout Snacks",
    dinner: "🌙 Evening Dinner Favorites",
  }[currentMeal];

  if (frequentList.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {mealGreeting}
        </h3>
        <span className="text-[11px] text-slate-400">1-tap log</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {frequentList.map((food) => (
          <button
            key={food.id}
            onClick={() => onPickFood(food, currentMeal)}
            className="flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-left hover:border-violet-300 dark:border-slate-800 dark:bg-slate-900 shadow-sm transition"
          >
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-slate-900 dark:text-white max-w-[140px]">
                {food.name}
              </div>
              <div className="text-[10px] text-slate-500">
                {Math.round(food.calories)} kcal · P {food.protein}g
              </div>
            </div>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              +
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
