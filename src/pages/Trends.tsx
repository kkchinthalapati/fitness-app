import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "../store/appStore";
import { dbOps } from "../db";
import {
  calculateBMI,
  computeWeightRollingAverage,
} from "../utils/weightTrends";
import type { FoodEntry, WaterEntry, WeightEntry, WorkoutEntry } from "../types";

function getTodayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getDateNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function Trends() {
  const settings = useAppStore((s) => s.settings);
  const weightEntries = useAppStore((s) => s.weightEntries);
  const addWeightEntry = useAppStore((s) => s.addWeightEntry);
  const deleteWeightEntry = useAppStore((s) => s.deleteWeightEntry);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [activeTab, setActiveTab] = useState<"nutrition" | "workouts" | "body">("nutrition");
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(7);

  // Historical data loaded from IndexedDB
  const [allEntries, setAllEntries] = useState<FoodEntry[]>([]);
  const [allWorkouts, setAllWorkouts] = useState<WorkoutEntry[]>([]);
  const [allWater, setAllWater] = useState<WaterEntry[]>([]);

  // Form State for Weight
  const [logDate, setLogDate] = useState(getTodayStr);
  const [weightKg, setWeightKg] = useState(
    settings.userProfile?.weightKg ? String(settings.userProfile.weightKg) : "58"
  );
  const [waistCm, setWaistCm] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [notes, setNotes] = useState("");
  const [showLogForm, setShowLogForm] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [entries, workouts, water] = await Promise.all([
          dbOps.getAllEntries(),
          dbOps.getAllWorkouts(),
          dbOps.getAllWaterEntries(),
        ]);
        if (mounted) {
          setAllEntries(entries);
          setAllWorkouts(workouts);
          setAllWater(water);
        }
      } catch (err) {
        console.error("Failed to load historical analytics data:", err);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [rangeDays]);

  // Date range boundaries
  const startDateStr = useMemo(() => getDateNDaysAgo(rangeDays - 1), [rangeDays]);
  const todayStr = useMemo(() => getTodayStr(), []);

  // Filtered data in range
  const entriesInRange = useMemo(() => {
    return allEntries.filter((e) => e.date >= startDateStr && e.date <= todayStr);
  }, [allEntries, startDateStr, todayStr]);

  const workoutsInRange = useMemo(() => {
    return allWorkouts.filter((w) => w.date >= startDateStr && w.date <= todayStr);
  }, [allWorkouts, startDateStr, todayStr]);

  const waterInRange = useMemo(() => {
    return allWater.filter((w) => w.date >= startDateStr && w.date <= todayStr);
  }, [allWater, startDateStr, todayStr]);

  // 1. Nutrition & Habits Analytics
  const nutritionAnalytics = useMemo(() => {
    const datesMap = new Map<string, { calories: number; protein: number; carbs: number; fat: number; fiber: number; items: number }>();
    const foodCounts = new Map<string, { count: number; name: string }>();

    for (const e of entriesInRange) {
      const cur = datesMap.get(e.date) || { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, items: 0 };
      cur.calories += e.calories;
      cur.protein += e.protein;
      cur.carbs += e.carbs;
      cur.fat += e.fat;
      cur.fiber += e.fiber || 0;
      cur.items += 1;
      datesMap.set(e.date, cur);

      const f = foodCounts.get(e.foodId) || { count: 0, name: e.foodName };
      f.count += 1;
      foodCounts.set(e.foodId, f);
    }

    const loggedDaysCount = datesMap.size;
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFiber = 0;

    for (const day of datesMap.values()) {
      totalCalories += day.calories;
      totalProtein += day.protein;
      totalFiber += day.fiber;
    }

    const avgCaloriesLogged = loggedDaysCount > 0 ? Math.round(totalCalories / loggedDaysCount) : 0;
    const avgProteinLogged = loggedDaysCount > 0 ? Math.round((totalProtein / loggedDaysCount) * 10) / 10 : 0;
    const avgFiberLogged = loggedDaysCount > 0 ? Math.round((totalFiber / loggedDaysCount) * 10) / 10 : 0;

    const totalWaterMl = waterInRange.reduce((acc, w) => acc + w.amountMl, 0);
    const avgWaterMl = loggedDaysCount > 0 ? Math.round(totalWaterMl / loggedDaysCount) : 0;

    const topFoods = Array.from(foodCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Build timeline of every calendar day in range
    const timeline: { date: string; shortDate: string; calories: number; logged: boolean }[] = [];
    const base = new Date(todayStr + "T12:00:00");
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const short = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
      const record = datesMap.get(dateKey);
      timeline.push({
        date: dateKey,
        shortDate: short,
        calories: record ? Math.round(record.calories) : 0,
        logged: Boolean(record),
      });
    }

    return {
      loggedDaysCount,
      totalCalories,
      avgCaloriesLogged,
      avgProteinLogged,
      avgFiberLogged,
      avgWaterMl,
      topFoods,
      timeline,
    };
  }, [entriesInRange, waterInRange, rangeDays, todayStr]);

  // 2. Workouts Analytics
  const workoutAnalytics = useMemo(() => {
    let totalMinutes = 0;
    let totalDistanceKm = 0;
    let totalBurn = 0;
    const typeDistribution = new Map<string, number>();

    for (const w of workoutsInRange) {
      totalMinutes += w.durationMinutes || 0;
      totalDistanceKm += w.distanceKm || 0;
      totalBurn += w.caloriesBurned || 0;
      const count = typeDistribution.get(w.type) || 0;
      typeDistribution.set(w.type, count + 1);
    }

    const sportsList = Array.from(typeDistribution.entries()).map(([type, count]) => ({
      type,
      count,
    }));

    return {
      totalSessions: workoutsInRange.length,
      totalMinutes,
      totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
      totalBurn: Math.round(totalBurn),
      sportsList,
    };
  }, [workoutsInRange]);

  // 3. Body & Rolling Weight Averages
  const currentWeight = useMemo(() => {
    if (weightEntries.length > 0) {
      const sorted = [...weightEntries].sort((a, b) => b.date.localeCompare(a.date));
      return sorted[0].weightKg;
    }
    return settings.userProfile?.weightKg || 58;
  }, [weightEntries, settings.userProfile]);

  const heightCm = settings.userProfile?.heightCm || 168;
  const bmiInfo = useMemo(() => calculateBMI(currentWeight, heightCm), [currentWeight, heightCm]);
  const rollingData = useMemo(() => computeWeightRollingAverage(weightEntries), [weightEntries]);

  async function handleSaveWeight() {
    const val = parseFloat(weightKg);
    if (isNaN(val) || val <= 0) return;

    const entry: WeightEntry = {
      id: `weight-${Date.now()}`,
      date: logDate,
      weightKg: Number(val.toFixed(1)),
      waistCm: waistCm ? parseFloat(waistCm) : undefined,
      bodyFatPct: bodyFat ? parseFloat(bodyFat) : undefined,
      notes: notes.trim() || undefined,
      createdAt: Date.now(),
    };

    await addWeightEntry(entry);
    if (settings.userProfile) {
      await updateSettings({
        userProfile: { ...settings.userProfile, weightKg: Number(val.toFixed(1)) },
      });
    }

    setShowLogForm(false);
    setWaistCm("");
    setBodyFat("");
    setNotes("");
  }

  // Weight SVG Chart Coordinates
  const weightChartPoints = useMemo(() => {
    if (rollingData.length < 2) return null;
    const weights = rollingData.map((d) => d.weightKg);
    const minW = Math.min(...weights) - 0.5;
    const maxW = Math.max(...weights) + 0.5;
    const rangeW = maxW - minW || 1;

    const width = 480;
    const height = 140;
    const padding = 24;

    const coords = rollingData.map((d, idx) => {
      const x = padding + (idx / (rollingData.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((d.weightKg - minW) / rangeW) * (height - 2 * padding);
      return { x, y, date: d.date, weightKg: d.weightKg, rollingAvgKg: d.rollingAvgKg };
    });

    const pathStr = coords.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");
    const rollingPathStr = coords
      .map((pt, i) => {
        const ry = height - padding - ((pt.rollingAvgKg - minW) / rangeW) * (height - 2 * padding);
        return `${i === 0 ? "M" : "L"} ${pt.x} ${ry}`;
      })
      .join(" ");
    return { coords, pathStr, rollingPathStr, width, height, minW, maxW };
  }, [rollingData]);

  const weightTrackingEnabled = settings.enableWeightTracking !== false;

  return (
    <div className="mx-auto max-w-[640px] p-4 pb-28 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Trends & Progress Analytics
          </h1>
          <p className="text-xs text-slate-500">
            Real logged nutrition patterns, workout frequency & long-term consistency
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 text-xs font-semibold">
          <button
            onClick={() => setRangeDays(7)}
            className={`rounded-lg px-2.5 py-1 transition ${
              rangeDays === 7 ? "bg-violet-600 text-white" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            7d
          </button>
          <button
            onClick={() => setRangeDays(14)}
            className={`rounded-lg px-2.5 py-1 transition ${
              rangeDays === 14 ? "bg-violet-600 text-white" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            14d
          </button>
          <button
            onClick={() => setRangeDays(30)}
            className={`rounded-lg px-2.5 py-1 transition ${
              rangeDays === 30 ? "bg-violet-600 text-white" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            30d
          </button>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex rounded-2xl border border-slate-200 bg-white p-1 shadow-2xs dark:border-slate-800 dark:bg-slate-900 text-xs font-bold">
        <button
          onClick={() => setActiveTab("nutrition")}
          className={`flex-1 rounded-xl py-2 transition flex items-center justify-center gap-1.5 ${
            activeTab === "nutrition"
              ? "bg-violet-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <span>🥗</span> Nutrition & Habits
        </button>
        <button
          onClick={() => setActiveTab("workouts")}
          className={`flex-1 rounded-xl py-2 transition flex items-center justify-center gap-1.5 ${
            activeTab === "workouts"
              ? "bg-violet-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <span>⚡</span> Workouts
        </button>
        <button
          onClick={() => setActiveTab("body")}
          className={`flex-1 rounded-xl py-2 transition flex items-center justify-center gap-1.5 ${
            activeTab === "body"
              ? "bg-violet-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          }`}
        >
          <span>⚖️</span> Body & Growth
        </button>
      </div>

      {/* 1. NUTRITION & HABITS TAB */}
      {activeTab === "nutrition" && (
        <div className="space-y-4 animate-fadeIn">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-3xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[11px] font-medium text-slate-500">Days Logged</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {nutritionAnalytics.loggedDaysCount} <span className="text-xs font-normal text-slate-400">/ {rangeDays}d</span>
              </div>
              <div className="text-[10px] text-slate-400">
                {Math.round((nutritionAnalytics.loggedDaysCount / rangeDays) * 100)}% consistency
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[11px] font-medium text-slate-500">Daily Intake Avg</div>
              <div className="text-xl font-black text-violet-600 dark:text-violet-400 mt-0.5">
                {nutritionAnalytics.avgCaloriesLogged}
              </div>
              <div className="text-[10px] text-slate-400">kcal on logged days</div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[11px] font-medium text-slate-500">Daily Protein Avg</div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {nutritionAnalytics.avgProteinLogged}g
              </div>
              <div className="text-[10px] text-slate-400">
                Fiber: {nutritionAnalytics.avgFiberLogged}g avg
              </div>
            </div>
          </div>

          {/* Daily Intake Timeline Chart */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Daily Energy Intake Pattern
                </h3>
                <p className="text-[11px] text-slate-500">
                  Target guide: {settings.calorieGoal} kcal/day · Empty bars represent unlogged days (not zero food)
                </p>
              </div>
            </div>

            <div className="flex items-end gap-1.5 h-36 pt-4 px-1 overflow-x-auto">
              {nutritionAnalytics.timeline.map((day) => {
                const maxDisplay = Math.max(settings.calorieGoal * 1.3, 2600);
                const heightPct = day.logged
                  ? Math.min(100, Math.round((day.calories / maxDisplay) * 100))
                  : 6;

                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center min-w-[28px] h-full justify-end">
                    <div className="w-full flex items-end justify-center h-28 relative">
                      {/* Target dashed line indicator */}
                      <div
                        className="absolute w-full border-t border-dashed border-violet-400 dark:border-violet-600 pointer-events-none opacity-40"
                        style={{ bottom: `${Math.round((settings.calorieGoal / maxDisplay) * 100)}%` }}
                      />

                      {day.logged ? (
                        <div
                          className="w-full max-w-[28px] rounded-t-lg bg-violet-600 dark:bg-violet-500 transition-all hover:opacity-80"
                          style={{ height: `${heightPct}%` }}
                          title={`${day.date}: ${day.calories} kcal`}
                        />
                      ) : (
                        <div
                          className="w-full max-w-[28px] rounded-t-lg border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/30"
                          style={{ height: `${heightPct}%` }}
                          title={`${day.date}: Not logged`}
                        />
                      )}
                    </div>
                    <span className="text-[9px] font-semibold text-slate-500 mt-1 truncate">
                      {day.shortDate.split(" ")[0]}
                    </span>
                    <span className="text-[9px] text-slate-400 leading-none">
                      {day.logged ? `${day.calories}` : "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Frequently Logged Foods */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Most Frequently Logged Foods
            </h3>
            {nutritionAnalytics.topFoods.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No food entries recorded in this time window.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {nutritionAnalytics.topFoods.map((f, i) => (
                  <div key={i} className="flex items-center justify-between py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">{f.name}</span>
                    </div>
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                      Logged {f.count}x
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. WORKOUTS TAB */}
      {activeTab === "workouts" && (
        <div className="space-y-4 animate-fadeIn">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-3xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[11px] font-medium text-slate-500">Sessions</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {workoutAnalytics.totalSessions}
              </div>
              <div className="text-[10px] text-slate-400">in past {rangeDays} days</div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[11px] font-medium text-slate-500">Active Minutes</div>
              <div className="text-xl font-black text-orange-600 dark:text-orange-400 mt-0.5">
                {workoutAnalytics.totalMinutes}m
              </div>
              <div className="text-[10px] text-slate-400">
                {Math.round(workoutAnalytics.totalMinutes / (rangeDays / 7))} min/wk pace
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
              <div className="text-[11px] font-medium text-slate-500">
                {!settings.hideExerciseCalories ? "Est. Movement Energy" : "Distance Covered"}
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {!settings.hideExerciseCalories ? `${workoutAnalytics.totalBurn} kcal` : `${workoutAnalytics.totalDistanceKm} km`}
              </div>
              <div className="text-[10px] text-slate-400">
                {!settings.hideExerciseCalories ? `${workoutAnalytics.totalDistanceKm} km total` : "Cardio movement"}
              </div>
            </div>
          </div>

          {/* Activity Breakdown */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Activity & Sport Frequency
            </h3>
            {workoutAnalytics.sportsList.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No activities recorded in this time range.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {workoutAnalytics.sportsList.map((s) => (
                  <div
                    key={s.type}
                    className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60"
                  >
                    <div className="text-[11px] font-bold uppercase text-slate-500">{s.type}</div>
                    <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                      {s.count} {s.count === 1 ? "session" : "sessions"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Sessions List */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Session History ({workoutsInRange.length})
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {workoutsInRange.slice(0, 10).map((w) => (
                <div key={w.id} className="py-2.5 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">{w.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {w.date} · {w.durationMinutes} min
                      {w.distanceKm ? ` · ${w.distanceKm} km` : ""}
                      {w.perceivedEffort ? ` · RPE ${w.perceivedEffort}/10` : ""}
                      {w.exercises?.length ? ` · ${w.exercises.length} strength exercises` : ""}
                    </div>
                  </div>
                  {!settings.hideExerciseCalories && (
                    <span className="font-bold text-orange-600 dark:text-orange-400 text-xs">
                      ~{w.caloriesBurned} kcal
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. BODY & GROWTH TAB */}
      {activeTab === "body" && (
        <div className="space-y-4 animate-fadeIn">
          {!weightTrackingEnabled ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-center space-y-3">
              <div className="text-3xl">🌿</div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Weight Tracking is Currently Inactive
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Your application is configured for nonjudgmental nutrition logging, strength development, and stamina consistency. You can enable optional weight tracking in Settings anytime.
              </p>
              <button
                onClick={() => updateSettings({ enableWeightTracking: true })}
                className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700 transition"
              >
                Enable Weight Tracking
              </button>
            </div>
          ) : (
            <>
              {/* Header with Log Weight Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Body Weight & Development
                  </h3>
                  <p className="text-xs text-slate-500">
                    7-day rolling average to filter natural hydration fluctuations
                  </p>
                </div>
                <button
                  onClick={() => setShowLogForm(!showLogForm)}
                  className="rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 transition"
                >
                  {showLogForm ? "Cancel" : "+ Log Measurement"}
                </button>
              </div>

              {/* Log Form */}
              {showLogForm && (
                <div className="rounded-3xl border border-violet-200 bg-white p-5 shadow-lg dark:border-violet-900 dark:bg-slate-900 space-y-3 animate-fadeIn">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Record Body Measurement
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Date</label>
                      <input
                        type="date"
                        value={logDate}
                        onChange={(e) => setLogDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Weight (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Waist cm (optional)"
                      value={waistCm}
                      onChange={(e) => setWaistCm(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Body Fat % (optional)"
                      value={bodyFat}
                      onChange={(e) => setBodyFat(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  <input
                    type="text"
                    placeholder="Notes (e.g. morning, post training)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />

                  <button
                    onClick={handleSaveWeight}
                    className="w-full rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-700 transition"
                  >
                    Save Measurement
                  </button>
                </div>
              )}

              {/* Overview Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Latest Weight
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {currentWeight}
                    </span>
                    <span className="text-xs font-bold text-slate-500">kg</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Height: {heightCm} cm
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Adolescent Context
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                      {bmiInfo.bmi}
                    </span>
                    <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Developing Youth
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {bmiInfo.notice}
                  </div>
                </div>
              </div>

              {/* Smoothed Trend Chart */}
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Weight Trend & 7-Day Rolling Smoothed Curve
                    </h3>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-violet-600 inline-block" /> Daily Weigh-in
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-0.5 w-3 border-b-2 border-dashed border-emerald-500 inline-block" /> 7-day Rolling Trend
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">
                    {weightEntries.length} record{weightEntries.length === 1 ? "" : "s"}
                  </span>
                </div>

                {weightChartPoints ? (
                  <div className="w-full overflow-x-auto">
                    <svg
                      viewBox={`0 0 ${weightChartPoints.width} ${weightChartPoints.height}`}
                      className="w-full h-36 fill-none"
                    >
                      <path
                        d={weightChartPoints.rollingPathStr}
                        strokeWidth="2"
                        strokeDasharray="4 3"
                        className="stroke-emerald-500"
                      />
                      <path
                        d={weightChartPoints.pathStr}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="stroke-violet-600"
                      />
                      {weightChartPoints.coords.map((pt, i) => (
                        <g key={i}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="4"
                            className="fill-violet-600 stroke-white dark:stroke-slate-900 stroke-2"
                          />
                          <text
                            x={pt.x}
                            y={pt.y - 8}
                            textAnchor="middle"
                            className="text-[9px] font-bold fill-slate-700 dark:fill-slate-300 stroke-none"
                          >
                            {pt.weightKg}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/30">
                    Log at least 2 measurements to view your smoothed rolling average.
                  </div>
                )}
              </div>

              {/* Measurement History Table */}
              {weightEntries.length > 0 && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Measurement Log History
                  </h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {[...weightEntries]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between py-2.5 text-xs">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {entry.weightKg} kg
                              {entry.waistCm ? ` · Waist: ${entry.waistCm} cm` : ""}
                              {entry.bodyFatPct ? ` · BF: ${entry.bodyFatPct}%` : ""}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {entry.date} {entry.notes ? ` · "${entry.notes}"` : ""}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteWeightEntry(entry.id)}
                            className="rounded-full px-2 py-1 text-slate-400 hover:text-red-600 transition"
                            title="Delete entry"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
