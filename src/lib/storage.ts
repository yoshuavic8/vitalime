import { db, ALL_TABLES } from "../db/db";

export async function requestPersistentStorage(): Promise<boolean | undefined> {
  if (!navigator.storage?.persist) return undefined;
  if (await navigator.storage.persisted?.()) return true;
  return navigator.storage.persist();
}

export async function storageEstimate() {
  if (!navigator.storage?.estimate) return undefined;
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export async function resetAllData() {
  await db.transaction("rw", ALL_TABLES.map((n) => db.table(n)), async () => {
    for (const name of ALL_TABLES) await db.table(name).clear();
  });
}
