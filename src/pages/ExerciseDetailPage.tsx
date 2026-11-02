import { useNavigate, useParams } from "react-router-dom";
import { Trophy, TriangleAlert } from "lucide-react";
import { Badge, Card, LineChart, Notice, Page, PageHeader, SectionTitle } from "../components/ui";
import { useLiveQuery } from "../hooks";
import { exerciseHistory, exerciseMap } from "../db/repo/training";
import { formatDayShort, relativeDayLabel } from "../lib/date";
import { fmt1, fmtInt } from "../lib/format";
import { EQUIPMENT_LABEL, PATTERN_LABEL } from "../lib/labels";

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
  const chart = history.rows.filter((r) => r.best1rm > 0).map((r) => ({ x: r.session.localDate + r.session.id, y: Math.round(r.best1rm * 10) / 10 }));

  return (
    <Page>
      <PageHeader back title={ex.name} />
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="lime">{ex.primaryMuscle}</Badge>
        {ex.secondaryMuscles.map((m) => (
          <Badge key={m}>{m}</Badge>
        ))}
        <Badge tone="info">{EQUIPMENT_LABEL[ex.equipment]}</Badge>
        <Badge>{PATTERN_LABEL[ex.pattern]}</Badge>
      </div>
      {ex.instructions && <p className="mt-3 text-sm leading-relaxed text-ink-300">{ex.instructions}</p>}
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
      {ex.alternatives.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 text-sm">
          <span className="text-ink-400">Alternatif:</span>
          {ex.alternatives.map((a) =>
            all[a] ? (
              <button key={a} className="text-lime-400 underline-offset-2 active:underline" onClick={() => navigate(`/training/exercise/${a}`, { replace: true })}>
                {all[a].name}
              </button>
            ) : null,
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Card className="p-3">
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            <Trophy className="size-3.5 text-lime-400" /> Beban terberat
          </div>
          <div className="mt-1 font-display text-xl font-bold">{history.pbWeight ? `${fmt1(history.pbWeight)} kg` : "—"}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-1.5 text-xs text-ink-400">
            <Trophy className="size-3.5 text-lime-400" /> Estimasi 1RM
          </div>
          <div className="mt-1 font-display text-xl font-bold">{history.pb1rm ? `${fmt1(history.pb1rm)} kg` : "—"}</div>
        </Card>
      </div>

      {chart.length > 1 && (
        <>
          <SectionTitle>Tren estimasi 1RM</SectionTitle>
          <Card>
            <LineChart points={chart} unit="kg" formatX={(x) => formatDayShort(x.slice(0, 10))} />
            <p className="mt-1 text-xs text-ink-500">Rumus Epley dari set terbaik tiap sesi — hanya indikasi, bukan hasil tes 1RM.</p>
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
              <span className="text-ink-400">{fmtInt(r.volume)} kg volume</span>
            </div>
            <div className="mt-1 text-sm tabular-nums text-ink-300">
              {r.sets.map((s) => `${fmt1(s.weightKg)}×${s.reps ?? "—"}${s.rpe ? ` @${s.rpe}` : ""}`).join("  ·  ")}
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}
