import { db } from "../db";
import type { AiAnalysis } from "../types";
import { newId } from "../../lib/id";
import { nowIso } from "../../lib/date";

export async function saveAiAnalysis(input: Omit<AiAnalysis, "id" | "createdAt">) {
  const id = newId();
  await db.aiAnalyses.add({ ...input, id, createdAt: nowIso() });
  return id;
}

/** Links pending analyses to the entry once it is saved and records the final verification. */
export async function attachAnalyses(ids: string[], foodEntryId: string, status: AiAnalysis["status"]) {
  if (!ids.length) return;
  await db.aiAnalyses.where("id").anyOf(ids).modify({ foodEntryId, status });
}

export async function listAnalysesFor(foodEntryId: string) {
  return db.aiAnalyses.where("foodEntryId").equals(foodEntryId).sortBy("createdAt");
}
