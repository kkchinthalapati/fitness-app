import { useState, useEffect } from "react";
import { useAppStore } from "../store/appStore";
import { getDB, dbOps, DB_VERSION } from "../db";
import {
  calculateBMR,
  calculateTDEE,
  calculateTargetCalories,
  ACTIVITY_LABELS,
  GOAL_LABELS,
} from "../utils/energyBalance";
import { getStravaAuthorizeUrl } from "../utils/strava";
import type { ActivityLevel, GoalType, UserProfile } from "../types";

export function Settings() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const syncStravaWorkouts = useAppStore((s) => s.syncStravaWorkouts);

  const defaultProfile: UserProfile = settings.userProfile || {
    name: "Karthik",
    age: 15,
    gender: "male",
    heightCm: 168,
    weightKg: 58,
    activityLevel: "moderate",
    goalType: "maintain",
    deficitTargetKcal: 300,
  };

  // Profile Form State
  const [name, setName] = useState(defaultProfile.name);
  const [age, setAge] = useState(String(defaultProfile.age));
  const [gender, setGender] = useState<"male" | "female">(defaultProfile.gender);
  const [heightCm, setHeightCm] = useState(String(defaultProfile.heightCm));
  const [weightKg, setWeightKg] = useState(String(defaultProfile.weightKg));
  const [activity, setActivity] = useState<ActivityLevel>(defaultProfile.activityLevel);
  const [goalType, setGoalType] = useState<GoalType>(defaultProfile.goalType);
  const [deficitTarget, setDeficitTarget] = useState(
    String(defaultProfile.deficitTargetKcal || 300)
  );

  // Nutritional & Hydration Goals
  const [calGoal, setCalGoal] = useState(String(settings.calorieGoal));
  const [pGoal, setPGoal] = useState(String(settings.proteinGoal));
  const [cGoal, setCGoal] = useState(String(settings.carbsGoal));
  const [fGoal, setFGoal] = useState(String(settings.fatGoal));
  const [fibGoal, setFibGoal] = useState(String(settings.fiberGoal || 32));
  const [waterGoal, setWaterGoal] = useState(String(settings.waterGoalMl || 2500));

  // Preferences & Tracking Philosophy
  const [theme, setTheme] = useState<"system" | "light" | "dark">(settings.theme || "system");
  const [hideExerciseCalories, setHideExerciseCalories] = useState<boolean>(Boolean(settings.hideExerciseCalories));
  const [enableWeightTracking, setEnableWeightTracking] = useState<boolean>(settings.enableWeightTracking !== false);

  // Strava Auto-Connector State
  const [stravaClientId, setStravaClientId] = useState(settings.stravaClientId || "");
  const [stravaClientSecret, setStravaClientSecret] = useState(settings.stravaClientSecret || "");
  const [stravaRefreshToken, setStravaRefreshToken] = useState(settings.stravaRefreshToken || "");
  const [stravaToken, setStravaToken] = useState(settings.stravaAccessToken || "");
  const [stravaAutoSync, setStravaAutoSync] = useState(Boolean(settings.stravaAutoSyncEnabled));
  const [showAdvancedStrava, setShowAdvancedStrava] = useState(false);
  const [testingStrava, setTestingStrava] = useState(false);
  const [stravaTestResult, setStravaTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Gemini AI Keys
  const [key, setKey] = useState(settings.geminiApiKey || "");
  const [model, setModel] = useState(settings.geminiModel || "gemini-2.0-flash");

  const [saved, setSaved] = useState(false);

  // Backup & Storage Diagnostics State
  const [storageStats, setStorageStats] = useState<{
    recordCounts: Record<string, number>;
    usageBytes?: number;
    quotaBytes?: number;
  } | null>(null);
  const [backupStatus, setBackupStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    let mounted = true;
    dbOps.getStorageStats().then((stats) => {
      if (mounted) setStorageStats(stats);
    });
    return () => {
      mounted = false;
    };
  }, [saved]);

  async function handleExportJSON() {
    setIsExporting(true);
    setBackupStatus(null);
    try {
      const jsonStr = await dbOps.exportFullBackup();
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `fitness-app-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupStatus({
        success: true,
        message: "Full JSON backup downloaded successfully!",
      });
    } catch (err: unknown) {
      setBackupStatus({
        success: false,
        message: err instanceof Error ? err.message : "Failed to generate backup.",
      });
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImportJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`Restore data from "${file.name}"? This will safely merge or update records into your local database.`)) {
      e.target.value = "";
      return;
    }

    setIsImporting(true);
    setBackupStatus(null);
    try {
      const text = await file.text();
      const res = await dbOps.importFullBackup(text);
      await useAppStore.getState().hydrate();
      const stats = await dbOps.getStorageStats();
      setStorageStats(stats);
      setBackupStatus({
        success: true,
        message: `Backup restored! Loaded ${res.counts.foods} foods, ${res.counts.entries} entries, ${res.counts.workouts} workouts, ${res.counts.recipes} recipes.`,
      });
    } catch (err: unknown) {
      setBackupStatus({
        success: false,
        message: `Restore failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  }

  async function handleExportCSV(type: "entries" | "workouts" | "weights") {
    try {
      const csvStr = await dbOps.exportToCSV(type);
      const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `fitness-${type}-${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(`CSV export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Computed BMR and TDEE preview
  const previewProfile: UserProfile = {
    name: name.trim() || "Karthik",
    age: Math.max(10, parseInt(age) || 15),
    gender,
    heightCm: Math.max(100, parseFloat(heightCm) || 168),
    weightKg: Math.max(30, parseFloat(weightKg) || 58),
    activityLevel: activity,
    goalType,
    deficitTargetKcal: parseInt(deficitTarget) || 300,
  };

  const previewBMR = calculateBMR(previewProfile);
  const previewTDEE = calculateTDEE(previewProfile);
  const recommendedCals = calculateTargetCalories(previewProfile);

  function applyRecommended() {
    setCalGoal(String(recommendedCals));
    // Vegetarian active teen macro split: ~2g protein per kg of bodyweight = ~116-120g
    const recProtein = Math.round(previewProfile.weightKg * 2.0);
    // 25% fat calories = (recommendedCals * 0.25) / 9
    const recFat = Math.round((recommendedCals * 0.25) / 9);
    // Remaining carbs calories = recommendedCals - (recProtein * 4 + recFat * 9)
    const recCarbs = Math.round((recommendedCals - (recProtein * 4 + recFat * 9)) / 4);

    setPGoal(String(recProtein));
    setFGoal(String(recFat));
    setCGoal(String(recCarbs));
    setFibGoal("32");
  }

  function handleConnectStravaOAuth() {
    const id = stravaClientId.trim();
    const secret = stravaClientSecret.trim();
    if (!id || !secret) {
      setStravaTestResult({
        success: false,
        message: "Please enter your Strava Client ID and Client Secret from strava.com/settings/api first.",
      });
      return;
    }
    // Save credentials in storage before redirecting to Strava OAuth
    localStorage.setItem("fitness-strava-client-id", id);
    localStorage.setItem("fitness-strava-client-secret", secret);
    updateSettings({
      stravaClientId: id,
      stravaClientSecret: secret,
    });

    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl = getStravaAuthorizeUrl(id, redirectUri);
    window.location.href = authUrl;
  }

  async function handleTestStrava() {
    setTestingStrava(true);
    setStravaTestResult(null);
    try {
      await updateSettings({
        stravaClientId: stravaClientId.trim() || undefined,
        stravaClientSecret: stravaClientSecret.trim() || undefined,
        stravaRefreshToken: stravaRefreshToken.trim() || undefined,
        stravaAccessToken: stravaToken.trim() || undefined,
        stravaAutoSyncEnabled: stravaAutoSync,
      });

      const res = await syncStravaWorkouts();
      const latest = useAppStore.getState().settings;
      if (latest.stravaRefreshToken) setStravaRefreshToken(latest.stravaRefreshToken);
      if (latest.stravaAccessToken) setStravaToken(latest.stravaAccessToken);

      setStravaTestResult({
        success: true,
        message:
          res.newCount > 0
            ? `Connection successful! Synced ${res.newCount} new activit${res.newCount === 1 ? "y" : "ies"} (-${res.totalBurnedKcal} kcal).`
            : "Connection successful! Account linked and all activities are up to date.",
      });
    } catch (err: unknown) {
      setStravaTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Connection failed. Please check your credentials.",
      });
    } finally {
      setTestingStrava(false);
    }
  }

  async function handleDisconnectStrava() {
    setStravaClientId("");
    setStravaClientSecret("");
    setStravaRefreshToken("");
    setStravaToken("");
    setStravaAutoSync(false);
    localStorage.removeItem("fitness-strava-client-id");
    localStorage.removeItem("fitness-strava-client-secret");
    await updateSettings({
      stravaClientId: undefined,
      stravaClientSecret: undefined,
      stravaRefreshToken: undefined,
      stravaAccessToken: undefined,
      stravaAutoSyncEnabled: false,
      stravaTokenExpiresAt: undefined,
    });
    setStravaTestResult({
      success: true,
      message: "Strava account disconnected.",
    });
  }

  async function save() {
    await updateSettings({
      userProfile: previewProfile,
      calorieGoal: Number(calGoal) || 2200,
      proteinGoal: Number(pGoal) || 120,
      carbsGoal: Number(cGoal) || 280,
      fatGoal: Number(fGoal) || 65,
      fiberGoal: Number(fibGoal) || 32,
      waterGoalMl: Number(waterGoal) || 2500,
      theme,
      hideExerciseCalories,
      enableWeightTracking,
      stravaClientId: stravaClientId.trim() || settings.stravaClientId || undefined,
      stravaClientSecret: stravaClientSecret.trim() || settings.stravaClientSecret || undefined,
      stravaRefreshToken: stravaRefreshToken.trim() || settings.stravaRefreshToken || undefined,
      stravaAccessToken: stravaToken.trim() || settings.stravaAccessToken || undefined,
      stravaAutoSyncEnabled: stravaAutoSync,
      geminiApiKey: key.trim(),
      geminiModel: model.trim() || "gemini-2.0-flash",
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function clearData() {
    if (!confirm("Clear all daily entries and workouts? Foods and profile will be kept.")) return;
    const db = await getDB();
    await db.clear("entries");
    await db.clear("workouts");
    await db.clear("waterEntries");
    location.reload();
  }

  return (
    <div className="mx-auto max-w-[560px] p-4 pb-28 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings & Profile</h1>
          <p className="text-xs text-slate-500">
            Personal metabolic profile, energy balance targets & integrations
          </p>
        </div>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
          Local-First
        </span>
      </div>

      {/* 1. Personal Profile & BMR/TDEE Calculator */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Personal Metabolic Profile
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Age (years)</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as "male" | "female")}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Height (cm)</label>
            <input
              type="number"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Physical Activity Level
          </label>
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value as ActivityLevel)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((k) => (
              <option key={k} value={k}>
                {ACTIVITY_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Weight Goal</label>
            <select
              value={goalType}
              onChange={(e) => setGoalType(e.target.value as GoalType)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {(Object.keys(GOAL_LABELS) as GoalType[]).map((k) => (
                <option key={k} value={k}>
                  {GOAL_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Deficit Target (kcal)
            </label>
            <input
              type="number"
              step="50"
              value={deficitTarget}
              onChange={(e) => setDeficitTarget(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        {/* Live BMR / TDEE Calculation Result Card */}
        <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 dark:border-violet-900/60 dark:bg-violet-950/30 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-violet-900 dark:text-violet-200">
              Basal Metabolic Rate (BMR):
            </span>
            <span className="font-black text-violet-950 dark:text-white">
              {previewBMR} kcal
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-violet-900 dark:text-violet-200">
              Total Daily Energy Expenditure (TDEE):
            </span>
            <span className="font-black text-violet-950 dark:text-white">
              {previewTDEE} kcal
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-violet-200/60 dark:border-violet-900/60">
            <span className="font-bold text-violet-900 dark:text-violet-200">
              Recommended Daily Target:
            </span>
            <span className="text-sm font-black text-violet-700 dark:text-violet-300">
              {recommendedCals} kcal
            </span>
          </div>

          <button
            type="button"
            onClick={applyRecommended}
            className="mt-2 w-full rounded-xl bg-violet-600 py-2 text-xs font-bold text-white hover:bg-violet-700 transition"
          >
            Apply Recommended Goals (Macros & Calories)
          </button>
        </div>
      </div>

      {/* 2. Theme & Tracking Philosophy */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Appearance & Tracking Philosophy
        </h2>

        {/* Theme Selector */}
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Color Theme
          </label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setTheme("system")}
              className={`rounded-xl py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                theme === "system"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                  : "border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <span>🌓</span> Auto
            </button>
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`rounded-xl py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                theme === "light"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                  : "border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <span>☀️</span> Light
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`rounded-xl py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                theme === "dark"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                  : "border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <span>🌙</span> Dark
            </button>
          </div>
        </div>

        {/* Tracking Philosophy & Adolescent Guidance Controls */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hideExerciseCalories}
              onChange={(e) => setHideExerciseCalories(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Hide Exercise Calories Burned
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Displays active minutes and workout consistency instead of calorie burn, preventing compensatory exercise thinking.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={enableWeightTracking}
              onChange={(e) => setEnableWeightTracking(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            />
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Enable Body Weight Tracking
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Optional body measurement tracking. When unchecked, weight inputs and cards are hidden so the tracker focuses purely on nourishment and fitness.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* 3. Daily Targets & Macronutrient Goals */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          Nutritional & Hydration Targets
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Calorie Goal (kcal)
            <input
              value={calGoal}
              onChange={(e) => setCalGoal(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Protein Goal (g)
            <input
              value={pGoal}
              onChange={(e) => setPGoal(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Carbs Goal (g)
            <input
              value={cGoal}
              onChange={(e) => setCGoal(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Fat Goal (g)
            <input
              value={fGoal}
              onChange={(e) => setFGoal(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Fiber Goal (g)
            <input
              value={fibGoal}
              onChange={(e) => setFibGoal(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Water Goal (ml)
            <input
              value={waterGoal}
              onChange={(e) => setWaterGoal(e.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        </div>
      </div>

      {/* 3. Strava Auto-Connector */}
      <div className="rounded-3xl border border-orange-200/80 bg-gradient-to-b from-orange-50/40 to-white p-5 shadow-sm dark:border-orange-950/60 dark:from-orange-950/20 dark:to-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-600 text-sm text-white shadow-sm">
              ⚡
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Strava Auto-Connector
              </h2>
              <p className="text-xs text-slate-500">
                Seamless workout auto-sync & background token refresh
              </p>
            </div>
          </div>

          {settings.stravaRefreshToken ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Connected
            </span>
          ) : settings.stravaAccessToken ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Manual Token
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Not Connected
            </span>
          )}
        </div>

        {/* Status Callout if Connected */}
        {settings.stravaRefreshToken && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 dark:border-emerald-900/60 dark:bg-emerald-950/30 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                🟢 Auto-Refresh Credentials Linked
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Workouts automatically sync and deduplicate against existing logs.
                {settings.stravaLastSyncTime && (
                  <span className="block mt-0.5 text-slate-400">
                    Last synced: {new Date(settings.stravaLastSyncTime).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleDisconnectStrava}
              className="shrink-0 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900 dark:bg-slate-800 dark:text-red-300 transition"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* 1-Click Connect Button */}
        <div>
          <button
            type="button"
            onClick={handleConnectStravaOAuth}
            className="w-full rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 py-3 text-sm font-bold text-white shadow-md hover:from-orange-700 hover:to-amber-700 transition flex items-center justify-center gap-2"
          >
            <span>🔗</span>
            <span>Connect with Strava (1-Click OAuth)</span>
          </button>
          <p className="mt-1.5 text-center text-[11px] text-slate-400">
            Redirects to Strava to securely authorize read-access for your workouts.
          </p>
        </div>

        {/* API Credentials */}
        <div className="space-y-3 pt-1 border-t border-orange-100 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Client ID
              </label>
              <input
                type="text"
                placeholder="e.g. 123456"
                value={stravaClientId}
                onChange={(e) => setStravaClientId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Client Secret
              </label>
              <input
                type="password"
                placeholder="Secret key from Strava"
                value={stravaClientSecret}
                onChange={(e) => setStravaClientSecret(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Auto-Sync Toggle */}
          <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-800/80">
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Auto-sync on app open
              </div>
              <div className="text-[11px] text-slate-500">
                Automatically fetch and log new workouts when you open the app
              </div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={stravaAutoSync}
                onChange={(e) => setStravaAutoSync(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-orange-600 peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-slate-700" />
            </label>
          </div>

          {/* Test & Sync Button */}
          <button
            type="button"
            onClick={handleTestStrava}
            disabled={testingStrava || (!stravaClientId && !stravaToken && !stravaRefreshToken)}
            className="w-full rounded-xl border border-orange-300 bg-white py-2.5 text-xs font-bold text-orange-700 shadow-sm hover:bg-orange-50 disabled:opacity-50 dark:border-orange-800 dark:bg-slate-800 dark:text-orange-300 transition flex items-center justify-center gap-1.5"
          >
            <span className={testingStrava ? "animate-spin" : ""}>🔄</span>
            <span>{testingStrava ? "Testing Connection & Syncing..." : "Test Connection & Sync Now"}</span>
          </button>

          {/* Test Result Message */}
          {stravaTestResult && (
            <div
              className={`rounded-xl p-3 text-xs font-semibold ${
                stravaTestResult.success
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
              }`}
            >
              {stravaTestResult.success ? "✓ " : "✕ "}
              {stravaTestResult.message}
            </div>
          )}

          {/* Advanced / Manual Tokens Collapsible */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvancedStrava(!showAdvancedStrava)}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              {showAdvancedStrava ? "▲ Hide Advanced Token Inputs" : "▼ Show Advanced / Manual Tokens"}
            </button>

            {showAdvancedStrava && (
              <div className="mt-2 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 animate-fadeIn">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Refresh Token (Permanent)
                  </label>
                  <input
                    type="password"
                    placeholder="Strava refresh token"
                    value={stravaRefreshToken}
                    onChange={(e) => setStravaRefreshToken(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Access Token (Temporary 6-hr Bearer Token)
                  </label>
                  <input
                    type="password"
                    placeholder="Strava access token"
                    value={stravaToken}
                    onChange={(e) => setStravaToken(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Setup Guide Callout */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400 space-y-1.5">
            <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span>📖</span>
              <span>How to link Strava in 60 seconds (Free API):</span>
            </div>
            <div>1. Open <a href="https://www.strava.com/settings/api" target="_blank" rel="noreferrer" className="text-orange-600 font-bold underline">strava.com/settings/api</a>.</div>
            <div>2. Create your API app (Category: Personal, Callback Domain: localhost).</div>
            <div>3. Enter your <b>Client ID</b> and <b>Client Secret</b> above and click <b>Connect with Strava</b>.</div>
            <div className="text-[11px] text-slate-500 pt-0.5">
              Done! The app securely handles token refreshing and auto-logs workouts with 0 manual uploads.
            </div>
          </div>
        </div>
      </div>

      {/* 4. Gemini AI Settings */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Gemini AI Vision & Estimation</h2>
        <p className="text-xs text-slate-500">
          Used only for photo food recognition and unknown dishes. Stored strictly in local IndexedDB.
        </p>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="AIza... (Gemini API key)"
          type="password"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Model
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gemini-2.0-flash"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </label>
      </div>

      {/* 5. Data Management, Privacy & Local Backup */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-600 text-sm text-white shadow-sm font-bold">
              💾
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Data Management, Privacy & Local Backup
              </h2>
              <p className="text-xs text-slate-500">
                100% offline-first · Zero cloud dependency · Full JSON & CSV exports
              </p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            IDB v{DB_VERSION}
          </span>
        </div>

        {/* Backup Feedback Toast */}
        {backupStatus && (
          <div
            className={`rounded-2xl p-3.5 text-xs font-semibold transition animate-fadeIn ${
              backupStatus.success
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span>{backupStatus.success ? "✓ " : "✕ "}{backupStatus.message}</span>
              <button
                type="button"
                onClick={() => setBackupStatus(null)}
                className="ml-2 font-bold opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* JSON Backup & Restore Actions */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Full Database Snapshot (JSON)
          </div>
          <p className="text-[11px] text-slate-500">
            Export or restore all foods, custom foods, recipes, diary entries, workouts, and settings as a single portable file.
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleExportJSON}
              disabled={isExporting}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 transition"
            >
              <span>{isExporting ? "⏳" : "💾"}</span>
              <span>{isExporting ? "Exporting..." : "Download Backup (.json)"}</span>
            </button>

            <label className="flex items-center justify-center gap-1.5 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2.5 text-xs font-bold text-violet-700 hover:bg-violet-100 cursor-pointer disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300 transition">
              <span>{isImporting ? "⏳" : "📥"}</span>
              <span>{isImporting ? "Restoring..." : "Restore Backup (.json)"}</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportJSON}
                disabled={isImporting}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* CSV Spreadsheet Exports */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Spreadsheet Data Exports (CSV)
          </div>
          <p className="text-[11px] text-slate-500">
            Export cleanly formatted tabular records for Microsoft Excel, Apple Numbers, or Google Sheets.
          </p>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleExportCSV("entries")}
              className="rounded-xl border border-slate-200 bg-white py-2 px-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
            >
              📋 Food Entries
            </button>
            <button
              type="button"
              onClick={() => handleExportCSV("workouts")}
              className="rounded-xl border border-slate-200 bg-white py-2 px-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
            >
              🏃 Workouts
            </button>
            <button
              type="button"
              onClick={() => handleExportCSV("weights")}
              className="rounded-xl border border-slate-200 bg-white py-2 px-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
            >
              ⚖️ Weight Logs
            </button>
          </div>
        </div>

        {/* Storage Diagnostics Table */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Storage Diagnostics & Record Counts
            </span>
            {storageStats?.usageBytes !== undefined && (
              <span className="text-[11px] text-slate-400">
                {(storageStats.usageBytes / 1024 / 1024).toFixed(2)} MB used
              </span>
            )}
          </div>
          {storageStats ? (
            <div className="grid grid-cols-3 gap-2 pt-0.5">
              <div className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800/50">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">Foods</div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {storageStats.recordCounts.foods ?? 0}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800/50">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">Diary Entries</div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {storageStats.recordCounts.entries ?? 0}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800/50">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">Recipes</div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {storageStats.recordCounts.recipes ?? 0}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800/50">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">Workouts</div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {storageStats.recordCounts.workouts ?? 0}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800/50">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">Water Logs</div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {storageStats.recordCounts.waterEntries ?? 0}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5 text-center dark:bg-slate-800/50">
                <div className="text-[10px] font-semibold text-slate-400 uppercase">Weight Logs</div>
                <div className="text-sm font-black text-slate-900 dark:text-white">
                  {storageStats.recordCounts.weights ?? 0}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">Reading storage diagnostics...</div>
          )}
        </div>

        {/* Privacy & Zero-Cloud Guarantee */}
        <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-3.5 text-xs text-slate-600 dark:border-violet-950 dark:bg-violet-950/20 dark:text-slate-400 space-y-1">
          <div className="font-bold text-violet-950 dark:text-violet-200 flex items-center gap-1.5">
            <span>🛡️</span>
            <span>Local-First & Offline Privacy Guarantee</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            All your food, nutrition, weight, and fitness logs live exclusively in your local browser storage (IndexedDB). No telemetry, no third-party cloud trackers, and no unsolicited data transmission. You have complete ownership of your data at all times.
          </p>
        </div>
      </div>

      <button
        onClick={save}
        className="w-full rounded-2xl bg-violet-600 py-3.5 text-sm font-bold text-white shadow-lg hover:bg-violet-700 transition"
      >
        {saved ? "✓ Settings Saved Successfully" : "Save All Settings"}
      </button>

      {/* Clear Data */}
      <button
        onClick={clearData}
        className="w-full rounded-2xl border border-red-200 bg-red-50 py-3 text-xs font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
      >
        Clear Daily Entries & Workouts (Keeps Foods & Profile)
      </button>

      <p className="text-center text-xs text-slate-400">
        fitness-app · Private & Local-First · Hyderabad
      </p>
    </div>
  );
}
