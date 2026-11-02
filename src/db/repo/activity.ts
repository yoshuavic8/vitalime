import { db } from "../db";
import type { ActivityEntry, BodyMeasurement, HealthImport, HealthMetric, HealthMetricType } from "../types";
import { newId, hashString } from "../../lib/id";
import { nowIso, toLocalDate } from "../../lib/date";

export type ActivityInput = Omit<
  ActivityEntry,
  "id" | "createdAt" | "updatedAt" | "localDate" | "fingerprint" | "source"
>;

export function activityFingerprint(a: {
  activityType: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  sourceName?: string;
}): string {
  const start = new Date(a.startedAt).toISOString().slice(0, 16);
  const end = a.endedAt ? new Date(a.endedAt).toISOString().slice(0, 16) : "";
  return hashString(
    ["workout", a.activityType.toLowerCase(), start, end, Math.round(a.durationMinutes ?? 0), a.sourceName ?? ""].join("|"),
  );
}

export function metricFingerprint(m: {
  metric: HealthMetricType;
  startAt: string;
  endAt: string;
  value: number;
  unit: string;
  sourceName?: string;
}): string {
  return hashString(
    [
      m.metric,
      new Date(m.startAt).toISOString(),
      new Date(m.endAt).toISOString(),
      m.value.toFixed(3),
      m.unit,
      m.sourceName ?? "",
    ].join("|"),
  );
}

export async function listActivitiesByDate(localDate: string) {
  return db.activityEntries.where("localDate").equals(localDate).sortBy("startedAt");
}

export async function listActivitiesBetween(from: string, to: string) {
  return db.activityEntries.where("localDate").between(from, to, true, true).toArray();
}

export async function listRecentActivities(limit = 60) {
  return db.activityEntries.orderBy("startedAt").reverse().limit(limit).toArray();
}

