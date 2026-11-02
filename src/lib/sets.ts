import type { Exercise, ExerciseMetric, WorkoutSet } from "../db/types";
import { fmt1 } from "./format";

export const metricOf = (ex: Pick<Exercise, "metric"> | undefined): ExerciseMetric => ex?.metric ?? "reps";

/** Program targets reuse repMin/repMax: reps for "reps", seconds for "time", minutes for "cardio". */
export function defaultTargets(metric: ExerciseMetric) {
  switch (metric) {
    case "reps":
      return { targetSets: 3, repMin: 8, repMax: 12, restSeconds: 90 };
    case "time":
      return { targetSets: 3, repMin: 30, repMax: 45, restSeconds: 45 };
    case "cardio":
      return { targetSets: 1, repMin: 20, repMax: 30, restSeconds: 0 };
    default: {
      const never: never = metric;
      throw new Error(`Unknown metric ${never}`);
    }
  }
}

export function targetUnit(metric: ExerciseMetric) {
  switch (metric) {
    case "reps":
      return "rep";
    case "time":
      return "dtk";
    case "cardio":
      return "mnt";
    default: {
      const never: never = metric;
      throw new Error(`Unknown metric ${never}`);
    }
  }
}

export function targetLabel(min: number | undefined, max: number | undefined, metric: ExerciseMetric) {
  if (min == null && max == null) return undefined;
  const range = min != null && max != null && min !== max ? `${min}–${max}` : `${max ?? min}`;
  return `${range} ${targetUnit(metric)}`;
}

export function clock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatSet(s: WorkoutSet, metric: ExerciseMetric) {
  const rpe = s.rpe ? ` @${s.rpe}` : "";
  switch (metric) {
    case "reps":
      return `${fmt1(s.weightKg)}×${s.reps ?? "—"}${rpe}`;
    case "time":
      return `${s.durationSec != null ? `${s.durationSec} dtk` : "—"}${s.weightKg ? ` +${fmt1(s.weightKg)} kg` : ""}${rpe}`;
    case "cardio": {
      const min = s.durationSec != null ? `${Math.round(s.durationSec / 60)} mnt` : "—";
      return `${min}${s.distanceKm != null ? ` · ${fmt1(s.distanceKm)} km` : ""}${rpe}`;
    }
    default: {
      const never: never = metric;
      throw new Error(`Unknown metric ${never}`);
    }
  }
}
