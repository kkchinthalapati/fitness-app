import { useMemo, useState } from "react";
import { useAppStore } from "../store/appStore";
import { MicronutrientsModal } from "./MicronutrientsModal";

export function TotalsBar() {
  const entries = useAppStore((s) => s.entries);
  const workouts = useAppStore((s) => s.workouts);
  const settings = useAppStore((s) => s.settings);

  const [showMicros, setShowMicros] = useState(false);

  // Calculate totals from entries
  const totals = useMemo(() => {
    return entries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fat: acc.fat + e.fat,
        fiber: acc.fiber + (e.fiber || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );
  }, [entries]);

  // Total exercise burn & duration from workouts
  const { totalBurn, totalMinutes } = useMemo(() => {
    return workouts.reduce(
      (acc, w) => ({
        totalBurn: acc.totalBurn + (w.caloriesBurned || 0),
        totalMinutes: acc.totalMinutes + (w.durationMinutes || 0),
      }),
      { totalBurn: 0, totalMinutes: 0 }
    );
  }, [workouts]);

  const target = Math.max(1, settings.calorieGoal);
  const intakeCalories = Math.round(totals.calories);
  const pct = Math.min(100, Math.round((intakeCalories / target) * 100));

  const proteinPct = Math.min(100, Math.round((totals.protein / Math.max(1, settings.proteinGoal)) * 100));
  const carbsPct = Math.min(100, Math.round((totals.carbs / Math.max(1, settings.carbsGoal)) * 100));
  const fatPct = Math.min(100, Math.round((totals.fat / Math.max(1, settings.fatGoal)) * 100));
  const fiberPct = Math.min(100, Math.round((totals.fiber / Math.max(1, settings.fiberGoal || 32)) * 100));

  return (
    <>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        {/* Top Header & Supportive Status */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider uppercase text-slate-400">
                Daily Energy & Nourishment
              </span>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-800 dark:bg-violet-950/70 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
                {intakeCalories >= target * 0.85 && intakeCalories <= target * 1.15
                  ? "Balanced Energy"
                  : intakeCalories > target * 1.15
                  ? "Well Fueled"
                  : "Daily Intake Logging"}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {intakeCalories}
              </span>
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                kcal consumed / {settings.calorieGoal} daily guide
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowMicros(true)}
            className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300 transition"
          >
            <span>🔬</span> Micronutrients
          </button>
        </div>

        {/* Nutrition & Movement Summary (Independent, Non-compensatory) */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-2xl bg-slate-50 p-3 text-center dark:divide-slate-800 dark:bg-slate-800/40">
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Food Energy</div>
            <div className="text-base font-bold text-slate-900 dark:text-white">
              {intakeCalories}
            </div>
            <div className="text-[10px] text-slate-400">kcal intake</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Target Guide</div>
            <div className="text-base font-bold text-violet-600 dark:text-violet-400">
              {settings.calorieGoal}
            </div>
            <div className="text-[10px] text-slate-400">kcal adolescent guide</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Active Movement</div>
            <div className="text-base font-bold text-orange-600 dark:text-orange-400">
              {!settings.hideExerciseCalories ? `~${Math.round(totalBurn)} kcal` : `${totalMinutes} min`}
            </div>
            <div className="text-[10px] text-slate-400">
              {!settings.hideExerciseCalories ? `${totalMinutes} min (est. burn)` : `${workouts.length} activity logged`}
            </div>
          </div>
        </div>

        {/* Food Intake Progress Bar */}
        <div>
          <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            <span>Daily Intake Progress</span>
            <span>{pct}% of energy guideline</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full transition-all duration-300 bg-violet-600 dark:bg-violet-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Exercise is tracked for health, stamina and fitness progression — not to restrict or compensate for food.
          </p>
        </div>

        {/* Macronutrient breakdown meters */}
        <div className="grid grid-cols-4 gap-2 pt-1">
          {/* Protein */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-800/20">
            <div className="text-[10px] font-semibold text-slate-400">PROTEIN</div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {Math.round(totals.protein)}<span className="text-[10px] font-normal text-slate-500">/{settings.proteinGoal}g</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${proteinPct}%` }} />
            </div>
          </div>

          {/* Carbs */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-800/20">
            <div className="text-[10px] font-semibold text-slate-400">CARBS</div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {Math.round(totals.carbs)}<span className="text-[10px] font-normal text-slate-500">/{settings.carbsGoal}g</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full rounded-full bg-blue-500" style={{ width: `${carbsPct}%` }} />
            </div>
          </div>

          {/* Fat */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-800/20">
            <div className="text-[10px] font-semibold text-slate-400">FAT</div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {Math.round(totals.fat)}<span className="text-[10px] font-normal text-slate-500">/{settings.fatGoal}g</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${fatPct}%` }} />
            </div>
          </div>

          {/* Fiber */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2 dark:border-slate-800 dark:bg-slate-800/20">
            <div className="text-[10px] font-semibold text-slate-400">FIBER</div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              {Math.round(totals.fiber)}<span className="text-[10px] font-normal text-slate-500">/{settings.fiberGoal || 32}g</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className="h-full rounded-full bg-teal-500" style={{ width: `${fiberPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {showMicros && <MicronutrientsModal onClose={() => setShowMicros(false)} />}
    </>
  );
}
