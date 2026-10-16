import { useState, useMemo } from "react";
import { useAppStore } from "../store/appStore";
import {
  calculateBMI,
  calculateWeightProjection,
  computeWeightRollingAverage,
} from "../utils/weightTrends";
import type { WeightEntry } from "../types";

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function Trends() {
  const settings = useAppStore((s) => s.settings);
  const weightEntries = useAppStore((s) => s.weightEntries);
  const addWeightEntry = useAppStore((s) => s.addWeightEntry);
  const deleteWeightEntry = useAppStore((s) => s.deleteWeightEntry);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [logDate, setLogDate] = useState(getTodayStr);
  const [weightKg, setWeightKg] = useState(
    settings.userProfile?.weightKg ? String(settings.userProfile.weightKg) : "58"
  );
  const [waistCm, setWaistCm] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [notes, setNotes] = useState("");
  const [showLogForm, setShowLogForm] = useState(false);

  // Profile context
  const currentWeight = useMemo(() => {
    if (weightEntries.length > 0) {
      const sorted = [...weightEntries].sort((a, b) => b.date.localeCompare(a.date));
      return sorted[0].weightKg;
    }
    return settings.userProfile?.weightKg || 58;
  }, [weightEntries, settings.userProfile]);

  const heightCm = settings.userProfile?.heightCm || 168;
  const bmiInfo = useMemo(() => calculateBMI(currentWeight, heightCm), [currentWeight, heightCm]);

  // Rolling averages
  const rollingData = useMemo(() => computeWeightRollingAverage(weightEntries), [weightEntries]);

  // Projected weight loss based on deficit target or average
  const dailyDeficitTarget = settings.userProfile?.deficitTargetKcal || 350;
  const projection = useMemo(
    () => calculateWeightProjection(currentWeight, dailyDeficitTarget),
    [currentWeight, dailyDeficitTarget]
  );

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
    // Also sync to user profile for BMR/TDEE accuracy
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

  // SVG Chart Dimensions & Coordinates
  const chartPoints = useMemo(() => {
    if (rollingData.length < 2) return null;
    const weights = rollingData.map((d) => d.weightKg);
    const minW = Math.min(...weights) - 0.5;
    const maxW = Math.max(...weights) + 0.5;
    const rangeW = maxW - minW || 1;

    const width = 480;
    const height = 140;
    const padding = 20;

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
    return { coords, pathStr, rollingPathStr, minW, maxW, width, height };
  }, [rollingData]);

  return (
    <div className="mx-auto max-w-[560px] p-4 pb-28 space-y-4">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Trends & Deficit Projections
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Scientifically modeled weight trends & metabolic deficit forecasting
          </p>
        </div>
        <button
          onClick={() => setShowLogForm(!showLogForm)}
          className="rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700 transition"
        >
          {showLogForm ? "Cancel" : "+ Log Weight"}
        </button>
      </div>

      {/* Log Weight Form */}
      {showLogForm && (
        <div className="rounded-3xl border border-violet-200 bg-white p-5 shadow-lg dark:border-violet-900 dark:bg-slate-900 space-y-3 animate-fadeIn">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Log Body Weight & Measurements
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Date
              </label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Weight (kg)
              </label>
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
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Waist Circumference (cm)
              </label>
              <input
                type="number"
                step="0.5"
                placeholder="Optional"
                value={waistCm}
                onChange={(e) => setWaistCm(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Body Fat %
              </label>
              <input
                type="number"
                step="0.5"
                placeholder="Optional"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <input
            type="text"
            placeholder="Notes (e.g. Morning fasting, post badminton match)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
          />

          <button
            onClick={handleSaveWeight}
            className="w-full rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-700 transition"
          >
            Save Weight Entry
          </button>
        </div>
      )}

      {/* Overview Cards (Weight & BMI) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Current Weight Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Current Weight
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

        {/* BMI Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Body Mass Index (BMI)
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {bmiInfo.bmi}
            </span>
            <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {bmiInfo.label}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Asian-Indian standard cutoff (&lt;23 ideal)
          </div>
        </div>
      </div>

      {/* Deficit Forecasting Card */}
      <div className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50/70 to-white p-5 shadow-sm dark:border-violet-900/60 dark:from-violet-950/20 dark:to-slate-900 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-600 text-sm text-white shadow-sm">
              🎯
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Deficit Projections & Future Forecast
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                At your target {dailyDeficitTarget} kcal daily deficit (7,700 kcal / kg)
              </p>
            </div>
          </div>
          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-extrabold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
            {projection.weeklyChangeKg > 0 ? "+" : ""}{projection.weeklyChangeKg} kg/wk
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="rounded-2xl border border-violet-100 bg-white p-3 dark:border-violet-900/40 dark:bg-slate-800/80">
            <div className="text-[11px] text-slate-500">In 4 Weeks</div>
            <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              {projection.projectedWeight4WeeksKg} kg
            </div>
            <div className={`text-[10px] font-bold ${projection.weeklyChangeKg <= 0 ? "text-emerald-600" : "text-amber-600"}`}>
              {projection.weeklyChangeKg > 0 ? "+" : ""}{(projection.weeklyChangeKg * 4).toFixed(1)} kg
            </div>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-white p-3 dark:border-violet-900/40 dark:bg-slate-800/80">
            <div className="text-[11px] text-slate-500">In 8 Weeks</div>
            <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              {projection.projectedWeight8WeeksKg} kg
            </div>
            <div className={`text-[10px] font-bold ${projection.weeklyChangeKg <= 0 ? "text-emerald-600" : "text-amber-600"}`}>
              {projection.weeklyChangeKg > 0 ? "+" : ""}{(projection.weeklyChangeKg * 8).toFixed(1)} kg
            </div>
          </div>

          <div className="rounded-2xl border border-violet-100 bg-white p-3 dark:border-violet-900/40 dark:bg-slate-800/80">
            <div className="text-[11px] text-slate-500">In 12 Weeks</div>
            <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              {projection.projectedWeight12WeeksKg} kg
            </div>
            <div className={`text-[10px] font-bold ${projection.weeklyChangeKg <= 0 ? "text-emerald-600" : "text-amber-600"}`}>
              {projection.weeklyChangeKg > 0 ? "+" : ""}{(projection.weeklyChangeKg * 12).toFixed(1)} kg
            </div>
          </div>
        </div>
      </div>

      {/* Weight History Chart */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Weight Trend & 7-Day Rolling Average
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
            {weightEntries.length} data point{weightEntries.length === 1 ? "" : "s"}
          </span>
        </div>

        {chartPoints ? (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartPoints.width} ${chartPoints.height}`}
              className="w-full h-36 fill-none"
            >
              {/* 7-day rolling average smoothed curve (dashed) */}
              <path
                d={chartPoints.rollingPathStr}
                strokeWidth="2"
                strokeDasharray="4 3"
                className="stroke-emerald-500"
              />
              {/* Daily weigh-in trend line */}
              <path
                d={chartPoints.pathStr}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="stroke-violet-600"
              />
              {/* Data points */}
              {chartPoints.coords.map((pt, i) => (
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
            Log at least 2 weight entries to generate your visual trend graph.
          </div>
        )}
      </div>

      {/* History Table */}
      {weightEntries.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Measurement Log History
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[...weightEntries]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2.5 text-xs"
                >
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
                  >
                    ✕
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
