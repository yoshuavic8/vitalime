import type { Limb, Motion, Pose, Prop, Shape, Vec } from "../lib/pose";
import { GROUND, SEGMENTS, shoulderPos, solveLimb, torsoTo } from "../lib/pose";

// ---- Authoring DSL ------------------------------------------------------------------------------

type KeySpec = {
  hip: Vec;
  /** Torso angle, or a point the shoulder should sit on. */
  torso: number | { shoulder: Vec };
  head?: number;
  hand?: Vec;
  handF?: Vec;
  arm?: Limb;
  armF?: Limb;
  armBend?: 1 | -1;
  armBendF?: 1 | -1;
  foot?: Vec;
  footF?: Vec;
  leg?: Limb;
  legF?: Limb;
  legBend?: 1 | -1;
  legBendF?: 1 | -1;
  footAngle?: number;
  footAngleF?: number;
};

const FRONT_SHOULDER = 7.5;
const ARM = [SEGMENTS.upperArm, SEGMENTS.forearm] as const;
const LEG = [SEGMENTS.thigh, SEGMENTS.shin] as const;
const shift = (v: Vec, dx: number, dy: number): Vec => [v[0] + dx, v[1] + dy];
const offsetLimb = (l: Limb, d: number): Limb => [l[0] + d, l[1] + d];

/** Side-view key pose. Far limbs default to a slightly offset copy of the near ones for depth. */
function k(s: KeySpec): Pose {
  const torso = typeof s.torso === "number" ? s.torso : torsoTo(s.hip, s.torso.shoulder);
  const sh = shoulderPos(s.hip, torso);
  const armBend = s.armBend ?? -1;
  const legBend = s.legBend ?? 1;
  const armN: Limb = s.arm ?? (s.hand ? solveLimb(sh, s.hand, ...ARM, armBend) : [0, 0]);
  const armF: Limb =
    s.armF ?? (s.handF ? solveLimb(sh, s.handF, ...ARM, s.armBendF ?? armBend) : s.hand ? solveLimb(sh, shift(s.hand, -2, -0.6), ...ARM, armBend) : offsetLimb(armN, -6));
  const legN: Limb = s.leg ?? (s.foot ? solveLimb(s.hip, s.foot, ...LEG, legBend) : [0, 0]);
  const legF: Limb =
    s.legF ?? (s.footF ? solveLimb(s.hip, s.footF, ...LEG, s.legBendF ?? legBend) : s.foot ? solveLimb(s.hip, shift(s.foot, -2.5, 0), ...LEG, legBend) : offsetLimb(legN, -4));
  return { hip: s.hip, torso, head: s.head, armN, armF, legN, legF, footN: s.footAngle, footF: s.footAngleF ?? s.footAngle };
}

/** Front-view key pose: symmetric unless far limbs are given. Angles are positive outward. */
function f(s: { hip: Vec; torso?: number; arm: Limb; armF?: Limb; leg?: Limb; legF?: Limb; hand?: Vec; armBend?: 1 | -1 }): Pose {
  const torso = s.torso ?? 0;
  const sh = shoulderPos(s.hip, torso);
  const arm = s.hand ? solveLimb([sh[0] + FRONT_SHOULDER, sh[1]], s.hand, ...ARM, s.armBend ?? 1) : s.arm;
  const leg = s.leg ?? [2, 2];
  return { hip: s.hip, torso, armN: arm, armF: s.armF ?? arm, legN: leg, legF: s.legF ?? leg };
}

const shape = (sh: Shape): Prop => ({ kind: "shape", shape: sh });
const DB: Prop = { kind: "dumbbell" };
const DB1: Prop = { kind: "dumbbell", hands: "near" };
const BB: Prop = { kind: "barbell" };
const KB: Prop = { kind: "kettlebell", hands: "near" };
const HANDLE: Prop = { kind: "handle" };
const cable = (x: number, y: number): Prop => ({ kind: "cable", anchor: [x, y] });

const FLAT_BENCH = [
  shape({ kind: "rect", x: 16, y: 64.5, w: 50, h: 4 }),
  shape({ kind: "line", a: [22, 68.5], b: [22, GROUND], tone: "frame" }),
  shape({ kind: "line", a: [60, 68.5], b: [60, GROUND], tone: "frame" }),
];
const SEAT = (x: number, y: number, w = 22) => [
  shape({ kind: "rect", x, y, w, h: 4 }),
  shape({ kind: "line", a: [x + w / 2, y + 4], b: [x + w / 2, GROUND], tone: "frame" }),
];
const BACKREST = (a: Vec, b: Vec) => shape({ kind: "line", a, b, tone: "pad", width: 5 });
const BOX = (x: number, y: number, w: number) => shape({ kind: "rect", x, y, w, h: GROUND - y + 1, r: 1 });
const BAR_SIDE = (x: number, y: number) => [
  shape({ kind: "circle", c: [x, y], r: 1.8, tone: "metal" }),
  shape({ kind: "line", a: [x - 14, y], b: [x + 14, y], tone: "frame", width: 1 }),
];

