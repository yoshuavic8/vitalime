/**
 * Tiny 2D figure engine for exercise demos. A pose is a set of absolute joint angles; a motion is a
 * list of key poses. Rendering produces plain SVG markup so the same code drives the in-app
 * animation and the PNG sprite generator (scripts/generate-sprites.mjs).
 *
 * Coordinates: 100×100 viewBox, y grows downward, ground at y = GROUND.
 * Side view: the figure faces +x. Limb angles are measured from straight down; positive rotates
 * toward the facing direction (90 = pointing forward, 180 = straight up, -90 = backward).
 * Torso angle is measured from straight up; positive leans forward, -90 = lying on the back.
 * Front view: x is lateral. Near limbs are drawn on +x, far limbs mirrored; positive = outward.
 *
 * This file must stay dependency-free: the sprite script loads it outside the app bundle.
 */

export type Vec = [number, number];
/** [proximal, distal] absolute angles in degrees: upper arm/forearm or thigh/shin. */
export type Limb = [number, number];

export type Pose = {
  hip: Vec;
  torso: number;
  head?: number;
  armN: Limb;
  armF: Limb;
  legN: Limb;
  legF: Limb;
  /** Absolute foot angle; defaults to shin + 90 (foot flat when the shin is vertical). */
  footN?: number;
  footF?: number;
};

export type Shape =
  | { kind: "rect"; x: number; y: number; w: number; h: number; r?: number; tone?: "pad" | "frame" | "metal" }
  | { kind: "line"; a: Vec; b: Vec; tone?: "pad" | "frame" | "metal"; width?: number }
  | { kind: "circle"; c: Vec; r: number; tone?: "pad" | "frame" | "metal" };

export type Prop =
  | { kind: "dumbbell"; hands?: "both" | "near" }
  | { kind: "barbell" }
  | { kind: "kettlebell"; hands?: "both" | "near" }
  | { kind: "cable"; anchor: Vec; hands?: "both" | "near" }
  | { kind: "band"; anchor?: Vec }
  | { kind: "handle" }
  /** Pad pressed by the near foot (leg press platform), drawn along the foot. */
  | { kind: "footplate" }
  /** Roller pad at the near ankle (leg extension / curl). */
  | { kind: "anklePad" }
  /** Jump rope arc from hand to hand passing under the feet. */
  | { kind: "rope" }
  | { kind: "shape"; shape: Shape };

export type Motion = {
  view?: "side" | "front";
  /** Hide the floor line for hanging movements. */
  ground?: boolean;
  keys: Pose[];
  /** pingpong: A→B→A (default). cycle: A→B→C→…→A for gait-like movements. */
  loop?: "pingpong" | "cycle";
  props?: Prop[];
  /** Full cycle duration in ms. */
  period?: number;
};

export const GROUND = 92;

const L = { torso: 24, neck: 3.5, head: 5.5, upperArm: 14, forearm: 13, thigh: 19, shin: 19, foot: 6 };
const FRONT = { shoulder: 7.5, hip: 4 };

const COLORS = {
  near: "#c6ff3d",
  far: "#6f8f22",
  torso: "#c6ff3d",
  head: "#c6ff3d",
  weight: "#f4f4f5",
  weightDark: "#a1a1aa",
  cable: "#71717a",
  pad: "#27272a",
  padStroke: "#3f3f46",
  frame: "#52525b",
  metal: "#a1a1aa",
  ground: "#27272a",
};

export const SEGMENTS = L;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const add = (p: Vec, len: number, angleFromDown: number): Vec => [
  p[0] + len * Math.sin(rad(angleFromDown)),
  p[1] + len * Math.cos(rad(angleFromDown)),
];
const r1 = (n: number) => Math.round(n * 10) / 10;
const pt = (p: Vec) => `${r1(p[0])},${r1(p[1])}`;

// ---- Authoring helpers ------------------------------------------------------------------------

/** Shoulder centre for a hip position and torso angle. */
export function shoulderPos(hip: Vec, torso: number): Vec {
  return add(hip, L.torso, 180 - torso);
}

/** Torso angle that points from `hip` toward `shoulder`. */
export function torsoTo(hip: Vec, shoulder: Vec): number {
  return 180 - deg(Math.atan2(shoulder[0] - hip[0], shoulder[1] - hip[1]));
}

