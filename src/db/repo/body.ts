import { db } from "../db";
import type { BodyMeasurement, DailyNote } from "../types";
import { newId } from "../../lib/id";
import { addDays, nowIso, toLocalDate } from "../../lib/date";

export type MeasurementInput = Omit<
  BodyMeasurement,
  "id" | "createdAt" | "updatedAt" | "localDate" | "source" | "fingerprint"
>;

export async function listMeasurements(): Promise<BodyMeasurement[]> {
  return db.bodyMeasurements.orderBy("measuredAt").toArray();
}

export async function latestWeight(): Promise<BodyMeasurement | undefined> {
  const rows = await db.bodyMeasurements.orderBy("measuredAt").reverse().toArray();
  return rows.find((r) => r.weightKg != null);
}

export async function saveMeasurement(input: MeasurementInput, id?: string) {
  const now = nowIso();
  const existing = id ? await db.bodyMeasurements.get(id) : undefined;
  await db.bodyMeasurements.put({
    ...existing,
    ...input,
    id: id ?? newId(),
    localDate: toLocalDate(input.measuredAt),
    source: existing?.source ?? "manual",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function deleteMeasurement(id: string) {
  await db.bodyMeasurements.delete(id);
}

export type WeightPoint = { localDate: string; weightKg: number; avg7?: number };

/**
 * One point per day (last weigh-in of that day) plus a trailing 7-day moving average
 * computed over calendar days, so gaps don't distort the window.
 */
export function weightSeries(rows: BodyMeasurement[]): WeightPoint[] {
  const byDay = new Map<string, number>();
  for (const r of rows) if (r.weightKg != null) byDay.set(r.localDate, r.weightKg);
  const days = [...byDay.keys()].sort();
  return days.map((d) => {
    const windowStart = addDays(d, -6);
    const win = days.filter((x) => x >= windowStart && x <= d).map((x) => byDay.get(x)!);
    return {
      localDate: d,
      weightKg: byDay.get(d)!,
      avg7: win.length >= 3 ? win.reduce((a, b) => a + b, 0) / win.length : undefined,
    };
  });
}

export async function getDailyNote(localDate: string): Promise<DailyNote | undefined> {
  return db.dailyNotes.where("localDate").equals(localDate).first();
}

export async function saveDailyNote(localDate: string, text: string) {
  const existing = await getDailyNote(localDate);
  const now = nowIso();
  if (!text.trim()) {
    if (existing) await db.dailyNotes.delete(existing.id);
    return;
  }
  await db.dailyNotes.put({
    id: existing?.id ?? newId(),
    localDate,
    text,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}
