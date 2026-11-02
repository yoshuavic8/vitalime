import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Activity as ActivityIcon, ChevronRight, FileUp, Flame, Footprints, HeartPulse, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, IconButton, MiniBars, NumberInput, Page, PageHeader, SectionTitle, Sheet, TextArea, TextInput, useToast } from "../components/ui";
import { useLiveQuery } from "../hooks";
import { deleteActivity, healthTotalsBetween, lastImport, listRecentActivities, saveManualActivity } from "../db/repo/activity";
import type { ActivityEntry } from "../db/types";
import { addDays, dateRange, formatDateTime, formatTime, fromDateTimeInput, parseLocalDate, relativeDayLabel, toDateTimeInput, todayLocal, WEEKDAY_SHORT } from "../lib/date";
import { fmt1, fmtDuration, fmtInt } from "../lib/format";
import { SOURCE_LABEL } from "../lib/labels";

const QUICK_TYPES = ["Jalan kaki", "Lari", "Bersepeda", "Renang", "Weight training", "Yoga", "Futsal", "Badminton"];

export default function ActivityPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<ActivityEntry | "new" | undefined>(params.get("add") ? "new" : undefined);
  const today = todayLocal();
  const weekStart = addDays(today, -6);

  useEffect(() => {
    if (params.get("add")) setParams({}, { replace: true });
  }, [params, setParams]);

  const data = useLiveQuery(async () => {
    const [recent, health, last] = await Promise.all([listRecentActivities(80), healthTotalsBetween(weekStart, today), lastImport()]);
    return { recent, health, last };
  }, [today]);

  const days = dateRange(weekStart, today);
  const grouped = new Map<string, ActivityEntry[]>();
  for (const a of data?.recent ?? []) grouped.set(a.localDate, [...(grouped.get(a.localDate) ?? []), a]);
  const todayHealth = data?.health[today] ?? {};

  return (
    <Page>
      <PageHeader
        title="Activity"
        right={
          <IconButton label="Tambah aktivitas" onClick={() => setEditing("new")}>
            <Plus className="size-5" />
          </IconButton>
        }
      />

      <Card onClick={() => navigate("/activity/import")} className="bg-lime-radial">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-lime-400 text-ink-950">
            <FileUp className="size-5" />
          </span>
          <div className="flex-1">
            <div className="font-semibold">Impor data Apple Health</div>
            <div className="text-xs text-ink-400">
              {data?.last ? `Terakhir: ${formatDateTime(data.last.importedAt)} · +${data.last.added}` : "Via Shortcut atau file JSON/CSV"}
            </div>
          </div>
          <ChevronRight className="size-5 text-ink-400" />
        </div>
      </Card>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric icon={<Footprints className="size-4" />} label="Langkah" value={todayHealth.steps} />
        <Metric icon={<Flame className="size-4" />} label="Active kkal" value={todayHealth.active_energy} />
        <Metric icon={<HeartPulse className="size-4" />} label="Exercise" value={todayHealth.exercise_minutes} unit="mnt" />
      </div>

      <SectionTitle>Langkah 7 hari</SectionTitle>
      <Card>
        <MiniBars
          values={days.map((d) => data?.health[d]?.steps)}
          labels={days.map((d) => WEEKDAY_SHORT[parseLocalDate(d).getDay()])}
        />
        <p className="mt-2 text-xs text-ink-500">Sumber: impor Apple Health. Hari tanpa data ditampilkan “—”, bukan nol.</p>
      </Card>

      <SectionTitle>Riwayat aktivitas</SectionTitle>
      {data && data.recent.length === 0 && (
        <EmptyState
          icon={<ActivityIcon className="size-6" />}
          title="Belum ada aktivitas"
          text="Tambahkan manual atau impor dari Apple Health."
          action={<Button size="sm" onClick={() => setEditing("new")}>Tambah aktivitas</Button>}
        />
      )}
      {[...grouped.entries()].map(([date, items]) => (
        <div key={date} className="mb-3">
          <div className="mb-1.5 px-1 text-sm font-medium text-ink-300">{relativeDayLabel(date)}</div>
          <div className="space-y-2">
            {items.map((a) => (
              <Card key={a.id} className="p-3" onClick={() => setEditing(a)}>
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-white/[0.05] text-lime-400">
                    <ActivityIcon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{a.activityType}</span>
                      <Badge tone={a.source === "manual" ? "neutral" : "info"}>{SOURCE_LABEL[a.source]}</Badge>
                    </div>
                    <div className="text-xs text-ink-400">
                      {formatTime(a.startedAt)} · {fmtDuration(a.durationMinutes)}
                      {a.distanceKm != null && ` · ${fmt1(a.distanceKm)} km`}
                      {a.averageHeartRate != null && ` · ${fmtInt(a.averageHeartRate)} bpm`}
                    </div>
                  </div>
                  {a.activeEnergyKcal != null && (
                    <div className="text-right">
                      <div className="font-display font-bold">{fmtInt(a.activeEnergyKcal)}</div>
                      <div className="text-[10px] text-ink-400">kkal aktif</div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <ActivitySheet entry={editing} onClose={() => setEditing(undefined)} />
    </Page>
  );
}

function Metric({ icon, label, value, unit }: { icon: ReactNode; label: string; value?: number; unit?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
        <span className="text-lime-400">{icon}</span>
        {label}
      </div>
      <div className="mt-1 font-display text-lg font-bold tabular-nums">
        {value != null ? fmtInt(value) : <span className="text-ink-500">—</span>}
        {value != null && unit && <span className="ml-0.5 text-xs text-ink-400">{unit}</span>}
      </div>
      {value == null && <div className="text-[10px] text-ink-500">belum tercatat</div>}
    </Card>
  );
}

function ActivitySheet({ entry, onClose }: { entry: ActivityEntry | "new" | undefined; onClose: () => void }) {
  const toast = useToast();
  const isNew = entry === "new";
  const existing = entry && entry !== "new" ? entry : undefined;
  const readOnly = existing && existing.source !== "manual";
  const [type, setType] = useState("");
  const [startedAt, setStartedAt] = useState(new Date().toISOString());
  const [duration, setDuration] = useState<number>();
  const [distance, setDistance] = useState<number>();
  const [kcal, setKcal] = useState<number>();
  const [hr, setHr] = useState<number>();
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!entry) return;
    setType(existing?.activityType ?? "");
    setStartedAt(existing?.startedAt ?? new Date().toISOString());
    setDuration(existing?.durationMinutes);
    setDistance(existing?.distanceKm);
    setKcal(existing?.activeEnergyKcal);
    setHr(existing?.averageHeartRate);
    setNotes(existing?.notes ?? "");
  }, [entry]);

  const save = async () => {
    if (!type.trim()) return toast("Jenis aktivitas wajib diisi");
    const endedAt = duration ? new Date(new Date(startedAt).getTime() + duration * 60000).toISOString() : undefined;
    await saveManualActivity(
      {
        activityType: type.trim(),
        startedAt,
        endedAt,
        durationMinutes: duration,
        distanceKm: distance,
        activeEnergyKcal: kcal,
        averageHeartRate: hr,
        notes: notes.trim() || undefined,
      },
      existing?.id,
    );
    toast("Aktivitas tersimpan");
    onClose();
  };

  return (
    <Sheet
      open={!!entry}
      onClose={onClose}
      title={isNew ? "Tambah aktivitas" : readOnly ? "Detail aktivitas" : "Edit aktivitas"}
      footer={
        <div className="flex gap-2">
          {existing && (
            <Button
              variant="danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (!confirm("Hapus aktivitas ini?")) return;
                await deleteActivity(existing.id);
                onClose();
              }}
            >
              Hapus
            </Button>
          )}
          {!readOnly && (
            <Button className="flex-1" onClick={save}>
              Simpan
            </Button>
          )}
        </div>
      }
    >
      {readOnly && (
        <p className="mb-3 text-sm text-ink-400">
          Diimpor dari {SOURCE_LABEL[existing.source]}
          {existing.sourceName && ` (${existing.sourceName})`}. Data impor tidak diedit agar tetap sesuai sumber aslinya.
        </p>
      )}
      <fieldset disabled={readOnly} className="space-y-4">
        <Field label="Jenis aktivitas">
          <TextInput value={type} onChange={(e) => setType(e.target.value)} placeholder="mis. Lari" />
        </Field>
        {!readOnly && (
          <div className="-mt-2 flex flex-wrap gap-1.5">
            {QUICK_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs text-ink-300 active:bg-white/10">
                {t}
              </button>
            ))}
          </div>
        )}
        <Field label="Mulai">
          <TextInput type="datetime-local" value={toDateTimeInput(startedAt)} onChange={(e) => e.target.value && setStartedAt(fromDateTimeInput(e.target.value))} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Durasi">
            <NumberInput value={duration} onChange={setDuration} suffix="menit" />
          </Field>
          <Field label="Jarak">
            <NumberInput value={distance} onChange={setDistance} suffix="km" />
          </Field>
          <Field label="Active energy" hint="Dari jam/aplikasi, bukan tebakan.">
            <NumberInput value={kcal} onChange={setKcal} suffix="kkal" />
          </Field>
          <Field label="Rata-rata HR">
            <NumberInput value={hr} onChange={setHr} suffix="bpm" />
          </Field>
        </div>
        <Field label="Catatan">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </fieldset>
    </Sheet>
  );
}
