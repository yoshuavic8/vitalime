import type { HealthMetricType } from "../db/types";
import { activityFingerprint, metricFingerprint, type PreparedImport } from "../db/repo/activity";
import { hashString, newId } from "./id";
import { nowIso, toLocalDate } from "./date";
import { parseNum } from "./format";
import { parseCsv } from "./csv";

export type ParseResult = {
  prepared: PreparedImport;
  invalid: number;
  warnings: string[];
  source: "apple_health_import" | "shortcut_import";
};

const METRIC_ALIASES: Record<string, HealthMetricType | "body_mass"> = {
  steps: "steps",
  step_count: "steps",
  stepcount: "steps",
  langkah: "steps",
  active_energy: "active_energy",
  activeenergy: "active_energy",
  active_energy_burned: "active_energy",
  activeenergyburned: "active_energy",
  resting_energy: "resting_energy",
  restingenergy: "resting_energy",
  basal_energy_burned: "resting_energy",
  basalenergyburned: "resting_energy",
  walking_running_distance: "walking_running_distance",
  walking_and_running_distance: "walking_running_distance",
  distancewalkingrunning: "walking_running_distance",
  cycling_distance: "cycling_distance",
  distancecycling: "cycling_distance",
  exercise_minutes: "exercise_minutes",
  exercise_time: "exercise_minutes",
  appleexercisetime: "exercise_minutes",
  body_mass: "body_mass",
  bodymass: "body_mass",
  weight: "body_mass",
};

function normaliseMetric(raw: unknown): HealthMetricType | "body_mass" | undefined {
  if (typeof raw !== "string") return undefined;
  const key = raw
    .trim()
    .toLowerCase()
    .replace(/^hkquantitytypeidentifier/, "")
    .replace(/[\s-]+/g, "_");
  return METRIC_ALIASES[key] ?? METRIC_ALIASES[key.replace(/_/g, "")];
}

/** Converts to the canonical unit per metric (kcal, km, min, count, kg). */
function convert(metric: HealthMetricType | "body_mass", value: number, unit?: string): number | undefined {
  const u = (unit ?? "").trim().toLowerCase();
  switch (metric) {
    case "steps":
      return value;
    case "active_energy":
    case "resting_energy":
      if (!u || u === "kcal" || u === "cal" || u === "kilocalories" || u === "kkal") return value;
      if (u === "kj") return value / 4.184;
      return undefined;
    case "walking_running_distance":
    case "cycling_distance":
      if (!u || u === "km") return value;
      if (u === "m") return value / 1000;
      if (u === "mi") return value * 1.609344;
      return undefined;
    case "exercise_minutes":
      if (!u || u === "min" || u === "menit") return value;
      if (u === "h" || u === "hr") return value * 60;
      if (u === "s") return value / 60;
      return undefined;
    case "body_mass":
      if (!u || u === "kg") return value;
      if (u === "lb" || u === "lbs") return value * 0.45359237;
      if (u === "g") return value / 1000;
      return undefined;
    default: {
      const exhaustive: never = metric;
      return exhaustive;
    }
  }
}

function validIso(raw: unknown): string | undefined {
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

type RawWorkout = Record<string, unknown>;
type RawSample = Record<string, unknown>;

function buildPrepared(
  rawWorkouts: RawWorkout[],
  rawSamples: RawSample[],
  source: ParseResult["source"],
): ParseResult {
  const prepared: PreparedImport = { workouts: [], metrics: [], bodyMass: [] };
  const warnings: string[] = [];
  let invalid = 0;
  const now = nowIso();

  for (const w of rawWorkouts) {
    const startedAt = validIso(w.start ?? w.startDate ?? w.started_at ?? w.startedAt);
    const type = str(w.type ?? w.activityType ?? w.workoutActivityType ?? w.name) ?? "Workout";
    if (!startedAt) {
      invalid++;
      continue;
    }
    const endedAt = validIso(w.end ?? w.endDate ?? w.ended_at ?? w.endedAt);
    let durationMinutes = parseNum(w.durationMin ?? w.duration_min ?? w.duration);
    if (durationMinutes == null && endedAt) {
      durationMinutes = (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000;
    }
    const sourceName = str(w.source ?? w.sourceName);
    const base = {
      activityType: type.replace(/^HKWorkoutActivityType/, ""),
      startedAt,
      endedAt,
      durationMinutes: durationMinutes != null ? Math.round(durationMinutes * 10) / 10 : undefined,
      sourceName,
    };
    const externalId = str(w.id ?? w.uuid);
    prepared.workouts.push({
      ...base,
      id: newId(),
      localDate: toLocalDate(startedAt),
      distanceKm: parseNum(w.distanceKm ?? w.distance_km ?? w.distance),
      activeEnergyKcal: parseNum(w.activeEnergyKcal ?? w.active_kcal ?? w.activeEnergy ?? w.energy),
      averageHeartRate: parseNum(w.avgHeartRate ?? w.avg_hr ?? w.averageHeartRate),
      maxHeartRate: parseNum(w.maxHeartRate ?? w.max_hr),
      source,
      externalId,
      fingerprint: externalId ? hashString(`ext|${externalId}`) : activityFingerprint(base),
      createdAt: now,
      updatedAt: now,
    });
  }

  const unknownTypes = new Set<string>();
  for (const s of rawSamples) {
    const metric = normaliseMetric(s.type ?? s.metric ?? s.name);
    const startAt = validIso(s.start ?? s.startDate ?? s.date);
    const endAt = validIso(s.end ?? s.endDate) ?? startAt;
    const originalValue = s.value ?? s.qty ?? s.quantity;
    const value = parseNum(originalValue);
    const unit = str(s.unit);
    if (!metric) {
      if (typeof s.type === "string") unknownTypes.add(s.type);
      invalid++;
      continue;
    }
    if (!startAt || !endAt || value == null) {
      invalid++;
      continue;
    }
    const converted = convert(metric, value, unit);
    if (converted == null) {
      warnings.push(`Unit "${unit}" tidak dikenali untuk ${metric}; baris dilewati.`);
      invalid++;
      continue;
    }
    const sourceName = str(s.source ?? s.sourceName);
    const externalId = str(s.id ?? s.uuid);
    if (metric === "body_mass") {
      prepared.bodyMass.push({
        measuredAt: startAt,
        weightKg: Math.round(converted * 100) / 100,
        fingerprint: externalId ? hashString(`ext|${externalId}`) : hashString(`bm|${startAt}|${converted.toFixed(2)}`),
      });
      continue;
    }
    const canonUnit = metric === "steps" ? "count" : metric.includes("energy") ? "kcal" : metric.includes("distance") ? "km" : "min";
    prepared.metrics.push({
      id: newId(),
      metric,
      startAt,
      endAt,
      localDate: toLocalDate(startAt),
      value: converted,
      unit: canonUnit,
      originalValue: String(originalValue),
      originalUnit: unit,
      source,
      sourceName,
      externalId,
      fingerprint: externalId
        ? hashString(`ext|${externalId}`)
        : metricFingerprint({ metric, startAt, endAt, value: converted, unit: canonUnit, sourceName }),
      createdAt: now,
    });
  }
  if (unknownTypes.size) warnings.push(`Tipe data tidak didukung: ${[...unknownTypes].slice(0, 6).join(", ")}`);

  return { prepared, invalid, warnings: [...new Set(warnings)], source };
}

function asArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];
}

