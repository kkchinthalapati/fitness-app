import { useState, useId } from "react";
import { useAppStore } from "../store/appStore";
import { WORKOUT_MET_MAP, calculateWorkoutCalories } from "../utils/workoutCalc";
import { parseStravaFile } from "../utils/strava";
import type { WorkoutEntry, WorkoutType } from "../types";
import { WORKOUT_LABELS } from "../types";

export function WorkoutModal({
  onClose,
  initialTab = "manual",
}: {
  onClose: () => void;
  initialTab?: "manual" | "strava_file" | "strava_api";
}) {
  const settings = useAppStore((s) => s.settings);
  const selectedDate = useAppStore((s) => s.selectedDate);
  const addWorkout = useAppStore((s) => s.addWorkout);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const syncStravaWorkouts = useAppStore((s) => s.syncStravaWorkouts);

  const fileInputId = useId();
  const [tab, setTab] = useState<"manual" | "strava_file" | "strava_api">(initialTab);

  // Manual form state
  const [sport, setSport] = useState<WorkoutType>("badminton");
  const [title, setTitle] = useState("Badminton Match");
  const [durationMin, setDurationMin] = useState(WORKOUT_MET_MAP.badminton.defaultDurationMin);
  const [distanceKm, setDistanceKm] = useState("");
  const [heartRate, setHeartRate] = useState("");

  // Strava File state
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileSuccess, setFileSuccess] = useState<string | null>(null);

  // Strava API state
  const [stravaToken, setStravaToken] = useState(settings.stravaAccessToken || "");
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSuccess, setApiSuccess] = useState<string | null>(null);

  const userWeightKg = settings.userProfile?.weightKg || 58;
  const estimatedCalories = calculateWorkoutCalories(sport, durationMin, userWeightKg);

  function handleSportChange(s: WorkoutType) {
    setSport(s);
    setTitle(WORKOUT_LABELS[s]);
    setDurationMin(WORKOUT_MET_MAP[s]?.defaultDurationMin || 30);
  }

  async function handleSaveManual() {
    const entry: WorkoutEntry = {
      id: `manual-workout-${Date.now()}`,
      date: selectedDate,
      title: title.trim() || WORKOUT_LABELS[sport],
      type: sport,
      durationMinutes: durationMin,
      caloriesBurned: estimatedCalories,
      distanceKm: distanceKm ? parseFloat(distanceKm) : undefined,
      avgHeartRate: heartRate ? parseInt(heartRate) : undefined,
      source: "manual",
      createdAt: Date.now(),
    };

    await addWorkout(entry);
    onClose();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    setFileSuccess(null);

    try {
      const text = await file.text();
      const workouts = parseStravaFile(text, file.name, userWeightKg);

      for (const w of workouts) {
        // Assign to current selected date if file has no date or user wants today
        if (!w.date) w.date = selectedDate;
        await addWorkout(w);
      }

      setFileSuccess(`Successfully imported ${workouts.length} workout(s) from "${file.name}"!`);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setFileError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSyncStravaAPI() {
    if (!stravaToken.trim() && !settings.stravaRefreshToken) return;
    setApiLoading(true);
    setApiError(null);
    setApiSuccess(null);

    try {
      if (stravaToken.trim() && stravaToken.trim() !== settings.stravaAccessToken) {
        await updateSettings({ stravaAccessToken: stravaToken.trim() });
      }

      const res = await syncStravaWorkouts();
      if (res.newCount > 0) {
        setApiSuccess(
          `Successfully synced ${res.newCount} new activit${res.newCount === 1 ? "y" : "ies"} (-${res.totalBurnedKcal} kcal)!`
        );
      } else {
        setApiSuccess("All activities are already up to date (0 new).");
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setApiLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="flex max-h-[90vh] w-full max-w-[500px] flex-col rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Log Workout & Strava Integration
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Subtracts burn from intake to calculate accurate Net Calories
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 p-2 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/40">
          <button
            onClick={() => setTab("manual")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
              tab === "manual"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            🏃 Manual Log
          </button>
          <button
            onClick={() => setTab("strava_file")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
              tab === "strava_file"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            📁 Strava GPX / TCX / JSON
          </button>
          <button
            onClick={() => setTab("strava_api")}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
              tab === "strava_api"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            ⚡ Strava API
          </button>
        </div>

        {/* Tab Content */}
        <div className="overflow-y-auto p-5">
          {tab === "manual" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select Sport / Activity
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(Object.keys(WORKOUT_LABELS) as WorkoutType[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleSportChange(st)}
                      className={`flex items-center justify-between rounded-xl border p-2.5 text-xs font-semibold text-left transition ${
                        sport === st
                          ? "border-violet-600 bg-violet-50 text-violet-900 dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-200"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300"
                      }`}
                    >
                      <span>{WORKOUT_LABELS[st]}</span>
                      <span className="text-[10px] text-slate-400">MET {WORKOUT_MET_MAP[st]?.met}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Activity Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={durationMin}
                    onChange={(e) => setDurationMin(Math.max(1, parseInt(e.target.value) || 1))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Distance (km)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 5.2"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Avg HR (bpm)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 145"
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              {/* Calculated Burn Preview */}
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-950 dark:bg-orange-950/20">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-orange-800 dark:text-orange-300">
                      Estimated Calorie Burn (MET {WORKOUT_MET_MAP[sport]?.met})
                    </span>
                    <div className="text-2xl font-black text-orange-600 dark:text-orange-400">
                      {estimatedCalories} kcal
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    Based on {userWeightKg} kg bodyweight
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveManual}
                className="w-full rounded-xl bg-orange-600 py-3 text-sm font-bold text-white shadow-md hover:bg-orange-700 transition"
              >
                Log Workout (-{estimatedCalories} Net kcal)
              </button>
            </div>
          )}

          {tab === "strava_file" && (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-violet-500 dark:border-slate-700 transition">
                <span className="text-4xl">📥</span>
                <h3 className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                  Upload Strava Activity File
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Supports GPX (GPS tracks), TCX (Garmin/Strava with HeartRate & Calories), and Strava JSON exports.
                </p>

                <label
                  htmlFor={fileInputId}
                  className="mt-4 inline-block cursor-pointer rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-violet-700 transition"
                >
                  Choose File (.gpx, .tcx, .json)
                </label>
                <input
                  id={fileInputId}
                  type="file"
                  accept=".gpx,.tcx,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {fileSuccess && (
                <div className="rounded-xl bg-emerald-100 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 animate-fadeIn">
                  ✓ {fileSuccess}
                </div>
              )}

              {fileError && (
                <div className="rounded-xl bg-red-100 p-3 text-xs font-semibold text-red-800 dark:bg-red-950/60 dark:text-red-300 animate-fadeIn">
                  ✕ {fileError}
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400 space-y-1.5">
                <div className="font-bold text-slate-700 dark:text-slate-300">How to get your Strava file:</div>
                <div>1. On strava.com, open your activity (Run, Ride, etc.).</div>
                <div>2. Click the <b>··· (More)</b> button → <b>Export GPX</b> or <b>Export Original (TCX)</b>.</div>
                <div>3. Drop it here! The app computes distance, MET pace, and calories burned with 100% offline privacy.</div>
              </div>
            </div>
          )}

          {tab === "strava_api" && (
            <div className="space-y-4">
              {settings.stravaRefreshToken ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      Strava Auto-Connector Active
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                    Your account is permanently linked with automatic token refresh. Workouts are auto-synced and deduplicated against your daily log.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Strava Personal Access Token
                    </label>
                    <input
                      type="password"
                      placeholder="Paste Strava Bearer Token"
                      value={stravaToken}
                      onChange={(e) => setStravaToken(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-3 text-xs text-orange-950 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200">
                    <div className="font-bold flex items-center gap-1.5 text-orange-800 dark:text-orange-300">
                      <span>⚡</span>
                      <span>Want seamless auto-logging?</span>
                    </div>
                    <p className="mt-1 text-[11px] text-orange-700 dark:text-orange-300">
                      Link your account in Settings with 1-click OAuth so you never have to paste temporary 6-hour tokens again.
                    </p>
                    <a
                      href="/settings"
                      onClick={() => onClose()}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-orange-700 transition"
                    >
                      <span>⚙️ Setup Auto-Connector in Settings</span>
                    </a>
                  </div>
                </div>
              )}

              {apiSuccess && (
                <div className="rounded-xl bg-emerald-100 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  ✓ {apiSuccess}
                </div>
              )}

              {apiError && (
                <div className="rounded-xl bg-red-100 p-3 text-xs font-semibold text-red-800 dark:bg-red-950/60 dark:text-red-300">
                  ✕ {apiError}
                </div>
              )}

              <button
                onClick={handleSyncStravaAPI}
                disabled={apiLoading || (!stravaToken.trim() && !settings.stravaRefreshToken)}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-md hover:bg-violet-700 disabled:opacity-50 transition"
              >
                {apiLoading ? "Syncing Activities..." : "Sync Recent Strava Activities"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
