import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, HardDrive, Lock, ShieldCheck, Trash2, Upload } from "lucide-react";
import {
  Button,
  Card,
  Chip,
  Field,
  NumberInput,
  Notice,
  Page,
  PageHeader,
  SectionTitle,
  Segmented,
  Select,
  Sheet,
  TextInput,
  Toggle,
  useToast,
} from "../components/ui";
import { useLiveQuery } from "../hooks";
import {
  DEFAULT_GOAL,
  getGoalFor,
  getProfile,
  getSetting,
  getTrainingSetup,
  saveGoal,
  saveProfile,
  saveTrainingSetup,
  setSetting,
  SETTING_KEYS,
  type TrainingPlace,
} from "../db/repo/settings";
import { photoStorageStats, purgeOriginalPhotosOlderThan } from "../db/repo/food";
import { EQUIPMENT, HOME_EQUIPMENT, type Equipment, type Goal, type Sex, type TargetMode } from "../db/types";
import { EQUIPMENT_LABEL } from "../lib/labels";
import { SCHEMA_VERSION, type TableName } from "../db/db";
import { exportBackupFile, isEncryptedBackup, readBackup, restoreBackup, shareOrDownload, type BackupPreview } from "../lib/backup";
import { buildCsv, type CsvKind } from "../lib/exportCsv";
import { resetAllData, storageEstimate } from "../lib/storage";
import { formatDateTime, todayLocal } from "../lib/date";
import { fmtBytes, fmtInt } from "../lib/format";

const TABLE_LABEL: Partial<Record<TableName, string>> = {
  foodEntries: "Makanan",
  foodPhotos: "Foto makanan",
  activityEntries: "Aktivitas",
  healthMetrics: "Sampel Health",
  bodyMeasurements: "Pengukuran",
  workoutSessions: "Sesi latihan",
  workoutSets: "Set",
  trainingPrograms: "Program",
};

export default function SettingsPage() {
  const toast = useToast();
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) document.getElementById(hash.replace("#", ""))?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  return (
    <Page>
      <PageHeader back title="Pengaturan" />
      <ProfileSection />
      <GoalSection />
      <EquipmentSection />
      <BackupSection />
      <CsvSection />
      <StorageSection />
      <PrivacySection />

      <SectionTitle>Zona bahaya</SectionTitle>
      <Card>
        <p className="text-sm text-ink-400">Menghapus semua data di perangkat ini. Tidak dapat dibatalkan — buat backup terlebih dahulu.</p>
        <Button
          variant="danger"
          block
          className="mt-3"
          icon={<Trash2 className="size-4" />}
          onClick={async () => {
            const typed = prompt('Ketik "HAPUS" untuk menghapus seluruh data.');
            if (typed !== "HAPUS") return;
            await resetAllData();
            toast("Semua data dihapus");
            location.reload();
          }}
        >
          Reset semua data
        </Button>
      </Card>

      <p className="mt-6 text-center text-xs text-ink-500">
        Vitalime v{__APP_VERSION__} · skema DB v{SCHEMA_VERSION} · {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </p>
    </Page>
  );
}

function ProfileSection() {
  const toast = useToast();
  const profile = useLiveQuery(getProfile);
  const [name, setName] = useState<string>();
  const [sex, setSex] = useState<Sex>();
  const [birthYear, setBirthYear] = useState<number>();
  const [height, setHeight] = useState<number>();
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (touched || profile === undefined) return;
    setName(profile?.name ?? "");
    setSex(profile?.sex ?? "unspecified");
    setBirthYear(profile?.birthYear);
    setHeight(profile?.heightCm);
  }, [profile, touched]);

  const save = async () => {
    await saveProfile({ name: name?.trim() || undefined, sex: sex ?? "unspecified", birthYear, heightCm: height });
    setTouched(false);
    toast("Profil tersimpan");
  };

  return (
    <>
      <SectionTitle>Profil</SectionTitle>
      <Card className="space-y-3" >
        <Field label="Nama panggilan">
          <TextInput value={name ?? ""} onChange={(e) => { setTouched(true); setName(e.target.value); }} />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Jenis kelamin">
            <Select value={sex ?? "unspecified"} onChange={(e) => { setTouched(true); setSex(e.target.value as Sex); }}>
              <option value="unspecified">—</option>
              <option value="male">Pria</option>
              <option value="female">Wanita</option>
            </Select>
          </Field>
          <Field label="Tahun lahir">
            <NumberInput value={birthYear} onChange={(v) => { setTouched(true); setBirthYear(v); }} />
          </Field>
          <Field label="Tinggi">
            <NumberInput value={height} onChange={(v) => { setTouched(true); setHeight(v); }} suffix="cm" />
          </Field>
        </div>
        {touched && (
          <Button block onClick={save}>
            Simpan profil
          </Button>
        )}
      </Card>
    </>
  );
}