/**
 * Point on the torso line: frac 0 = hip, 1 = shoulder; `out` offsets toward the chest side
 * (the side the figure faces when upright).
 */
export function alongTorso(hip: Vec, torso: number, frac: number, out = 0): Vec {
  const t = rad(torso);
  return [hip[0] + L.torso * frac * Math.sin(t) + out * Math.cos(t), hip[1] - L.torso * frac * Math.cos(t) + out * Math.sin(t)];
}

/**
 * Two-bone IK: angles that put the end of a limb rooted at `root` on `target` (clamped to reach).
 * bend = 1 bends the joint toward larger angles (knees forward when standing), -1 the other way.
 */
export function solveLimb(root: Vec, target: Vec, l1: number, l2: number, bend: 1 | -1): Limb {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const base = deg(Math.atan2(dx, dy));
  const alpha = deg(Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const proximal = base + bend * alpha;
  const joint = add(root, l1, proximal);
  const distal = deg(Math.atan2(target[0] - joint[0], target[1] - joint[1]));
  return [proximal, unwrapNear(distal, proximal)];
}

/** Keeps angles continuous so interpolation takes the short way round. */
function unwrapNear(angle: number, ref: number) {
  let a = angle;
  while (a - ref > 180) a -= 360;
  while (a - ref < -180) a += 360;
  return a;
}

export const armReach = L.upperArm + L.forearm;
export const legReach = L.thigh + L.shin;

const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => lerp(a, unwrapNear(b, a), t);
const lerpLimb = (a: Limb, b: Limb, t: number): Limb => [lerpAngle(a[0], b[0], t), lerpAngle(a[1], b[1], t)];

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const foot = (x: number | undefined, y: number | undefined) => (x == null && y == null ? undefined : lerp(x ?? y!, y ?? x!, t));
  return {
    hip: [lerp(a.hip[0], b.hip[0], t), lerp(a.hip[1], b.hip[1], t)],
    torso: lerpAngle(a.torso, b.torso, t),
    head: lerp(a.head ?? 0, b.head ?? 0, t),
    armN: lerpLimb(a.armN, b.armN, t),
    armF: lerpLimb(a.armF, b.armF, t),
    legN: lerpLimb(a.legN, b.legN, t),
    legF: lerpLimb(a.legF, b.legF, t),
    footN: foot(a.footN, b.footN),
    footF: foot(a.footF, b.footF),
  };
}

/** Pose at phase t ∈ [0, 1) of the motion's loop. */
export function poseAt(m: Motion, t: number): Pose {
  const keys = m.keys;
  if (keys.length === 1) return keys[0];
  const phase = ((t % 1) + 1) % 1;
  if ((m.loop ?? "pingpong") === "pingpong") {
    // Two keys: A→B→A. More keys: A→B→C→B→A.
    const seq = [...keys, ...keys.slice(1, -1).reverse()];
    return stepThrough(seq, phase, true);
  }
  return stepThrough(keys, phase, true);
}

function stepThrough(seq: Pose[], phase: number, wrap: boolean): Pose {
  const n = wrap ? seq.length : seq.length - 1;
  const x = phase * n;
  const i = Math.floor(x) % seq.length;
  const j = (i + 1) % seq.length;
  // Linger slightly at each key so start/end positions are readable.
  const local = Math.min(1, Math.max(0, (x - Math.floor(x) - 0.12) / 0.76));
  return lerpPose(seq[i], seq[j], ease(local));
}

type Skeleton = {
  hipN: Vec;
  hipF: Vec;
  shoulderN: Vec;
  shoulderF: Vec;
  neck: Vec;
  headC: Vec;
  elbowN: Vec;
  handN: Vec;
  elbowF: Vec;
  handF: Vec;
  kneeN: Vec;
  ankleN: Vec;
  toeN: Vec;
  kneeF: Vec;
  ankleF: Vec;
  toeF: Vec;
};

