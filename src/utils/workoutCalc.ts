import type { WorkoutType } from "../types.ts";

export interface METActivityInfo {
  met: number;
  label: string;
  category: string;
  defaultDurationMin: number;
}

export const WORKOUT_MET_MAP: Record<WorkoutType, METActivityInfo> = {
  badminton: {
    met: 7.0,
    label: "Badminton (Competitive / Match Play)",
    category: "Racket Sports",
    defaultDurationMin: 45,
  },
  cricket: {
    met: 5.0,
    label: "Cricket (Batting, Bowling, Fielding)",
    category: "Team Sports",
    defaultDurationMin: 60,
  },
  running: {
    met: 9.8,
    label: "Running (Moderate ~6 min/km pace)",
    category: "Cardio",
    defaultDurationMin: 30,
  },
  cycling: {
    met: 7.5,
    label: "Cycling (Moderate ~18-22 km/h)",
    category: "Cardio",
    defaultDurationMin: 40,
  },
  gym: {
    met: 5.5,
    label: "Gym / Strength Training & Circuits",
    category: "Strength",
    defaultDurationMin: 45,
  },
  swimming: {
    met: 7.0,
    label: "Swimming (Freestyle / Moderate)",
    category: "Aquatics",
    defaultDurationMin: 30,
  },
  walking: {
    met: 3.8,
    label: "Walking (Brisk ~5 km/h)",
    category: "Cardio",
    defaultDurationMin: 30,
  },
  other: {
    met: 6.0,
    label: "Other General Workout",
    category: "General",
    defaultDurationMin: 30,
  },
};

/**
 * Calculates calories burned based on the Compendium of Physical Activities MET formula:
 * Calories = (MET * 3.5 * weightKg / 200) * durationMinutes
 */
export function calculateWorkoutCalories(
  type: WorkoutType,
  durationMinutes: number,
  weightKg: number,
  customMET?: number
): number {
  const met = customMET ?? WORKOUT_MET_MAP[type]?.met ?? 6.0;
  if (durationMinutes <= 0 || weightKg <= 0) return 0;
  const burn = (met * 3.5 * weightKg / 200) * durationMinutes;
  return Math.round(burn);
}

/**
 * Calculates MET for running based on speed (km/h) if available.
 */
export function getRunningMET(speedKmh: number): number {
  if (speedKmh <= 6.5) return 6.0;
  if (speedKmh <= 8.0) return 8.3;
  if (speedKmh <= 9.7) return 9.8;
  if (speedKmh <= 11.3) return 11.0;
  if (speedKmh <= 13.0) return 11.8;
  return 12.8;
}

/**
 * Calculates MET for cycling based on speed (km/h) if available.
 */
export function getCyclingMET(speedKmh: number): number {
  if (speedKmh <= 15) return 4.0;
  if (speedKmh <= 19) return 6.0;
  if (speedKmh <= 22) return 8.0;
  if (speedKmh <= 25) return 10.0;
  return 12.0;
}
