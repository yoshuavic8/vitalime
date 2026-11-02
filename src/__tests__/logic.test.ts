import { describe, expect, it } from "vitest";
import { weightSeries } from "../db/repo/body";
import { progressionHint } from "../db/repo/training";
import type { ActivityEntry, BodyMeasurement, WorkoutSession, WorkoutSet } from "../db/types";
import { parseAiFoodResult } from "../lib/aiHandoff";
import { resolveEnergy } from "../services/reports";

describe("resolveEnergy", () => {
  const run = { activeEnergyKcal: 340 } as ActivityEntry;

  it("prefers the Health daily total so workout energy is not counted twice", () => {
    expect(resolveEnergy({ active_energy: 620, resting_energy: 1650 }, [run])).toEqual({
      activeKcal: 620,
      activeSource: "health",
      restingKcal: 1650,
    });
  });

  it("falls back to logged workouts, and stays undefined when nothing is recorded", () => {
    expect(resolveEnergy({}, [run]).activeKcal).toBe(340);
    expect(resolveEnergy({}, []).activeKcal).toBeUndefined();
  });
});

describe("weightSeries", () => {
  const m = (localDate: string, weightKg: number) => ({ localDate, weightKg }) as BodyMeasurement;

  it("averages over calendar days and needs at least 3 points", () => {
    const s = weightSeries([m("2026-11-01", 72), m("2026-11-02", 73), m("2026-11-03", 74), m("2026-11-20", 70)]);
    expect(s[1].avg7).toBeUndefined();
    expect(s[2].avg7).toBe(73);
    expect(s[3].avg7).toBeUndefined();
  });
});

describe("progressionHint", () => {
  const session = (patch: Partial<WorkoutSession> = {}) => ({ id: "s", ...patch }) as WorkoutSession;
  const set = (reps: number, rpe?: number) => ({ completed: true, reps, rpe, weightKg: 20 }) as WorkoutSet;

  it("suggests an increase only when every set hit the top of the range", () => {
    expect(progressionHint({ session: session(), sets: [set(12), set(12)] }, { repMax: 12, targetSets: 2 })?.kind).toBe("increase");
    expect(progressionHint({ session: session(), sets: [set(12), set(10)] }, { repMax: 12, targetSets: 2 })?.kind).toBe("hold");
    expect(progressionHint({ session: session(), sets: [set(12, 10), set(12)] }, { repMax: 12, targetSets: 2 })?.kind).toBe("hold");
  });

  it("never suggests an increase after a session with pain", () => {
    expect(progressionHint({ session: session({ hadPain: true }), sets: [set(12)] }, { repMax: 12 })?.kind).toBe("caution");
  });
});

describe("parseAiFoodResult", () => {
  it("accepts JSON wrapped in prose and code fences", () => {
    const r = parseAiFoodResult(
      'Berikut hasilnya:\n```json\n{"food_name":"Nasi goreng","calories_kcal":620,"protein_g":18,"carbs_g":80,"fat_g":24,"confidence":"medium"}\n```',
    );
    expect(r).toMatchObject({ food_name: "Nasi goreng", calories_kcal: 620, confidence: "medium" });
  });

  it("rejects negative or missing numbers", () => {
    expect(() => parseAiFoodResult('{"calories_kcal":-1,"protein_g":1,"carbs_g":1,"fat_g":1}')).toThrow("calories_kcal");
    expect(() => parseAiFoodResult("tidak ada json")).toThrow();
  });

  it("keeps per-component grams and drops placeholder rows", () => {
    const r = parseAiFoodResult(
      JSON.stringify({
        food_name: "Nasi ayam",
        calories_kcal: 650,
        protein_g: 38,
        carbs_g: 75,
        fat_g: 20,
        components: [
          { name: "Nasi putih", estimated_portion: "1 centong (~100 g)", grams: 100, calories_kcal: 130 },
          { name: "string" },
        ],
      }),
    );
    expect(r.components).toHaveLength(1);
    expect(r.components![0]).toMatchObject({ name: "Nasi putih", grams: 100, calories_kcal: 130 });
  });
});