const STAND_HIP: Vec = [46, 54];
const FEET: Vec = [47, GROUND];

// Reusable key poses -------------------------------------------------------------------------------

const stand = (o: Partial<KeySpec> = {}): Pose => k({ hip: STAND_HIP, torso: 0, foot: FEET, ...o });
const squatBottom = (o: Partial<KeySpec> = {}): Pose => k({ hip: [35, 72], torso: 38, foot: FEET, ...o });

function walkCycle(o: { arms?: "swing" | "down" | "run"; run?: boolean } = {}): Pose[] {
  const run = o.run ?? false;
  const amp = run ? 1 : 0.6;
  const hipY = run ? 55 : 54.5;
  const torso = run ? 10 : 3;
  const arms = o.arms ?? (run ? "run" : "swing");
  const armPair = (forward: boolean): Limb =>
    arms === "down" ? [forward ? 3 : -3, forward ? 3 : -3] : arms === "run" ? (forward ? [40, 125] : [-40, 40]) : forward ? [22, 32] : [-22, -12];
  const contact = (nearFront: boolean): Pose => ({
    hip: [46, hipY + 1],
    torso,
    armN: armPair(!nearFront),
    armF: armPair(nearFront),
    legN: nearFront ? [25 * amp, 8 * amp] : [-22 * amp, -55 * amp],
    legF: nearFront ? [-22 * amp, -55 * amp] : [25 * amp, 8 * amp],
  });
  const passing = (nearSupport: boolean): Pose => ({
    hip: [46, hipY - (run ? 3 : 1)],
    torso,
    armN: [0, arms === "run" ? 80 : 0],
    armF: [0, arms === "run" ? 80 : 0],
    legN: nearSupport ? [2, 0] : [45 * amp, -20 * amp],
    legF: nearSupport ? [45 * amp, -20 * amp] : [2, 0],
  });
  return [contact(true), passing(false), contact(false), passing(true)];
}

// ---- Motions per exercise ------------------------------------------------------------------------

const lyingBench = (hand: Vec, o: Partial<KeySpec> = {}) => k({ hip: [56, 62], torso: -90, foot: [74, GROUND], hand, armBend: -1, ...o });
const seatedUpright = (o: Partial<KeySpec>) => k({ hip: [40, 66], torso: -6, foot: [60, GROUND], ...o });
const quadruped = (o: Partial<KeySpec> = {}) =>
  k({ hip: [40, 73], torso: 75, leg: [0, -90], legF: [-3, -92], footAngle: -90, hand: [64, GROUND], ...o });
const plankTop = (o: Partial<KeySpec> = {}) =>
  k({ hip: [44, 72], torso: 80, foot: [9, 85], footAngle: 14, hand: [68, GROUND - 0.5], ...o });
const lyingFloor = (o: Partial<KeySpec>) => k({ hip: [54, 88], torso: -90, ...o });

const curl = (props: Prop[], extra: Prop[] = []): Motion => ({
  keys: [stand({ arm: [2, 2], armF: [-3, -3] }), stand({ arm: [2, 150], armF: [-3, 145] })],
  props: [...props, ...extra],
});

