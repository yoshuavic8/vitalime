import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Camera, ChevronRight, FileText, Plus, Scale, Trash2, X } from "lucide-react";
import {
  Badge,
  BlobImage,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  LineChart,
  NumberInput,
  Page,
  PageHeader,
  SectionTitle,
  Segmented,
  Sheet,
  TextArea,
  TextInput,
  useToast,
} from "../components/ui";
import { useLiveQuery } from "../hooks";
import { deleteMeasurement, getDailyNote, listMeasurements, saveDailyNote, saveMeasurement, weightSeries } from "../db/repo/body";
import type { BodyMeasurement } from "../db/types";
import { addDays, formatDateTime, formatDayShort, fromDateTimeInput, toDateTimeInput, todayLocal } from "../lib/date";
import { fmt1 } from "../lib/format";
import { processPhoto } from "../lib/image";
import { SOURCE_LABEL } from "../lib/labels";

type Range = "7" | "30" | "90" | "all";

export default function ProgressPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [range, setRange] = useState<Range>("30");
  const [editing, setEditing] = useState<BodyMeasurement | "new" | undefined>(params.get("add") ? "new" : undefined);
  const today = todayLocal();

  useEffect(() => {
    if (params.get("add")) setParams({}, { replace: true });
  }, [params, setParams]);

  const rows = useLiveQuery(listMeasurements);
  const series = weightSeries(rows ?? []);
  const from = range === "all" ? "0000" : addDays(today, -Number(range) + 1);
  const visible = series.filter((p) => p.localDate >= from);
  const waist = (rows ?? []).filter((r) => r.waistCm != null && r.localDate >= from);

  const first = visible[0];
  const last = visible.at(-1);
  // Compare smoothed values when available so one noisy weigh-in doesn't dominate.
  const startVal = first?.avg7 ?? first?.weightKg;
  const endVal = last?.avg7 ?? last?.weightKg;
  const delta = startVal != null && endVal != null && visible.length > 1 ? endVal - startVal : undefined;

  return (
    <Page>
      <PageHeader
        title="Progress"
        right={
          <IconButton label="Catat pengukuran" onClick={() => setEditing("new")}>
            <Plus className="size-5" />
          </IconButton>
        }
      />

      <Card onClick={() => navigate("/report")} className="mb-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-lime-400/15 text-lime-400">
            <FileText className="size-5" />
          </span>
          <div className="flex-1">
            <div className="font-semibold">Laporan mingguan</div>
            <div className="text-xs text-ink-400">Nutrisi, aktivitas, latihan & tren tubuh</div>
          </div>
          <ChevronRight className="size-5 text-ink-400" />
        </div>
      </Card>

      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: "7", label: "7 hari" },
          { value: "30", label: "30 hari" },
          { value: "90", label: "90 hari" },
          { value: "all", label: "Semua" },
        ]}
      />

      {rows && series.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<Scale className="size-6" />}
            title="Belum ada data berat"
            text="Timbang di waktu yang sama setiap hari (mis. pagi setelah bangun) agar trennya bermakna."
            action={<Button size="sm" onClick={() => setEditing("new")}>Catat berat</Button>}
          />
        </div>
      ) : (
        <Card className="mt-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-ink-400">Berat terakhir</div>
              <div className="font-display text-3xl font-bold">
                {fmt1(last?.weightKg ?? series.at(-1)?.weightKg)} <span className="text-base font-medium text-ink-400">kg</span>
              </div>
            </div>
            {delta != null && (
              <div className="text-right">
                <div className={delta <= 0 ? "font-display text-lg font-bold text-lime-400" : "font-display text-lg font-bold text-amber-300"}>
                  {delta > 0 ? "+" : ""}
                  {fmt1(delta)} kg
                </div>
                <div className="text-[11px] text-ink-400">dalam rentang ini</div>
              </div>
            )}
          </div>
          {visible.length > 0 && (
            <div className="mt-3">
              <LineChart points={visible.map((p) => ({ x: p.localDate, y: p.weightKg, y2: p.avg7 }))} unit="kg" formatX={formatDayShort} />
              <div className="mt-1 flex items-center gap-4 text-[11px] text-ink-400">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-lime-400/60" /> harian
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded bg-lime-400" /> rata-rata 7 hari
                </span>
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-ink-500">Berat badan saja tidak menggambarkan komposisi tubuh. Lihat juga lingkar pinggang dan performa latihan.</p>
        </Card>
      )}

      {waist.length > 1 && (
        <>
          <SectionTitle>Lingkar pinggang</SectionTitle>
          <Card>
            <LineChart points={waist.map((w) => ({ x: w.localDate + w.id, y: w.waistCm! }))} unit="cm" formatX={(x) => formatDayShort(x.slice(0, 10))} />
          </Card>
        </>
      )}

      <DailyNoteCard date={today} />

      <SectionTitle>Riwayat pengukuran</SectionTitle>
      <div className="space-y-2">
        {[...(rows ?? [])].reverse().slice(0, 60).map((r) => (
          <Card key={r.id} className="p-3" onClick={() => setEditing(r)}>
            <div className="flex items-center gap-3">
              {r.photoThumb && <BlobImage blob={r.photoThumb} alt="Foto progres" className="size-12 rounded-xl" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{formatDateTime(r.measuredAt)}</span>
                  {r.source !== "manual" && <Badge tone="info">{SOURCE_LABEL[r.source]}</Badge>}
                </div>
                <div className="truncate text-xs text-ink-400">
                  {[r.waistCm && `pinggang ${fmt1(r.waistCm)}`, r.chestCm && `dada ${fmt1(r.chestCm)}`, r.hipCm && `pinggul ${fmt1(r.hipCm)}`, r.notes]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
              </div>
              {r.weightKg != null && (
                <div className="font-display text-lg font-bold">
                  {fmt1(r.weightKg)}
                  <span className="ml-0.5 text-xs font-medium text-ink-400">kg</span>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <MeasurementSheet entry={editing} onClose={() => setEditing(undefined)} />
    </Page>
  );
}

function DailyNoteCard({ date }: { date: string }) {
  const note = useLiveQuery(() => getDailyNote(date), [date]);
  const [text, setText] = useState<string>();
  const value = text ?? note?.text ?? "";

  useEffect(() => {
    if (text == null) return;
    const t = setTimeout(() => saveDailyNote(date, text), 500);
    return () => clearTimeout(t);
  }, [text, date]);

  return (
    <>
      <SectionTitle>Catatan hari ini</SectionTitle>
      <Card>
        <TextArea rows={2} placeholder="Tidur, stres, siklus, kondisi tubuh…" value={value} onChange={(e) => setText(e.target.value)} />
        <p className="mt-1 px-1 text-[11px] text-ink-500">Tersimpan otomatis.</p>
      </Card>
    </>
  );
}

function MeasurementSheet({ entry, onClose }: { entry: BodyMeasurement | "new" | undefined; onClose: () => void }) {
  const toast = useToast();
  const existing = entry && entry !== "new" ? entry : undefined;
  const [f, setF] = useState<Partial<BodyMeasurement>>({});
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setF(existing ? { ...existing } : { measuredAt: new Date().toISOString() });
    setShowMore(!!(existing?.chestCm || existing?.hipCm || existing?.armCm || existing?.thighCm));
  }, [entry]);

  const set = <K extends keyof BodyMeasurement>(k: K, v: BodyMeasurement[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    if (f.weightKg == null && f.waistCm == null && !f.chestCm && !f.hipCm && !f.armCm && !f.thighCm) {
      return toast("Isi minimal satu pengukuran");
    }
    await saveMeasurement(
      {
        measuredAt: f.measuredAt ?? new Date().toISOString(),
        weightKg: f.weightKg,
        waistCm: f.waistCm,
        chestCm: f.chestCm,
        hipCm: f.hipCm,
        armCm: f.armCm,
        thighCm: f.thighCm,
        notes: f.notes?.trim() || undefined,
        photo: f.photo,
        photoThumb: f.photoThumb,
      },
      existing?.id,
    );
    toast("Pengukuran tersimpan");
    onClose();
  };

  return (
    <Sheet
      open={!!entry}
      onClose={onClose}
      title={existing ? "Edit pengukuran" : "Catat pengukuran"}
      footer={
        <div className="flex gap-2">
          {existing && (
            <Button
              variant="danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (!confirm("Hapus pengukuran ini?")) return;
                await deleteMeasurement(existing.id);
                onClose();
              }}
            >
              Hapus
            </Button>
          )}
          <Button className="flex-1" onClick={save}>
            Simpan
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Berat">
            <NumberInput value={f.weightKg} onChange={(v) => set("weightKg", v)} suffix="kg" />
          </Field>
          <Field label="Lingkar pinggang">
            <NumberInput value={f.waistCm} onChange={(v) => set("waistCm", v)} suffix="cm" />
          </Field>
        </div>
        {showMore ? (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Dada">
              <NumberInput value={f.chestCm} onChange={(v) => set("chestCm", v)} suffix="cm" />
            </Field>
            <Field label="Pinggul">
              <NumberInput value={f.hipCm} onChange={(v) => set("hipCm", v)} suffix="cm" />
            </Field>
            <Field label="Lengan">
              <NumberInput value={f.armCm} onChange={(v) => set("armCm", v)} suffix="cm" />
            </Field>
            <Field label="Paha">
              <NumberInput value={f.thighCm} onChange={(v) => set("thighCm", v)} suffix="cm" />
            </Field>
          </div>
        ) : (
          <button className="px-1 text-sm text-lime-400" onClick={() => setShowMore(true)}>
            + Ukuran lain (dada, pinggul, lengan, paha)
          </button>
        )}
        <Field label="Waktu">
          <TextInput
            type="datetime-local"
            value={f.measuredAt ? toDateTimeInput(f.measuredAt) : ""}
            onChange={(e) => e.target.value && set("measuredAt", fromDateTimeInput(e.target.value))}
          />
        </Field>
        <Field label="Catatan kondisi">
          <TextArea rows={2} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <div>
          <span className="mb-1.5 block px-1 text-[13px] font-medium text-ink-300">Foto progres (opsional)</span>
          {f.photoThumb ? (
            <div className="relative w-fit">
              <BlobImage blob={f.photoThumb} alt="Foto progres" className="h-36 w-28 rounded-2xl" />
              <button
                aria-label="Hapus foto"
                className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/70"
                onClick={() => setF((x) => ({ ...x, photo: undefined, photoThumb: undefined }))}
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <label className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-sm text-ink-300">
              <Camera className="size-4" /> Tambah foto
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const p = await processPhoto(file);
                  setF((x) => ({ ...x, photo: p.blob, photoThumb: p.thumb }));
                }}
              />
            </label>
          )}
        </div>
      </div>
    </Sheet>
  );
}
