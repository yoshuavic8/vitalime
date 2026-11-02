import type { DataSource, Equipment, ExerciseMetric, MealType, MovementPattern, Split, Verification } from "../db/types";

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Sarapan",
  lunch: "Makan siang",
  dinner: "Makan malam",
  snack: "Snack",
  drink: "Minuman",
};

export const SOURCE_LABEL: Record<DataSource, string> = {
  manual: "Manual",
  apple_health_import: "Apple Health",
  shortcut_import: "Shortcut",
  ai_estimate: "Estimasi AI",
};

export const VERIFICATION_LABEL: Record<Verification, string> = {
  draft: "Draft",
  confirmed: "Terkonfirmasi",
  corrected: "Dikoreksi",
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  bodyweight: "Bodyweight",
  dumbbell: "Dumbbell",
  barbell: "Barbell",
  machine: "Mesin",
  cable: "Cable",
  resistance_band: "Band",
  kettlebell: "Kettlebell",
  cardio_machine: "Mesin kardio",
};

export const PATTERN_LABEL: Record<MovementPattern, string> = {
  push: "Push",
  pull: "Pull",
  squat: "Squat",
  hinge: "Hinge",
  lunge: "Lunge",
  carry: "Carry",
  core: "Core",
  plyometric: "Pliometrik",
  cardio: "Kardio",
  mobility: "Mobilitas",
};

export const METRIC_LABEL: Record<ExerciseMetric, string> = {
  reps: "Beban × repetisi",
  time: "Durasi (detik)",
  cardio: "Durasi & jarak",
};

export const SPLIT_LABEL: Record<Split, string> = {
  full_body: "Full body",
  upper_lower: "Upper/Lower",
  push_pull_legs: "Push/Pull/Legs",
  body_part: "Split per otot",
  circuit: "Circuit",
  custom: "Kustom",
};

export function defaultMealForNow(): MealType {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}
