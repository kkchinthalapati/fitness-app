import type { WeightEntry } from "../types.ts";

export interface WeightProjection {
  currentWeightKg: number;
  avgDailyDeficitKcal: number;
  projectedWeight4WeeksKg: number;
  projectedWeight8WeeksKg: number;
  projectedWeight12WeeksKg: number;
  weeklyChangeKg: number;
}

/**
 * Calculates projected weight based on average daily calorie deficit.
 * 7,700 kcal deficit ≈ 1 kg fat loss (standard metabolic rule of thumb).
 */
export function calculateWeightProjection(
  currentWeightKg: number,
  avgDailyDeficitKcal: number
): WeightProjection {
  // Weekly change in kg = (avgDailyDeficitKcal * 7) / 7700
  // Note: positive deficit -> weight loss (negative change in body weight)
  const weeklyChangeKg = -Number(((avgDailyDeficitKcal * 7) / 7700).toFixed(2));

  const projectedWeight4WeeksKg = Number(
    Math.max(35, currentWeightKg + weeklyChangeKg * 4).toFixed(1)
  );
  const projectedWeight8WeeksKg = Number(
    Math.max(35, currentWeightKg + weeklyChangeKg * 8).toFixed(1)
  );
  const projectedWeight12WeeksKg = Number(
    Math.max(35, currentWeightKg + weeklyChangeKg * 12).toFixed(1)
  );

  return {
    currentWeightKg,
    avgDailyDeficitKcal: Math.round(avgDailyDeficitKcal),
    projectedWeight4WeeksKg,
    projectedWeight8WeeksKg,
    projectedWeight12WeeksKg,
    weeklyChangeKg,
  };
}

/**
 * Calculates BMI with adolescent context.
 * Note: Adult BMI cutoffs (like Asian-Indian <23) are NOT diagnostic for adolescents (WHO/IAP).
 */
export function calculateBMI(weightKg: number, heightCm: number): {
  bmi: number;
  category: "underweight" | "healthy" | "overweight" | "obese";
  label: string;
  notice: string;
} {
  if (heightCm <= 0 || weightKg <= 0) {
    return {
      bmi: 0,
      category: "healthy",
      label: "Growth Context",
      notice: "Individual adolescent growth patterns vary. Discuss with a healthcare professional.",
    };
  }
  const heightM = heightCm / 100;
  const bmi = Number((weightKg / (heightM * heightM)).toFixed(1));

  let category: "underweight" | "healthy" | "overweight" | "obese" = "healthy";
  let label = "Active Developing Teen";
  if (bmi < 18.5) {
    category = "underweight";
    label = "Lean / Growing Youth";
  } else if (bmi < 23) {
    category = "healthy";
    label = "Active Developing Teen";
  } else if (bmi < 27.5) {
    category = "overweight";
    label = "Higher Mass Range";
  } else {
    category = "obese";
    label = "Pediatric Review Context";
  }

  return {
    bmi,
    category,
    label,
    notice: "Adult BMI categories do not define health for a growing adolescent. Use pediatric growth curves and healthcare advice.",
  };
}

/**
 * Computes a 7-day rolling average for weight entries.
 */
export function computeWeightRollingAverage(
  entries: WeightEntry[]
): { date: string; weightKg: number; rollingAvgKg: number }[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const results: { date: string; weightKg: number; rollingAvgKg: number }[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const window = sorted.slice(Math.max(0, i - 6), i + 1);
    const sum = window.reduce((acc, curr) => acc + curr.weightKg, 0);
    const avg = Number((sum / window.length).toFixed(1));
    results.push({
      date: sorted[i].date,
      weightKg: sorted[i].weightKg,
      rollingAvgKg: avg,
    });
  }

  return results;
}
