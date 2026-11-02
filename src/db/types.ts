export type Verification = "draft" | "confirmed" | "corrected";
export type DataSource = "manual" | "apple_health_import" | "shortcut_import" | "ai_estimate";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "drink";
export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack", "drink"];

export type PortionUnit = "g" | "ml" | "buah" | "potong" | "sendok" | "porsi";
export const PORTION_UNITS: PortionUnit[] = ["g", "ml", "buah", "potong", "sendok", "porsi"];

export type Sex = "male" | "female" | "unspecified";

export type Profile = {
  id: "me";
  name?: string;
  sex: Sex;
  birthYear?: number;
  heightCm?: number;
  createdAt: string;
  updatedAt: string;
};

/** fixed: target stays constant. activity_adjusted: imported active energy is added to the target. */
export type TargetMode = "fixed" | "activity_adjusted";

export type Goal = {
  id: string;
  effectiveFrom: string; // local date YYYY-MM-DD
  caloriesKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  targetMode: TargetMode;
  stepsTarget?: number;
  createdAt: string;
  updatedAt: string;
};

export type FoodEntry = {
  id: string;
  consumedAt: string;
  localDate: string;
  mealType: MealType;
  name: string;
  description?: string;
  portionValue?: number;
  portionUnit?: PortionUnit;
  caloriesKcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  source: "manual" | "ai_estimate";
  verification: Verification;
  notes?: string;
  templateId?: string;
  createdAt: string;
  updatedAt: string;
};

export type FoodPhoto = {
  id: string;
  foodEntryId: string;
  /** Null once the original is purged to free storage; the thumbnail is kept. */
  blob: Blob | null;
  thumb: Blob;
  mime: string;
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
};

export type FoodTemplate = {
  id: string;
  name: string;
  mealType?: MealType;
  portionValue?: number;
  portionUnit?: PortionUnit;
  caloriesKcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  notes?: string;
  useCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ActivityEntry = {
  id: string;
  activityType: string;
  startedAt: string;
  endedAt?: string;
  localDate: string;
  durationMinutes?: number;
  distanceKm?: number;
  activeEnergyKcal?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  notes?: string;
  source: "manual" | "apple_health_import" | "shortcut_import";
  sourceName?: string;
  externalId?: string;
  fingerprint: string;
  importId?: string;
  createdAt: string;
  updatedAt: string;
};

export type HealthMetricType =
  | "steps"
  | "active_energy"
  | "resting_energy"
  | "walking_running_distance"
  | "cycling_distance"
  | "exercise_minutes";

export const HEALTH_METRIC_UNITS: Record<HealthMetricType, string> = {
  steps: "count",
  active_energy: "kcal",
  resting_energy: "kcal",
  walking_running_distance: "km",
  cycling_distance: "km",
  exercise_minutes: "min",
};

/** Cumulative Health samples (steps, energy...). Summed per local date for the dashboard. */
export type HealthMetric = {
  id: string;
  metric: HealthMetricType;
  startAt: string;
  endAt: string;
  localDate: string;
  value: number;
  unit: string;
  originalValue: string;
  originalUnit?: string;
  source: "apple_health_import" | "shortcut_import";
  sourceName?: string;
  externalId?: string;
  fingerprint: string;
  importId: string;
  createdAt: string;
};

export type HealthImport = {
  id: string;
  importedAt: string;
  fileName: string;
  format: "json" | "csv";
  source: "apple_health_import" | "shortcut_import";
  rangeStart?: string;
  rangeEnd?: string;
  added: number;
  skippedDuplicates: number;
  invalid: number;
};

export type BodyMeasurement = {
  id: string;
  measuredAt: string;
  localDate: string;
  weightKg?: number;
  waistCm?: number;
  chestCm?: number;
  hipCm?: number;
  armCm?: number;
  thighCm?: number;
  notes?: string;
  photo?: Blob;
  photoThumb?: Blob;
  source: "manual" | "apple_health_import" | "shortcut_import";
  fingerprint?: string;
  createdAt: string;
  updatedAt: string;
};

export type Equipment =
  | "bodyweight"
  | "dumbbell"
  | "barbell"
  | "machine"
  | "cable"
  | "resistance_band"
  | "kettlebell";

export type MovementPattern = "push" | "pull" | "squat" | "hinge" | "lunge" | "carry" | "core";

export type Exercise = {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  equipment: Equipment;
  pattern: MovementPattern;
  instructions: string;
  alternatives: string[];
  needsCaution?: boolean;
  isCustom: boolean;
  createdAt: string;
};

export type Split = "full_body" | "upper_lower" | "push_pull_legs" | "custom";

export type TrainingProgram = {
  id: string;
  name: string;
  goal?: string;
  split: Split;
  daysPerWeek: number;
  startDate?: string;
  endDate?: string;
  status: "active" | "inactive" | "archived";
  deloadActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProgramDay = {
  id: string;
  programId: string;
  name: string;
  order: number;
  /** 0 = Sunday … 6 = Saturday. Empty means unscheduled (any day). */
  weekdays: number[];
};

export type ProgramExercise = {
  id: string;
  programDayId: string;
  exerciseId: string;
  order: number;
  targetSets: number;
  repMin: number;
  repMax: number;
  targetWeightKg?: number;
  restSeconds: number;
  notes?: string;
};

export type WorkoutSession = {
  id: string;
  programId?: string;
  programDayId?: string;
  name: string;
  startedAt: string;
  endedAt?: string;
  localDate: string;
  status: "in_progress" | "completed";
  isDeload: boolean;
  energyLevel?: number; // 1-5
  painNotes?: string;
  hadPain: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkoutSet = {
  id: string;
  sessionId: string;
  exerciseId: string;
  exerciseOrder: number;
  setNumber: number;
  targetRepMin?: number;
  targetRepMax?: number;
  reps?: number;
  weightKg?: number;
  rpe?: number;
  restSeconds?: number;
  completed: boolean;
  skipped: boolean;
  createdAt: string;
};

export type AiAnalysis = {
  id: string;
  foodEntryId?: string;
  channel: "manual_handoff" | "api";
  model: string;
  prompt: string;
  rawResult: string;
  parsed?: AiFoodResult;
  status: Verification;
  createdAt: string;
};

export type AiFoodResult = {
  food_name: string;
  components?: { name: string; estimated_portion?: string }[];
  portion_assumption?: string;
  calories_kcal: number;
  calories_range?: [number, number];
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence?: "low" | "medium" | "high";
  clarifying_questions?: string[];
};

export type DailyNote = {
  id: string;
  localDate: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type AppSetting = { key: string; value: unknown };
export type SchemaMeta = { key: string; value: unknown };
