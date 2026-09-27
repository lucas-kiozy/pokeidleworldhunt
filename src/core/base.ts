/* Construção e acesso à base do jogo (creatures.json + items.json da Pokepedia).
   Sem DOM, sem storage (regra A-LAYER do AGENTS.md). */
import baseRaw from "../data/base.json";

/* ---------- base ---------- */
function buildBase(D: any) {
  const T = D.T,
    CAT = ["PHYSICAL", "SPECIAL", "STATUS"];
  const items = D.items.map(([n, p, c]: any) => ({ n, p, c }));
  const moves = D.moves.map(([n, t, c, p]: any) => ({ n, t: T[t], c: CAT[c], p }));
  const MONS = D.mons.map((r: any) => ({
    id: r[0],
    n: r[1],
    t: [T[r[2]]].concat(r[3] >= 0 ? [T[r[3]]] : []),
    b: { hp: r[4], atk: r[5], def: r[6], spAtk: r[7], spDef: r[8], speed: r[9] },
    l: r[10],
    x0: r[11],
    evo: r[12],
    evoL: r[13],
    area: r[14],
    xm: r[15],
    rar: r[16],
    atk: r[17].map((a: any) => ({ ...moves[a[0]], cd: a[1], lv: a[2], tm: !!a[3] })),
    loot: r[18].map(([i, ch, mn, mx]: any) => ({ it: items[i], p: ch / 1e5, mn, mx })),
    cap: r[19],
    val: r[20],
  }));
  for (const m of MONS) m.x = m.area === "orre" && m.xm ? Math.round(m.x0 * m.xm) : m.x0;
  const BY_ID: any = {},
    BY_NAME: any = {};
  for (const m of MONS) {
    if (!(m.id in BY_ID)) BY_ID[m.id] = m;
    BY_NAME[m.n.toLowerCase()] = m;
  }
  return { MONS, BY_ID, BY_NAME, CHART: D.chart, POT: D.pot, meta: D.meta, T };
}

export const BASE = buildBase(baseRaw);

export const spOf = (m: any) => BASE.BY_NAME[(m.species || "").toLowerCase()] || null;
export const huntOf = (n: string) => {
  const h = BASE.BY_NAME[(n || "").trim().toLowerCase()];
  return h && h.l > 0 && h.x > 0 ? h : null;
};
export const potByName = (n: string) => BASE.POT.find((p: any) => p[0] === n) || BASE.POT[1];

export { buildBase };
