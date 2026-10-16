import { useMemo } from "react";
import { useAppStore } from "../store/appStore";
import { computeDailyMicronutrients } from "../utils/micronutrients";
import type { Food } from "../types";

export function MicronutrientsModal({ onClose }: { onClose: () => void }) {
  const entries = useAppStore((s) => s.entries);
  const foods = useAppStore((s) => s.foods);

  const foodsMap = useMemo(() => {
    const map = new Map<string, Food>();
    for (const f of foods) map.set(f.id, f);
    return map;
  }, [foods]);

  const { reports } = useMemo(
    () => computeDailyMicronutrients(entries, foodsMap),
    [entries, foodsMap]
  );

  const macroTotals = useMemo(() => {
    const p = entries.reduce((acc, e) => acc + (e.protein || 0), 0);
    const c = entries.reduce((acc, e) => acc + (e.carbs || 0), 0);
    const f = entries.reduce((acc, e) => acc + (e.fat || 0), 0);
    const totalCals = p * 4 + c * 4 + f * 9;
    return {
      p,
      c,
      f,
      totalCals,
      pctP: totalCals > 0 ? Math.round(((p * 4) / totalCals) * 100) : 0,
      pctC: totalCals > 0 ? Math.round(((c * 4) / totalCals) * 100) : 0,
      pctF: totalCals > 0 ? Math.round(((f * 9) / totalCals) * 100) : 0,
    };
  }, [entries]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="flex max-h-[90vh] w-full max-w-[540px] flex-col rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🔬</span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Cronometer Micronutrient Audit
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Benchmarked against ICMR-NIN 2020 RDA for Indian Teenagers (13–17 yrs)
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-5 space-y-5">
          {/* Macronutrient Calorie Ratio Bar */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>Macronutrient Energy Distribution</span>
              <span className="text-slate-500">{Math.round(macroTotals.totalCals)} kcal</span>
            </div>
            <div className="mt-2.5 flex h-4 w-full overflow-hidden rounded-full">
              <div
                style={{ width: `${macroTotals.pctP}%` }}
                className="bg-emerald-500 transition-all"
                title={`Protein: ${macroTotals.pctP}%`}
              />
              <div
                style={{ width: `${macroTotals.pctC}%` }}
                className="bg-blue-500 transition-all"
                title={`Carbs: ${macroTotals.pctC}%`}
              />
              <div
                style={{ width: `${macroTotals.pctF}%` }}
                className="bg-amber-500 transition-all"
                title={`Fat: ${macroTotals.pctF}%`}
              />
            </div>
            <div className="mt-2.5 flex justify-between text-xs text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Protein {macroTotals.pctP}% ({Math.round(macroTotals.p)}g)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                Carbs {macroTotals.pctC}% ({Math.round(macroTotals.c)}g)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                Fat {macroTotals.pctF}% ({Math.round(macroTotals.f)}g)
              </span>
            </div>
          </div>

          {/* Micronutrient Items */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Vitamins & Minerals (ICMR Targets)
            </h3>
            {reports.map((item) => {
              const pctClamped = Math.min(100, item.percentage);
              let barColor = "bg-emerald-500";
              let badgeColor = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
              let badgeText = `${item.percentage}% RDA`;

              if (item.status === "low") {
                barColor = "bg-amber-500";
                badgeColor = "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
              } else if (item.status === "excess") {
                barColor = "bg-red-500";
                badgeColor = "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300";
                badgeText = "Upper Limit Exceeded";
              } else if (item.status === "optimal") {
                barColor = "bg-emerald-600";
                badgeText = `Optimal · ${item.percentage}%`;
              }

              return (
                <div
                  key={item.key}
                  className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.name}
                        </span>
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${badgeColor}`}>
                          {badgeText}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {item.current}
                      </span>
                      <span className="text-xs text-slate-500"> / {item.target} {item.unit}</span>
                    </div>
                  </div>

                  {/* Progress Meter */}
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                      style={{ width: `${pctClamped}%` }}
                    />
                  </div>

                  {/* Top food sources */}
                  {item.topSources.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 overflow-x-auto text-[11px] text-slate-500 dark:text-slate-400 no-scrollbar">
                      <span className="font-medium text-slate-600 dark:text-slate-300">Sources:</span>
                      {item.topSources.map((s, idx) => (
                        <span key={idx} className="rounded-md bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
                          {s.foodName}: {s.amount} {item.unit} ({s.pctOfTotal}%)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white shadow-md hover:bg-violet-700 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
