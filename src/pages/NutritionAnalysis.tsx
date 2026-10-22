import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "../store/appStore";
import { dbOps } from "../db";
import { computeDailyMicronutrients, ICMR_TEEN_RDA } from "../utils/micronutrients";
import type { Food, FoodEntry, Micronutrients } from "../types";

export function NutritionAnalysis() {
  const selectedDate = useAppStore((s) => s.selectedDate);
  const currentEntries = useAppStore((s) => s.entries);
  const foods = useAppStore((s) => s.foods);

  const [dateRangeMode, setDateRangeMode] = useState<"day" | "week" | "month">("day");
  const [multiDayEntries, setMultiDayEntries] = useState<FoodEntry[]>([]);
  const rangeEntries = dateRangeMode === "day" ? currentEntries : multiDayEntries;

  const [selectedNutrientKey, setSelectedNutrientKey] = useState<
    keyof Micronutrients | "fiber" | "protein" | null
  >("protein");

  const foodsMap = useMemo(() => {
    const map = new Map<string, Food>();
    for (const f of foods) map.set(f.id, f);
    return map;
  }, [foods]);

  // Load multi-day entries if week or month is selected
  useEffect(() => {
    if (dateRangeMode === "day") return;

    let isMounted = true;
    async function loadMultiDay() {
      const daysCount = dateRangeMode === "week" ? 7 : 30;
      const all: FoodEntry[] = [];
      const base = new Date(selectedDate + "T12:00:00");

      for (let i = 0; i < daysCount; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const dayEntries = await dbOps.getEntriesByDate(dateStr);
        all.push(...dayEntries);
      }

      if (isMounted) {
        setMultiDayEntries(all);
      }
    }

    loadMultiDay();
    return () => {
      isMounted = false;
    };
  }, [dateRangeMode, selectedDate]);

  // Number of distinct calendar days in range vs logged days
  const loggedDaysCount = useMemo(() => {
    const setOfDates = new Set(rangeEntries.map((e) => e.date));
    return Math.max(1, setOfDates.size);
  }, [rangeEntries]);

  // Compute micronutrients report
  const { reports } = useMemo(() => {
    return computeDailyMicronutrients(rangeEntries, foodsMap);
  }, [rangeEntries, foodsMap]);

  // Scale reports by number of logged days if in multi-day mode (so report shows daily average)
  const normalizedReports = useMemo(() => {
    if (dateRangeMode === "day" || loggedDaysCount <= 1) return reports;
    return reports.map((r) => {
      const dailyAvg = Math.round((r.current / loggedDaysCount) * 10) / 10;
      const pct = Math.round((dailyAvg / r.target) * 100);
      let status: "optimal" | "good" | "low" | "excess" = "good";
      if (ICMR_TEEN_RDA[r.key]?.isUpperLimitOnly) {
        status = dailyAvg > r.target ? "excess" : "optimal";
      } else {
        if (pct >= 90) status = "optimal";
        else if (pct >= 60) status = "good";
        else status = "low";
      }
      return {
        ...r,
        current: dailyAvg,
        percentage: pct,
        status,
      };
    });
  }, [reports, dateRangeMode, loggedDaysCount]);

  // Macronutrient Calorie Breakdown
  const macroBreakdown = useMemo(() => {
    const p = rangeEntries.reduce((sum, e) => sum + (e.protein || 0), 0) / loggedDaysCount;
    const c = rangeEntries.reduce((sum, e) => sum + (e.carbs || 0), 0) / loggedDaysCount;
    const f = rangeEntries.reduce((sum, e) => sum + (e.fat || 0), 0) / loggedDaysCount;
    const totalCals = p * 4 + c * 4 + f * 9;
    return {
      proteinGrams: Math.round(p * 10) / 10,
      carbsGrams: Math.round(c * 10) / 10,
      fatGrams: Math.round(f * 10) / 10,
      totalCalories: Math.round(totalCals),
      pctP: totalCals > 0 ? Math.round(((p * 4) / totalCals) * 100) : 0,
      pctC: totalCals > 0 ? Math.round(((c * 4) / totalCals) * 100) : 0,
      pctF: totalCals > 0 ? Math.round(((f * 9) / totalCals) * 100) : 0,
    };
  }, [rangeEntries, loggedDaysCount]);

  // Currently selected nutrient details
  const activeReport = useMemo(() => {
    if (!selectedNutrientKey) return null;
    return normalizedReports.find((r) => r.key === selectedNutrientKey) || null;
  }, [normalizedReports, selectedNutrientKey]);

  // Data completeness check
  const dataCompleteness = useMemo(() => {
    if (rangeEntries.length === 0) return { measuredEntriesCount: 0, totalEntries: 0, pct: 0 };
    let measured = 0;
    for (const e of rangeEntries) {
      const food = foodsMap.get(e.foodId);
      if (food?.micronutrients && Object.keys(food.micronutrients).length > 0) {
        measured++;
      }
    }
    return {
      measuredEntriesCount: measured,
      totalEntries: rangeEntries.length,
      pct: Math.round((measured / rangeEntries.length) * 100),
    };
  }, [rangeEntries, foodsMap]);

  return (
    <div className="mx-auto max-w-[640px] p-4 pb-28 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Nutrition & Micronutrient Analysis
          </h1>
          <p className="text-xs text-slate-500">
            Cronometer-grade transparency benchmarked to ICMR-NIN 2020 RDA (Indian Teens 13–17 yrs)
          </p>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={() => setDateRangeMode("day")}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
            dateRangeMode === "day"
              ? "bg-violet-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          Selected Date ({selectedDate})
        </button>
        <button
          onClick={() => setDateRangeMode("week")}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
            dateRangeMode === "week"
              ? "bg-violet-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          Past 7 Days (Daily Avg)
        </button>
        <button
          onClick={() => setDateRangeMode("month")}
          className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
            dateRangeMode === "month"
              ? "bg-violet-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          Past 30 Days (Daily Avg)
        </button>
      </div>

      {dateRangeMode !== "day" && (
        <div className="text-[11px] text-slate-400 px-1">
          Averaged across {loggedDaysCount} logged day{loggedDaysCount === 1 ? "" : "s"} in this period. Unlogged calendar days are not counted as 0 intake.
        </div>
      )}

      {/* Macronutrient Distribution Bar */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-900 dark:text-white">Macronutrient Energy Ratio</span>
          <span className="text-slate-500 font-semibold">{macroBreakdown.totalCalories} kcal daily avg</span>
        </div>

        <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            style={{ width: `${macroBreakdown.pctP}%` }}
            className="bg-emerald-500 transition-all"
            title={`Protein: ${macroBreakdown.pctP}%`}
          />
          <div
            style={{ width: `${macroBreakdown.pctC}%` }}
            className="bg-blue-500 transition-all"
            title={`Carbs: ${macroBreakdown.pctC}%`}
          />
          <div
            style={{ width: `${macroBreakdown.pctF}%` }}
            className="bg-amber-500 transition-all"
            title={`Fat: ${macroBreakdown.pctF}%`}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-1 text-xs">
          <div className="rounded-2xl bg-emerald-50/60 p-2.5 border border-emerald-100 dark:border-emerald-950 dark:bg-emerald-950/20">
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">PROTEIN</span>
            <div className="text-base font-black text-emerald-900 dark:text-white">
              {macroBreakdown.proteinGrams}g
            </div>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">{macroBreakdown.pctP}% cals</span>
          </div>
          <div className="rounded-2xl bg-blue-50/60 p-2.5 border border-blue-100 dark:border-blue-950 dark:bg-blue-950/20">
            <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300">CARBS</span>
            <div className="text-base font-black text-blue-900 dark:text-white">
              {macroBreakdown.carbsGrams}g
            </div>
            <span className="text-[10px] text-blue-700 dark:text-blue-400 font-semibold">{macroBreakdown.pctC}% cals</span>
          </div>
          <div className="rounded-2xl bg-amber-50/60 p-2.5 border border-amber-100 dark:border-amber-950 dark:bg-amber-950/20">
            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300">FAT</span>
            <div className="text-base font-black text-amber-900 dark:text-white">
              {macroBreakdown.fatGrams}g
            </div>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">{macroBreakdown.pctF}% cals</span>
          </div>
        </div>
      </div>

      {/* Data Quality & Honest Attribution Notice */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 flex items-center justify-between">
        <div>
          <span className="font-bold text-slate-800 dark:text-slate-200">Data Completeness: </span>
          <span>{dataCompleteness.measuredEntriesCount} of {dataCompleteness.totalEntries} entries have full ICMR laboratory micronutrient data ({dataCompleteness.pct}%).</span>
        </div>
        <span className="text-[10px] font-bold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 px-2 py-1 rounded-md">
          ICMR IFCT 2017
        </span>
      </div>

      {/* INTERACTIVE NUTRIENT INSPECTOR CARD */}
      {activeReport && (
        <div className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-sm dark:border-violet-900/60 dark:from-violet-950/30 dark:to-slate-900 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-600 text-sm text-white shadow-sm">
                🔬
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeReport.name} Contribution Inspector
                </h3>
                <p className="text-[11px] text-slate-500">
                  {activeReport.description}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-black text-violet-700 dark:text-violet-300">
                {activeReport.current} {activeReport.unit}
              </span>
              <div className="text-[10px] text-slate-400">Target: {activeReport.target} {activeReport.unit} ({activeReport.percentage}%)</div>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Top Contributing Foods in Selected Period:
            </div>
            {activeReport.topSources.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No food records with reported {activeReport.name} in this period.</p>
            ) : (
              activeReport.topSources.map((source, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl bg-white p-2.5 text-xs shadow-2xs dark:bg-slate-800"
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                    {source.foodName}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {source.amount} {activeReport.unit}
                    </span>
                    <span className="text-[10px] text-violet-600 font-bold ml-1.5">
                      ({source.pctOfTotal}%)
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* FULL MICRONUTRIENT AUDIT TABLE */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Daily Micronutrient Breakdown
          </h3>
          <span className="text-[11px] text-slate-400">Click a nutrient to inspect food sources</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {normalizedReports.map((report) => {
            const isSelected = selectedNutrientKey === report.key;
            return (
              <button
                key={report.key}
                type="button"
                onClick={() => setSelectedNutrientKey(report.key)}
                className={`w-full py-3 text-left transition flex flex-col gap-1.5 px-2 rounded-xl ${
                  isSelected
                    ? "bg-violet-50/80 dark:bg-violet-950/40"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {report.name}
                    </span>
                    {report.status === "optimal" ? (
                      <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        OPTIMAL
                      </span>
                    ) : report.status === "excess" ? (
                      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        EXCEEDS LIMIT
                      </span>
                    ) : report.status === "low" ? (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        LOW
                      </span>
                    ) : (
                      <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        GOOD
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900 dark:text-white">
                      {report.current} <span className="text-[10px] font-normal text-slate-400">{report.unit}</span>
                    </span>
                    <span className="text-[11px] text-slate-500 ml-1.5">
                      / {report.target} {report.unit} ({report.percentage}%)
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    style={{ width: `${Math.min(100, report.percentage)}%` }}
                    className={`h-full rounded-full transition-all ${
                      report.status === "excess"
                        ? "bg-amber-500"
                        : report.status === "optimal"
                        ? "bg-emerald-500"
                        : report.status === "low"
                        ? "bg-violet-400"
                        : "bg-blue-500"
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Adolescent Guidance Notice */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-850 dark:text-slate-400 space-y-1.5">
        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <span>💡</span>
          <span>Adolescent Nutritional Benchmark Notice</span>
        </div>
        <p>
          Reference values in this view are based on the <strong>ICMR-NIN 2020 Nutrient Requirements for Indian Adolescents</strong>. Teenage bodies require ample calcium and protein to fuel skeletal growth spurts, along with adequate iron for red blood cell synthesis and cognitive focus.
        </p>
        <p className="text-[11px] text-slate-400 pt-0.5">
          These benchmarks are informative guides. Individual growth and athletic demands vary; consult a registered dietitian for personalized clinical needs.
        </p>
      </div>
    </div>
  );
}
