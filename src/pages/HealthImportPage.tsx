import { useState } from "react";
import { ClipboardPaste, Download, FileUp, RotateCcw } from "lucide-react";
import { Badge, Button, Card, Notice, Page, PageHeader, SectionTitle, TextArea, useToast } from "../components/ui";
import { useLiveQuery } from "../hooks";
import { commitImport, listImports, previewImport, undoImport, type ImportPreview } from "../db/repo/activity";
import { parseHealthCsv, parseHealthJson, SAMPLE_HEALTH_CSV, SAMPLE_HEALTH_JSON, type ParseResult } from "../lib/healthImport";
import { formatDateTime, formatDayShort } from "../lib/date";
import { shareOrDownload } from "../lib/backup";
import { SOURCE_LABEL } from "../lib/labels";

type Staged = { parsed: ParseResult; preview: ImportPreview; fileName: string; format: "json" | "csv" };

export default function HealthImportPage() {
  const toast = useToast();
  const [text, setText] = useState("");
  const [staged, setStaged] = useState<Staged>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const imports = useLiveQuery(listImports);

  const stage = async (content: string, fileName: string) => {
    setError(undefined);
    setStaged(undefined);
    const trimmed = content.trim();
    if (!trimmed) return;
    const format = trimmed.startsWith("{") || trimmed.startsWith("[") ? "json" : "csv";
    try {
      const parsed = format === "json" ? parseHealthJson(trimmed) : parseHealthCsv(trimmed);
      const total = parsed.prepared.workouts.length + parsed.prepared.metrics.length + parsed.prepared.bodyMass.length;
      if (!total) throw new Error("Tidak ada record valid di file ini.");
      setStaged({ parsed, preview: await previewImport(parsed.prepared), fileName, format });
    } catch (e) {
      setError(e instanceof SyntaxError ? "JSON tidak valid." : (e as Error).message);
    }
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    stage(await file.text(), file.name);
  };

  const confirmImport = async () => {
    if (!staged) return;
    setBusy(true);
    try {
      const rec = await commitImport(staged.parsed.prepared, {
        fileName: staged.fileName,
        format: staged.format,
        source: staged.parsed.source,
        invalid: staged.parsed.invalid,
      });
      toast(`Impor selesai: +${rec.added}, ${rec.skippedDuplicates} duplikat dilewati`);
      setStaged(undefined);
      setText("");
    } finally {
      setBusy(false);
    }
  };

  const p = staged?.preview;
  const range = staged
    ? [...staged.parsed.prepared.workouts.map((w) => w.localDate), ...staged.parsed.prepared.metrics.map((m) => m.localDate)].sort()
    : [];

  return (
    <Page>
      <PageHeader back title="Impor Apple Health" />

      <Notice tone="info">
        PWA tidak bisa membaca HealthKit secara langsung. Data masuk lewat <b>Apple Shortcuts</b> atau file JSON/CSV, dan selalu
        ditampilkan dulu sebelum disimpan. Impor ulang file yang sama tidak membuat duplikat.
      </Notice>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <label className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-lime-400 font-semibold text-ink-950 active:scale-[0.98]">
          <FileUp className="size-5" /> Pilih file
          <input type="file" accept=".json,.csv,application/json,text/csv,text/plain" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <Button
          variant="secondary"
          icon={<ClipboardPaste className="size-5" />}
          onClick={async () => {
            try {
              const t = await navigator.clipboard.readText();
              setText(t);
              stage(t, "clipboard");
            } catch {
              toast("Clipboard tidak bisa dibaca — tempel manual di bawah.");
            }
          }}
        >
          Tempel
        </Button>
      </div>

      <TextArea
        className="mt-2 font-mono text-[13px]"
        rows={4}
        placeholder="…atau tempel JSON/CSV di sini"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          stage(e.target.value, "tempel manual");
        }}
      />
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

      {staged && p && (
        <Card className="mt-3 border-lime-400/25">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold">Preview impor</span>
            <Badge tone="info">{SOURCE_LABEL[staged.parsed.source]}</Badge>
          </div>
          {range.length > 0 && (
            <p className="mb-3 text-sm text-ink-400">
              Rentang: {formatDayShort(range[0])} – {formatDayShort(range[range.length - 1])}
            </p>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            <PreviewStat label="Workout" fresh={p.workoutsNew} dup={p.workoutsDup} />
            <PreviewStat label="Sampel" fresh={p.metricsNew} dup={p.metricsDup} />
            <PreviewStat label="Berat" fresh={p.bodyNew} dup={p.bodyDup} />
          </div>
          {staged.parsed.invalid > 0 && <p className="mt-3 text-sm text-amber-300">{staged.parsed.invalid} baris tidak valid akan dilewati.</p>}
          {staged.parsed.warnings.map((w) => (
            <p key={w} className="mt-1 text-xs text-amber-200/80">
              {w}
            </p>
          ))}
          <Button block className="mt-4" disabled={busy || p.workoutsNew + p.metricsNew + p.bodyNew === 0} onClick={confirmImport}>
            {p.workoutsNew + p.metricsNew + p.bodyNew === 0 ? "Semua data sudah ada" : "Konfirmasi impor"}
          </Button>
        </Card>
      )}

      <SectionTitle>Riwayat impor</SectionTitle>
      {!imports?.length && <p className="px-1 text-sm text-ink-400">Belum ada impor.</p>}
      <div className="space-y-2">
        {imports?.map((i) => (
          <Card key={i.id} className="p-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{i.fileName}</div>
                <div className="text-xs text-ink-400">
                  {formatDateTime(i.importedAt)} · +{i.added} · {i.skippedDuplicates} duplikat
                  {i.invalid ? ` · ${i.invalid} invalid` : ""}
                </div>
              </div>
              <button
                aria-label="Batalkan impor"
                className="grid size-9 place-items-center rounded-full text-ink-400 active:bg-white/5"
                onClick={async () => {
                  if (!confirm("Batalkan impor ini? Semua data yang ditambahkan oleh impor ini akan dihapus.")) return;
                  await undoImport(i.id);
                  toast("Impor dibatalkan");
                }}
              >
                <RotateCcw className="size-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <SectionTitle>Panduan Apple Shortcuts</SectionTitle>
      <Card>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-300">
          <li>
            Buka <b className="text-ink-100">Shortcuts</b> → buat shortcut baru “Vitalime Export”.
          </li>
          <li>
            Tambah aksi <b className="text-ink-100">Find Health Samples</b>: Type = <i>Steps</i>, Start Date = <i>in the last 7 days</i>, Group by
            = <i>Day</i>. Ulangi untuk <i>Active Energy</i>, <i>Resting Energy</i>, <i>Walking + Running Distance</i>, <i>Weight</i>.
          </li>
          <li>
            Gunakan <b className="text-ink-100">Repeat with Each</b> + <b className="text-ink-100">Text</b> untuk membuat baris JSON:
            <pre className="mt-1 whitespace-pre-wrap rounded-xl bg-black/40 p-2 font-mono text-[11px]">
              {`{"type":"steps","start":"[Start Date]","end":"[End Date]","value":[Value],"unit":"count"}`}
            </pre>
            Atur format tanggal ke <i>ISO 8601</i>.
          </li>
          <li>
            Gabungkan dengan <b className="text-ink-100">Combine Text</b> (pemisah koma), bungkus jadi{" "}
            <code className="text-lime-300">{`{"samples":[ … ]}`}</code>.
          </li>
          <li>
            Akhiri dengan <b className="text-ink-100">Copy to Clipboard</b> (lalu tekan “Tempel” di sini) atau <b className="text-ink-100">Save File</b>{" "}
            ke Files lalu “Pilih file”.
          </li>
        </ol>
        <p className="mt-3 text-xs text-ink-500">
          Ketersediaan tipe data dan aksi Health di Shortcuts bergantung versi iOS. Uji setiap metrik — jangan diasumsikan semua tersedia.
          Jangan impor sampel per jam dan total harian untuk hari yang sama, karena keduanya akan dijumlahkan.
        </p>
      </Card>

      <SectionTitle>Format file</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          icon={<Download className="size-4" />}
          onClick={() => shareOrDownload(new File([SAMPLE_HEALTH_JSON], "vitalime-health-contoh.json", { type: "application/json" }))}
        >
          Contoh JSON
        </Button>
        <Button
          variant="secondary"
          icon={<Download className="size-4" />}
          onClick={() => shareOrDownload(new File([SAMPLE_HEALTH_CSV], "vitalime-health-contoh.csv", { type: "text/csv" }))}
        >
          Contoh CSV
        </Button>
      </div>
      <p className="mt-2 px-1 text-xs text-ink-500">
        Tipe sampel: steps, active_energy, resting_energy, walking_running_distance, cycling_distance, exercise_minutes, body_mass. Unit
        dikonversi otomatis (kJ→kkal, m/mi→km, lb→kg).
      </p>
    </Page>
  );
}

function PreviewStat({ label, fresh, dup }: { label: string; fresh: number; dup: number }) {
  return (
    <div className="rounded-2xl bg-black/30 p-2">
      <div className="font-display text-xl font-bold text-lime-400">+{fresh}</div>
      <div className="text-[11px] text-ink-300">{label}</div>
      {dup > 0 && <div className="text-[10px] text-ink-500">{dup} duplikat</div>}
    </div>
  );
}