export const MOTIONS: Record<string, Motion> = {
  // Squat / knee dominant
  "ex-goblet-squat": {
    keys: [stand({ hand: [55, 37] }), squatBottom({ hand: [57, 57] })],
    props: [DB1],
  },
  "ex-back-squat": {
    keys: [stand({ hand: [43, 31], armBend: 1 }), squatBottom({ hand: [48, 52], armBend: 1 })],
    props: [BB],
  },
  "ex-front-squat": {
    keys: [stand({ hand: [54, 33], armBend: -1 }), k({ hip: [37, 73], torso: 22, foot: FEET, hand: [50, 53], armBend: -1 })],
    props: [BB],
  },
  "ex-bw-squat": {
    keys: [stand({ arm: [5, 5] }), squatBottom({ arm: [95, 95] })],
  },
  "ex-jump-squat": {
    keys: [squatBottom({ arm: [-50, -40] }), k({ hip: [46, 46], torso: 0, foot: [47, 84], arm: [150, 160], footAngle: 150 })],
  },
  "ex-wall-sit": {
    keys: [k({ hip: [36, 72], torso: 0, foot: [55, GROUND], hand: [50, 70] }), k({ hip: [36, 72.5], torso: 0, foot: [55, GROUND], hand: [50, 70.5] })],
    props: [shape({ kind: "rect", x: 26, y: 20, w: 4, h: 73, r: 0.5 })],
  },
  "ex-leg-press": {
    keys: [k({ hip: [36, 72], torso: -55, foot: [55, 56], hand: [42, 74] }), k({ hip: [36, 72], torso: -55, foot: [70, 44], hand: [42, 74] })],
    props: [
      BACKREST([40, 77], [20, 54]),
      shape({ kind: "line", a: [34, 80], b: [52, 80], tone: "pad", width: 4 }),
      shape({ kind: "line", a: [50, 82], b: [86, 36], tone: "frame" }),
      shape({ kind: "line", a: [30, 82], b: [30, GROUND], tone: "frame" }),
      { kind: "footplate" },
    ],
  },
  "ex-hack-squat": {
    keys: [k({ hip: [44, 55], torso: -10, foot: [54, GROUND], hand: [43, 30] }), k({ hip: [38, 74], torso: -10, foot: [54, GROUND], hand: [37, 50] })],
    props: [shape({ kind: "line", a: [34, 92], b: [24, 24], tone: "pad", width: 5 }), HANDLE],
  },
  "ex-leg-extension": {
    keys: [seatedUpright({ leg: [90, 0], hand: [36, 70] }), seatedUpright({ leg: [90, 82], hand: [36, 70] })],
    props: [...SEAT(26, 68, 34), BACKREST([30, 68], [27, 40]), { kind: "anklePad" }],
  },
  "ex-leg-curl": {
    keys: [seatedUpright({ leg: [90, 78], hand: [36, 70] }), seatedUpright({ leg: [90, -18], hand: [36, 70] })],
    props: [...SEAT(26, 68, 34), BACKREST([30, 68], [27, 40]), shape({ kind: "rect", x: 48, y: 59, w: 14, h: 3.5 }), { kind: "anklePad" }],
  },
  "ex-calf-raise": {
    keys: [stand({ arm: [4, 4] }), k({ hip: [46, 47.5], torso: 0, foot: [47, 85.5], footAngle: 30, arm: [4, 4] })],
    props: [shape({ kind: "rect", x: 44, y: 90, w: 16, h: 3 })],
  },
  "ex-step-up": {
    keys: [
      k({ hip: [46, 60], torso: 15, foot: [60, 74], footF: [42, GROUND], arm: [3, 3], legBend: 1 }),
      k({ hip: [58, 37], torso: 2, foot: [60, 74], legF: [75, -5], arm: [3, 3] }),
    ],
    props: [BOX(52, 74, 22), DB],
  },
  "ex-lunge": {
    keys: [stand({ arm: [2, 2] }), k({ hip: [46, 71], torso: 2, foot: [62, GROUND], legF: [-8, -93], footAngleF: 70, arm: [2, 2] })],
    props: [DB],
  },
  "ex-reverse-lunge": {
    keys: [stand({ hand: [49, 54] }), k({ hip: [44, 71], torso: 4, foot: [60, GROUND], legF: [-8, -93], footAngleF: 70, hand: [48, 69] })],
  },
  "ex-split-squat": {
    keys: [
      k({ hip: [44, 57], torso: 4, foot: [58, GROUND], footF: [24, 70], legBendF: 1, footAngleF: -80, arm: [2, 2] }),
      k({ hip: [42, 71], torso: 8, foot: [58, GROUND], footF: [24, 70], legBendF: 1, footAngleF: -80, arm: [2, 2] }),
    ],
    props: [shape({ kind: "rect", x: 8, y: 71, w: 20, h: 4 }), shape({ kind: "line", a: [18, 75], b: [18, GROUND], tone: "frame" }), DB],
  },

  // Hinge / glutes
  "ex-deadlift": {
    keys: [k({ hip: [34, 70], torso: 58, foot: [52, GROUND], hand: [55, 85.5] }), k({ hip: [48, 54], torso: 0, foot: [50, GROUND], hand: [50, 57] })],
    props: [BB],
  },
  "ex-rdl": {
    keys: [k({ hip: [48, 54], torso: 0, foot: [50, GROUND], hand: [50, 57] }), k({ hip: [39, 57], torso: 78, foot: [50, GROUND], hand: [62, 77] })],
    props: [BB],
  },
  "ex-db-rdl": {
    keys: [k({ hip: [48, 54], torso: 0, foot: [50, GROUND], hand: [50, 57] }), k({ hip: [39, 57], torso: 78, foot: [50, GROUND], hand: [62, 77] })],
    props: [DB],
  },
  "ex-single-leg-rdl": {
    keys: [k({ hip: [46, 54], torso: 0, foot: [47, GROUND], hand: [48, 57] }), k({ hip: [46, 56], torso: 85, foot: [48, GROUND], legF: [-92, -92], hand: [70, 80] })],
    props: [DB1],
  },
  "ex-hip-thrust": {
    keys: [k({ hip: [44, 80], torso: -55, foot: [66, GROUND], hand: [46, 79], armBend: 1 }), k({ hip: [48, 65], torso: -90, foot: [66, GROUND], hand: [50, 64], armBend: 1 })],
    props: [shape({ kind: "rect", x: 6, y: 67, w: 20, h: 4 }), shape({ kind: "line", a: [16, 71], b: [16, GROUND], tone: "frame" }), BB],
  },
  "ex-glute-bridge": {
    keys: [
      lyingFloor({ hip: [50, 88], torso: -90, foot: [68, GROUND], hand: [40, 91] }),
      lyingFloor({ hip: [51, 76], torso: { shoulder: [27, 87] }, foot: [68, GROUND], hand: [41, 91] }),
    ],
  },
  "ex-kb-swing": {
    keys: [k({ hip: [38, 58], torso: 62, foot: [50, GROUND], hand: [48, 74] }), k({ hip: [47, 54], torso: -4, foot: [50, GROUND], arm: [92, 92] })],
    props: [KB],
  },
  "ex-back-extension": {
    keys: [k({ hip: [52, 54], torso: 120, leg: [-40, -40], hand: [64, 66] }), k({ hip: [52, 54], torso: 40, leg: [-40, -40], hand: [60, 46] })],
    props: [shape({ kind: "line", a: [52, 62], b: [60, 54], tone: "pad", width: 5 }), shape({ kind: "line", a: [56, 60], b: [40, GROUND], tone: "frame" }), shape({ kind: "line", a: [28, 80], b: [22, 86], tone: "pad", width: 4 })],
  },
  "ex-cable-kickback": {
    keys: [k({ hip: [46, 56], torso: 30, foot: [50, GROUND], footF: [52, GROUND], hand: [64, 50] }), k({ hip: [46, 56], torso: 30, foot: [50, GROUND], legF: [-50, -45], hand: [64, 50] })],
    props: [shape({ kind: "line", a: [68, 20], b: [68, GROUND], tone: "frame" }), { kind: "cable", anchor: [68, 88], hands: "near" }],
  },

  // Push
  "ex-bench": {
    keys: [lyingBench([34, 37]), lyingBench([38, 53])],
    props: [...FLAT_BENCH, BB],
  },
  "ex-db-bench": {
    keys: [lyingBench([33, 36]), lyingBench([36, 55])],
    props: [...FLAT_BENCH, DB],
  },
  "ex-incline-db": {
    keys: [k({ hip: [54, 68], torso: -52, foot: [72, GROUND], hand: [40, 28] }), k({ hip: [54, 68], torso: -52, foot: [72, GROUND], hand: [41, 50] })],
    props: [BACKREST([54, 72], [27, 46]), ...SEAT(46, 70, 20), DB],
  },
  "ex-machine-chest-press": {
    keys: [seatedUpright({ hand: [46, 44] }), seatedUpright({ hand: [62, 44] })],
    props: [...SEAT(28, 68, 24), BACKREST([32, 68], [30, 36]), HANDLE],
  },
  "ex-pushup": {
    keys: [plankTop(), plankTop({ hip: [44, 80], torso: 86, hand: [68, GROUND - 0.5] })],
  },
  "ex-knee-pushup": {
    keys: [
      k({ hip: [42, 77], torso: 75, leg: [-75, -150], hand: [66, GROUND - 0.5] }),
      k({ hip: [42, 83], torso: 85, leg: [-80, -150], hand: [66, GROUND - 0.5] }),
    ],
  },
  "ex-pike-pushup": {
    keys: [k({ hip: [44, 52], torso: 133, foot: [22, GROUND], footAngle: 60, hand: [68, GROUND - 0.5] }), k({ hip: [44, 54], torso: 150, foot: [22, GROUND], footAngle: 60, hand: [68, GROUND - 0.5] })],
  },
  "ex-ohp": {
    keys: [stand({ hand: [53, 33], armBend: -1 }), stand({ hand: [49, 7], armBend: -1 })],
    props: [BB],
  },
  "ex-db-shoulder": {
    keys: [seatedUpright({ hand: [46, 40], armBend: -1 }), seatedUpright({ hand: [41, 16], armBend: -1 })],
    props: [...SEAT(28, 68, 24), BACKREST([32, 68], [30, 36]), DB],
  },
  "ex-machine-shoulder-press": {
    keys: [seatedUpright({ hand: [46, 40], armBend: -1 }), seatedUpright({ hand: [42, 16], armBend: -1 })],
    props: [...SEAT(28, 68, 24), BACKREST([32, 68], [30, 34]), HANDLE],
  },
  "ex-lateral-raise": {
    view: "front",
    keys: [f({ hip: [50, 54], arm: [8, 10] }), f({ hip: [50, 54], arm: [86, 92] })],
    props: [DB],
  },
  "ex-cable-lateral": {
    view: "front",
    keys: [f({ hip: [50, 54], arm: [-12, -20], armF: [28, -40] }), f({ hip: [50, 54], arm: [85, 90], armF: [28, -40] })],
    props: [{ kind: "cable", anchor: [30, 88], hands: "near" }],
  },
  "ex-front-raise": {
    keys: [stand({ arm: [4, 4] }), stand({ arm: [88, 90], armF: [4, 4] })],
    props: [DB],
  },
  "ex-dips": {
    ground: false,
    keys: [k({ hip: [46, 53], torso: 15, hand: [54, 56], leg: [8, -60] }), k({ hip: [46, 66], torso: 22, hand: [55, 56], leg: [8, -60] })],
    props: [shape({ kind: "line", a: [38, 57.5], b: [72, 57.5], tone: "metal", width: 2 }), shape({ kind: "line", a: [66, 57.5], b: [66, 96], tone: "frame" })],
  },
  "ex-bench-dip": {
    keys: [k({ hip: [40, 61], torso: 0, foot: [70, GROUND], hand: [33, 64.5], armBend: -1 }), k({ hip: [41, 73], torso: 4, foot: [70, GROUND], hand: [33, 64.5], armBend: -1 })],
    props: [shape({ kind: "rect", x: 8, y: 64.5, w: 26, h: 4 }), shape({ kind: "line", a: [21, 68.5], b: [21, GROUND], tone: "frame" })],
  },
  "ex-triceps-pushdown": {
    keys: [stand({ torso: 8, arm: [4, 140] }), stand({ torso: 8, arm: [4, 6] })],
    props: [cable(60, 4), HANDLE],
  },
  "ex-overhead-triceps": {
    keys: [stand({ arm: [172, -20] }), stand({ arm: [172, 176] })],
    props: [DB1],
  },
  "ex-skullcrusher": {
    keys: [lyingBench([0, 0], { arm: [168, -82] }), lyingBench([0, 0], { arm: [172, 176] })],
    props: [...FLAT_BENCH, BB],
  },

  // Pull
  "ex-pullup": {
    ground: false,
    keys: [k({ hip: [44, 66], torso: -6, hand: [50, 14], leg: [4, -55] }), k({ hip: [44, 48], torso: -12, hand: [50, 14], armBend: -1, leg: [10, -50] })],
    props: [...BAR_SIDE(50, 14)],
  },
  "ex-chinup": {
    ground: false,
    keys: [k({ hip: [44, 66], torso: -6, hand: [50, 14], leg: [4, -55] }), k({ hip: [45, 47], torso: -4, hand: [50, 14], armBend: -1, leg: [10, -50] })],
    props: [...BAR_SIDE(50, 14)],
  },
  "ex-assisted-pullup": {
    keys: [k({ hip: [44, 62], torso: -6, hand: [50, 12], leg: [60, -40] }), k({ hip: [45, 46], torso: -6, hand: [50, 12], armBend: -1, leg: [60, -40] })],
    props: [...BAR_SIDE(50, 12), shape({ kind: "line", a: [60, 80], b: [60, GROUND], tone: "frame" })],
  },
  "ex-lat-pulldown": {
    keys: [k({ hip: [44, 70], torso: -10, foot: [60, GROUND], hand: [46, 20], armBend: 1 }), k({ hip: [44, 70], torso: -16, foot: [60, GROUND], hand: [47, 42], armBend: 1 })],
    props: [...SEAT(32, 72, 24), shape({ kind: "rect", x: 54, y: 63, w: 10, h: 3.5 }), cable(46, 2), HANDLE],
  },
  "ex-straight-arm-pulldown": {
    keys: [k({ hip: [42, 55], torso: 30, foot: [48, GROUND], hand: [76, 30] }), k({ hip: [42, 55], torso: 30, foot: [48, GROUND], hand: [58, 58] })],
    props: [cable(88, 6), HANDLE],
  },
  "ex-barbell-row": {
    keys: [k({ hip: [40, 58], torso: 70, foot: [50, GROUND], hand: [62, 80] }), k({ hip: [40, 58], torso: 70, foot: [50, GROUND], hand: [52, 66], armBend: -1 })],
    props: [BB],
  },
  "ex-db-row": {
    keys: [
      k({ hip: [40, 58], torso: 80, foot: [36, GROUND], footF: [46, GROUND], hand: [64, 82], handF: [70, 77] }),
      k({ hip: [40, 58], torso: 80, foot: [36, GROUND], footF: [46, GROUND], hand: [50, 64], handF: [70, 77], armBend: -1, armBendF: -1 }),
    ],
    props: [shape({ kind: "rect", x: 56, y: 77, w: 34, h: 4 }), shape({ kind: "line", a: [80, 81], b: [80, GROUND], tone: "frame" }), DB1],
  },
  "ex-cable-row": {
    keys: [
      k({ hip: [32, 80], torso: 18, foot: [62, 84], hand: [60, 64], footAngle: 150 }),
      k({ hip: [32, 80], torso: -8, foot: [62, 84], hand: [40, 66], armBend: -1, footAngle: 150 }),
    ],
    props: [shape({ kind: "line", a: [66, 74], b: [66, GROUND], tone: "frame", width: 3 }), cable(90, 72), HANDLE],
  },
  "ex-chest-supported-row": {
    keys: [k({ hip: [36, 66], torso: 50, foot: [50, GROUND], hand: [62, 72] }), k({ hip: [36, 66], torso: 50, foot: [50, GROUND], hand: [48, 56], armBend: -1 })],
    props: [BACKREST([46, 64], [62, 44]), ...SEAT(24, 68, 18), HANDLE],
  },
  "ex-inverted-row": {
    keys: [
      k({ hip: [46, 85], torso: { shoulder: [70, 82] }, foot: [8, 90], footAngle: 160, hand: [72, 58] }),
      k({ hip: [48, 73.5], torso: { shoulder: [70, 64] }, foot: [8, 90], footAngle: 160, hand: [72, 58], armBend: 1 }),
    ],
    props: [...BAR_SIDE(72, 58), shape({ kind: "line", a: [82, 58], b: [82, GROUND], tone: "frame" })],
  },
  "ex-face-pull": {
    keys: [stand({ torso: -6, hand: [74, 30] }), stand({ torso: -8, hand: [56, 24], armBend: 1 })],
    props: [cable(90, 26), HANDLE],
  },
  "ex-band-pull-apart": {
    view: "front",
    keys: [f({ hip: [50, 54], arm: [70, -20] }), f({ hip: [50, 54], arm: [88, 90] })],
    props: [{ kind: "band" }],
  },
  "ex-band-row": {
    keys: [stand({ torso: 2, hand: [74, 46] }), stand({ torso: -2, hand: [54, 52], armBend: -1 })],
    props: [{ kind: "band", anchor: [94, 46] }, shape({ kind: "line", a: [94, 20], b: [94, GROUND], tone: "frame" })],
  },
  "ex-biceps-curl": curl([DB]),
  "ex-hammer-curl": curl([DB]),
  "ex-barbell-curl": curl([BB]),
  "ex-cable-curl": curl([cable(66, 90), HANDLE]),

  // Core
  "ex-plank": {
    keys: [
      k({ hip: [42, 79], torso: 84, foot: [6, 87], footAngle: 14, arm: [0, 90] }),
      k({ hip: [42, 78], torso: 83, foot: [6, 87], footAngle: 14, arm: [0, 90] }),
    ],
  },
  "ex-dead-bug": {
    keys: [
      lyingFloor({ arm: [180, 180], armF: [175, 175], leg: [178, 90], legF: [172, 88] }),
      lyingFloor({ arm: [180, 180], armF: [-95, -95], leg: [100, 95], legF: [172, 88] }),
    ],
  },
  "ex-crunch": {
    keys: [lyingFloor({ hip: [52, 88], foot: [70, GROUND], arm: [-150, 60] }), lyingFloor({ hip: [52, 88], torso: -55, foot: [70, GROUND], arm: [-120, 90] })],
  },
  "ex-hanging-knee-raise": {
    ground: false,
    keys: [k({ hip: [47, 58], torso: -4, hand: [50, 6], leg: [6, 4] }), k({ hip: [47, 58], torso: -10, hand: [50, 6], leg: [100, 5] })],
    props: [...BAR_SIDE(50, 6)],
  },
  "ex-leg-raise": {
    keys: [lyingFloor({ leg: [90, 90], arm: [80, 80] }), lyingFloor({ leg: [170, 170], arm: [80, 80] })],
  },
  "ex-hollow-hold": {
    keys: [lyingFloor({ hip: [52, 88], torso: -100, leg: [104, 104], arm: [-100, -100] }), lyingFloor({ hip: [52, 88], torso: -102, leg: [107, 107], arm: [-98, -98] })],
  },
  "ex-mountain-climber": {
    keys: [
      plankTop({ leg: [35, -80], legF: [-78, -78], foot: undefined, footAngleF: 14 }),
      plankTop({ leg: [-78, -78], legF: [35, -80], foot: undefined, footAngle: 14 }),
    ],
    period: 900,
  },
  "ex-bird-dog": {
    keys: [quadruped(), quadruped({ arm: [100, 100], legF: [-95, -95], hand: undefined, handF: [64, GROUND] })],
  },
  "ex-cable-crunch": {
    keys: [
      k({ hip: [44, 69], torso: 15, leg: [0, -90], footAngle: -90, hand: [54, 40] }),
      k({ hip: [44, 69], torso: 75, leg: [0, -90], footAngle: -90, hand: [66, 58] }),
    ],
    props: [cable(70, 4)],
  },
  "ex-farmer-carry": { keys: walkCycle({ arms: "down" }), loop: "cycle", props: [DB], period: 1300 },

  // Conditioning
  "ex-burpee": {
    keys: [stand({ arm: [170, 175], hip: [46, 50], foot: [47, 88] }), squatBottom({ hand: [58, GROUND - 0.5] }), plankTop()],
    period: 2600,
  },
  "ex-jumping-jack": {
    view: "front",
    keys: [f({ hip: [50, 54], arm: [8, 8], leg: [2, 2] }), f({ hip: [50, 52], arm: [150, 165], leg: [16, 16] })],
    period: 900,
  },
  "ex-high-knees": {
    keys: [
      k({ hip: [46, 53], torso: 4, leg: [95, 0], legF: [0, 0], arm: [-30, 50], armF: [40, 120] }),
      k({ hip: [46, 53], torso: 4, leg: [0, 0], legF: [95, 0], arm: [40, 120], armF: [-30, 50] }),
    ],
    period: 700,
  },
  "ex-box-jump": {
    keys: [stand({ hip: [34, 54], foot: [35, GROUND], arm: [5, 5] }), k({ hip: [26, 70], torso: 40, foot: [36, GROUND], arm: [-60, -50] }), k({ hip: [64, 44], torso: 18, foot: [70, 72], arm: [60, 90] })],
    props: [BOX(58, 72, 30)],
    period: 2400,
  },
  "ex-thruster": {
    keys: [squatBottom({ hand: [52, 50], armBend: -1 }), stand({ hand: [48, 8], armBend: -1 })],
    props: [DB],
  },

  // Cardio
  "ex-treadmill-run": {
    keys: walkCycle({ run: true }),
    loop: "cycle",
    period: 800,
    props: [shape({ kind: "rect", x: 8, y: 92.5, w: 82, h: 3 }), shape({ kind: "line", a: [86, 92], b: [80, 44], tone: "frame" }), shape({ kind: "line", a: [74, 44], b: [84, 42], tone: "frame", width: 3 })],
  },
  "ex-treadmill-walk": {
    keys: walkCycle(),
    loop: "cycle",
    period: 1300,
    props: [shape({ kind: "rect", x: 8, y: 92.5, w: 82, h: 3 }), shape({ kind: "line", a: [86, 92], b: [80, 44], tone: "frame" }), shape({ kind: "line", a: [74, 44], b: [84, 42], tone: "frame", width: 3 })],
  },
  "ex-bike": {
    keys: [0, 90, 180, 270].map((deg) => {
      const r = 8;
      const c: Vec = [60, 78];
      const a = (deg * Math.PI) / 180;
      return k({
        hip: [40, 56],
        torso: 38,
        hand: [68, 44],
        foot: [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)],
        footF: [c[0] - r * Math.cos(a), c[1] - r * Math.sin(a)],
        footAngle: 95,
      });
    }),
    loop: "cycle",
    period: 1000,
    props: [
      shape({ kind: "circle", c: [74, 80], r: 9, tone: "frame" }),
      shape({ kind: "line", a: [40, 60], b: [56, 84], tone: "frame" }),
      shape({ kind: "line", a: [56, 84], b: [70, 48], tone: "frame" }),
      shape({ kind: "line", a: [30, GROUND], b: [84, GROUND], tone: "frame", width: 3 }),
      shape({ kind: "rect", x: 33, y: 57, w: 13, h: 3, r: 1.5 }),
      shape({ kind: "line", a: [66, 44], b: [72, 46], tone: "metal", width: 2.4 }),
      shape({ kind: "circle", c: [60, 78], r: 1.6, tone: "metal" }),
    ],
  },
  "ex-rower": {
    keys: [
      k({ hip: [46, 82], torso: 30, foot: [70, 84], hand: [74, 70], footAngle: 150 }),
      k({ hip: [30, 82], torso: -22, foot: [70, 84], hand: [44, 68], armBend: -1, footAngle: 150 }),
    ],
    props: [
      shape({ kind: "line", a: [8, 87], b: [86, 87], tone: "frame", width: 2.4 }),
      shape({ kind: "circle", c: [88, 74], r: 7, tone: "frame" }),
      shape({ kind: "line", a: [74, 76], b: [74, 87], tone: "frame", width: 3 }),
      cable(84, 72),
      HANDLE,
    ],
    period: 2200,
  },
  "ex-jump-rope": {
    view: "front",
    keys: [f({ hip: [50, 54], arm: [20, 40] }), f({ hip: [50, 49], arm: [24, 60] })],
    props: [{ kind: "rope" }],
    period: 500,
  },

  // Mobility
  "ex-cat-cow": {
    keys: [quadruped({ torso: 70, head: -30 }), quadruped({ torso: 82, head: 35 })],
    period: 4000,
  },
  "ex-childs-pose": {
    keys: [
      k({ hip: [34, 80], torso: { shoulder: [56, 86] }, leg: [65, -90], footAngle: -90, hand: [80, GROUND - 1] }),
      k({ hip: [33, 80], torso: { shoulder: [55, 87] }, leg: [66, -90], footAngle: -90, hand: [80, GROUND - 1] }),
    ],
    period: 4000,
  },
  "ex-cobra": {
    keys: [
      k({ hip: [42, 89], torso: 90, leg: [-90, -90], footAngle: -150, hand: [64, GROUND - 0.5] }),
      k({ hip: [42, 89], torso: 58, head: -20, leg: [-90, -90], footAngle: -150, hand: [64, GROUND - 0.5] }),
    ],
    period: 3600,
  },
  "ex-downward-dog": {
    keys: [
      k({ hip: [44, 50], torso: 138, foot: [22, GROUND], footAngle: 70, hand: [72, GROUND - 0.5] }),
      k({ hip: [44, 50], torso: 138, foot: [22, GROUND], footF: [21, 88], footAngle: 70, hand: [72, GROUND - 0.5] }),
    ],
    period: 2400,
  },
  "ex-hip-flexor-stretch": {
    keys: [
      k({ hip: [44, 71], torso: 0, foot: [64, GROUND], legF: [-15, -90], footAngleF: -150, hand: [52, 70] }),
      k({ hip: [49, 73], torso: -6, foot: [64, GROUND], legF: [-30, -92], footAngleF: -150, arm: [178, 178] }),
    ],
    period: 3600,
  },
  "ex-hamstring-stretch": {
    keys: [stand({ arm: [175, 178] }), k({ hip: [40, 54], torso: 125, foot: [48, GROUND], hand: [52, 90] })],
    period: 3600,
  },
  "ex-quad-stretch": {
    keys: [
      k({ hip: [46, 54], torso: 2, foot: [47, GROUND], legF: [-4, -168], footAngleF: -90, handF: [43, 52], hand: [50, 57] }),
      k({ hip: [46, 54], torso: 4, foot: [47, GROUND], legF: [-10, -170], footAngleF: -90, handF: [41, 54], arm: [100, 100] }),
    ],
    period: 3600,
  },
  "ex-deep-squat-hold": {
    keys: [k({ hip: [38, 78], torso: 25, foot: FEET, hand: [52, 56], armBend: -1 }), k({ hip: [38, 79], torso: 22, foot: FEET, hand: [52, 57], armBend: -1 })],
    period: 3600,
  },
  "ex-shoulder-dislocate": {
    keys: [stand({ arm: [40, 40] }), stand({ arm: [180, 180] }), stand({ arm: [-40, -40] })],
    period: 3600,
  },
};

export function motionFor(exerciseId: string): Motion | undefined {
  return MOTIONS[exerciseId];
}
