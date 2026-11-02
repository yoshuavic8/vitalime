import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Archive, Plus, Trash2 } from "lucide-react";
import { Button, Card, Field, NumberInput, Page, PageHeader, SectionTitle, TextArea, TextInput, cx, useToast } from "../components/ui";
import { ExercisePicker } from "../components/ExercisePicker";
import { useLiveQuery } from "../hooks";
import {
  addProgramDay,
  addProgramExercise,
  archiveProgram,
  deleteProgramDay,
  deleteProgramExercise,
  exerciseMap,
  getProgramDetail,
  moveProgramExercise,
  setActiveProgram,
  updateProgram,
  updateProgramDay,
  updateProgramExercise,
} from "../db/repo/training";
import type { ProgramExercise } from "../db/types";
import { WEEKDAY_SHORT } from "../lib/date";

export default function ProgramEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [pickerFor, setPickerFor] = useState<string>();
  const data = useLiveQuery(async () => {
    const [detail, exercises] = await Promise.all([getProgramDetail(id!), exerciseMap()]);
    return { detail, exercises };
  }, [id]);

  if (!data) return null;
  const { detail, exercises } = data;
  if (!detail) return <Page><PageHeader back title="Program tidak ditemukan" /></Page>;
  const { program, days } = detail;

  return (
    <Page>
      <PageHeader back="/training" title="Edit program" />

      <div className="space-y-3">
        <Field label="Nama program">
          <TextInput defaultValue={program.name} onChange={(e) => e.target.value.trim() && updateProgram(program.id, { name: e.target.value.trim() })} />
        </Field>
        <Field label="Tujuan">
          <TextArea rows={2} defaultValue={program.goal} onChange={(e) => updateProgram(program.id, { goal: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Mulai">
            <TextInput type="date" defaultValue={program.startDate} onChange={(e) => updateProgram(program.id, { startDate: e.target.value || undefined })} />
          </Field>
          <Field label="Selesai">
            <TextInput type="date" defaultValue={program.endDate} onChange={(e) => updateProgram(program.id, { endDate: e.target.value || undefined })} />
          </Field>
        </div>
        {program.status !== "active" && (
          <Button block onClick={() => setActiveProgram(program.id)}>
            Jadikan program aktif
          </Button>
        )}
      </div>

      {days.map(({ day, exercises: list }) => (
        <section key={day.id}>
          <SectionTitle
            action={
              <button
                className="text-xs text-red-300"
                onClick={async () => {
                  if (!confirm(`Hapus ${day.name}?`)) return;
                  await deleteProgramDay(day.id);
                }}
              >
                Hapus hari
              </button>
            }
          >
            {day.name}
          </SectionTitle>
          <Card>
            <TextInput defaultValue={day.name} onChange={(e) => e.target.value.trim() && updateProgramDay(day.id, { name: e.target.value.trim() })} />
            <div className="mt-3 flex justify-between gap-1">
              {WEEKDAY_SHORT.map((label, w) => {
                const on = day.weekdays.includes(w);
                return (
                  <button
                    key={label}
                    onClick={() =>
                      updateProgramDay(day.id, { weekdays: on ? day.weekdays.filter((x) => x !== w) : [...day.weekdays, w].sort() })
                    }
                    className={cx(
                      "h-9 flex-1 rounded-xl text-xs font-semibold transition",
                      on ? "bg-lime-400 text-ink-950" : "bg-white/[0.05] text-ink-400",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-3">
              {list.map((pe, i) => (
                <ExerciseRow
                  key={pe.id}
                  pe={pe}
                  name={exercises[pe.exerciseId]?.name ?? "?"}
                  first={i === 0}
                  last={i === list.length - 1}
                />
              ))}
            </div>
            <Button variant="ghost" block className="mt-2" icon={<Plus className="size-4" />} onClick={() => setPickerFor(day.id)}>
              Tambah latihan
            </Button>
          </Card>
        </section>
      ))}

      <Button variant="secondary" block className="mt-4" icon={<Plus className="size-4" />} onClick={() => addProgramDay(program.id)}>
        Tambah hari latihan
      </Button>
      <Button
        variant="danger"
        block
        className="mt-6"
        icon={<Archive className="size-4" />}
        onClick={async () => {
          if (!confirm("Arsipkan program ini? Riwayat sesi tetap tersimpan.")) return;
          await archiveProgram(program.id);
          toast("Program diarsipkan");
          navigate("/training");
        }}
      >
        Arsipkan program
      </Button>

      <ExercisePicker
        open={!!pickerFor}
        onClose={() => setPickerFor(undefined)}
        onPick={async (exerciseId) => {
          await addProgramExercise(pickerFor!, exerciseId);
          setPickerFor(undefined);
        }}
      />
    </Page>
  );
}

function ExerciseRow({ pe, name, first, last }: { pe: ProgramExercise; name: string; first: boolean; last: boolean }) {
  const patch = (p: Partial<ProgramExercise>) => updateProgramExercise(pe.id, p);
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
      <div className="flex items-center gap-1">
        <span className="flex-1 truncate font-semibold">{name}</span>
        <button disabled={first} aria-label="Naik" className="grid size-8 place-items-center rounded-full text-ink-400 disabled:opacity-30" onClick={() => moveProgramExercise(pe.id, -1)}>
          <ArrowUp className="size-4" />
        </button>
        <button disabled={last} aria-label="Turun" className="grid size-8 place-items-center rounded-full text-ink-400 disabled:opacity-30" onClick={() => moveProgramExercise(pe.id, 1)}>
          <ArrowDown className="size-4" />
        </button>
        <button aria-label="Hapus latihan" className="grid size-8 place-items-center rounded-full text-red-300" onClick={() => deleteProgramExercise(pe.id)}>
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        <Mini label="Set">
          <NumberInput value={pe.targetSets} onChange={(v) => v && patch({ targetSets: Math.max(1, Math.round(v)) })} />
        </Mini>
        <Mini label="Rep min">
          <NumberInput value={pe.repMin} onChange={(v) => v && patch({ repMin: Math.round(v) })} />
        </Mini>
        <Mini label="Rep max">
          <NumberInput value={pe.repMax} onChange={(v) => v && patch({ repMax: Math.round(v) })} />
        </Mini>
        <Mini label="Rest (dtk)">
          <NumberInput value={pe.restSeconds} onChange={(v) => v != null && patch({ restSeconds: Math.round(v) })} />
        </Mini>
      </div>
      <div className="mt-1.5">
        <Mini label="Target beban (opsional, kg)">
          <NumberInput value={pe.targetWeightKg} onChange={(v) => patch({ targetWeightKg: v })} placeholder="ikuti sesi terakhir" />
        </Mini>
      </div>
    </div>
  );
}

function Mini({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wide text-ink-500">{label}</span>
      <div className="[&_input]:px-2.5 [&_input]:py-2 [&_input]:text-center">{children}</div>
    </label>
  );
}
