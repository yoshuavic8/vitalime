import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, X } from "lucide-react";
import { useGoBack, useObjectUrl } from "../hooks";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ---- Layout ----------------------------------------------------------------

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-xl px-4 pb-tabbar", className)}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: boolean | string;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  const goBack = useGoBack();
  return (
    <header className="pt-safe sticky top-0 z-20 -mx-4 mb-3 bg-ink-950/80 px-4 pb-3 backdrop-blur-xl">
      <div className="flex min-h-11 items-center gap-2">
        {back && (
          <button
            aria-label="Kembali"
            onClick={() => (typeof back === "string" ? navigate(back) : goBack())}
            className="-ml-2 grid size-10 place-items-center rounded-full text-lime-400 active:bg-white/5"
          >
            <ChevronLeft className="size-6" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          {subtitle && <div className="text-xs font-medium uppercase tracking-[0.14em] text-ink-400">{subtitle}</div>}
          <h1 className={cx("truncate font-display font-bold tracking-tight", back ? "text-xl" : "text-[28px] leading-tight")}>
            {title}
          </h1>
        </div>
        {right && <div className="flex items-center gap-1">{right}</div>}
      </div>
    </header>
  );
}

export function Card({
  children,
  className,
  onClick,
  glow,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  glow?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  // Tailwind can't resolve two conflicting padding utilities, so a caller-supplied one replaces the default.
  const customPadding = /(^|\s)p-\S+/.test(className ?? "");
  return (
    <Tag
      onClick={onClick}
      className={cx(
        "block w-full rounded-3xl border border-white/[0.06] bg-ink-850 text-left",
        !customPadding && "p-4",
        onClick && "transition active:scale-[0.99] active:bg-ink-800",
        glow && "glow-lime",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-400">{children}</h2>
      {action}
    </div>
  );
}

// ---- Buttons ---------------------------------------------------------------

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  block?: boolean;
};

export function Button({ variant = "primary", size = "md", icon, block, className, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={cx(
        "inline-flex select-none items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-12 px-4 text-[15px]",
        size === "lg" && "h-14 px-5 text-base",
        variant === "primary" && "bg-lime-400 text-ink-950 shadow-[0_8px_30px_-10px_rgb(198_255_61/0.6)] active:bg-lime-500",
        variant === "secondary" && "border border-white/[0.08] bg-ink-800 text-ink-100 active:bg-ink-700",
        variant === "ghost" && "text-lime-400 active:bg-white/5",
        variant === "danger" && "border border-red-500/30 bg-red-500/10 text-red-300 active:bg-red-500/20",
        block && "w-full",
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      {...rest}
      className={cx(
        "grid size-10 place-items-center rounded-full border border-white/[0.06] bg-ink-850 text-ink-100 transition active:scale-95 active:bg-ink-700",
        className,
      )}
    >
      {children}
    </button>
  );
}

// ---- Forms -----------------------------------------------------------------

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block px-1 text-[13px] font-medium text-ink-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block px-1 text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-2xl border border-white/[0.08] bg-ink-800 px-4 py-3 text-ink-100 placeholder:text-ink-500 outline-none transition focus:border-lime-400/60 focus:bg-ink-700/60";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(inputCls, "resize-none", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, "appearance-none", props.className)} />;
}

/** Numeric input that keeps a free-text draft (so "72," can be typed) and reports a parsed number. */
export function NumberInput({
  value,
  onChange,
  suffix,
  placeholder,
  step = "any",
  className,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  suffix?: string;
  placeholder?: string;
  step?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  useEffect(() => {
    const parsed = draft === "" ? undefined : Number(draft.replace(",", "."));
    if (parsed !== value) setDraft(value != null ? String(value) : "");
  }, [value]);
  return (
    <div className={cx("relative", className)}>
      <input
        inputMode="decimal"
        step={step}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,-]/g, "");
          setDraft(raw);
          const n = raw === "" ? undefined : Number(raw.replace(",", "."));
          onChange(n != null && Number.isFinite(n) ? n : undefined);
        }}
        className={cx(inputCls, suffix && "pr-14", "tabular-nums")}
      />
      {suffix && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-ink-400">{suffix}</span>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cx("no-scrollbar flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.06] bg-ink-850 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition",
            value === o.value ? "bg-lime-400 text-ink-950" : "text-ink-300 active:bg-white/5",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active ? "border-lime-400 bg-lime-400 text-ink-950" : "border-white/[0.08] bg-ink-850 text-ink-300 active:bg-white/5",
      )}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 py-2 text-left">
      <span className="flex-1">
        <span className="block text-[15px] text-ink-100">{label}</span>
        {hint && <span className="block text-xs text-ink-400">{hint}</span>}
      </span>
      <span className={cx("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-lime-400" : "bg-ink-600")}>
        <span className={cx("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

// ---- Feedback --------------------------------------------------------------

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "lime" | "warn" | "info" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "neutral" && "bg-white/[0.06] text-ink-300",
        tone === "lime" && "bg-lime-400/15 text-lime-300",
        tone === "warn" && "bg-amber-400/15 text-amber-300",
        tone === "info" && "bg-sky-400/15 text-sky-300",
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/10 px-6 py-10 text-center">
      <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-lime-400/10 text-lime-400">{icon}</div>
      <div className="font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-xs text-sm text-ink-400">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "lime" }) {
  return (
    <div
      className={cx(
        "rounded-2xl border px-4 py-3 text-sm leading-relaxed",
        tone === "info" && "border-sky-400/20 bg-sky-400/[0.06] text-sky-100/90",
        tone === "warn" && "border-amber-400/25 bg-amber-400/[0.07] text-amber-100/90",
        tone === "lime" && "border-lime-400/25 bg-lime-400/[0.07] text-lime-100/90",
      )}
    >
      {children}
    </div>
  );
}

type ToastCtx = (msg: string) => void;
const ToastContext = createContext<ToastCtx>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string>();
  const show = useCallback((m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg((cur) => (cur === m ? undefined : cur)), 2600);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center pt-safe">
            <div className="animate-fade-in mt-2 rounded-full border border-lime-400/30 bg-ink-800/95 px-4 py-2 text-sm font-medium text-ink-100 shadow-xl backdrop-blur">
              {msg}
            </div>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

// ---- Sheet -----------------------------------------------------------------

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-sheet-up relative flex max-h-[92dvh] flex-col rounded-t-[28px] border-t border-white/10 bg-ink-900">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-white/15" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button aria-label="Tutup" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/[0.06] text-ink-300">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="pb-safe border-t border-white/[0.06] px-5 pt-3">{footer}</div>}
        {!footer && <div className="pb-safe" />}
      </div>
    </div>,
    document.body,
  );
}

