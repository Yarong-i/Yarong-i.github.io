// Home — the 폐품 공장 explainer, running RIGHT TO LEFT like the real factory screen (투입구 on the right,
// 판매기 on the left). Only facts on record:
// the line order from the real screen and the automation the project lists (원격 집하장, 자동 공급 설비).

export const VW = 1200;
export const VH = 614;                     // the real screen's aspect (1486 x 760)
export const BELT_Y = 440;
export const HOPPER = { x: 1070, y: 330 };
export const SELL = { x: 100, name: '판매기' };
// In the order of the flow (from the hopper leftwards).
export const STATIONS = ['세척 분사기', '자석 분리기', '압축기', '분쇄기', '분류기', '용광로']
  .map((name, i) => ({ name, x: 910 - i * 135 }));
export const NODES = [
  { id: 'remote', name: '원격 집하장', x: 820, y: 110, to: { x: HOPPER.x - 10, y: HOPPER.y - 80 } },
  { id: 'feed', name: '자동 공급 설비', x: 370, y: 110, to: { x: 573, y: BELT_Y - 118 } },
];
export const KINDS = ['can', 'gear', 'bottle', 'pipe'] as const;
export const PIECES = [
  [1110, 70, -20], [870, 50, 15], [640, 110, 40], [380, 60, -35], [110, 120, 10],
  [940, 220, 60], [500, 250, -50], [210, 280, 25], [740, 190, -10], [50, 230, 30],
].map(([x, y, r], i) => ({ x: x!, y: y!, r: r!, kind: KINDS[i % KINDS.length]! }));

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const ease = (t: number) => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// Scroll budget (p = 0..1 over the stage's effective scroll distance). Each scene has a motion part and a hold
// part where its finished state rests before the next text comes in:
//   모으고     motion .01-.14, hold .14-.21
//   가공하고   motion .21-.50 (each piece crosses the line in .11, one after another), hold .50-.57
//   자동화하고 motion .57-.68, hold .68-.75
//   실제 화면  motion .75-.85, hold .85-1
// On a 900px screen the stage's effective scroll is 210vh = 1890px, so a hold is about 130px or more.
export const SCENE_START = [0, .21, .57] as const;
export const stepOf = (p: number) => (p < SCENE_START[1] ? 0 : p < SCENE_START[2] ? 1 : 2);

export type Form = 'raw' | 'block' | 'ingot' | 'coin';
export interface PieceState { x: number; y: number; r: number; s: number; o: number; form: Form; }

export function pieceAt(i: number, p: number): PieceState {
  const P = PIECES[i]!;
  const g = ease(clamp((p - .01 - i * .011) / .03));
  const stack = { x: HOPPER.x - 32 + (i % 3) * 32, y: HOPPER.y - 14 - Math.floor(i / 3) * 22 };
  let x = lerp(P.x, stack.x, g), y = lerp(P.y, stack.y, g) - Math.sin(g * Math.PI) * 50;
  let r = lerp(P.r, 0, g), s = lerp(1.5, 1.15, g);
  let form: Form = 'raw';
  const t = clamp((p - .21 - i * .02) / .11);
  if (t > 0) {
    const bx = lerp(HOPPER.x - 50, SELL.x, ease(t));
    x = bx; y = BELT_Y - 22; r = 0; s = 1.05;
    const furnace = STATIONS[5]!.x, press = STATIONS[2]!.x;
    form = bx < furnace - 30 ? 'coin' : bx < furnace + 10 ? 'ingot' : bx < press ? 'block' : 'raw';
    if (t >= 1) { x = SELL.x - 12 + (i % 2) * 18; y = BELT_Y - 150 - Math.floor(i / 2) * 14; form = 'coin'; }
  }
  return { x, y, r, s, o: 1, form };
}

export interface SceneState { hopper: number; line: number; lit: number[]; sell: number; links: number; reveal: number; step: number; }
export function sceneAt(p: number): SceneState {
  return {
    hopper: clamp(p / .06) * (1 - clamp((p - .4) / .2) * .5),
    line: .22 + clamp((p - .17) / .04) * .78,
    lit: STATIONS.map((st) => Math.max(
      ...PIECES.map((_, i) => { const q = pieceAt(i, p); return q.y === BELT_Y - 22 ? clamp(1 - Math.abs(q.x - st.x) / 70) : 0; }),
      clamp((p - .48) / .04) * .45)),
    sell: clamp((p - .29) / .04),
    links: ease(clamp((p - .57) / .11)),
    reveal: ease(clamp((p - .75) / .1)),
    step: stepOf(p),
  };
}
// Each scene's finished state (the stills on phones and under reduced motion).
export const STILL = [.18, .55, .73] as const;
