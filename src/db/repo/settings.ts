import { db } from "../db";
import type { Goal, Profile } from "../types";
import { newId } from "../../lib/id";
import { nowIso, todayLocal } from "../../lib/date";

export const DEFAULT_GOAL: Omit<Goal, "id" | "createdAt" | "updatedAt" | "effectiveFrom"> = {
  caloriesKcal: 2000,
  proteinG: 120,
  carbsG: 220,
  fatG: 65,
  targetMode: "fixed",
  stepsTarget: 8000,
};

export async function getProfile(): Promise<Profile | undefined> {
  return db.profile.get("me");
}

export async function saveProfile(patch: Partial<Omit<Profile, "id" | "createdAt" | "updatedAt">>) {
  const existing = await getProfile();
  const now = nowIso();
  await db.profile.put({
    id: "me",
    sex: "unspecified",
    ...existing,
    ...patch,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

/** The goal in effect on a given date (latest effectiveFrom <= date). */
export async function getGoalFor(localDate: string): Promise<Goal | undefined> {
  return db.goals.where("effectiveFrom").belowOrEqual(localDate).last();
}

/** Falls back to DEFAULT_GOAL (flagged) so dashboards always have a target to compare against. */
export async function getGoalOrDefault(localDate: string): Promise<{ goal: Goal; isDefault: boolean }> {
  const goal = await getGoalFor(localDate);
  if (goal) return { goal, isDefault: false };
  return {
    goal: { ...DEFAULT_GOAL, id: "default", effectiveFrom: localDate, createdAt: "", updatedAt: "" },
    isDefault: true,
  };
}

export async function listGoals(): Promise<Goal[]> {
  return db.goals.orderBy("effectiveFrom").reverse().toArray();
}

/** Goals are versioned by date so past days keep the target that applied then. */
export async function saveGoal(values: Omit<Goal, "id" | "createdAt" | "updatedAt" | "effectiveFrom">) {
  const effectiveFrom = todayLocal();
  const now = nowIso();
  const existing = await db.goals.where("effectiveFrom").equals(effectiveFrom).first();
  await db.goals.put({
    id: existing?.id ?? newId(),
    effectiveFrom,
    ...values,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.appSettings.get(key);
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown) {
  await db.appSettings.put({ key, value });
}

export const SETTING_KEYS = {
  onboarded: "onboarded",
  lastBackupAt: "lastBackupAt",
  aiConsent: "aiConsent",
  aiModelLabel: "aiModelLabel",
  persistGranted: "persistGranted",
} as const;