function GoalSection() {
  const toast = useToast();
  const goal = useLiveQuery(() => getGoalFor(todayLocal()));
  const [g, setG] = useState<Omit<Goal, "id" | "createdAt" | "updatedAt" | "effectiveFrom">>(DEFAULT_GOAL);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (goal && !dirty) {
      const { id: _i, createdAt: _c, updatedAt: _u, effectiveFrom: _e, ...rest } = goal;
      setG(rest);
    }
  }, [goal, dirty]);

  const upd = (patch: Partial<typeof g>) => {
    setDirty(true);
    setG((x) => ({ ...x, ...patch }));
  };
  const macroKcal = g.proteinG * 4 + g.carbsG * 4 + g.fatG * 9;

  return (
    <>
      <SectionTitle>Target harian</SectionTitle>
      <Card className="space-y-3">
        {!goal && <Notice tone="lime">Belum ada target tersimpan. Nilai default di bawah hanya contoh — sesuaikan dengan kebutuhanmu.</Notice>}
        <Field label="Kalori" hint={Math.abs(macroKcal - g.caloriesKcal) > 100 ? `Total dari makro ≈ ${fmtInt(macroKcal)} kkal` : undefined}>
          <NumberInput value={g.caloriesKcal} onChange={(v) => upd({ caloriesKcal: v ?? 0 })} suffix="kkal" />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Protein">
            <NumberInput value={g.proteinG} onChange={(v) => upd({ proteinG: v ?? 0 })} suffix="g" />
          </Field>
          <Field label="Karbo">
            <NumberInput value={g.carbsG} onChange={(v) => upd({ carbsG: v ?? 0 })} suffix="g" />
          </Field>
          <Field label="Lemak">
            <NumberInput value={g.fatG} onChange={(v) => upd({ fatG: v ?? 0 })} suffix="g" />
          </Field>
        </div>
        <Field label="Metode target">
          <Segmented<TargetMode>
            value={g.targetMode}
            onChange={(v) => upd({ targetMode: v })}
            options={[
              { value: "fixed", label: "Tetap" },
              { value: "activity_adjusted", label: "+ Active energy" },
            ]}
          />
        </Field>
        <p className="-mt-1 px-1 text-xs text-ink-500">
          {g.targetMode === "fixed"
            ? "Target tidak berubah meskipun kamu berolahraga. Disarankan bila target sudah memperhitungkan aktivitas rata-rata."
            : "Active energy dari Apple Health ditambahkan ke target hari itu. Estimasi jam tangan bisa berlebih — gunakan dengan hati-hati."}
        </p>
        <Field label="Target langkah">
          <NumberInput value={g.stepsTarget} onChange={(v) => upd({ stepsTarget: v })} />
        </Field>
        {(dirty || !goal) && (
          <Button
            block
            onClick={async () => {
              await saveGoal(g);
              setDirty(false);
              toast("Target tersimpan mulai hari ini");
            }}
          >
            Simpan target
          </Button>
        )}
        <p className="px-1 text-xs text-ink-500">Target berlaku mulai hari ini; hari sebelumnya tetap memakai target lama.</p>
      </Card>
    </>
  );
}