function skeleton(p: Pose, view: "side" | "front"): Skeleton {
  const torsoDown = 180 - p.torso; // convert "from up, + forward" into "from down" convention
  const hipC = p.hip;
  const shoulderC = add(hipC, L.torso, torsoDown);
  const neck = add(shoulderC, L.neck, torsoDown);
  const headC = add(neck, L.head, torsoDown + (p.head ?? 0));

  if (view === "front") {
    const side = (sign: 1 | -1, arm: Limb, leg: Limb) => {
      const s: Vec = [shoulderC[0] + sign * FRONT.shoulder, shoulderC[1]];
      const h: Vec = [hipC[0] + sign * FRONT.hip, hipC[1]];
      const elbow = add(s, L.upperArm, sign * arm[0]);
      const hand = add(elbow, L.forearm, sign * arm[1]);
      const knee = add(h, L.thigh, sign * leg[0]);
      const ankle = add(knee, L.shin, sign * leg[1]);
      const toe: Vec = [ankle[0] + sign * 3.5, ankle[1] + 0.5];
      return { s, h, elbow, hand, knee, ankle, toe };
    };
    const n = side(1, p.armN, p.legN);
    const f = side(-1, p.armF, p.legF);
    return {
      hipN: n.h,
      hipF: f.h,
      shoulderN: n.s,
      shoulderF: f.s,
      neck,
      headC,
      elbowN: n.elbow,
      handN: n.hand,
      elbowF: f.elbow,
      handF: f.hand,
      kneeN: n.knee,
      ankleN: n.ankle,
      toeN: n.toe,
      kneeF: f.knee,
      ankleF: f.ankle,
      toeF: f.toe,
    };
  }

  const elbowN = add(shoulderC, L.upperArm, p.armN[0]);
  const handN = add(elbowN, L.forearm, p.armN[1]);
  const elbowF = add(shoulderC, L.upperArm, p.armF[0]);
  const handF = add(elbowF, L.forearm, p.armF[1]);
  const kneeN = add(hipC, L.thigh, p.legN[0]);
  const ankleN = add(kneeN, L.shin, p.legN[1]);
  const toeN = add(ankleN, L.foot, p.footN ?? p.legN[1] + 90);
  const kneeF = add(hipC, L.thigh, p.legF[0]);
  const ankleF = add(kneeF, L.shin, p.legF[1]);
  const toeF = add(ankleF, L.foot, p.footF ?? p.legF[1] + 90);
  return {
    hipN: hipC,
    hipF: hipC,
    shoulderN: shoulderC,
    shoulderF: shoulderC,
    neck,
    headC,
    elbowN,
    handN,
    elbowF,
    handF,
    kneeN,
    ankleN,
    toeN,
    kneeF,
    ankleF,
    toeF,
  };
}

