import { useMemo } from "react";
import { useAppStore } from "../store/appStore";

export function WaterTracker() {
  const waterEntries = useAppStore((s) => s.waterEntries);
  const settings = useAppStore((s) => s.settings);
  const addWater = useAppStore((s) => s.addWater);

  const goalMl = settings.waterGoalMl || 2500;
  const currentMl = useMemo(() => {
    return waterEntries.reduce((sum, w) => sum + (w.amountMl || 0), 0);
  }, [waterEntries]);

  const glassesCount = Math.round(currentMl / 250);
  const totalGlassesGoal = Math.max(1, Math.round(goalMl / 250));
  const pct = Math.min(100, Math.round((currentMl / goalMl) * 100));

  return (
    <div className="rounded-3xl border border-blue-100 bg-gradient-to-b from-blue-50/70 to-white p-5 shadow-sm dark:border-blue-950/60 dark:from-blue-950/20 dark:to-slate-900 space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500 text-sm text-white shadow-sm">
            💧
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Hydration Tracker
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Essential for sports performance & adolescent recovery
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-bold text-blue-700 dark:text-blue-400">
            {currentMl} <span className="text-xs font-normal text-slate-500">/ {goalMl} ml</span>
          </div>
          <div className="text-[10px] text-slate-400">
            {glassesCount} of {totalGlassesGoal} glasses ({pct}%)
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Glass Icons Grid */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        {Array.from({ length: totalGlassesGoal }).map((_, i) => (
          <span
            key={i}
            className={`text-base transition ${
              i < glassesCount ? "opacity-100 scale-105" : "opacity-25 grayscale"
            }`}
            title={`Glass ${i + 1} (250 ml)`}
          >
            🥛
          </span>
        ))}
      </div>

      {/* Quick Add Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => addWater(250)}
          className="flex-1 rounded-xl border border-blue-200 bg-white py-2 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-300 transition"
        >
          + 250 ml (Glass)
        </button>
        <button
          onClick={() => addWater(500)}
          className="flex-1 rounded-xl border border-blue-200 bg-white py-2 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-300 transition"
        >
          + 500 ml (Bottle)
        </button>
        {currentMl > 0 && (
          <button
            onClick={() => addWater(-250)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400 transition"
          >
            - 250 ml
          </button>
        )}
      </div>
    </div>
  );
}
