import { ALL_TABLES, DB_NAME, SCHEMA_VERSION, db, type TableName } from "../db/db";
import { blobToDataUrl, dataUrlToBlob } from "./image";
import { nowIso } from "./date";
import { setSetting, SETTING_KEYS } from "../db/repo/settings";

export const BACKUP_FORMAT = "vitalime-backup";

type BackupFile = {
  format: typeof BACKUP_FORMAT;
  app: string;
  dbName: string;
  schemaVersion: number;
  exportedAt: string;
  tables: Partial<Record<TableName, unknown[]>>;
};

type EncryptedBackup = {
  format: "vitalime-backup-encrypted";
  version: 1;
  salt: string;
  iv: string;
  data: string;
};

const BLOB_TAG = "__blob__";

async function serialise(value: unknown): Promise<unknown> {
  if (value instanceof Blob) return { [BLOB_TAG]: await blobToDataUrl(value) };
  if (Array.isArray(value)) return Promise.all(value.map(serialise));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await serialise(v);
    return out;
  }
  return value;
}

async function deserialise(value: unknown): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map(deserialise));
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj[BLOB_TAG] === "string") return dataUrlToBlob(obj[BLOB_TAG] as string);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = await deserialise(v);
    return out;
  }
  return value;
}

export async function createBackup(opts: { includePhotos: boolean }): Promise<BackupFile> {
  const tables: BackupFile["tables"] = {};
  for (const name of ALL_TABLES) {
    let rows: unknown[] = await db.table(name).toArray();
    if (!opts.includePhotos && name === "foodPhotos") rows = rows.map((r) => ({ ...(r as object), blob: null }));
    if (!opts.includePhotos && name === "bodyMeasurements") {
      rows = rows.map((r) => ({ ...(r as object), photo: undefined }));
    }
    tables[name] = (await serialise(rows)) as unknown[];
  }
  return {
    format: BACKUP_FORMAT,
    app: "Vitalime",
    dbName: DB_NAME,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    tables,
  };
}

// ---- Optional passphrase encryption (AES-GCM, PBKDF2-SHA256) ----------------

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encrypt(plain: string, passphrase: string): Promise<EncryptedBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return { format: "vitalime-backup-encrypted", version: 1, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

async function decrypt(file: EncryptedBackup, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, unb64(file.salt));
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(file.iv) }, key, unb64(file.data));
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("Passphrase salah atau file rusak.");
  }
}

export async function exportBackupFile(opts: { includePhotos: boolean; passphrase?: string }): Promise<File> {
  const backup = await createBackup(opts);
  const json = JSON.stringify(backup);
  const content = opts.passphrase ? JSON.stringify(await encrypt(json, opts.passphrase)) : json;
  const stamp = backup.exportedAt.slice(0, 16).replace(/[:T]/g, "-");
  const name = `vitalime-backup-${stamp}${opts.passphrase ? ".encrypted" : ""}.json`;
  await setSetting(SETTING_KEYS.lastBackupAt, backup.exportedAt);
  return new File([content], name, { type: "application/json" });
}

export type BackupPreview = {
  backup: BackupFile;
  counts: Partial<Record<TableName, number>>;
};

export function isEncryptedBackup(text: string): boolean {
  try {
    return (JSON.parse(text) as { format?: string }).format === "vitalime-backup-encrypted";
  } catch {
    return false;
  }
}

export async function readBackup(text: string, passphrase?: string): Promise<BackupPreview> {
  let parsed = JSON.parse(text) as BackupFile | EncryptedBackup;
  if (parsed.format === "vitalime-backup-encrypted") {
    if (!passphrase) throw new Error("Backup ini terenkripsi. Masukkan passphrase.");
    parsed = JSON.parse(await decrypt(parsed, passphrase)) as BackupFile;
  }
  if (parsed.format !== BACKUP_FORMAT) throw new Error("Bukan file backup Vitalime.");
  if (parsed.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`Backup dari versi skema ${parsed.schemaVersion}; perbarui aplikasi terlebih dahulu.`);
  }
  const counts: BackupPreview["counts"] = {};
  for (const name of ALL_TABLES) counts[name] = parsed.tables[name]?.length ?? 0;
  return { backup: parsed, counts };
}

/**
 * replace: wipes every table first. merge: upserts by primary key, so records from the backup
 * overwrite same-id local records and everything else is kept.
 */
export async function restoreBackup(backup: BackupFile, mode: "merge" | "replace") {
  const decoded: Partial<Record<TableName, unknown[]>> = {};
  for (const name of ALL_TABLES) {
    const rows = backup.tables[name];
    if (rows?.length) decoded[name] = (await deserialise(rows)) as unknown[];
  }
  await db.transaction("rw", ALL_TABLES.map((n) => db.table(n)), async () => {
    for (const name of ALL_TABLES) {
      const table = db.table(name);
      if (mode === "replace") await table.clear();
      const rows = decoded[name];
      if (!rows?.length) continue;
      if (name === "foodPhotos" && mode === "merge") {
        // Don't let a photo-less backup wipe originals that still exist locally.
        for (const row of rows as { id: string; blob: Blob | null }[]) {
          const local = await table.get(row.id);
          await table.put(row.blob === null && local?.blob ? { ...row, blob: local.blob } : row);
        }
        continue;
      }
      if (name === "bodyMeasurements" && mode === "merge") {
        for (const row of rows as { id: string; photo?: Blob }[]) {
          const local = await table.get(row.id);
          await table.put(!row.photo && local?.photo ? { ...row, photo: local.photo } : row);
        }
        continue;
      }
      await table.bulkPut(rows);
    }
  });
}

/** Share sheet on iOS (lets the user "Save to Files"), download fallback elsewhere. */
export async function shareOrDownload(file: File) {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      return "shared" as const;
    } catch (e) {
      if ((e as DOMException).name === "AbortError") return "cancelled" as const;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded" as const;
}