const poly = (pts: Vec[], color: string, width: number) =>
  `<polyline points="${pts.map(pt).join(" ")}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

function toneColors(tone: "pad" | "frame" | "metal" = "pad") {
  if (tone === "metal") return { fill: COLORS.metal, stroke: COLORS.metal };
  if (tone === "frame") return { fill: "none", stroke: COLORS.frame };
  return { fill: COLORS.pad, stroke: COLORS.padStroke };
}

function shapeSvg(s: Shape): string {
  const c = toneColors(s.tone);
  switch (s.kind) {
    case "rect":
      return `<rect x="${r1(s.x)}" y="${r1(s.y)}" width="${r1(s.w)}" height="${r1(s.h)}" rx="${s.r ?? 1.5}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1"/>`;
    case "line":
      return `<line x1="${r1(s.a[0])}" y1="${r1(s.a[1])}" x2="${r1(s.b[0])}" y2="${r1(s.b[1])}" stroke="${c.stroke}" stroke-width="${s.width ?? 2.2}" stroke-linecap="round"/>`;
    case "circle":
      return `<circle cx="${r1(s.c[0])}" cy="${r1(s.c[1])}" r="${r1(s.r)}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1"/>`;
    default: {
      const never: never = s;
      return never;
    }
  }
}

function dumbbellAt(h: Vec, view: "side" | "front") {
  if (view === "front") {
    return `<rect x="${r1(h[0] - 1.6)}" y="${r1(h[1] - 4.5)}" width="3.2" height="9" rx="1.2" fill="${COLORS.weight}"/>`;
  }
  return `<circle cx="${r1(h[0])}" cy="${r1(h[1])}" r="3.4" fill="${COLORS.weight}" stroke="${COLORS.weightDark}" stroke-width="0.8"/>`;
}

function kettlebellAt(h: Vec) {
  const c: Vec = [h[0], h[1] + 4.2];
  return (
    `<path d="M ${r1(h[0] - 2.2)} ${r1(h[1] + 1.5)} Q ${r1(h[0])} ${r1(h[1] - 2.5)} ${r1(h[0] + 2.2)} ${r1(h[1] + 1.5)}" fill="none" stroke="${COLORS.weight}" stroke-width="1.3"/>` +
    `<circle cx="${r1(c[0])}" cy="${r1(c[1])}" r="3.6" fill="${COLORS.weight}"/>`
  );
}

type Layers = { back: string[]; front: string[] };

function propSvg(prop: Prop, s: Skeleton, view: "side" | "front", layers: Layers) {
  const hands = (which: "both" | "near" = "both") => (which === "both" ? [s.handF, s.handN] : [s.handN]);
  switch (prop.kind) {
    case "dumbbell":
      for (const h of hands(prop.hands)) layers.front.push(dumbbellAt(h, view));
      return;
    case "kettlebell":
      for (const h of hands(prop.hands)) layers.front.push(kettlebellAt(h));
      return;
    case "barbell": {
      if (view === "front") {
        const y = (s.handN[1] + s.handF[1]) / 2;
        const xL = Math.min(s.handN[0], s.handF[0]) - 12;
        const xR = Math.max(s.handN[0], s.handF[0]) + 12;
        layers.front.push(
          `<line x1="${r1(xL)}" y1="${r1(y)}" x2="${r1(xR)}" y2="${r1(y)}" stroke="${COLORS.metal}" stroke-width="1.6" stroke-linecap="round"/>`,
          `<rect x="${r1(xL - 1)}" y="${r1(y - 6)}" width="3" height="12" rx="1" fill="${COLORS.weight}"/>`,
          `<rect x="${r1(xR - 2)}" y="${r1(y - 6)}" width="3" height="12" rx="1" fill="${COLORS.weight}"/>`,
        );
        return;
      }
      const h = s.handN;
      layers.front.push(
        `<circle cx="${r1(h[0])}" cy="${r1(h[1])}" r="6.5" fill="${COLORS.weight}" fill-opacity="0.92" stroke="${COLORS.weightDark}" stroke-width="1"/>`,
        `<circle cx="${r1(h[0])}" cy="${r1(h[1])}" r="1.4" fill="${COLORS.weightDark}"/>`,
      );
      return;
    }
    case "cable":
      for (const h of hands(prop.hands)) {
        layers.back.push(
          `<line x1="${r1(prop.anchor[0])}" y1="${r1(prop.anchor[1])}" x2="${r1(h[0])}" y2="${r1(h[1])}" stroke="${COLORS.cable}" stroke-width="0.9"/>`,
        );
      }
      layers.back.push(`<circle cx="${r1(prop.anchor[0])}" cy="${r1(prop.anchor[1])}" r="1.6" fill="${COLORS.frame}"/>`);
      return;
    case "band":
      if (prop.anchor) {
        layers.back.push(
          `<line x1="${r1(prop.anchor[0])}" y1="${r1(prop.anchor[1])}" x2="${r1(s.handN[0])}" y2="${r1(s.handN[1])}" stroke="#f59e0b" stroke-width="1.4"/>`,
        );
      } else {
        layers.front.push(
          `<line x1="${r1(s.handF[0])}" y1="${r1(s.handF[1])}" x2="${r1(s.handN[0])}" y2="${r1(s.handN[1])}" stroke="#f59e0b" stroke-width="1.4"/>`,
        );
      }
      return;
    case "handle": {
      if (view === "side") {
        const h = s.handN;
        layers.front.push(
          `<line x1="${r1(h[0])}" y1="${r1(h[1] - 3)}" x2="${r1(h[0])}" y2="${r1(h[1] + 3)}" stroke="${COLORS.metal}" stroke-width="1.8" stroke-linecap="round"/>`,
        );
        return;
      }
      const y = (s.handN[1] + s.handF[1]) / 2;
      layers.front.push(
        `<line x1="${r1(Math.min(s.handN[0], s.handF[0]) - 4)}" y1="${r1(y)}" x2="${r1(Math.max(s.handN[0], s.handF[0]) + 4)}" y2="${r1(y)}" stroke="${COLORS.metal}" stroke-width="1.6" stroke-linecap="round"/>`,
      );
      return;
    }
    case "footplate": {
      const dx = s.toeN[0] - s.ankleN[0];
      const dy = s.toeN[1] - s.ankleN[1];
      const len = Math.hypot(dx, dy) || 1;
      const u: Vec = [dx / len, dy / len];
      const n: Vec = [-u[1] * 2.2, u[0] * 2.2];
      const a: Vec = [s.ankleN[0] - u[0] * 4 - n[0], s.ankleN[1] - u[1] * 4 - n[1]];
      const b: Vec = [s.toeN[0] + u[0] * 4 - n[0], s.toeN[1] + u[1] * 4 - n[1]];
      layers.back.push(
        `<line x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}" stroke="${COLORS.frame}" stroke-width="3" stroke-linecap="round"/>`,
      );
      return;
    }
    case "rope": {
      const low = Math.max(s.ankleN[1], s.ankleF[1]) + 4;
      const cy = 2 * low - (s.handN[1] + s.handF[1]) / 2;
      layers.back.push(
        `<path d="M ${pt(s.handF)} Q ${r1((s.handF[0] + s.handN[0]) / 2)} ${r1(cy)} ${pt(s.handN)}" fill="none" stroke="#f59e0b" stroke-width="1.2"/>`,
      );
      return;
    }
    case "anklePad":
      layers.front.push(
        `<circle cx="${r1(s.ankleN[0] + 1.5)}" cy="${r1(s.ankleN[1] - 1)}" r="2.8" fill="${COLORS.pad}" stroke="${COLORS.frame}" stroke-width="1"/>`,
      );
      return;
    case "shape":
      layers.back.push(shapeSvg(prop.shape));
      return;
    default: {
      const never: never = prop;
      return never;
    }
  }
}

