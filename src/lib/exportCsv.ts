import { db } from "../db/db";
import { toCsv } from "./csv";

export type CsvKind = "food" | "activity" | "measurements" | "workouts";

export async function buildCsv(kind: CsvKind): Promise<File> {
  let csv: string;
  switch (kind) {
    case "food": {
      const rows = await db.foodEntries.orderBy("consumedAt").toArray();
      csv = toCsv(rows, [
        "localDate", "consumedAt", "mealType", "name", "portionValue", "portionUnit",
        "caloriesKcal", "proteinG", "carbsG", "fatG", "source", "verification", "notes",
      ]);
      break;
    }
    case "activity": {
      const rows = await db.activityEntries.orderBy("startedAt").toArray();
      csv = toCsv(rows, [
        "localDate", "startedAt", "endedAt", "activityType", "durationMinutes", "distanceKm",
        "activeEnergyKcal", "averageHeartRate", "maxHeartRate", "source", "sourceName", "notes",
      ]);
      break;
    }
    case "measurements": {
      const rows = await db.bodyMeasurements.orderBy("measuredAt").toArray();
      csv = toCsv(rows, ["localDate", "measuredAt", "weightKg", "waistCm", "chestCm", "hipCm", "armCm", "thighCm", "source", "notes"]);
      break;
    }
    case "workouts": {
      const [sets, sessions, exercises] = await Promise.all([
        db.workoutSets.toArray(),
        db.workoutSessions.toArray(),
        db.exerciseLibrary.toArray(),
      ]);
      const s = new Map(sessions.map((x) => [x.id, x]));
      const e = new Map(exercises.map((x) => [x.id, x]));
      const rows = sets
        .map((set) => ({
          date: s.get(set.sessionId)?.localDate ?? "",
          session: s.get(set.sessionId)?.name ?? "",
          exercise: e.get(set.exerciseId)?.name ?? set.exerciseId,
          setNumber: set.setNumber,
          weightKg: set.weightKg,
          reps: set.reps,
          durationSec: set.durationSec,
          distanceKm: set.distanceKm,
          rpe: set.rpe,
          completed: set.completed,
          skipped: set.skipped,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      csv = toCsv(rows, ["date", "session", "exercise", "setNumber", "weightKg", "reps", "durationSec", "distanceKm", "rpe", "completed", "skipped"]);
      break;
    }
    default: {
      const exhaustive: never = kind;
      throw new Error(`Unknown CSV kind: ${exhaustive}`);
    }
  }
  return new File(["\uFEFF" + csv], `vitalime-${kind}.csv`, { type: "text/csv" });
}