export async function saveManualActivity(input: ActivityInput, id?: string) {
  const now = nowIso();
  const existing = id ? await db.activityEntries.get(id) : undefined;
  const entryId = id ?? newId();
  await db.activityEntries.put({
    ...input,
    id: entryId,
    source: "manual",
    localDate: toLocalDate(input.startedAt),
    // Manual entries are never de-duplicated against each other.
    fingerprint: `manual:${entryId}`,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  return entryId;
}

export async function deleteActivity(id: string) {
  await db.activityEntries.delete(id);
}

export type DailyHealthTotals = Partial<Record<HealthMetricType, number>>;

export async function healthTotalsFor(localDate: string): Promise<DailyHealthTotals> {
  const rows = await db.healthMetrics.where("localDate").equals(localDate).toArray();
  const totals: DailyHealthTotals = {};
  for (const r of rows) totals[r.metric] = (totals[r.metric] ?? 0) + r.value;
  return totals;
}

export async function healthTotalsBetween(from: string, to: string) {
  const rows = await db.healthMetrics.where("localDate").between(from, to, true, true).toArray();
  const byDate: Record<string, DailyHealthTotals> = {};
  for (const r of rows) {
    const t = (byDate[r.localDate] ??= {});
    t[r.metric] = (t[r.metric] ?? 0) + r.value;
  }
  return byDate;
}

export async function listImports() {
  return db.healthImports.orderBy("importedAt").reverse().toArray();
}

export async function lastImport(): Promise<HealthImport | undefined> {
  return db.healthImports.orderBy("importedAt").last();
}

/** Removes everything a single import added, so a bad file can be rolled back. */
export async function undoImport(importId: string) {
  await db.transaction("rw", db.activityEntries, db.healthMetrics, db.bodyMeasurements, db.healthImports, async () => {
    await db.activityEntries.where("importId").equals(importId).delete();
    await db.healthMetrics.where("importId").equals(importId).delete();
    await db.bodyMeasurements.filter((b) => b.fingerprint?.startsWith(`${importId}:`) ?? false).delete();
    await db.healthImports.delete(importId);
  });
}

export type PreparedImport = {
  workouts: Omit<ActivityEntry, "importId">[];
  metrics: Omit<HealthMetric, "importId">[];
  bodyMass: { measuredAt: string; weightKg: number; fingerprint: string }[];
};

export type ImportPreview = {
  workoutsNew: number;
  workoutsDup: number;
  metricsNew: number;
  metricsDup: number;
  bodyNew: number;
  bodyDup: number;
};

async function existingFingerprints(table: "activityEntries" | "healthMetrics", fps: string[]) {
  if (!fps.length) return new Set<string>();
  const rows = await db[table].where("fingerprint").anyOf(fps).toArray();
  return new Set(rows.map((r) => r.fingerprint));
}

async function existingBodyFingerprints(fps: string[]) {
  const set = new Set(fps);
  const found = new Set<string>();
  await db.bodyMeasurements.each((b) => {
    const fp = b.fingerprint?.split(":").slice(1).join(":");
    if (fp && set.has(fp)) found.add(fp);
  });
  return found;
}

export async function previewImport(p: PreparedImport): Promise<ImportPreview> {
  const [w, m, b] = await Promise.all([
    existingFingerprints("activityEntries", p.workouts.map((x) => x.fingerprint)),
    existingFingerprints("healthMetrics", p.metrics.map((x) => x.fingerprint)),
    existingBodyFingerprints(p.bodyMass.map((x) => x.fingerprint)),
  ]);
  return {
    workoutsNew: p.workouts.filter((x) => !w.has(x.fingerprint)).length,
    workoutsDup: p.workouts.filter((x) => w.has(x.fingerprint)).length,
    metricsNew: p.metrics.filter((x) => !m.has(x.fingerprint)).length,
    metricsDup: p.metrics.filter((x) => m.has(x.fingerprint)).length,
    bodyNew: p.bodyMass.filter((x) => !b.has(x.fingerprint)).length,
    bodyDup: p.bodyMass.filter((x) => b.has(x.fingerprint)).length,
  };
}

export async function commitImport(
  p: PreparedImport,
  meta: Pick<HealthImport, "fileName" | "format" | "source" | "invalid">,
): Promise<HealthImport> {
  const importId = newId();
  return db.transaction(
    "rw",
    [db.activityEntries, db.healthMetrics, db.bodyMeasurements, db.healthImports],
    async () => {
      const [w, m, b] = await Promise.all([
        existingFingerprints("activityEntries", p.workouts.map((x) => x.fingerprint)),
        existingFingerprints("healthMetrics", p.metrics.map((x) => x.fingerprint)),
        existingBodyFingerprints(p.bodyMass.map((x) => x.fingerprint)),
      ]);
      // De-dupe within the file itself as well as against the database.
      const seen = new Set<string>();
      const fresh = <T extends { fingerprint: string }>(rows: T[], existing: Set<string>) =>
        rows.filter((r) => {
          if (existing.has(r.fingerprint) || seen.has(r.fingerprint)) return false;
          seen.add(r.fingerprint);
          return true;
        });

      const workouts = fresh(p.workouts, w).map((x) => ({ ...x, importId }));
      const metrics = fresh(p.metrics, m).map((x) => ({ ...x, importId }));
      const body = fresh(p.bodyMass, b);
      const now = nowIso();

      await db.activityEntries.bulkAdd(workouts);
      await db.healthMetrics.bulkAdd(metrics);
      await db.bodyMeasurements.bulkAdd(
        body.map<BodyMeasurement>((x) => ({
          id: newId(),
          measuredAt: x.measuredAt,
          localDate: toLocalDate(x.measuredAt),
          weightKg: x.weightKg,
          source: meta.source,
          fingerprint: `${importId}:${x.fingerprint}`,
          createdAt: now,
          updatedAt: now,
        })),
      );

      const dates = [...workouts.map((x) => x.localDate), ...metrics.map((x) => x.localDate)].sort();
      const total = p.workouts.length + p.metrics.length + p.bodyMass.length;
      const added = workouts.length + metrics.length + body.length;
      const record: HealthImport = {
        id: importId,
        importedAt: now,
        fileName: meta.fileName,
        format: meta.format,
        source: meta.source,
        rangeStart: dates[0],
        rangeEnd: dates[dates.length - 1],
        added,
        skippedDuplicates: total - added,
        invalid: meta.invalid,
      };
      await db.healthImports.add(record);
      return record;
    },
  );
}
