import { useState, useMemo } from "react";
import { useAppStore } from "../store/appStore";
import { calculateWorkoutCalories } from "../utils/workoutCalc";
import { WorkoutModal } from "../components/WorkoutModal";
import type { StrengthExerciseLog, WorkoutEntry } from "../types";
import { WORKOUT_LABELS } from "../types";

const STRENGTH_PRESETS = [
  "Pull-ups",
  "Push-ups",
  "Bodyweight Squats",
  "Dumbbell Goblet Squats",
  "Dumbbell Shoulder Press",
  "Dumbbell Bicep Curls",
  "Dumbbell Bench Press",
  "Dumbbell Romanian Deadlift",
  "Lateral Raises",
  "Plank Hold",
  "Barbell Squat",
  "Barbell Bench Press",
  "Barbell Deadlift",
  "Dips",
];

export function WorkoutsPage() {
  const selectedDate = useAppStore((s) => s.selectedDate);
  const workouts = useAppStore((s) => s.workouts);
  const addWorkout = useAppStore((s) => s.addWorkout);
  const deleteWorkout = useAppStore((s) => s.deleteWorkout);
  const settings = useAppStore((s) => s.settings);
  const syncStravaWorkouts = useAppStore((s) => s.syncStravaWorkouts);

  const [showCardioModal, setShowCardioModal] = useState(false);
  const [showStrengthModal, setShowStrengthModal] = useState(false);
  const [modalDefaultTab, setModalDefaultTab] = useState<"manual" | "strava_file" | "strava_api">("manual");
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Strength session modal state
  const [strengthTitle, setStrengthTitle] = useState("Upper Body Strength");
  const [strengthDuration, setStrengthDuration] = useState(45);
  const [strengthRpe, setStrengthRpe] = useState(7);
  const [strengthNotes, setStrengthNotes] = useState("");
  const [exercises, setExercises] = useState<StrengthExerciseLog[]>([
    {
      exerciseId: "ex-1",
      exerciseName: "Pull-ups",
      sets: [
        { setNumber: 1, reps: 8, weightKg: 0, completed: true },
        { setNumber: 2, reps: 7, weightKg: 0, completed: true },
        { setNumber: 3, reps: 6, weightKg: 0, completed: true },
      ],
    },
  ]);
  const [newExName, setNewExName] = useState("");

  const userWeightKg = settings.userProfile?.weightKg || 58;

  const totalBurn = useMemo(() => {
    return workouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
  }, [workouts]);

  const totalMinutes = useMemo(() => {
    return workouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);
  }, [workouts]);

  function handleAddExercisePreset(name: string) {
    if (!name.trim()) return;
    setExercises((prev) => [
      ...prev,
      {
        exerciseId: `ex-${Date.now()}-${prev.length}`,
        exerciseName: name.trim(),
        sets: [
          { setNumber: 1, reps: 10, weightKg: 0, completed: true },
          { setNumber: 2, reps: 10, weightKg: 0, completed: true },
          { setNumber: 3, reps: 10, weightKg: 0, completed: true },
        ],
      },
    ]);
    setNewExName("");
  }

  function handleRemoveExercise(index: number) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAddSet(exIndex: number) {
    setExercises((prev) => {
      const copy = [...prev];
      const ex = copy[exIndex];
      const lastSet = ex.sets[ex.sets.length - 1];
      const nextSetNum = ex.sets.length + 1;
      ex.sets.push({
        setNumber: nextSetNum,
        reps: lastSet ? lastSet.reps : 10,
        weightKg: lastSet ? lastSet.weightKg : 0,
        completed: true,
      });
      return copy;
    });
  }

  function handleUpdateSet(exIndex: number, setIndex: number, field: "reps" | "weightKg", value: number) {
    setExercises((prev) => {
      const copy = [...prev];
      const s = copy[exIndex].sets[setIndex];
      if (field === "reps") s.reps = Math.max(1, value);
      else s.weightKg = Math.max(0, value);
      return copy;
    });
  }

  function handleRemoveSet(exIndex: number, setIndex: number) {
    setExercises((prev) => {
      const copy = [...prev];
      copy[exIndex].sets = copy[exIndex].sets.filter((_, i) => i !== setIndex);
      return copy;
    });
  }

  async function handleSaveStrengthSession() {
    if (exercises.length === 0) {
      alert("Please add at least one exercise.");
      return;
    }

    const estimatedBurn = calculateWorkoutCalories("gym", strengthDuration, userWeightKg);

    const entry: WorkoutEntry = {
      id: `strength-${Date.now()}`,
      date: selectedDate,
      title: strengthTitle.trim() || "Gym Strength Session",
      type: "gym",
      durationMinutes: strengthDuration,
      caloriesBurned: estimatedBurn,
      perceivedEffort: strengthRpe,
      exercises,
      notes: strengthNotes.trim() || undefined,
      source: "manual",
      createdAt: Date.now(),
    };

    await addWorkout(entry);
    setShowStrengthModal(false);
    setToastMsg(`Logged "${entry.title}" (${exercises.length} exercises)!`);
    setTimeout(() => setToastMsg(null), 3000);
  }

  async function handleSyncStrava() {
    setIsSyncing(true);
    setToastMsg(null);
    try {
      const res = await syncStravaWorkouts();
      if (res.newCount > 0) {
        setToastMsg(`Synced ${res.newCount} new workout(s) from Strava!`);
      } else {
        setToastMsg("Strava is up to date (0 new workouts).");
      }
    } catch (err: unknown) {
      setToastMsg(err instanceof Error ? err.message : "Strava sync failed");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setToastMsg(null), 4000);
    }
  }

  return (
    <div className="mx-auto max-w-[640px] p-4 pb-28 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Workout & Activity Journal
          </h1>
          <p className="text-xs text-slate-500">
            Log resistance training sets, cardio distance/pace, and auto-sync with Strava
          </p>
        </div>
      </div>

      {toastMsg && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 animate-fadeIn">
          ✓ {toastMsg}
        </div>
      )}

      {/* Daily Activity Summary Card */}
      <div className="rounded-3xl border border-orange-200/80 bg-gradient-to-br from-orange-50/60 to-white p-5 shadow-sm dark:border-orange-950/60 dark:from-orange-950/20 dark:to-slate-900 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-600 text-sm text-white shadow-sm">
              🏃
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Today's Movement ({selectedDate})
              </h3>
              <p className="text-xs text-slate-500">
                {workouts.length} activity logged · {totalMinutes} active minutes
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xl font-black text-orange-600 dark:text-orange-400">
              {totalBurn} <span className="text-xs font-medium text-slate-500">kcal</span>
            </div>
            <div className="text-[10px] text-slate-400">Estimated Burn</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <button
            onClick={() => setShowStrengthModal(true)}
            className="rounded-xl bg-orange-600 py-2.5 px-3 text-xs font-bold text-white shadow-sm hover:bg-orange-700 transition"
          >
            🏋️ Strength Sets
          </button>
          <button
            onClick={() => {
              setModalDefaultTab("manual");
              setShowCardioModal(true);
            }}
            className="rounded-xl border border-orange-300 bg-white py-2.5 px-3 text-xs font-bold text-orange-700 shadow-sm hover:bg-orange-50 dark:border-orange-800 dark:bg-slate-800 dark:text-orange-300 transition"
          >
            🏃 Cardio / Sport
          </button>
          <button
            onClick={handleSyncStrava}
            disabled={isSyncing}
            className="rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 transition flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <span className={isSyncing ? "animate-spin" : ""}>🔄</span>
            <span>Strava Sync</span>
          </button>
          <button
            onClick={() => {
              setModalDefaultTab("strava_file");
              setShowCardioModal(true);
            }}
            className="rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 transition"
          >
            📁 GPX / TCX
          </button>
        </div>
      </div>

      {/* Workouts History List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Logged Workouts ({workouts.length})
        </h3>

        {workouts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
            No workouts logged for this date. Record strength sets, running, sports, or sync from Strava above.
          </div>
        ) : (
          workouts.map((w) => (
            <div
              key={w.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">
                      {w.title}
                    </span>
                    <span className="rounded-md bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                      {WORKOUT_LABELS[w.type] || w.type}
                    </span>
                    {w.source.startsWith("strava") && (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        Strava
                      </span>
                    )}
                    {w.perceivedEffort && (
                      <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-300">
                        RPE {w.perceivedEffort}/10
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {w.durationMinutes} min active
                    {w.distanceKm ? ` · ${w.distanceKm} km` : ""}
                    {w.distanceKm && w.durationMinutes ? ` · ${(w.durationMinutes / w.distanceKm).toFixed(2)} min/km pace` : ""}
                    {w.avgHeartRate ? ` · ${w.avgHeartRate} bpm` : ""}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-extrabold text-orange-600 dark:text-orange-400">
                    ~{w.caloriesBurned} kcal
                  </span>
                  <button
                    onClick={() => deleteWorkout(w.id)}
                    className="rounded-full p-1.5 text-slate-400 hover:text-red-600 transition"
                    title="Delete workout"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Strength exercises table if present */}
              {w.exercises && w.exercises.length > 0 && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                  <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    Strength Sets Logged:
                  </div>
                  <div className="space-y-1.5">
                    {w.exercises.map((ex, i) => (
                      <div key={i} className="text-xs">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {ex.exerciseName}:
                        </span>{" "}
                        <span className="text-slate-500">
                          {ex.sets.map((s) => `${s.reps} reps${s.weightKg ? ` @ ${s.weightKg}kg` : ""}`).join(" · ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {w.notes && (
                <p className="text-xs text-slate-500 italic bg-slate-50 dark:bg-slate-800/30 p-2 rounded-xl">
                  "{w.notes}"
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* STRENGTH SESSION MODAL */}
      {showStrengthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="flex max-h-[90vh] w-full max-w-[540px] flex-col rounded-3xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Log Strength Training Session
                </h3>
                <p className="text-xs text-slate-500">Record exercises, sets, repetitions, and weights</p>
              </div>
              <button
                onClick={() => setShowStrengthModal(false)}
                className="rounded-full p-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Session Title
                  <input
                    type="text"
                    value={strengthTitle}
                    onChange={(e) => setStrengthTitle(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Duration (Minutes)
                  <input
                    type="number"
                    min={5}
                    value={strengthDuration}
                    onChange={(e) => setStrengthDuration(Math.max(5, parseInt(e.target.value) || 30))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
              </div>

              {/* RPE Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Rate of Perceived Exertion (RPE: {strengthRpe}/10)
                </label>
                <div className="mt-1 flex gap-1">
                  {[4, 5, 6, 7, 8, 9, 10].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setStrengthRpe(r)}
                      className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${
                        strengthRpe === r
                          ? "bg-violet-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Exercises List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                  <span>Exercises ({exercises.length})</span>
                </div>

                {exercises.map((ex, exIdx) => (
                  <div
                    key={ex.exerciseId}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {ex.exerciseName}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExercise(exIdx)}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>

                    {/* Sets */}
                    <div className="space-y-1.5">
                      {ex.sets.map((s, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-2 text-xs">
                          <span className="w-12 text-slate-400 font-semibold">Set {s.setNumber}</span>
                          <input
                            type="number"
                            min={1}
                            value={s.reps}
                            onChange={(e) => handleUpdateSet(exIdx, sIdx, "reps", parseInt(e.target.value) || 0)}
                            className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center font-bold dark:border-slate-700 dark:bg-slate-900"
                            placeholder="Reps"
                          />
                          <span className="text-slate-400">reps @</span>
                          <input
                            type="number"
                            min={0}
                            step={0.5}
                            value={s.weightKg || 0}
                            onChange={(e) => handleUpdateSet(exIdx, sIdx, "weightKg", parseFloat(e.target.value) || 0)}
                            className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center font-bold dark:border-slate-700 dark:bg-slate-900"
                            placeholder="kg"
                          />
                          <span className="text-slate-400">kg</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSet(exIdx, sIdx)}
                            className="text-slate-400 hover:text-red-500 ml-auto px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddSet(exIdx)}
                      className="text-[11px] font-bold text-violet-600 hover:underline"
                    >
                      + Add Set
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Exercise Quick Chips */}
              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Add Exercise:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {STRENGTH_PRESETS.slice(0, 8).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddExercisePreset(preset)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Custom exercise name..."
                    value={newExName}
                    onChange={(e) => setNewExName(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddExercisePreset(newExName)}
                    className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white dark:bg-slate-700"
                  >
                    Add
                  </button>
                </div>
              </div>

              <textarea
                placeholder="Session notes (e.g. Good form on pull-ups, left shoulder felt great)..."
                value={strengthNotes}
                onChange={(e) => setStrengthNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="border-t border-slate-200 p-4 dark:border-slate-800 flex gap-2">
              <button
                type="button"
                onClick={handleSaveStrengthSession}
                className="flex-1 rounded-xl bg-orange-600 py-2.5 text-xs font-bold text-white shadow hover:bg-orange-700 transition"
              >
                Save Workout
              </button>
              <button
                type="button"
                onClick={() => setShowStrengthModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:border-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cardio / Strava Modal */}
      {showCardioModal && (
        <WorkoutModal
          initialTab={modalDefaultTab}
          onClose={() => setShowCardioModal(false)}
        />
      )}
    </div>
  );
}
