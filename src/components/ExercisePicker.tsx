import { useMemo, useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import { Button, Field, Segmented, Select, Sheet, TextArea, TextInput, useToast } from "./ui";
import { useLiveQuery } from "../hooks";
import { listExercises, saveCustomExercise } from "../db/repo/training";
import type { Equipment, MovementPattern } from "../db/types";
import { EQUIPMENT_LABEL, PATTERN_LABEL } from "../lib/labels";

type Filter = "all" | MovementPattern;

export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (exerciseId: string) => void }) {
  const toast = useToast();
  const exercises = useLiveQuery(listExercises);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", primaryMuscle: "", equipment: "dumbbell" as Equipment, pattern: "push" as MovementPattern, instructions: "" });

  const list = useMemo(
    () =>
      (exercises ?? []).filter(
        (e) =>
          (filter === "all" || e.pattern === filter) &&
          (!q || e.name.toLowerCase().includes(q.toLowerCase()) || e.primaryMuscle.toLowerCase().includes(q.toLowerCase())),
      ),
    [exercises, q, filter],
  );

  const create = async () => {
    if (!draft.name.trim()) return toast("Nama latihan wajib diisi");
    const id = await saveCustomExercise({
      name: draft.name.trim(),
      primaryMuscle: draft.primaryMuscle.trim() || "—",
      secondaryMuscles: [],
      equipment: draft.equipment,
      pattern: draft.pattern,
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
            <Field label="Equipment">
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
          <Segmented
            className="mt-2"
            value={filter}
            onChange={setFilter}
            options={[{ value: "all" as Filter, label: "Semua" }, ...Object.entries(PATTERN_LABEL).map(([k, v]) => ({ value: k as Filter, label: v }))]}
          />
          <div className="mt-2 divide-y divide-white/[0.05]">
            {list.map((e) => (
              <button key={e.id} onClick={() => onPick(e.id)} className="flex w-full items-center gap-3 py-3 text-left active:bg-white/5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    {e.name}
                    {e.needsCaution && <TriangleAlert className="size-3.5 text-amber-400" />}
                  </div>
                  <div className="text-xs text-ink-400">
                    {e.primaryMuscle} · {EQUIPMENT_LABEL[e.equipment]}
                  </div>
                </div>
                <Plus className="size-5 text-lime-400" />
              </button>
            ))}
          </div>
          <Button variant="ghost" block className="mt-2" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Buat latihan custom
          </Button>
        </>
      )}
    </Sheet>
  );
}