export function parseHealthJson(text: string): ParseResult {
  const data: unknown = JSON.parse(text);
  if (Array.isArray(data)) {
    // A bare array: rows with a `start`+`type`+`value` are samples, everything else workouts.
    const rows = asArray(data);
    const samples = rows.filter((r) => "value" in r || "qty" in r);
    const workouts = rows.filter((r) => !("value" in r || "qty" in r));
    return buildPrepared(workouts, samples, "shortcut_import");
  }
  if (!data || typeof data !== "object") throw new Error("Format JSON tidak dikenali.");
  const obj = data as Record<string, unknown>;
  const source = obj.source === "apple_health_import" ? "apple_health_import" : "shortcut_import";
  return buildPrepared(asArray(obj.workouts), asArray(obj.samples), source);
}

export function parseHealthCsv(text: string): ParseResult {
  const rows = parseCsv(text);
  const workouts: RawWorkout[] = [];
  const samples: RawSample[] = [];
  for (const r of rows) {
    const record = (r.record ?? r.kind ?? "sample").toLowerCase();
    if (record === "workout") {
      workouts.push({
        type: r.type,
        start: r.start,
        end: r.end,
        durationMin: r.duration_min,
        distanceKm: r.distance_km,
        activeEnergyKcal: r.active_kcal,
        avgHeartRate: r.avg_hr,
        maxHeartRate: r.max_hr,
        source: r.source,
        id: r.id,
      });
    } else {
      samples.push({ type: r.type, start: r.start, end: r.end, value: r.value, unit: r.unit, source: r.source, id: r.id });
    }
  }
  return buildPrepared(workouts, samples, "shortcut_import");
}

export const SAMPLE_HEALTH_JSON = `{
  "format": "vitalime-health-v1",
  "source": "shortcut_import",
  "exportedAt": "2026-11-02T21:00:00+07:00",
  "workouts": [
    {
      "type": "Running",
      "start": "2026-11-02T06:10:00+07:00",
      "end": "2026-11-02T06:42:00+07:00",
      "distanceKm": 5.1,
      "activeEnergyKcal": 340,
      "avgHeartRate": 152,
      "source": "Apple Watch"
    }
  ],
  "samples": [
    { "type": "steps", "start": "2026-11-02T00:00:00+07:00", "end": "2026-11-02T23:59:00+07:00", "value": 9120, "unit": "count" },
    { "type": "active_energy", "start": "2026-11-02T00:00:00+07:00", "end": "2026-11-02T23:59:00+07:00", "value": 620, "unit": "kcal" },
    { "type": "resting_energy", "start": "2026-11-02T00:00:00+07:00", "end": "2026-11-02T23:59:00+07:00", "value": 1650, "unit": "kcal" },
    { "type": "body_mass", "start": "2026-11-02T06:00:00+07:00", "value": 72.4, "unit": "kg" }
  ]
}`;

export const SAMPLE_HEALTH_CSV = `record,type,start,end,value,unit,duration_min,distance_km,active_kcal,avg_hr,source
workout,Running,2026-11-02T06:10:00+07:00,2026-11-02T06:42:00+07:00,,,32,5.1,340,152,Apple Watch
sample,steps,2026-11-02T00:00:00+07:00,2026-11-02T23:59:00+07:00,9120,count,,,,,iPhone
sample,active_energy,2026-11-02T00:00:00+07:00,2026-11-02T23:59:00+07:00,620,kcal,,,,,Apple Watch`;
