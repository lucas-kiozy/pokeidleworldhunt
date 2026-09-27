/* Regras de combate, stats e XP (código da Pokepedia). Sem DOM, sem storage (A-LAYER). */
import {
  TM_CAT,
  STAT_EXP,
  STAT_KEYS,
  WILD_G,
  WILD_Q,
  WILD_HP_MULT,
  WILD_DMG_MULT,
  CROWD_TAU,
  CROWD_MAX,
} from "./constants";

export function statsOf(sp: any, L: number, g: number, q: number) {
  const o: any = {};
  for (const k in STAT_EXP)
    o[k] = Math.round((L / 100) * (sp.b[k] + 2 * g) * Math.pow(q, STAT_EXP[k]));
  return o;
}
export function ivAvg(m: any) {
  return m.ivt > 0 ? Math.min(32, Math.max(1, m.ivt / 6)) : +m.g || 16;
}
export function hasStats(m: any) {
  return m && m.stats && STAT_KEYS.every((k) => +m.stats[k] > 0) && +m.statsLv > 0;
}
/* stats reais digitados (escalados pelo nível, já que o stat é proporcional ao nível) ou estimados pela média */
export function monStats(m: any, sp: any, L: number) {
  if (hasStats(m)) {
    const o: any = {},
      f = L / m.statsLv;
    for (const k of STAT_KEYS) o[k] = Math.round(m.stats[k] * f);
    return o;
  }
  return statsOf(sp, L, ivAvg(m), +m.q || 1);
}
/* IV por stat e qualidade que explicam os stats digitados */
export function inferIv(m: any, sp: any) {
  if (!hasStats(m)) return null;
  const L = m.statsLv,
    q = +m.q || 1,
    out: any = {};
  let sum = 0;
  for (const k of STAT_KEYS) {
    const g = (m.stats[k] / (L / 100) / Math.pow(q, STAT_EXP[k]) - sp.b[k]) / 2;
    out[k] = Math.max(1, Math.min(32, Math.round(g)));
    sum += out[k];
  }
  out.sum = sum;
  return out;
}
export function combatHp(hp: number, wild: boolean) {
  return Math.max(24, Math.round(hp * (wild ? 7 : 12)));
}
function cubic(L: number) {
  return L <= 1 ? 0 : Math.round((50 / 3) * (L ** 3 - 6 * L ** 2 + 17 * L - 12));
}
export function totalXp(L: number): number {
  L = Math.floor(L);
  if (L <= 150) return cubic(L);
  const t = L - 150;
  if (t <= 100)
    return Math.round(
      cubic(150) +
        (0.5 * ((t * (t + 1)) / 2) ** 2 +
          ((t * (t + 1) * (2 * t + 1)) / 6) * 197.5 +
          ((t * (t + 1)) / 2) * 25629 +
          1087900 * t),
    );
  return Math.round(totalXp(250) + 2 * (cubic(L) - cubic(250)));
}
function effRaw(CH: any, atk: string, defs: string[]) {
  let m = 1;
  for (const d of defs) {
    const v = CH[atk][d];
    if (v !== undefined) m *= v;
  }
  return m;
}
function amp(m: number) {
  if (m === 0) return 0;
  if (m > 1) return 1 + (m - 1) * 1.5;
  if (m < 1) return m / 1.5;
  return 1;
}

/* selvagens se juntam enquanto a luta dura: 1 atacante no início, +1 a cada CROWD_TAU s, até CROWD_MAX.
   devolve atacantes×segundos acumulados numa luta de T segundos */
export function crowdInt(T: number) {
  const t2 = (CROWD_MAX - 1) * CROWD_TAU;
  if (T <= t2) return T + (T * T) / (2 * CROWD_TAU);
  return t2 + (t2 * t2) / (2 * CROWD_TAU) + CROWD_MAX * (T - t2);
}
export function crowdAt(T: number) {
  return Math.min(CROWD_MAX, 1 + T / CROWD_TAU);
}
/* a Pokepedia só marca área para Orre e Nightmare; o resto (Kanto/Outland) é inferido só pelo nível,
   então pode errar por espécie — por isso existe o botão de ocultar em cada hunt */
