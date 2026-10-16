import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { getDB } from "../db";
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

      {/* 2. Daily Targets & Macronutrient Goals */}
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