function EquipmentSection() {
  const setup = useLiveQuery(getTrainingSetup);
  if (!setup) return null;
  const choosePlace = (place: TrainingPlace) => saveTrainingSetup(place, place === "home" ? HOME_EQUIPMENT : EQUIPMENT);
  const toggle = (e: Equipment) =>
    saveTrainingSetup(setup.place, setup.equipment.includes(e) ? setup.equipment.filter((x) => x !== e) : [...setup.equipment, e]);
  return (
    <>
      <SectionTitle>Alat latihan</SectionTitle>
      <Card className="space-y-3">
        <Segmented<TrainingPlace>
          value={setup.place}
          onChange={choosePlace}
          options={[
            { value: "gym", label: "Gym" },
            { value: "home", label: "Rumah" },
            { value: "both", label: "Keduanya" },
          ]}
        />
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT.map((e) => (
            <Chip key={e} active={setup.equipment.includes(e)} onClick={() => toggle(e)}>
              {EQUIPMENT_LABEL[e]}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-ink-400">Dipakai untuk filter library, saran ganti latihan, dan menandai template yang butuh alat lain.</p>
      </Card>
    </>
  );
}

function BackupSection() {
  const toast = useToast();
  const lastBackupAt = useLiveQuery(() => getSetting<string>(SETTING_KEYS.lastBackupAt));
  const [includePhotos, setIncludePhotos] = useState(true);
  const [encrypt, setEncrypt] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [restoreText, setRestoreText] = useState<string>();
  const [restorePass, setRestorePass] = useState("");
  const [preview, setPreview] = useState<BackupPreview>();
  const [error, setError] = useState<string>();

  const doExport = async () => {
    if (encrypt && passphrase.length < 8) return toast("Passphrase minimal 8 karakter");
    setBusy(true);
    try {
      const file = await exportBackupFile({ includePhotos, passphrase: encrypt ? passphrase : undefined });
      const res = await shareOrDownload(file);
      if (res !== "cancelled") toast(`Backup dibuat (${fmtBytes(file.size)})`);
    } catch {
      toast("Backup gagal");
    } finally {
      setBusy(false);
    }
  };

  const load = async (text: string, pass?: string) => {
    setError(undefined);
    setPreview(undefined);
    try {
      setPreview(await readBackup(text, pass));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const closeRestore = () => {
    setRestoreText(undefined);
    setPreview(undefined);
    setRestorePass("");
    setError(undefined);
  };

  const restore = async (mode: "merge" | "replace") => {
    if (!preview) return;
    if (mode === "replace" && !confirm("Ganti SEMUA data di perangkat dengan isi backup ini?")) return;
    setBusy(true);
    try {
      await restoreBackup(preview.backup, mode);
      toast("Backup dipulihkan");
      closeRestore();
    } catch {
      toast("Pemulihan gagal — data lama tidak diubah");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionTitle>
        <span id="backup">Backup & restore</span>
      </SectionTitle>
      <Card className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <HardDrive className="size-4 text-lime-400" />
          <span className="text-ink-300">Backup terakhir: {lastBackupAt ? formatDateTime(lastBackupAt) : "belum pernah"}</span>
        </div>
        <Toggle checked={includePhotos} onChange={setIncludePhotos} label="Sertakan foto asli" hint="File lebih besar. Thumbnail selalu ikut." />
        <Toggle checked={encrypt} onChange={setEncrypt} label="Enkripsi dengan passphrase" hint="AES-256. Passphrase yang hilang tidak bisa dipulihkan." />
        {encrypt && <TextInput type="password" placeholder="Passphrase (min. 8 karakter)" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />}
        <Button block disabled={busy} icon={encrypt ? <Lock className="size-4" /> : <Download className="size-4" />} onClick={doExport}>
          Buat backup
        </Button>
        <p className="px-1 text-xs text-ink-500">Di iPhone, pilih “Save to Files” (iCloud Drive) agar backup aman di luar browser.</p>
        <label className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-ink-800 font-semibold active:bg-ink-700">
          <Upload className="size-4" /> Pulihkan dari file
          <input
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const text = await file.text();
              setRestoreText(text);
              if (!isEncryptedBackup(text)) load(text);
            }}
          />
        </label>
      </Card>

      <Sheet open={restoreText != null} onClose={closeRestore} title="Pulihkan backup">
        {restoreText && isEncryptedBackup(restoreText) && !preview && (
          <div className="space-y-2">
            <p className="text-sm text-ink-300">Backup ini terenkripsi.</p>
            <TextInput type="password" placeholder="Passphrase" value={restorePass} onChange={(e) => setRestorePass(e.target.value)} />
            <Button block onClick={() => load(restoreText, restorePass)}>
              Buka
            </Button>
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        {preview && (
          <div className="space-y-3">
            <p className="text-sm text-ink-400">
              Dibuat {formatDateTime(preview.backup.exportedAt)} · skema v{preview.backup.schemaVersion}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TABLE_LABEL).map(([k, label]) => (
                <div key={k} className="rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
                  <span className="font-bold tabular-nums">{fmtInt(preview.counts[k as TableName])}</span> <span className="text-ink-400">{label}</span>
                </div>
              ))}
            </div>
            <Button block disabled={busy} onClick={() => restore("merge")}>
              Gabungkan dengan data sekarang
            </Button>
            <Button block variant="danger" disabled={busy} onClick={() => restore("replace")}>
              Ganti semua data
            </Button>
            <p className="text-xs text-ink-500">Gabungkan: record dengan ID sama ditimpa versi backup, sisanya dipertahankan.</p>
          </div>
        )}
      </Sheet>
    </>
  );
}

function CsvSection() {
  const kinds: { kind: CsvKind; label: string }[] = [
    { kind: "food", label: "Makanan" },
    { kind: "activity", label: "Aktivitas" },
    { kind: "measurements", label: "Pengukuran" },
    { kind: "workouts", label: "Latihan" },
  ];
  return (
    <>
      <SectionTitle>Ekspor CSV</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {kinds.map(({ kind, label }) => (
          <Button key={kind} variant="secondary" icon={<Download className="size-4" />} onClick={async () => shareOrDownload(await buildCsv(kind))}>
            {label}
          </Button>
        ))}
      </div>
    </>
  );
}

function StorageSection() {
  const toast = useToast();
  const photos = useLiveQuery(photoStorageStats);
  const persisted = useLiveQuery(() => getSetting<boolean>(SETTING_KEYS.persistGranted));
  const [estimate, setEstimate] = useState<{ usage: number; quota: number }>();
  const [days, setDays] = useState("90");

  useEffect(() => {
    storageEstimate().then(setEstimate);
  }, [photos]);

  return (
    <>
      <SectionTitle>Penyimpanan</SectionTitle>
      <Card className="space-y-3">
        {estimate && (
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-ink-300">Terpakai</span>
              <span className="tabular-nums">
                {fmtBytes(estimate.usage)} <span className="text-ink-500">/ {fmtBytes(estimate.quota)}</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-lime-400" style={{ width: `${Math.min(100, (estimate.usage / Math.max(estimate.quota, 1)) * 100)}%` }} />
            </div>
          </div>
        )}
        <div className="text-sm text-ink-300">
          Foto: {photos?.count ?? 0} ({photos?.originals ?? 0} asli) · {fmtBytes(photos?.bytes ?? 0)}
        </div>
        <div className="text-sm text-ink-300">
          Penyimpanan persisten: {persisted === true ? "diizinkan" : persisted === false ? "tidak dijamin" : "tidak didukung"}
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onChange={(e) => setDays(e.target.value)} className="flex-1">
            <option value="30">Lebih dari 30 hari</option>
            <option value="90">Lebih dari 90 hari</option>
            <option value="180">Lebih dari 180 hari</option>
          </Select>
          <Button
            variant="secondary"
            onClick={async () => {
              if (!confirm("Hapus foto asli yang lebih lama? Thumbnail tetap disimpan.")) return;
              const n = await purgeOriginalPhotosOlderThan(Number(days));
              toast(`${n} foto asli dihapus`);
            }}
          >
            Hapus asli
          </Button>
        </div>
      </Card>
    </>
  );
}

function PrivacySection() {
  const consent = useLiveQuery(() => getSetting<boolean>(SETTING_KEYS.aiConsent));
  return (
    <>
      <SectionTitle>AI & privasi</SectionTitle>
      <Card>
        <div className="flex gap-3 text-sm text-ink-300">
          <ShieldCheck className="size-5 shrink-0 text-lime-400" />
          <p>
            Semua data tersimpan lokal di iPhone (IndexedDB). Tidak ada akun, server, atau analytics. AI berjalan lewat <b>manual hand-off</b>:
            kamu sendiri yang membagikan foto/teks ke aplikasi AI.
          </p>
        </div>
        <div className="mt-2 border-t border-white/[0.06] pt-2">
          <Toggle
            checked={!!consent}
            onChange={(v) => setSetting(SETTING_KEYS.aiConsent, v)}
            label="Persetujuan analisis AI"
            hint="Matikan untuk menampilkan penjelasan privasi lagi sebelum analisis."
          />
        </div>
      </Card>
    </>
  );
}