// ---- Media -----------------------------------------------------------------

export function BlobImage({ blob, alt, className }: { blob: Blob | null | undefined; alt: string; className?: string }) {
  const url = useObjectUrl(blob);
  if (!url) return <div className={cx("bg-ink-700", className)} />;
  return <img src={url} alt={alt} className={cx("object-cover", className)} />;
}

// ---- Data viz --------------------------------------------------------------

export function Ring({
  value,
  max,
  size = 168,
  stroke = 14,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const over = max > 0 && value > max;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#dcff8a" />
            <stop offset="1" stopColor="#8be000" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? "#fbbf24" : "url(#ringGrad)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(.2,.9,.25,1)", filter: "drop-shadow(0 0 8px rgb(198 255 61 / 0.35))" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function MacroBar({ label, value, target, color }: { label: string; value: number; target?: number; color: string }) {
  const pct = target ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-ink-300">{label}</span>
        <span className="tabular-nums text-ink-100">
          {Math.round(value)}
          <span className="text-ink-400">{target ? ` / ${Math.round(target)} g` : " g"}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export type ChartPoint = { x: string; y: number; y2?: number };

/** Lightweight SVG line chart: raw points plus an optional smoothed series (y2). */
export function LineChart({
  points,
  height = 180,
  unit,
  formatX,
}: {
  points: ChartPoint[];
  height?: number;
  unit?: string;
  formatX: (x: string) => string;
}) {
  const width = 340;
  const pad = { l: 34, r: 10, t: 12, b: 24 };
  if (points.length === 0) return null;
  const ys = points.flatMap((p) => [p.y, p.y2].filter((v): v is number => v != null));
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (max - min < 1) {
    min -= 0.5;
    max += 0.5;
  }
  const span = max - min;
  min -= span * 0.1;
  max += span * 0.1;
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - ((v - min) / (max - min)) * ih;
  const path = (key: "y" | "y2") =>
    points
      .map((p, i) => ({ v: p[key], i }))
      .filter((p): p is { v: number; i: number } => p.v != null)
      .map((p, j) => `${j ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`)
      .join(" ");
  const ticks = [min + (max - min) * 0.15, (min + max) / 2, max - (max - min) * 0.15];
  const xLabels = points.length > 1 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0];
  const area = `${path("y")} L${x(points.length - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Grafik tren">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c6ff3d" stopOpacity="0.22" />
          <stop offset="1" stopColor="#c6ff3d" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 4" />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#7a7a85">
            {t.toFixed(span < 5 ? 1 : 0)}
          </text>
        </g>
      ))}
      {points.length > 1 && <path d={area} fill="url(#areaGrad)" />}
      <path d={path("y")} fill="none" stroke="rgba(198,255,61,0.45)" strokeWidth="1.5" />
      {points.some((p) => p.y2 != null) && (
        <path d={path("y2")} fill="none" stroke="#c6ff3d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {points.map((p, i) => (
        <circle key={p.x} cx={x(i)} cy={y(p.y)} r={points.length > 40 ? 1.5 : 2.5} fill="#c6ff3d" />
      ))}
      {xLabels.map((i) => (
        <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize="9" fill="#7a7a85">
          {formatX(points[i].x)}
        </text>
      ))}
      {unit && (
        <text x={pad.l} y={9} fontSize="9" fill="#7a7a85">
          {unit}
        </text>
      )}
    </svg>
  );
}

export function MiniBars({ values, target, labels }: { values: (number | undefined)[]; target?: number; labels: string[] }) {
  const max = Math.max((target ?? 0) * 1.2, ...values.map((v) => v ?? 0), 1);
  return (
    <div className="flex h-32 items-end gap-2">
      {values.map((v, i) => (
        <div key={labels[i] + i} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="relative flex h-24 w-full items-end overflow-hidden rounded-lg bg-white/[0.04]">
            {target && <div className="absolute inset-x-0 border-t border-dashed border-white/25" style={{ bottom: `${(target / max) * 100}%` }} />}
            {v != null && v > 0 ? (
              <div
                className={cx("w-full rounded-lg", target && v > target * 1.1 ? "bg-amber-400" : "bg-lime-400")}
                style={{ height: `${(v / max) * 100}%` }}
              />
            ) : (
              <div className="w-full text-center text-[9px] text-ink-500">—</div>
            )}
          </div>
          <span className="text-[10px] text-ink-400">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}
