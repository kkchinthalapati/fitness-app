import { useMemo } from "react";
import { useAppStore } from "../store/appStore";

export function TotalsBar() {
  const entries = useAppStore((s) => s.entries);
  const settings = useAppStore((s) => s.settings);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fat: acc.fat + e.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [entries]);

  const pct = Math.min(100, Math.round((totals.calories / Math.max(1, settings.calorieGoal)) * 100));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">TODAY</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {Math.round(totals.calories)} <span className="text-sm font-medium text-slate-500">/ {settings.calorieGoal} kcal</span>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500 dark:text-slate-400">
          <div>P {Math.round(totals.protein)} / {settings.proteinGoal}g</div>
          <div>C {Math.round(totals.carbs)} / {settings.carbsGoal}g</div>
          <div>F {Math.round(totals.fat)} / {settings.fatGoal}g</div>
        </div>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-violet-600 transition-all dark:bg-violet-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{pct}% of goal</div>
    </div>
  );
}