/** Inner SVG markup (no <svg> wrapper) for one pose of a motion. */
export function renderPose(m: Motion, p: Pose, opts: { ground?: boolean } = {}): string {
  const view = m.view ?? "side";
  const s = skeleton(p, view);
  const layers: Layers = { back: [], front: [] };
  for (const prop of m.props ?? []) propSvg(prop, s, view, layers);

  const out: string[] = [];
  if (opts.ground !== false && m.ground !== false) {
    out.push(`<line x1="4" y1="${GROUND + 1.5}" x2="96" y2="${GROUND + 1.5}" stroke="${COLORS.ground}" stroke-width="1.2" stroke-linecap="round"/>`);
  }
  out.push(...layers.back);

  const farColor = view === "front" ? COLORS.near : COLORS.far;
  // Far side first so near limbs overlap it.
  out.push(poly([s.hipF, s.kneeF, s.ankleF, s.toeF], farColor, 4));
  out.push(poly([s.shoulderF, s.elbowF, s.handF], farColor, 3.6));
  if (view === "front") {
    out.push(poly([s.shoulderF, s.shoulderN], COLORS.torso, 4.4));
    out.push(poly([s.hipF, s.hipN], COLORS.torso, 4.4));
    const mid = (a: Vec, b: Vec): Vec => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    out.push(poly([mid(s.hipF, s.hipN), mid(s.shoulderF, s.shoulderN)], COLORS.torso, 6));
  } else {
    out.push(poly([s.hipN, s.shoulderN], COLORS.torso, 6));
  }
  out.push(poly([s.shoulderN, s.neck], COLORS.torso, 3));
  out.push(`<circle cx="${r1(s.headC[0])}" cy="${r1(s.headC[1])}" r="${L.head}" fill="${COLORS.head}"/>`);
  out.push(poly([s.hipN, s.kneeN, s.ankleN, s.toeN], COLORS.near, 4.4));
  out.push(poly([s.shoulderN, s.elbowN, s.handN], COLORS.near, 4));
  out.push(...layers.front);
  return out.join("");
}

export function motionSvg(m: Motion, t: number, opts: { size?: number; background?: string } = {}): string {
  const size = opts.size ?? 100;
  const bg = opts.background ? `<rect width="100" height="100" fill="${opts.background}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">${bg}${renderPose(m, poseAt(m, t))}</svg>`;
}
