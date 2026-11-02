import { beforeEach, describe, expect, it } from "vitest";
import { ALL_TABLES, db } from "../db/db";
import { commitImport, previewImport, undoImport } from "../db/repo/activity";
import { saveMeasurement } from "../db/repo/body";
import { saveFoodEntry } from "../db/repo/food";
import { createBackup, exportBackupFile, isEncryptedBackup, readBackup, restoreBackup } from "../lib/backup";
import { parseHealthCsv, parseHealthJson, SAMPLE_HEALTH_CSV, SAMPLE_HEALTH_JSON } from "../lib/healthImport";

async function counts() {
  return Object.fromEntries(await Promise.all(ALL_TABLES.map(async (n) => [n, await db.table(n).count()])));
}

beforeEach(async () => {
  await Promise.all(ALL_TABLES.map((n) => db.table(n).clear()));
});

const food = {
  name: "Nasi ayam",
  mealType: "lunch" as const,
  consumedAt: "2026-11-02T12:30:00+07:00",
  caloriesKcal: 650,
  proteinG: 38,
  carbsG: 75,
  fatG: 20,
  source: "manual" as const,
  verification: "confirmed" as const,
};

describe("Apple Health import", () => {
  it("previews, commits, and skips duplicates on re-import", async () => {
    const parsed = parseHealthJson(SAMPLE_HEALTH_JSON);
    expect(await previewImport(parsed.prepared)).toMatchObject({ workoutsNew: 1, metricsNew: 3, bodyNew: 1 });

    const first = await commitImport(parsed.prepared, { fileName: "a.json", format: "json", source: parsed.source, invalid: 0 });
    expect(first.added).toBe(5);

    const again = parseHealthJson(SAMPLE_HEALTH_JSON);
    expect(await previewImport(again.prepared)).toMatchObject({ workoutsNew: 0, metricsNew: 0, bodyNew: 0, workoutsDup: 1 });
    const second = await commitImport(again.prepared, { fileName: "a.json", format: "json", source: again.source, invalid: 0 });
    expect(second.added).toBe(0);
    expect(second.skippedDuplicates).toBe(5);
    expect(await db.healthMetrics.count()).toBe(3);
  });

  it("treats the same data as CSV as duplicates of the JSON import", async () => {
    const json = parseHealthJson(SAMPLE_HEALTH_JSON);
    await commitImport(json.prepared, { fileName: "a.json", format: "json", source: json.source, invalid: 0 });
    const csv = parseHealthCsv(SAMPLE_HEALTH_CSV);
    const preview = await previewImport(csv.prepared);
    expect(preview.workoutsNew).toBe(0);
  });

  it("undo removes exactly what one import added", async () => {
    const parsed = parseHealthJson(SAMPLE_HEALTH_JSON);
    const rec = await commitImport(parsed.prepared, { fileName: "a.json", format: "json", source: parsed.source, invalid: 0 });
    await undoImport(rec.id);
    const c = await counts();
    expect(c.activityEntries + c.healthMetrics + c.bodyMeasurements + c.healthImports).toBe(0);
  });

  it("rejects unsupported types without failing the file", () => {
    const parsed = parseHealthJson(
      JSON.stringify({ samples: [{ type: "steps", start: "2026-11-02T00:00:00+07:00", value: 10 }, { type: "hrv", value: 40 }] }),
    );
    expect(parsed.prepared.metrics).toHaveLength(1);
    expect(parsed.invalid).toBe(1);
  });
});

describe("backup / restore", () => {
  it("survives an encrypted round-trip with replace", async () => {
    await saveFoodEntry(food);
    await saveMeasurement({ measuredAt: "2026-11-02T06:00:00+07:00", weightKg: 72.4 });
    const before = await counts();

    const file = await exportBackupFile({ includePhotos: true, passphrase: "rahasia123" });
    const text = await file.text();
    expect(isEncryptedBackup(text)).toBe(true);
    expect(text).not.toContain("Nasi ayam");
    await expect(readBackup(text, "salah")).rejects.toThrow("Passphrase salah");

    const { backup } = await readBackup(text, "rahasia123");
    await Promise.all(ALL_TABLES.map((n) => db.table(n).clear()));
    await restoreBackup(backup, "replace");
    expect(await counts()).toEqual(before);
    expect((await db.foodEntries.toArray())[0].name).toBe("Nasi ayam");
  });

  it("merge keeps local-only records", async () => {
    await saveFoodEntry(food);
    const backup = await createBackup({ includePhotos: false });
    await saveFoodEntry({ ...food, name: "Roti" });
    await restoreBackup(backup, "merge");
    expect((await db.foodEntries.toArray()).map((f) => f.name).sort()).toEqual(["Nasi ayam", "Roti"]);
  });

  it("refuses backups from a newer schema", async () => {
    const backup = await createBackup({ includePhotos: false });
    await expect(readBackup(JSON.stringify({ ...backup, schemaVersion: 999 }))).rejects.toThrow("versi skema");
  });
});
