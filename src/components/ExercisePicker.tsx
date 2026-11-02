import { useMemo, useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { Button, Chip, Field, Select, Sheet, TextArea, TextInput, Toggle, useToast } from "./ui";
import { ExerciseThumb } from "./ExerciseAnimation";
import { useLiveQuery } from "../hooks";
import { listExercises, saveCustomExercise } from "../db/repo/training";
import { getTrainingSetup } from "../db/repo/settings";
import type { Equipment, ExerciseMetric, MovementPattern } from "../db/types";
import { EQUIPMENT_LABEL, METRIC_LABEL, PATTERN_LABEL } from "../lib/labels";

type Filter = "all" | MovementPattern;

export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (exerciseId: string) => void }) {
  const toast = useToast();
  const exercises = useLiveQuery(listExercises);
  const setup = useLiveQuery(getTrainingSetup);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [onlyMine, setOnlyMine] = useState(true);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    primaryMuscle: "",
    equipment: "dumbbell" as Equipment,
    pattern: "push" as MovementPattern,
    metric: "reps" as ExerciseMetric,
    instructions: "",
  });

  const limited = !!setup && setup.equipment.length < Object.keys(EQUIPMENT_LABEL).length;
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (exercises ?? []).filter(
      (e) =>
        (filter === "all" || e.pattern === filter) &&
        (!limited || !onlyMine || setup!.equipment.includes(e.equipment)) &&
        (!needle || e.name.toLowerCase().includes(needle) || e.primaryMuscle.toLowerCase().includes(needle)),
    );
  }, [exercises, q, filter, onlyMine, limited, setup]);

  const create = async () => {
    if (!draft.name.trim()) return toast("Nama latihan wajib diisi");
    const id = await saveCustomExercise({
      name: draft.name.trim(),
      primaryMuscle: draft.primaryMuscle.trim() || "—",
      secondaryMuscles: [],
      equipment: draft.equipment,
      pattern: draft.pattern,
      metric: draft.metric,
      instructions: draft.instructions.trim(),
      alternatives: [],
    });
    setCreating(false);
    onPick(id);
  };

  return (
    <Sheet open={open} onClose={onClose} title={creating ? "Latihan custom" : "Pilih latihan"}>
      {creating ? (
        <div className="space-y-3">
          <Field label="Nama">
            <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Field>
          <Field label="Otot utama">
            <TextInput value={draft.primaryMuscle} onChange={(e) => setDraft({ ...draft, primaryMuscle: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Alat">
              <Select value={draft.equipment} onChange={(e) => setDraft({ ...draft, equipment: e.target.value as Equipment })}>
                {Object.entries(EQUIPMENT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Pola gerak">
              <Select value={draft.pattern} onChange={(e) => setDraft({ ...draft, pattern: e.target.value as MovementPattern })}>
                {Object.entries(PATTERN_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Dicatat sebagai">
            <Select value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value as ExerciseMetric })}>
              {Object.entries(METRIC_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Instruksi singkat">
            <TextArea value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
          </Field>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setCreating(false)}>
              Batal
            </Button>
            <Button className="flex-1" onClick={create}>
              Simpan & pilih
            </Button>
          </div>
        </div>
      ) : (
        <>
          <TextInput placeholder="Cari latihan atau otot" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="no-scrollbar -mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5">
            <Chip active={filter === "all"} onClick={() => setFilter("all")}>
              Semua
            </Chip>
            {(Object.entries(PATTERN_LABEL) as [MovementPattern, string][]).map(([k, v]) => (
              <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
                {v}
              </Chip>
            ))}
          </div>
          {limited && (
            <div className="mt-1">
              <Toggle checked={onlyMine} onChange={setOnlyMine} label="Hanya alat yang saya punya" hint="Atur di Pengaturan → Alat latihan." />
            </div>
          )}
          <div className="mt-1 divide-y divide-white/[0.05]">
            {list.map((e) => (
              <button key={e.id} onClick={() => onPick(e.id)} className="flex w-full items-center gap-3 py-2.5 text-left active:bg-white/5">
                <ExerciseThumb exerciseId={e.id} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="truncate">{e.name}</span>
                    {e.needsCaution && <TriangleAlert className="size-3.5 shrink-0 text-amber-400" />}
                  </div>
                  <div className="truncate text-xs text-ink-400">
                    {e.primaryMuscle} · {EQUIPMENT_LABEL[e.equipment]}
                  </div>
                </div>
                <Plus className="size-5 shrink-0 text-lime-400" />
              </button>
            ))}
            {!list.length && <p className="py-6 text-center text-sm text-ink-400">Tidak ada latihan yang cocok.</p>}
          </div>
          <Button variant="ghost" block className="mt-2" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Buat latihan custom
          </Button>
        </>
      )}
    </Sheet>
  );
}
