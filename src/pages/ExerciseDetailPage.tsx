import { useNavigate, useParams } from "react-router-dom";
import { Check, Trophy, TriangleAlert } from "lucide-react";
import { Badge, Card, LineChart, Notice, Page, PageHeader, SectionTitle } from "../components/ui";
import { ExerciseAnimation, ExerciseThumb } from "../components/ExerciseAnimation";
import { useLiveQuery } from "../hooks";
import { exerciseHistory, exerciseMap } from "../db/repo/training";
import { formatDayShort, relativeDayLabel } from "../lib/date";
import { fmt1, fmtInt } from "../lib/format";
import { EQUIPMENT_LABEL, PATTERN_LABEL } from "../lib/labels";
import { clock, formatSet, metricOf } from "../lib/sets";
import type { Exercise } from "../db/types";

const LEVEL_LABEL: Record<NonNullable<Exercise["level"]>, string> = { beginner: "Pemula", intermediate: "Menengah", advanced: "Lanjut" };

export default function ExerciseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const data = useLiveQuery(async () => {
    const [all, history] = await Promise.all([exerciseMap(), exerciseHistory(id!)]);
    return { ex: all[id!], all, history };
  }, [id]);

  if (!data) return null;
  const { ex, all, history } = data;
  if (!ex) return <Page><PageHeader back title="Latihan tidak ditemukan" /></Page>;
  const metric = metricOf(ex);
  const chart =
    metric === "reps"
      ? history.rows.filter((r) => r.best1rm > 0).map((r) => ({ x: r.session.localDate + r.session.id, y: Math.round(r.best1rm * 10) / 10 }))
      : metric === "time"
        ? history.rows.filter((r) => r.bestDuration > 0).map((r) => ({ x: r.session.localDate + r.session.id, y: r.bestDuration }))
        : history.rows.filter((r) => r.totalDuration > 0).map((r) => ({ x: r.session.localDate + r.session.id, y: Math.round(r.totalDuration / 60) }));

  return (
    <Page>
      <PageHeader back title={ex.name} />
      <ExerciseAnimation exerciseId={ex.id} className="mx-auto max-w-sm" />

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="lime">{ex.primaryMuscle}</Badge>
        {ex.secondaryMuscles.map((m) => (
          <Badge key={m}>{m}</Badge>
        ))}
        <Badge tone="info">{EQUIPMENT_LABEL[ex.equipment]}</Badge>
        <Badge>{PATTERN_LABEL[ex.pattern]}</Badge>
        {ex.level && <Badge>{LEVEL_LABEL[ex.level]}</Badge>}
      </div>
      {ex.instructions && <p className="mt-3 text-sm leading-relaxed text-ink-300">{ex.instructions}</p>}
      {!!ex.cues?.length && (
        <ul className="mt-3 space-y-1.5">
          {ex.cues.map((c) => (
            <li key={c} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-lime-400" strokeWidth={3} />
              {c}
            </li>
          ))}
        </ul>
      )}
      {ex.needsCaution && (
        <div className="mt-3">
          <Notice tone="warn">
            <div className="flex gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Latihan teknis/berat. Pelajari teknik dengan beban ringan, gunakan pengaman, dan pilih alternatif bila ada keterbatasan gerak.
            </div>
          </Notice>
        </div>
      )}
      {ex.alternatives.some((a) => all[a]) && (
        <>
          <SectionTitle>Alternatif</SectionTitle>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {ex.alternatives
              .filter((a) => all[a])
              .map((a) => (
                <button key={a} className="flex w-24 shrink-0 flex-col items-center gap-1 text-center" onClick={() => navigate(`/training/exercise/${a}`, { replace: true })}>
                  <ExerciseThumb exerciseId={a} size={72} />
                  <span className="line-clamp-2 text-xs text-ink-300">{all[a].name}</span>
                </button>
              ))}
          </div>
        </>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {metric === "reps" && (
          <>
            <Stat label="Beban terberat" value={history.pbWeight ? `${fmt1(history.pbWeight)} kg` : "—"} />
            <Stat label="Estimasi 1RM" value={history.pb1rm ? `${fmt1(history.pb1rm)} kg` : "—"} />
          </>
        )}
        {metric === "time" && (
          <>
            <Stat label="Tahan terlama" value={history.pbDuration ? clock(history.pbDuration) : "—"} />
            <Stat label="Sesi tercatat" value={fmtInt(history.rows.length)} />
          </>
        )}
        {metric === "cardio" && (
          <>
            <Stat label="Sesi terpanjang" value={history.rows.length ? `${Math.round(Math.max(...history.rows.map((r) => r.totalDuration)) / 60)} mnt` : "—"} />
            <Stat label="Jarak terjauh" value={history.pbDistance ? `${fmt1(history.pbDistance)} km` : "—"} />
          </>
        )}
      </div>

      {chart.length > 1 && (
        <>
          <SectionTitle>{metric === "reps" ? "Tren estimasi 1RM" : metric === "time" ? "Tren durasi terlama" : "Tren durasi (menit)"}</SectionTitle>
          <Card>
            <LineChart points={chart} unit={metric === "reps" ? "kg" : metric === "time" ? "dtk" : "mnt"} formatX={(x) => formatDayShort(x.slice(0, 10))} />
            {metric === "reps" && <p className="mt-1 text-xs text-ink-500">Rumus Epley dari set terbaik tiap sesi — hanya indikasi, bukan hasil tes 1RM.</p>}
          </Card>
        </>
      )}

      <SectionTitle>Riwayat</SectionTitle>
      {!history.rows.length && <p className="px-1 text-sm text-ink-400">Belum ada set selesai untuk latihan ini.</p>}
      <div className="space-y-2">
        {[...history.rows].reverse().map((r) => (
          <Card key={r.session.id} className="p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{relativeDayLabel(r.session.localDate)}</span>
              {metric === "reps" && <span className="text-ink-400">{fmtInt(r.volume)} kg volume</span>}
            </div>
            <div className="mt-1 text-sm tabular-nums text-ink-300">{r.sets.map((s) => formatSet(s, metric)).join("  ·  ")}</div>
          </Card>
        ))}
      </div>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-xs text-ink-400">
        <Trophy className="size-3.5 text-lime-400" /> {label}
      </div>
      <div className="mt-1 font-display text-xl font-bold">{value}</div>
    </Card>
  );
}
