import { useState, useMemo } from "react";
import { useAppStore } from "../store/appStore";
import { WorkoutModal } from "./WorkoutModal";
import { WORKOUT_LABELS } from "../types";

export function WorkoutsCard() {
  const workouts = useAppStore((s) => s.workouts);
  const deleteWorkout = useAppStore((s) => s.deleteWorkout);
  const settings = useAppStore((s) => s.settings);
  const syncStravaWorkouts = useAppStore((s) => s.syncStravaWorkouts);

  const [showModal, setShowModal] = useState(false);
  const [modalDefaultTab, setModalDefaultTab] = useState<"manual" | "strava_file" | "strava_api">("manual");
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const isStravaConnected = Boolean(settings.stravaRefreshToken || settings.stravaAccessToken);
  const isAutoSync = Boolean(settings.stravaAutoSyncEnabled);

  const totalBurn = useMemo(() => {
    return workouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
  }, [workouts]);

  const totalMinutes = useMemo(() => {
    return workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);
  }, [workouts]);

  async function handleSyncClick() {
    if (!isStravaConnected) {
      setModalDefaultTab("strava_api");
      setShowModal(true);
      return;
    }

    setIsSyncing(true);
    setToastMessage(null);
    try {
      const res = await syncStravaWorkouts();
      if (res.newCount > 0) {
        setToastMessage({
          text: `Synced ${res.newCount} new activit${res.newCount === 1 ? "y" : "ies"} (-${res.totalBurnedKcal} kcal)`,
          type: "success",
        });
      } else {
        setToastMessage({
          text: "Strava up to date (0 new activities)",
          type: "info",
        });
      }
    } catch (err: unknown) {
      setToastMessage({
        text: err instanceof Error ? err.message : "Strava sync failed",
        type: "error",
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => {
        setToastMessage(null);
      }, 5000);
    }
  }

  return (
    <>
      <div className="rounded-3xl border border-orange-200/80 bg-gradient-to-b from-orange-50/50 to-white p-5 shadow-sm dark:border-orange-950/60 dark:from-orange-950/20 dark:to-slate-900 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-600 text-sm text-white shadow-sm">
              🏃
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Workouts & Strava Exercise Burn
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {workouts.length} recorded today · {totalMinutes} active minutes
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-base font-black text-orange-600 dark:text-orange-400">
              -{totalBurn} <span className="text-xs font-medium text-slate-500">kcal</span>
            </div>
            <div className="text-[10px] text-slate-400">Burned from intake</div>
          </div>
        </div>

        {/* Strava Connection Status Badge */}
        <div className="flex items-center justify-between pt-0.5">
          {isStravaConnected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              🟢 Strava Connected {isAutoSync ? "(Auto-sync on)" : ""}
            </span>
          ) : (
            <button
              onClick={() => {
                setModalDefaultTab("strava_api");
                setShowModal(true);
              }}
              className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200/70 hover:bg-amber-100 transition dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900"
            >
              <span>⚡ Connect Strava</span>
            </button>
          )}

          {settings.stravaLastSyncTime && (
            <span className="text-[10px] text-slate-400">
              Synced {new Date(settings.stravaLastSyncTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* Toast / Sync status banner */}
        {toastMessage && (
          <div
            className={`rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between transition animate-fadeIn ${
              toastMessage.type === "success"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
                : toastMessage.type === "error"
                ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900"
            }`}
          >
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 text-xs opacity-70 hover:opacity-100 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Workouts list */}
        {workouts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-4 text-center dark:border-slate-800 dark:bg-slate-800/20">
            <p className="text-xs text-slate-500">
              No workouts logged for this date. Auto-sync from Strava or record your sport.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {workouts.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-800/80"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {w.title}
                    </span>
                    <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                      {WORKOUT_LABELS[w.type] || w.type}
                    </span>
                    {w.source.startsWith("strava") && (
                      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Strava
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {w.durationMinutes} min
                    {w.distanceKm ? ` · ${w.distanceKm} km` : ""}
                    {w.avgHeartRate ? ` · ${w.avgHeartRate} bpm` : ""}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-extrabold text-orange-600 dark:text-orange-400">
                    -{w.caloriesBurned} kcal
                  </span>
                  <button
                    onClick={() => deleteWorkout(w.id)}
                    className="rounded-full p-1.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-700 transition"
                    title="Delete workout"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => {
              setModalDefaultTab("manual");
              setShowModal(true);
            }}
            className="flex-1 min-w-[120px] rounded-xl bg-orange-600 py-2.5 px-3 text-xs font-bold text-white shadow-sm hover:bg-orange-700 transition"
          >
            + Log Sport
          </button>
          <button
            onClick={handleSyncClick}
            disabled={isSyncing}
            className="flex-1 min-w-[130px] rounded-xl border border-orange-300 bg-white py-2.5 px-3 text-xs font-bold text-orange-700 shadow-sm hover:bg-orange-50 dark:border-orange-800 dark:bg-slate-800 dark:text-orange-300 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <span className={isSyncing ? "animate-spin" : ""}>🔄</span>
            <span>{isSyncing ? "Syncing..." : "Sync Strava"}</span>
          </button>
          <button
            onClick={() => {
              setModalDefaultTab("strava_file");
              setShowModal(true);
            }}
            className="rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
            title="Upload GPX, TCX, or JSON file"
          >
            📁 File
          </button>
        </div>
      </div>

      {showModal && (
        <WorkoutModal
          initialTab={modalDefaultTab}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
