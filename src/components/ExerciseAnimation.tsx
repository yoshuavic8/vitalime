import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Dumbbell, Pause, Play } from "lucide-react";
import { motionFor } from "../data/motions";
import { SPRITE_FRAMES, SPRITE_ROWS } from "../data/spriteIndex";
import { motionSvg } from "../lib/pose";
import { cx } from "./ui";

const SPRITE_URL = `${import.meta.env.BASE_URL}sprites/exercises.png`;
const SPRITE_COUNT = Object.keys(SPRITE_ROWS).length;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Small looping thumbnail from the pre-rendered sprite atlas (cheap enough for long lists). */
export function ExerciseThumb({ exerciseId, size = 48, className }: { exerciseId: string; size?: number; className?: string }) {
  const row = SPRITE_ROWS[exerciseId];
  if (row == null) {
    return (
      <span className={cx("grid shrink-0 place-items-center rounded-xl bg-ink-800 text-ink-500", className)} style={{ width: size, height: size }}>
        <Dumbbell className="size-1/2" />
      </span>
    );
  }
  const style = {
    "--s": `${size}px`,
    "--frames": SPRITE_FRAMES,
    width: size,
    height: size,
    backgroundImage: `url(${SPRITE_URL})`,
    backgroundSize: `${SPRITE_FRAMES * size}px ${SPRITE_COUNT * size}px`,
    backgroundPositionY: `${-row * size}px`,
  } as CSSProperties;
  return <span aria-hidden className={cx("sprite-thumb block shrink-0 rounded-xl bg-ink-850", className)} style={style} />;
}

/** Smooth vector animation of the movement, rendered live from the same pose data as the sprites. */
export function ExerciseAnimation({ exerciseId, className }: { exerciseId: string; className?: string }) {
  const motion = motionFor(exerciseId);
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const still = reduced || paused;

  useEffect(() => {
    const el = ref.current;
    if (!motion || !el) return;
    if (still) {
      el.innerHTML = motionSvg(motion, 0.5);
      return;
    }
    const period = motion.period ?? 2400;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      el.innerHTML = motionSvg(motion, ((now - start) % period) / period);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [motion, still]);

  if (!motion) {
    return (
      <div className={cx("grid aspect-square place-items-center rounded-3xl bg-ink-850 text-sm text-ink-500", className)}>
        Belum ada animasi untuk latihan custom
      </div>
    );
  }
  return (
    <div className={cx("relative aspect-square overflow-hidden rounded-3xl border border-white/[0.06] bg-ink-850", className)}>
      <div ref={ref} className="size-full [&>svg]:size-full" role="img" aria-label="Animasi gerakan" />
      {!reduced && (
        <button
          aria-label={paused ? "Putar animasi" : "Jeda animasi"}
          className="absolute bottom-2 right-2 grid size-9 place-items-center rounded-full bg-black/50 text-ink-300 backdrop-blur"
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        </button>
      )}
    </div>
  );
}
