import type { ActivityLevel, GoalType, UserProfile } from "../types.ts";

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2, // Little or no exercise, desk work
  light: 1.375, // Light exercise 1-3 days/week
  moderate: 1.55, // Moderate exercise 3-5 days/week (school sports, cycling)
  active: 1.725, // Hard exercise 6-7 days/week
  very_active: 1.9, // Very hard daily training/sports
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (Little/no exercise)",
  light: "Lightly Active (1-3 days/week)",
  moderate: "Moderately Active (3-5 days/week - Karthik's sports/cycling)",
  active: "Very Active (6-7 days/week)",
  very_active: "Athlete / Competitive Sports",
};

export const GOAL_LABELS: Record<GoalType, string> = {
  nourish: "Growth, Activity & Balanced Energy (Recommended for Teens)",
  maintain: "Maintain Energy Balance (TDEE)",
  mild_deficit: "Mild Deficit (-250 kcal/day, Adult Guidance Only)",
  deficit: "Standard Deficit (-500 kcal/day, Adult Guidance Only)",
  mild_surplus: "Lean Bulk / Growth Surplus (+250 kcal/day)",
  custom: "Custom Calorie Target",
};

/**
 * Calculates Basal Metabolic Rate (BMR) using Mifflin-St Jeor equation.
 * Validated for adolescents and adults.
 * Male: 10 * weight(kg) + 6.25 * height(cm) - 5 * age + 5
 * Female: 10 * weight(kg) + 6.25 * height(cm) - 5 * age - 161
 */
export function calculateBMR(profile: UserProfile): number {
  const { weightKg, heightCm, age, gender } = profile;
  const s = gender === "male" ? 5 : -161;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + s;
  return Math.round(bmr);
}

/**
 * Calculates Total Daily Energy Expenditure (TDEE).
 */
export function calculateTDEE(profile: UserProfile): number {
  const bmr = calculateBMR(profile);
  const multiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel] || 1.55;
  return Math.round(bmr * multiplier);
}

/**
 * Calculates target daily calories based on user profile and goal.
 */
export function calculateTargetCalories(profile: UserProfile): number {
  if (profile.goalType === "custom" && profile.customCalorieTarget) {
    return Math.round(profile.customCalorieTarget);
  }

  const tdee = calculateTDEE(profile);
  switch (profile.goalType) {
    case "mild_deficit":
      return Math.max(1600, tdee - 250);
    case "deficit":
      return Math.max(1600, tdee - (profile.deficitTargetKcal || 500));
    case "mild_surplus":
      return tdee + 250;
    case "nourish":
    case "maintain":
    default:
      return tdee;
  }
}

export interface EnergyBalanceSummary {
  bmr: number;
  tdee: number;
  intakeCalories: number;
  exerciseBurnCalories: number;
  netCalories: number; // Intake - Exercise Burn
  targetCalories: number;
  remainingCalories: number; // Target - Net
  dailyDeficitSurplus: number; // TDEE - Net (positive = deficit, negative = surplus)
  status: "deficit" | "surplus" | "balanced";
  deficitKcal: number; // absolute value
}

/**
 * Computes the full energy balance & deficit breakdown for the day.
 */
export function computeEnergyBalance(
  profile: UserProfile,
  intakeCalories: number,
  exerciseBurnCalories: number,
  targetCaloriesOverride?: number
): EnergyBalanceSummary {
  const bmr = calculateBMR(profile);
  const tdee = calculateTDEE(profile);
  const targetCalories = targetCaloriesOverride || calculateTargetCalories(profile);
  const netCalories = Math.round(intakeCalories - exerciseBurnCalories);
  const remainingCalories = Math.round(targetCalories - netCalories);
  const dailyDeficitSurplus = Math.round(tdee - netCalories);

  let status: "deficit" | "surplus" | "balanced" = "balanced";
  if (dailyDeficitSurplus >= 50) {
    status = "deficit";
  } else if (dailyDeficitSurplus <= -50) {
    status = "surplus";
  }

  return {
    bmr,
    tdee,
    intakeCalories: Math.round(intakeCalories),
    exerciseBurnCalories: Math.round(exerciseBurnCalories),
    netCalories,
    targetCalories,
    remainingCalories,
    dailyDeficitSurplus,
    status,
    deficitKcal: Math.abs(dailyDeficitSurplus),
  };
}
