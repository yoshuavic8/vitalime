import { db } from "../db";
import type { FoodEntry, FoodPhoto, FoodTemplate } from "../types";
import { newId } from "../../lib/id";
import { nowIso, toLocalDate } from "../../lib/date";
import type { ProcessedImage } from "../../lib/image";

export type FoodEntryInput = Omit<FoodEntry, "id" | "createdAt" | "updatedAt" | "localDate">;

export type NewPhoto = ProcessedImage & { sizeBytes: number };

export async function listFoodByDate(localDate: string): Promise<FoodEntry[]> {
  return db.foodEntries.where("localDate").equals(localDate).sortBy("consumedAt");
}

export async function listFoodBetween(from: string, to: string): Promise<FoodEntry[]> {
  return db.foodEntries.where("localDate").between(from, to, true, true).toArray();
}

export async function getFoodEntry(id: string) {
  return db.foodEntries.get(id);
}

export async function searchFoodHistory(query: string, limit = 30): Promise<FoodEntry[]> {
  const q = query.trim().toLowerCase();
  const all = await db.foodEntries.orderBy("consumedAt").reverse().toArray();
  const seen = new Set<string>();
  const out: FoodEntry[] = [];
  for (const e of all) {
    const key = e.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    if (q && !key.includes(q)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/** Saves the entry and its new photos atomically; removed photo ids are deleted in the same transaction. */
export async function saveFoodEntry(
  input: FoodEntryInput,
  opts: { id?: string; newPhotos?: NewPhoto[]; removedPhotoIds?: string[] } = {},
): Promise<string> {
  const now = nowIso();
  const id = opts.id ?? newId();
  await db.transaction("rw", db.foodEntries, db.foodPhotos, async () => {
    const existing = opts.id ? await db.foodEntries.get(opts.id) : undefined;
    await db.foodEntries.put({
      ...input,
      id,
      localDate: toLocalDate(input.consumedAt),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    if (opts.removedPhotoIds?.length) await db.foodPhotos.bulkDelete(opts.removedPhotoIds);
    for (const p of opts.newPhotos ?? []) {
      await db.foodPhotos.add({
        id: newId(),
        foodEntryId: id,
        blob: p.blob,
        thumb: p.thumb,
        mime: p.mime,
        width: p.width,
        height: p.height,
        sizeBytes: p.sizeBytes,
        createdAt: now,
      });
    }
  });
  return id;
}

export async function deleteFoodEntry(id: string) {
  await db.transaction("rw", db.foodEntries, db.foodPhotos, db.aiAnalyses, async () => {
    await db.foodPhotos.where("foodEntryId").equals(id).delete();
    await db.aiAnalyses.where("foodEntryId").equals(id).delete();
    await db.foodEntries.delete(id);
  });
}

export async function duplicateFoodEntry(id: string, toIso = nowIso()) {
  const e = await db.foodEntries.get(id);
  if (!e) return;
  const { id: _id, createdAt: _c, updatedAt: _u, localDate: _l, ...rest } = e;
  return saveFoodEntry({ ...rest, consumedAt: toIso });
}

export async function listPhotosFor(foodEntryId: string): Promise<FoodPhoto[]> {
  return db.foodPhotos.where("foodEntryId").equals(foodEntryId).sortBy("createdAt");
}

export async function firstThumbsFor(entryIds: string[]): Promise<Record<string, Blob>> {
  if (!entryIds.length) return {};
  const photos = await db.foodPhotos.where("foodEntryId").anyOf(entryIds).toArray();
  const out: Record<string, Blob> = {};
  for (const p of photos.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!out[p.foodEntryId]) out[p.foodEntryId] = p.thumb;
  }
  return out;
}

export async function photoStorageStats() {
  let count = 0;
  let originals = 0;
  let bytes = 0;
  await db.foodPhotos.each((p) => {
    count++;
    if (p.blob) {
      originals++;
      bytes += p.blob.size;
    }
    bytes += p.thumb.size;
  });
  return { count, originals, bytes };
}

/** Frees storage by dropping full-size originals older than `days`; thumbnails stay. */
export async function purgeOriginalPhotosOlderThan(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  return db.foodPhotos
    .where("createdAt")
    .below(cutoff)
    .filter((p) => p.blob !== null)
    .modify({ blob: null });
}

// ---- Templates -------------------------------------------------------------

export async function listTemplates(): Promise<FoodTemplate[]> {
  return db.foodTemplates.orderBy("useCount").reverse().toArray();
}

export async function saveTemplateFromEntry(entry: FoodEntryInput) {
  const now = nowIso();
  const existing = await db.foodTemplates
    .where("name")
    .equalsIgnoreCase(entry.name.trim())
    .first();
  await db.foodTemplates.put({
    id: existing?.id ?? newId(),
    name: entry.name.trim(),
    mealType: entry.mealType,
    portionValue: entry.portionValue,
    portionUnit: entry.portionUnit,
    caloriesKcal: entry.caloriesKcal,
    proteinG: entry.proteinG,
    carbsG: entry.carbsG,
    fatG: entry.fatG,
    notes: entry.notes,
    useCount: existing?.useCount ?? 0,
    lastUsedAt: existing?.lastUsedAt,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function markTemplateUsed(id: string) {
  const t = await db.foodTemplates.get(id);
  if (t) await db.foodTemplates.update(id, { useCount: t.useCount + 1, lastUsedAt: nowIso() });
}

export async function deleteTemplate(id: string) {
  await db.foodTemplates.delete(id);
}