export function mapOf(h: any) {
  if (h.area) return h.area;
  return h.l <= 150 ? "base" : "unconfirmed";
}

export function myMoves(mon: any, sp: any) {
  const learned = sp.atk.filter((a: any) => !a.tm && a.p > 0 && a.lv <= mon.level);
  let mv = Array.isArray(mon.moves) ? learned.filter((a: any) => mon.moves.includes(a.n)) : learned;
  if (!mv.length) mv = learned;
  if (mon.tm) {
    const t = sp.atk.find((a: any) => a.tm && a.t === mon.tm);
    if (t) mv = mv.concat([{ n: t.n, t: t.t, c: TM_CAT[t.t] || t.c, p: 300, cd: 10, tm: true }]);
  }
  return mv;
}
function wildMoves(h: any) {
  return h.atk.filter((a: any) => !a.tm && a.p > 0 && a.lv <= h.l);
}
function hit(CH: any, a: any, aTypes: string[], aS: any, aL: number, dTypes: string[], dS: any) {
  const A = a.c === "PHYSICAL" ? aS.atk : aS.spAtk,
    Dd = a.c === "PHYSICAL" ? dS.def : dS.spDef;
  const e = amp(effRaw(CH, a.t, dTypes)),
    stab = aTypes.includes(a.t) ? 1.5 : 1;
  return { d: (((2 * aL) / 5 + 2) * a.p * A) / Math.max(1, Dd) / 50 + 2 * stab * e, e };
}
/* luta "bruta": segundos-índice que o modelo escala por B */
export function fightOf(B: any, mon: any, sp: any, h: any, level?: number) {
  const L = level || mon.level,
    mS = monStats(mon, sp, L),
    wS = statsOf(h, h.l, WILD_G, WILD_Q);
  const mm = myMoves({ ...mon, level: L }, sp);
  let my = 0,
    oe = 0;
  for (const a of mm) {
    const r = hit(B.CHART, a, sp.t, mS, L, h.t, wS);
    my += r.d / a.cd;
    oe = Math.max(oe, r.e);
  }
  let wd = 0,
    de = 0,
    worst: any = null,
    wv = -1,
    hmax = 0;
  for (const a of wildMoves(h)) {
    const r = hit(B.CHART, a, h.t, wS, h.l, sp.t, mS);
    const v = r.d / a.cd;
    wd += v;
    de = Math.max(de, r.e);
    if (v > wv) {
      wv = v;
      worst = { ...a, e: r.e };
    }
    if (r.d > hmax) hmax = r.d;
  }
  if (my <= 0) return null;
  const whp = WILD_HP_MULT * combatHp(wS.hp, true);
  return {
    fight: whp / my,
    wdps: wd * WILD_DMG_MULT,
    myHp: combatHp(mS.hp, false),
    oe,
    de,
    worst,
    whp,
    hmax: hmax * WILD_DMG_MULT,
  };
}
/* poção recomendada: entre as que enchem o HP de volta ao máximo quando o Auto-Potion dispara
   (HP máximo × (1 − limiar do gatilho)), a mais barata — encher a vida vem antes de economizar.
   Se nenhuma poção da base chega a encher, usa a maior disponível (chega mais perto do máximo). */
export function recommendPotion(POT: any[], missing: number) {
  const covering = POT.filter((p) => p[1] >= missing);
  if (covering.length) {
    covering.sort((a, b) => a[2] - b[2]);
    return { pot: covering[0], full: true };
  }
  const best = [...POT].sort((a, b) => b[1] - a[1])[0];
  return { pot: best, full: false };
}
export function lootPerKill(h: any, lb: number, stones: boolean) {
  let v = 0;
  for (const d of h.loot) {
    if (!stones && d.it.c === "stone") continue;
    v += Math.min(1, d.p * lb) * ((d.mn + d.mx) / 2) * d.it.p;
  }
  return v;
}
