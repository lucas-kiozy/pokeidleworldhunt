// NOTA DE MIGRAÇÃO (2026-09-26): portado do planejador-de-hunt-piw.html original do usuário.
// Ainda não dividido em src/core/services/ui conforme AGENTS.md — é o próximo passo.
// tsconfig está com "strict": false temporariamente enquanto este arquivo não é tipado
// (era JS vanilla); apertar a tipagem é trabalho de acompanhamento, não feito nesta migração.
import baseRaw from "./data/base.json";

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

/* ---------- regras do jogo (código da Pokepedia) ---------- */
const TM_CAT: Record<string, string> = {
  NORMAL: "PHYSICAL",
  GHOST: "SPECIAL",
  GRASS: "SPECIAL",
  POISON: "PHYSICAL",
  FIRE: "SPECIAL",
  FLYING: "PHYSICAL",
  WATER: "SPECIAL",
  ELECTRIC: "SPECIAL",
  PSYCHIC: "SPECIAL",
  GROUND: "PHYSICAL",
  FIGHTING: "PHYSICAL",
  ROCK: "PHYSICAL",
  ICE: "SPECIAL",
  BUG: "PHYSICAL",
  DARK: "PHYSICAL",
  DRAGON: "SPECIAL",
  FAIRY: "SPECIAL",
  STEEL: "PHYSICAL",
};
const STAT_EXP: Record<string, number> = {
  hp: 0.95,
  atk: 0.8,
  def: 0.8,
  spAtk: 0.8,
  spDef: 0.8,
  speed: 0.8,
};
function statsOf(sp: any, L: number, g: number, q: number) {
  const o: any = {};
  for (const k in STAT_EXP)
    o[k] = Math.round((L / 100) * (sp.b[k] + 2 * g) * Math.pow(q, STAT_EXP[k]));
  return o;
}
function ivAvg(m: any) {
  return m.ivt > 0 ? Math.min(32, Math.max(1, m.ivt / 6)) : +m.g || 16;
}
const STAT_KEYS = ["hp", "atk", "def", "spAtk", "spDef", "speed"];
function hasStats(m: any) {
  return m && m.stats && STAT_KEYS.every((k) => +m.stats[k] > 0) && +m.statsLv > 0;
}
/* stats reais digitados (escalados pelo nível, já que o stat é proporcional ao nível) ou estimados pela média */
function monStats(m: any, sp: any, L: number) {
  if (hasStats(m)) {
    const o: any = {},
      f = L / m.statsLv;
    for (const k of STAT_KEYS) o[k] = Math.round(m.stats[k] * f);
    return o;
  }
  return statsOf(sp, L, ivAvg(m), +m.q || 1);
}
/* IV por stat e qualidade que explicam os stats digitados */
function inferIv(m: any, sp: any) {
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
function combatHp(hp: number, wild: boolean) {
  return Math.max(24, Math.round(hp * (wild ? 7 : 12)));
}
function cubic(L: number) {
  return L <= 1 ? 0 : Math.round((50 / 3) * (L ** 3 - 6 * L ** 2 + 17 * L - 12));
}
function totalXp(L: number): number {
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

/* ---------- constantes do modelo ---------- */
const WILD_G = 16,
  WILD_Q = 1,
  WILD_HP_MULT = 5,
  WILD_DMG_MULT = 1.8;
const DEF = { T0: 4.5, B: 0.49, Kp: 2.5, E: 0.8 };
const DANGER_HPS = 0.5,
  CROWD_TAU = 10,
  CROWD_MAX = 3,
  VIP_XP = 1.5,
  EVENT_XP2 = 2,
  DAILY_TYPE_BONUS = 1.2;
/* selvagens se juntam enquanto a luta dura: 1 atacante no início, +1 a cada CROWD_TAU s, até CROWD_MAX.
   devolve atacantes×segundos acumulados numa luta de T segundos */
function crowdInt(T: number) {
  const t2 = (CROWD_MAX - 1) * CROWD_TAU;
  if (T <= t2) return T + (T * T) / (2 * CROWD_TAU);
  return t2 + (t2 * t2) / (2 * CROWD_TAU) + CROWD_MAX * (T - t2);
}
function crowdAt(T: number) {
  return Math.min(CROWD_MAX, 1 + T / CROWD_TAU);
}
/* espécies com versão "sem mapa" (área=null) que também têm uma versão marcada em Orre ou Nightmare com o mesmo nome —
   a versão sem mapa, nesses casos, não é do catálogo confirmado e não bateu com o mapa nos testes (Swampert, Makuhita, Whiscash, Sharpedo);
   mais um pequeno grupo listado como "no radar, ainda não implementado" no Discord oficial (24/09/2026) */
const BUILTIN_HIDDEN = [
  "Abomasnow",
  "Absol",
  "Aegislash",
  "Aggron",
  "Altaria",
  "Appletun",
  "Archen",
  "Archeops",
  "Aron",
  "Bagon",
  "Baltoy",
  "Banette",
  "Barboach",
  "Bastiodon",
  "Beldum",
  "Blaziken",
  "Braviary",
  "Cacturne",
  "Camerupt",
  "Carracosta",
  "Carvanha",
  "Chandelure",
  "Claydol",
  "Combusken",
  "Corphish",
  "Cranidos",
  "Crawdaunt",
  "Dragalge",
  "Drampa",
  "Dusclops",
  "Duskull",
  "Eelektrik",
  "Eelektross",
  "Electrike",
  "Espurr",
  "Exploud",
  "Feebas",
  "Flabebe",
  "Floette",
  "Florges",
  "Flygon",
  "Gabite",
  "Gallade",
  "Garchomp",
  "Gardevoir",
  "Gible",
  "Glalie",
  "Gliscor",
  "Gogoat",
  "Goodra",
  "Goomy",
  "Grovyle",
  "Grumpig",
  "Infernape",
  "Kirlia",
  "Klang",
  "Klink",
  "Klinklang",
  "Lairon",
  "Lampent",
  "Larvesta",
  "Lilligant",
  "Litleo",
  "Litwick",
  "Lombre",
  "Lopunny",
  "Lotad",
  "Loudred",
  "Lucario",
  "Ludicolo",
  "Lunatone",
  "Luxray",
  "Magnezone",
  "Makuhita",
  "Manectric",
  "Mantyke",
  "Marshtomp",
  "Mawile",
  "Medicham",
  "Meditite",
  "Metang",
  "Mightyena",
  "Mismagius",
  "Mudkip",
  "Numel",
  "Nuzleaf",
  "Pachirisu",
  "Pancham",
  "Pangoro",
  "Pelipper",
  "Petilil",
  "Poochyena",
  "Ralts",
  "Rampardos",
  "Riolu",
  "Rockruff",
  "Rufflet",
  "Sableye",
  "Sandaconda",
  "Sawk",
  "Sceptile",
  "Scolipede",
  "Sealeo",
  "Seedot",
  "Seviper",
  "Sharpedo",
  "Shelgon",
  "Shieldon",
  "Shiftry",
  "Shuppet",
  "Silicobra",
  "Simisear",
  "Sirfetch'd",
  "Skiddo",
  "Skrelp",
  "Slakoth",
  "Sliggoo",
  "Smeargle",
  "Snorunt",
  "Solrock",
  "Spheal",
  "Spoink",
  "Swablu",
  "Swampert",
  "Swellow",
  "Taillow",
  "Throh",
  "Tirtouga",
  "Togekiss",
  "Torchic",
  "Torkoal",
  "Trapinch",
  "Treecko",
  "Tropius",
  "Turtonator",
  "Tynamo",
  "Venipede",
  "Vespiquen",
  "Vibrava",
  "Vigoroth",
  "Volcarona",
  "Walrein",
  "Weavile",
  "Whiscash",
  "Whismur",
  "Wingull",
  "Wormadam",
  "Zangoose",
];
/* a Pokepedia só marca área para Orre e Nightmare; o resto (Kanto/Outland) é inferido só pelo nível,
   então pode errar por espécie — por isso existe o botão de ocultar em cada hunt */
function mapOf(h: any) {
  if (h.area) return h.area;
  return h.l <= 150 ? "base" : "unconfirmed";
}

function myMoves(mon: any, sp: any) {
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
function fightOf(B: any, mon: any, sp: any, h: any, level?: number) {
  const L = level || mon.level,
    q = +mon.q || 1,
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
function recommendPotion(POT: any[], missing: number) {
  const covering = POT.filter((p) => p[1] >= missing);
  if (covering.length) {
    covering.sort((a, b) => a[2] - b[2]);
    return { pot: covering[0], full: true };
  }
  const best = [...POT].sort((a, b) => b[1] - a[1])[0];
  return { pot: best, full: false };
}
function lootPerKill(h: any, lb: number, stones: boolean) {
  let v = 0;
  for (const d of h.loot) {
    if (!stones && d.it.c === "stone") continue;
    v += Math.min(1, d.p * lb) * ((d.mn + d.mx) / 2) * d.it.p;
  }
  return v;
}

/* calibração do time: tempo fixo e escala da luta são comuns a todos (validado com Venusaur e Golem);
   XP real/base e fator de poção são por pokémon, com o time como reserva */
function calibrateTeam(B: any, team: any[], sessions: any[]) {
  const pts: [number, number][] = [],
    per: any = {};
  let hSum = 0,
    dSum = 0,
    xe: number[] = [];
  for (const s of sessions) {
    const mon = team.find((m) => m.id === s.monId);
    if (!mon) continue;
    const sp = B.BY_NAME[(mon.species || "").toLowerCase()];
    const h = B.BY_NAME[(s.target || "").toLowerCase()];
    if (!sp || !h || !(s.seconds > 0) || !(s.kills > 0)) continue;
    const f = fightOf(B, mon, sp, h, s.level || mon.level);
    if (!f) continue;
    const kph = s.kills / (s.seconds / 3600);
    pts.push([f.fight, 3600 / kph]);
    const p = per[mon.id] || (per[mon.id] = { xe: [], h: 0, d: 0, f: [] });
    p.f.push({ s, f });
    if (s.xph > 0) {
      const r = s.xph / kph / (h.x * (s.vip ? VIP_XP : 1) * (s.xp2x ? EVENT_XP2 : 1));
      p.xe.push(r);
      xe.push(r);
    }
  }
  let T0 = DEF.T0,
    Bk = DEF.B;
  if (pts.length >= 2) {
    const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length,
      my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    let sxx = 0,
      sxy = 0;
    for (const [x, y] of pts) {
      sxx += (x - mx) ** 2;
      sxy += (x - mx) * (y - my);
    }
    let ok = false;
    if (sxx > 1e-6 && sxy > 0) {
      Bk = sxy / sxx;
      T0 = my - Bk * mx;
      ok = T0 >= 2 && T0 <= my;
    }
    if (!ok) {
      T0 = Math.min(DEF.T0, Math.min(...pts.map((p) => p[1])) * 0.9);
      Bk =
        pts.reduce((a, p) => a + Math.max(0.1, p[1] - T0) / Math.max(1e-6, p[0]), 0) / pts.length;
    }
  } else if (pts.length === 1) {
    T0 = Math.min(DEF.T0, pts[0][1] * 0.9);
    Bk = Math.max(0.1, pts[0][1] - T0) / Math.max(1e-6, pts[0][0]);
  }
  /* poções: HP curado ÷ dano do modelo, somado (sessões com mais poções pesam mais) */
  for (const id in per) {
    const p = per[id];
    for (const { s, f } of p.f) {
      if (s.potions === "" || s.potions == null) continue;
      const heal = +s.heal || 1000;
      p.h += +s.potions * heal;
      p.d += f.wdps * crowdInt(Bk * f.fight) * s.kills;
    }
    hSum += p.h;
    dSum += p.d;
    p.E = p.xe.length ? p.xe.reduce((a: number, b: number) => a + b, 0) / p.xe.length : null;
    p.Kp = p.d > 0 && p.h > 0 ? p.h / p.d : null;
  }
  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return {
    T0,
    B: Bk,
    n: pts.length,
    per,
    E: xe.length ? avg(xe) : DEF.E,
    Kp: dSum > 0 && hSum > 0 ? hSum / dSum : DEF.Kp,
  };
}
function calibFor(c: any, mon: any) {
  const p = c.per[mon.id] || {};
  return { E: p.E ?? c.E, Kp: p.Kp ?? c.Kp, nE: p.xe ? p.xe.length : 0, nS: p.f ? p.f.length : 0 };
}

function measured(B: any, sessions: any[], h: any) {
  const ss = sessions.filter(
    (s) => B.BY_NAME[(s.target || "").toLowerCase()] === h && s.seconds > 0 && s.kills > 0,
  );
  if (!ss.length) return null;
  const secs = ss.reduce((a, s) => a + s.seconds, 0),
    kills = ss.reduce((a, s) => a + s.kills, 0),
    kph = kills / (secs / 3600);
  const xs = ss.filter((s) => s.xph > 0),
    xph = xs.length
      ? xs.reduce(
          (a, s) => a + (s.xph / ((s.vip ? VIP_XP : 1) * (s.xp2x ? EVENT_XP2 : 1))) * s.seconds,
          0,
        ) / xs.reduce((a, s) => a + s.seconds, 0)
      : null;
  const bs = ss.filter((s) => s.balh !== "" && s.balh != null),
    net = bs.length
      ? bs.reduce((a, s) => a + +s.balh * s.seconds, 0) / bs.reduce((a, s) => a + s.seconds, 0)
      : null;
  const ps = ss.filter((s) => s.potions !== "" && s.potions != null),
    P = ps.length
      ? ps.reduce((a, s) => a + +s.potions, 0) / (ps.reduce((a, s) => a + s.seconds, 0) / 3600)
      : null;
  return { kph, xph, net, P, n: ss.length };
}

function rankFor(B: any, mon: any, team: any[], sessions: any[], st: any) {
  const sp = B.BY_NAME[(mon.species || "").toLowerCase()];
  if (!sp) return { list: [], c: null };
  const pot = B.POT.find((p: any) => p[0] === (mon.potion || st.potion)) || B.POT[3];
  const c = calibrateTeam(B, team, sessions),
    cm = calibFor(c, mon);
  const need = Math.max(
    0,
    totalXp(mon.goal || mon.level + 1) - totalXp(mon.level) - (+mon.curXp || 0),
  );
  const mine = sessions.filter((s) => s.monId === mon.id);
  const minL = 1,
    maxL = +st.trainerLv > 0 ? +st.trainerLv : Infinity;
  let list: any[] = [],
    hidden = 0;
  for (const h of B.MONS) {
    if (!(h.l > 0) || !(h.x > 0)) continue;
    const zone = mapOf(h),
      maps = st.maps || {};
    if (zone === "unconfirmed") continue;
    if (zone !== "base" && zone !== "unconfirmed" && !maps[zone]) continue;
    if ((st.hidden || []).includes(h.n) || BUILTIN_HIDDEN.includes(h.n)) continue;
    if (h.l < minL || h.l > maxL) continue;
    const f = fightOf(B, mon, sp, h);
    if (!f) continue;
    const real = c.B * f.fight,
      sec = c.T0 + real;
    const daily = st.dailyType && h.t.includes(st.dailyType) ? DAILY_TYPE_BONUS : 1;
    let kph = 3600 / sec,
      xph = kph * h.x * cm.E * (st.vip ? VIP_XP : 1) * (st.event2x ? EVENT_XP2 : 1) * daily;
    const dmgKill = cm.Kp * f.wdps * crowdInt(real),
      bars = dmgKill / f.myHp,
      hps = (cm.Kp * f.wdps * crowdAt(real)) / f.myHp;
    const missing = f.myHp * (1 - (+st.healThreshold || 60) / 100),
      rec = recommendPotion(B.POT, missing);
    const effHeal = Math.min(rec.pot[1], missing);
    let P = (dmgKill * kph) / effHeal,
      loot = lootPerKill(h, 1, !!st.stones) * daily,
      net = kph * loot - P * rec.pot[2],
      src = "est",
      potUsed = rec.pot;
    const m = measured(B, mine, h);
    if (m) {
      src = "med";
      kph = m.kph;
      if (m.xph) xph = m.xph * (st.vip ? VIP_XP : 1) * (st.event2x ? EVENT_XP2 : 1);
      if (m.P != null) P = m.P;
      net = m.net != null ? m.net : kph * loot - P * rec.pot[2];
      potUsed = pot;
    }
    const danger = src === "est" && hps > DANGER_HPS;
    const burst = f.hmax >= f.myHp * 0.5;
    const potInsuff = f.hmax > Math.max(...B.POT.map((p: any) => p[1]));
    if (danger) {
      hidden++;
      continue;
    }
    const extrap = src === "est" && c.n === 0;
    list.push({
      hid: (st.hidden || []).includes(h.n),
      above: h.l > mon.level,
      h,
      oe: f.oe,
      de: f.de,
      worst: f.worst,
      kph,
      xph,
      net,
      P,
      loot,
      bars,
      hps,
      danger,
      burst,
      potFull: rec.full,
      potInsuff,
      potUsed,
      src,
      extrap,
      hours: xph > 0 ? need / xph : Infinity,
    });
  }
  if (list.length) {
    const mxX = Math.max(...list.map((r) => r.xph)),
      mxN = Math.max(0, ...list.map((r) => r.net)),
      mxA = Math.max(...list.map((r) => Math.abs(r.net)));
    const den = Math.max(mxN, 0.25 * mxA, 1),
      w = +st.w / 100;
    for (const r of list) {
      r.score = (1 - w) * (r.xph / mxX) + w * (r.net / den);
      r.cost = -r.net / Math.max(1, r.xph);
    }
    const k = w <= 0.25 ? "xph" : w >= 0.75 ? "net" : "score";
    list.sort((a, b) =>
      k === "xph" ? b.xph - a.xph : k === "net" ? b.net - a.net : b.score - a.score,
    );
  }
  return { list, c, cm, need, sp, hidden, pot };
}
/* captura (regra do Discord oficial): cada arremesso é independente */
function captureOf(val: number, ballPrice: number, mult?: number) {
  if (!(val > 0) || !(ballPrice > 0)) return null;
  const c = Math.min(1, (ballPrice / val) * (mult || 1));
  const n = (q: number) => (c >= 1 ? 1 : Math.ceil(Math.log(1 - q) / Math.log(1 - c)));
  return { c, exp: 1 / c, cost: ballPrice / c, n50: n(0.5), n90: n(0.9), n99: n(0.99) };
}
/* mesma conta do ranking, mas para UM par (meu pokémon, hunt) só — usado na aba "Hunt solta".
   Reaproveita a calibração do time salvo (se houver sessões), sem precisar salvar nada. */
function singleHuntCalc(B: any, mon: any, team: any[], sessions: any[], h: any, st: any) {
  const sp = B.BY_NAME[(mon.species || "").toLowerCase()];
  if (!sp || !h) return null;
  const c = calibrateTeam(B, team, sessions),
    cm = calibFor(c, mon);
  const f = fightOf(B, mon, sp, h);
  if (!f) return null;
  const real = c.B * f.fight,
    sec = c.T0 + real;
  const daily = st.dailyType && h.t.includes(st.dailyType) ? DAILY_TYPE_BONUS : 1;
  const kph = 3600 / sec,
    xph = kph * h.x * cm.E * (st.vip ? VIP_XP : 1) * (st.event2x ? EVENT_XP2 : 1) * daily;
  const dmgKill = cm.Kp * f.wdps * crowdInt(real),
    bars = dmgKill / f.myHp,
    hps = (cm.Kp * f.wdps * crowdAt(real)) / f.myHp;
  const missing = f.myHp * (1 - (+st.healThreshold || 60) / 100),
    rec = recommendPotion(B.POT, missing);
  const effHeal = Math.min(rec.pot[1], missing);
  const P = (dmgKill * kph) / effHeal,
    loot = lootPerKill(h, 1, !!st.stones) * daily,
    net = kph * loot - P * rec.pot[2];
  const danger = hps > DANGER_HPS,
    burst = f.hmax >= f.myHp * 0.5,
    potInsuff = f.hmax > Math.max(...B.POT.map((p: any) => p[1]));
  return {
    h,
    sp,
    oe: f.oe,
    de: f.de,
    worst: f.worst,
    kph,
    xph,
    net,
    P,
    loot,
    bars,
    hps,
    danger,
    burst,
    potFull: rec.full,
    potInsuff,
    potUsed: rec.pot,
    myHp: f.myHp,
    c,
    cm,
    n: c.n,
  };
}

export {
  buildBase,
  statsOf,
  combatHp,
  totalXp,
  fightOf,
  calibrateTeam,
  calibFor,
  rankFor,
  lootPerKill,
  myMoves,
  DEF,
  captureOf,
  monStats,
  inferIv,
  hasStats,
  recommendPotion,
  EVENT_XP2,
  DAILY_TYPE_BONUS,
  singleHuntCalc,
};

const BASE = buildBase(baseRaw);
const TYPE_PT: Record<string, string> = {
  NORMAL: "Normal",
  FIRE: "Fogo",
  WATER: "Água",
  ELECTRIC: "Elétrico",
  GRASS: "Planta",
  ICE: "Gelo",
  FIGHTING: "Lutador",
  POISON: "Venenoso",
  GROUND: "Terrestre",
  FLYING: "Voador",
  PSYCHIC: "Psíquico",
  BUG: "Inseto",
  ROCK: "Pedra",
  GHOST: "Fantasma",
  DRAGON: "Dragão",
  DARK: "Sombrio",
  STEEL: "Aço",
  FAIRY: "Fada",
};
// Cores dos badges de tipo seguem a paleta oficial do jogo Pokémon (não a paleta de marca do site,
// que é para chrome/UI — ver memória "poke-idle-color-palette"). Água/Gelo usa --color-water-ice.
const TYPE_COLOR: Record<string, string> = {
  NORMAL: "#A8A77A",
  FIRE: "#EE8130",
  WATER: "var(--color-water-ice)",
  ELECTRIC: "#F7D02C",
  GRASS: "#7AC74C",
  ICE: "var(--color-water-ice)",
  FIGHTING: "#C22E28",
  POISON: "#A33EA1",
  GROUND: "#E2BF65",
  FLYING: "#A98FF3",
  PSYCHIC: "#F95587",
  BUG: "#A6B91A",
  ROCK: "#B6A136",
  GHOST: "#735797",
  DRAGON: "#6F35FC",
  DARK: "#705746",
  STEEL: "#B7B7CE",
  FAIRY: "#D685AD",
};
const spOf = (m: any) => BASE.BY_NAME[(m.species || "").toLowerCase()] || null;
const huntOf = (n: string) => {
  const h = BASE.BY_NAME[(n || "").trim().toLowerCase()];
  return h && h.l > 0 && h.x > 0 ? h : null;
};

/* ---------- estado (só neste navegador) ---------- */
const LS_KEY = "piw-hunt-planner-v2",
  LS_OLD = "piw-hunt-planner-v1";
const DEF_SETTINGS = {
  w: 35,
  potion: "Hyper Potion",
  trainerLv: "",
  vip: false,
  event2x: false,
  dailyType: "",
  healThreshold: 60,
  maps: { orre: false, nightmare: false },
  hidden: [] as string[],
  stones: false,
  capTarget: "",
  ballName: "Ultra Ball",
  ballPrice: 130,
  capBoost: false,
  capMult: 1,
};
const uid = () => Math.random().toString(36).slice(2, 10);
const emptyState = () => ({
  v: 2,
  activeId: null as string | null,
  team: [] as any[],
  sessions: [] as any[],
  settings: { ...DEF_SETTINGS },
});
function lsGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
    return true;
  } catch {
    return false;
  }
}
function sane(s: any) {
  if (!s || !Array.isArray(s.team) || !Array.isArray(s.sessions)) return emptyState();
  s.settings = { ...DEF_SETTINGS, ...(s.settings || {}) };
  s.v = 2;
  for (const m of s.team) {
    if (!m.potion) m.potion = s.settings.potion;
  }
  for (const x of s.sessions) {
    if (!x.heal) x.heal = potByName(x.potion || s.settings.potion)[1];
    if (x.vip === undefined) x.vip = !!s.settings.vip;
  }
  if (!Array.isArray(s.settings.hidden)) s.settings.hidden = [];
  if (!s.settings.maps)
    s.settings.maps = {
      orre: !!s.settings.areas,
      nightmare: !!s.settings.areas,
      unconfirmed: false,
    };
  return s;
}
let state: any;
try {
  state = sane(JSON.parse(lsGet(LS_KEY) || "null"));
} catch {
  state = emptyState();
}
let adding = false;
function persist() {
  const ok = lsSet(LS_KEY, JSON.stringify(state));
  $("saveStatus").textContent = ok ? "salvo neste navegador" : "este navegador não permite salvar";
}

function oldData() {
  try {
    const o = JSON.parse(lsGet(LS_OLD) || "null");
    if (!o || !Array.isArray(o.team)) return null;
    const team = o.team.filter((m: any) => spOf({ species: m.species || m.name }));
    return team.length ? { o, team } : null;
  } catch {
    return null;
  }
}
function importOld() {
  const d = oldData();
  if (!d) return;
  const idMap: any = {};
  for (const m of d.team) {
    const id = uid();
    idMap[m.id] = id;
    const sp = spOf({ species: m.species || m.name });
    state.team.push({
      id,
      name: m.name || sp.n,
      species: sp.n,
      level: +m.level || 1,
      goal: +m.goal || +m.level + 1,
      curXp: +m.curXp || 0,
      q: 1,
      g: 16,
      moves: null,
      tm: "",
      potion: state.settings.potion,
    });
  }
  for (const s of d.o.sessions || [])
    if (idMap[s.monId] && huntOf(s.target))
      state.sessions.push({
        ...s,
        id: uid(),
        monId: idMap[s.monId],
        target: huntOf(s.target)!.n,
        potion: state.settings.potion,
        heal: potByName(state.settings.potion)[1],
      });
  state.activeId = state.team[0].id;
  persist();
  renderAll();
}

/* ---------- utilidades ---------- */
const $ = (id: string) => document.getElementById(id) as HTMLElement;
const nf = new Intl.NumberFormat("pt-BR"),
  nf1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }),
  nf2 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
function big(n: number) {
  const a = Math.abs(n);
  if (a >= 1e6) return nf2.format(n / 1e6) + " mi";
  if (a >= 1e4) return nf1.format(n / 1e3) + " mil";
  return nf.format(Math.round(n));
}
function money(n: number) {
  return (n >= 0 ? "+$" : "−$") + big(Math.abs(n));
}
function dur(h: number) {
  if (!isFinite(h)) return "—";
  if (h === 0) return "pronto";
  const m = Math.round(h * 60);
  if (m < 60) return m + " min";
  if (h < 48) {
    const hh = Math.floor(m / 60),
      mm = m % 60;
    return hh + "h" + (mm ? " " + String(mm).padStart(2, "0") : "");
  }
  return nf1.format(h / 24) + " dias";
}
function pct(p: number) {
  return p >= 0.01 ? nf1.format(p * 100) + "%" : nf2.format(p * 100) + "%";
}
function esc(s: unknown) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
const mult = (x: number) => "×" + nf2.format(x);
const active = () => state.team.find((m: any) => m.id === state.activeId) || state.team[0] || null;
const monSessions = (m: any) => state.sessions.filter((s: any) => s.monId === m.id);
const needXp = (m: any) =>
  Math.max(0, totalXp(m.goal || m.level + 1) - totalXp(m.level) - (+m.curXp || 0));
const potByName = (n: string) => BASE.POT.find((p: any) => p[0] === n) || BASE.POT[1];
const potOptions = (sel: string) =>
  BASE.POT.map(
    (p: any) =>
      `<option value="${esc(p[0])}"${p[0] === sel ? " selected" : ""}>${esc(p[0])} (cura ${nf.format(p[1])})</option>`,
  ).join("");
function badge(t: string) {
  return `<span class="tb" style="background:${TYPE_COLOR[t]};color:#0B1220">${TYPE_PT[t]}</span>`;
}

/* ---------- time ---------- */
function renderTeam() {
  const el = $("team");
  if (!state.team.length) {
    el.innerHTML = "";
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML =
    state.team
      .map((m: any) => {
        const sp = spOf(m),
          t = sp ? sp.t : ["NORMAL"],
          c = TYPE_COLOR[t[0]],
          c2 = TYPE_COLOR[t[1]] || c;
        return `<span class="mon-tab-wrap"><button class="mon-tab" data-id="${m.id}" aria-pressed="${!adding && m.id === active().id}"><span class="dot" style="background:linear-gradient(135deg,${c} 50%,${c2} 50%)"></span>${esc(m.name)} <span class="lv">nv ${m.level}</span></button><button class="mon-tab-x" data-rm="${m.id}" title="Remover ${esc(m.name)} do time" aria-label="Remover ${esc(m.name)} do time">×</button></span>`;
      })
      .join("") +
    `<button class="add-tab" id="addMon" aria-pressed="${adding}">Adicionar pokémon</button>`;
  el.querySelectorAll(".mon-tab").forEach((b) =>
    b.addEventListener("click", () => {
      adding = false;
      state.activeId = (b as HTMLElement).dataset.id;
      persist();
      renderAll();
    }),
  );
  el.querySelectorAll("[data-rm]").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      removeMon((b as HTMLElement).dataset.rm!);
    }),
  );
  $("addMon").addEventListener("click", () => {
    adding = true;
    renderAll();
    setTimeout(() => ($("aSpecies") as HTMLElement | null)?.focus(), 0);
  });
}

function addForm(withCancel: boolean) {
  return `<div class="row3">
      <div style="grid-column:span 2"><label class="f" for="aSpecies">Espécie</label><input type="text" id="aSpecies" list="speciesList" autocomplete="off" placeholder="ex.: Dragonite"></div>
      <div><label class="f" for="aLevel">Nível</label><input type="number" id="aLevel" min="1" placeholder="ex.: 60"></div>
    </div>
    <label class="f" for="aQ">Qualidade (opcional, aparece na ficha do pokémon no jogo)</label>
    <input type="number" id="aQ" min="0.8" max="5" step="0.01" placeholder="1,00">
    <p class="hint" id="aErr" role="alert" style="color:var(--bad)"></p>
    <div class="actions"><button class="btn primary" id="aAdd">Adicionar ao time</button>${withCancel ? `<button class="btn ghost" id="aCancel">Cancelar</button>` : ""}</div>`;
}
function bindAddForm() {
  $("aAdd").addEventListener("click", () => {
    const sp = spOf({ species: ($("aSpecies") as HTMLInputElement).value.trim() }),
      lv = parseInt(($("aLevel") as HTMLInputElement).value);
    if (!sp) {
      $("aErr").textContent = "Escolha a espécie na lista.";
      return;
    }
    if (!(lv >= 1)) {
      $("aErr").textContent = "Informe o nível atual.";
      return;
    }
    const q = parseFloat(String(($("aQ") as HTMLInputElement).value).replace(",", "."));
    const id = uid();
    state.team.push({
      id,
      name: sp.n,
      species: sp.n,
      level: lv,
      goal: lv + 10,
      curXp: 0,
      q: q > 0 ? q : 1,
      ivt: 96,
      moves: null,
      tm: "",
      potion: state.settings.potion,
    });
    state.activeId = id;
    adding = false;
    persist();
    renderAll();
  });
  const cancelBtn = document.getElementById("aCancel");
  if (cancelBtn)
    cancelBtn.addEventListener("click", () => {
      adding = false;
      renderAll();
    });
  ["aSpecies", "aLevel", "aQ"].forEach((k) =>
    $(k).addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") $("aAdd").click();
    }),
  );
}

function renderWelcome() {
  const w = $("welcome"),
    od = oldData();
  w.innerHTML = `<div class="panel welcome-panel">
    <h2>Comece pelo seu time</h2>
    <p class="hint" style="font-size:15px">O planejador compara todas as hunts do jogo para um pokémon seu e aponta onde rende mais XP sem afundar o saldo. Tudo fica salvo só neste navegador.</p>
    <ol class="steps">
      <li><b>Adicione um pokémon</b> com espécie e nível. Os golpes que ele já aprendeu entram sozinhos.</li>
      <li><b>Veja a rota sugerida</b> e ajuste no slider quanto o dinheiro pesa na escolha.</li>
      <li><b>Rode 5 a 10 minutos no Hunt Analyzer</b> e registre a sessão. A estimativa passa a usar o seu ritmo real.</li>
    </ol>
    ${addForm(false)}
    ${od ? `<div class="calib" style="margin-top:16px">Este navegador tem dados da versão anterior: ${od.team.length} pokémon e ${(od.o.sessions || []).length} sessões.<div class="actions" style="margin-top:8px"><button class="btn small" id="impOld">Trazer para esta versão</button></div></div>` : ""}
    <p class="hint" style="margin-top:16px">Tem um backup de outro navegador? Cole em <a href="#backup" class="lnk" id="goBackup">Backup dos seus dados</a>, no fim da página.</p>
  </div>`;
  bindAddForm();
  if (od) $("impOld").addEventListener("click", importOld);
  $("goBackup").addEventListener("click", (e) => {
    e.preventDefault();
    ($("backup") as any).open = true;
    $("backup").scrollIntoView({ behavior: "smooth" });
  });
}

function removeMon(id: string) {
  const mm = state.team.find((x: any) => x.id === id);
  if (!mm) return;
  if (!confirm(`Remover ${mm.name} e as sessões dele?`)) return;
  state.team = state.team.filter((x: any) => x.id !== id);
  state.sessions = state.sessions.filter((s: any) => s.monId !== id);
  if (state.activeId === id) state.activeId = state.team[0]?.id || null;
  persist();
  renderAll();
}
function renderMon() {
  const p = $("monPanel");
  if (adding) {
    p.innerHTML = `<h2>Novo pokémon</h2><p class="hint">Espécie e nível bastam. O resto dá para ajustar depois.</p>${addForm(true)}`;
    bindAddForm();
    return;
  }
  const m = active(),
    sp = spOf(m);
  const S = monStats(m, sp, m.level),
    est = statsOf(sp, m.level, ivAvg(m), +m.q || 1);
  const evo = sp.evo && BASE.BY_ID[sp.evo];
  const learned = sp.atk
    .filter((a: any) => !a.tm && a.p > 0 && a.lv <= m.level)
    .sort((a: any, b: any) => a.lv - b.lv || a.n.localeCompare(b.n));
  const sel = myMoves(m, sp)
    .filter((a: any) => !a.tm)
    .map((a: any) => a.n);
  const tms = sp.atk.filter((a: any) => a.tm);
  const next = sp.atk
    .filter((a: any) => !a.tm && a.p > 0 && a.lv > m.level)
    .sort((a: any, b: any) => a.lv - b.lv)[0];
  p.innerHTML = `
    <h2 id="mTitle">${esc(m.name)}</h2>
    <p class="hint" id="mHint"></p>
    <details id="monEdit">
      <summary>Editar pokémon</summary>
      <label class="f" for="mSpecies">Espécie</label>
      <input type="text" id="mSpecies" list="speciesList" value="${esc(m.species)}" autocomplete="off">
      <label class="f" for="mName">Apelido</label>
      <input type="text" id="mName" value="${esc(m.name)}">
      <div class="row3">
        <div><label class="f" for="mLevel">Nível atual</label><input type="number" id="mLevel" min="1" value="${m.level}"></div>
        <div><label class="f" for="mGoal">Nível meta</label><input type="number" id="mGoal" min="2" value="${m.goal}"></div>
        <div><label class="f" for="mCur">XP no nível</label><input type="number" id="mCur" min="0" value="${m.curXp || 0}"></div>
      </div>
      <div class="row2">
        <div><label class="f" for="mQ">Qualidade</label><input type="number" id="mQ" min="0.8" max="5" step="0.01" value="${+m.q || 1}"></div>
        <div><label class="f" for="mG">IV total (6 a 192)</label><input type="number" id="mG" min="6" max="192" value="${m.ivt > 0 ? m.ivt : Math.round((+m.g || 16) * 6)}"></div>
      </div>
      <h3>Stats do jogo (opcional)</h3>
      <p class="hint">Copie da ficha do pokémon. Sem eles, o app usa a média calculada pela espécie, nível, qualidade e IV total.${hasStats(m) && m.statsLv !== m.level ? ` Digitados no nível ${m.statsLv} e ajustados ao nível atual.` : ""}</p>
      <div class="row3 stats">${[
        ["hp", "HP"],
        ["atk", "Atk"],
        ["def", "Def"],
        ["spAtk", "SpA"],
        ["spDef", "SpD"],
        ["speed", "Vel"],
      ]
        .map(
          ([k, l]) =>
            `<div><label class="f" for="st_${k}">${l}</label><input type="number" id="st_${k}" min="1" data-k="${k}" value="${hasStats(m) ? Math.round((m.stats[k] * m.level) / m.statsLv) : ""}" placeholder="${est[k]}"></div>`,
        )
        .join("")}</div>
      <p class="hint" id="ivInfo"></p>
      ${hasStats(m) ? `<div class="actions" style="margin-top:0"><button class="btn ghost small" id="clrStats">Voltar à média</button></div>` : ""}
      <h3>Golpes que ele usa</h3>
      <p class="hint">Todos os golpes de dano que ele já aprendeu vêm marcados. Desmarque os que ele não usa.${next ? ` Próximo: ${esc(next.n)} no nível ${next.lv}.` : ""}</p>
      <div class="moves" id="mMoves">${learned.map((a: any) => `<button type="button" class="mchip" data-n="${esc(a.n)}" aria-pressed="${sel.includes(a.n)}"><span class="mt" style="background:${TYPE_COLOR[a.t]}"></span>${esc(a.n)} <small>${a.c === "SPECIAL" ? "esp." : "fís."} ${a.p} · ${nf1.format(a.cd)} s</small></button>`).join("") || `<p class="empty">Nenhum golpe de dano até este nível.</p>`}</div>
      ${tms.length ? `<label class="f" for="mTm">TM elemental equipado</label><select id="mTm"><option value="">Nenhum</option>${tms.map((a: any) => `<option value="${a.t}"${m.tm === a.t ? " selected" : ""}>${esc(a.n)} (${TYPE_PT[a.t]}, poder 300, 10 s)</option>`).join("")}</select>` : ""}
      <div class="actions"><button class="btn ghost small" id="delMon">Remover do time</button></div>
    </details>`;
  const hint = () => {
    const mm = active(),
      s2 = spOf(mm),
      S2 = monStats(mm, s2, mm.level);
    $("mHint").innerHTML =
      `${s2.t.map(badge).join("")} nv ${mm.level} · HP em luta <b>${nf.format(combatHp(S2.hp, false))}</b>. Faltam <b>${big(needXp(mm))}</b> de XP para o nível ${mm.goal}.` +
      (evo
        ? `<br>Evolui para <b>${esc(evo.n)}</b>${s2.evoL ? ` a partir do nível ${s2.evoL}` : ""}.`
        : "");
  };
  hint();
  const ivInfo = () => {
    const mm = active(),
      s2 = spOf(mm),
      v = inferIv(mm, s2),
      el = document.getElementById("ivInfo");
    if (!el) return;
    if (!v) {
      el.textContent = "";
      return;
    }
    const names: Record<string, string> = {
      hp: "HP",
      atk: "Atk",
      def: "Def",
      spAtk: "SpA",
      spDef: "SpD",
      speed: "Vel",
    };
    const ivt = +mm.ivt || 0,
      off = !!(ivt && Math.abs(v.sum - ivt) > 2);
    el.innerHTML = `IV por stat que explica esses números: ${Object.keys(names)
      .map((k) => `${names[k]} ${v[k]}`)
      .join(
        ", ",
      )} (soma ${v.sum}${ivt ? ` de ${ivt} na ficha` : ""}).${off ? ' <b style="color:var(--warn)">A soma não bate: confira a qualidade, o IV total ou algum stat digitado.</b>' : ""}`;
  };
  ivInfo();
  const upd = (f: (m: any) => void, full?: boolean) => {
    f(m);
    persist();
    renderTeam();
    renderSessions();
    renderResults();
    if (full) {
      renderMon();
      ($("monEdit") as any).open = true;
    } else {
      $("mTitle").textContent = m.name;
      hint();
    }
  };
  ($("mSpecies") as HTMLInputElement).addEventListener("change", (e) => {
    const s = spOf({ species: (e.target as HTMLInputElement).value });
    if (!s) return;
    upd((mm) => {
      if (mm.name === mm.species) mm.name = s.n;
      mm.species = s.n;
      mm.moves = null;
      mm.tm = "";
    }, true);
  });
  ($("mName") as HTMLInputElement).addEventListener("input", (e) =>
    upd((mm) => (mm.name = (e.target as HTMLInputElement).value || "Sem nome")),
  );
  ($("mLevel") as HTMLInputElement).addEventListener("change", (e) => {
    const v = Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1);
    upd((mm) => {
      mm.level = v;
      if (mm.goal <= v) mm.goal = v + 1;
    }, true);
  });
  ($("mGoal") as HTMLInputElement).addEventListener("input", (e) => {
    const v = parseInt((e.target as HTMLInputElement).value) || m.level + 1;
    upd((mm) => (mm.goal = Math.max(v, mm.level + 1)));
  });
  ($("mCur") as HTMLInputElement).addEventListener("input", (e) =>
    upd((mm) => (mm.curXp = Math.max(0, +(e.target as HTMLInputElement).value || 0))),
  );
  ($("mQ") as HTMLInputElement).addEventListener("input", (e) => {
    const v = parseFloat((e.target as HTMLInputElement).value);
    if (v > 0) {
      upd((mm) => (mm.q = v));
      ivInfo();
    }
  });
  ($("mG") as HTMLInputElement).addEventListener("input", (e) => {
    const v = parseInt((e.target as HTMLInputElement).value);
    if (v >= 6 && v <= 192) {
      upd((mm) => (mm.ivt = v));
      ivInfo();
    }
  });
  $("mMoves")
    .querySelectorAll(".mchip")
    .forEach((b) =>
      b.addEventListener("click", () => {
        let cur = myMoves(m, sp)
          .filter((a: any) => !a.tm)
          .map((a: any) => a.n);
        const n = (b as HTMLElement).dataset.n!;
        if (cur.includes(n)) {
          if (cur.length > 1) cur = cur.filter((x: string) => x !== n);
        } else cur.push(n);
        upd((mm) => (mm.moves = cur));
        $("mMoves")
          .querySelectorAll(".mchip")
          .forEach((x) =>
            x.setAttribute("aria-pressed", String(cur.includes((x as HTMLElement).dataset.n))),
          );
      }),
    );
  const statInputs = [...document.querySelectorAll<HTMLInputElement>(".stats input")];
  statInputs.forEach((inp) =>
    inp.addEventListener("input", () => {
      const vals: any = {};
      for (const i of statInputs) vals[i.dataset.k!] = +i.value || 0;
      if (Object.values(vals).every((v: any) => v > 0))
        upd((mm) => {
          mm.stats = vals;
          mm.statsLv = mm.level;
        });
      else if (Object.values(vals).every((v: any) => !v))
        upd((mm) => {
          mm.stats = null;
          mm.statsLv = 0;
        });
      ivInfo();
    }),
  );
  const clrBtn = document.getElementById("clrStats");
  if (clrBtn)
    clrBtn.addEventListener("click", () =>
      upd((mm) => {
        mm.stats = null;
        mm.statsLv = 0;
      }, true),
    );
  const tmSel = document.getElementById("mTm");
  if (tmSel)
    tmSel.addEventListener("change", (e) =>
      upd((mm) => (mm.tm = (e.target as HTMLSelectElement).value)),
    );
  $("delMon").addEventListener("click", () => removeMon(m.id));
}

/* ---------- sessões ---------- */
function renderSessions() {
  const p = $("sessPanel");
  if (adding) {
    p.hidden = true;
    return;
  }
  p.hidden = false;
  const wasOpen = !!(document.getElementById("addSess") as any)?.open;
  const m = active(),
    ss = monSessions(m),
    st = state.settings,
    c = calibrateTeam(BASE, state.team, state.sessions),
    cm = calibFor(c, m);
  const rows = ss
    .map((s: any) => {
      const kph = s.kills / (s.seconds / 3600),
        mm = Math.floor(s.seconds / 60),
        sec = s.seconds % 60;
      return `<tr><td>${esc(s.target)}${huntOf(s.target) ? "" : ' <span class="tag d">fora da base</span>'}</td><td>${mm}:${String(sec).padStart(2, "0")}</td><td>${nf.format(Math.round(kph))}</td><td>${big(s.xph)}</td><td class="${s.balh === "" ? "" : +s.balh >= 0 ? "pos" : "neg"}">${s.balh === "" ? "—" : money(+s.balh)}</td><td><button class="btn small ghost" data-del="${s.id}" aria-label="Apagar sessão em ${esc(s.target)}">Apagar</button></td></tr>`;
    })
    .join("");
  const conf =
    c.n === 0
      ? "Sem sessões no time ainda: usando os valores medidos nos testes de Venusaur e Golem."
      : c.n === 1
        ? "Tempo calibrado com 1 sessão do time. Registre outra num alvo de nível ou tipo diferente para afinar."
        : `Tempo calibrado com ${c.n} sessões do time.`;
  p.innerHTML = `
    <h2>Sessões do Hunt Analyzer</h2>
    <p class="hint">Rode 5 a 10 minutos num alvo e copie os números da ferramenta do jogo.</p>
    ${ss.length ? `<div class="tablewrap" style="margin-top:0"><table class="sess"><thead><tr><th>Alvo</th><th>Tempo</th><th>Kills/h</th><th>XP/h</th><th>Saldo/h</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="empty">Nenhuma sessão registrada para ${esc(m.name)}.</p>`}
    <div class="calib">${conf}<br>Tempo fixo por kill <b>${nf1.format(c.T0)} s</b> · escala da luta <b>${nf2.format(c.B)}</b><br>${esc(m.name)}: XP real vs base, sem VIP, <b>${Math.round(cm.E * 100)}%</b>${cm.nE ? "" : " (do time)"} · fator de poção <b>${nf1.format(cm.Kp)}</b>${c.per[m.id] && c.per[m.id].Kp != null ? "" : " (do time)"}</div>
    <details id="addSess"${ss.length && !wasOpen ? "" : " open"}>
      <summary style="margin-top:14px">Registrar sessão</summary>
      <label class="f" for="sTarget">Alvo</label>
      <input type="text" id="sTarget" list="huntList" autocomplete="off" placeholder="ex.: Kingdra">
      <div class="row3">
        <div><label class="f" for="sMin">Minutos</label><input type="number" id="sMin" min="0"></div>
        <div><label class="f" for="sSec">Segundos</label><input type="number" id="sSec" min="0" max="59"></div>
        <div><label class="f" for="sKills">Derrotados</label><input type="number" id="sKills" min="1"></div>
      </div>
      <div class="row2">
        <div><label class="f" for="sXph">XP/h</label><input type="number" id="sXph" min="0"></div>
        <div><label class="f" for="sBal">Saldo/h (opcional)</label><input type="number" id="sBal"></div>
      </div>
      <div class="row2">
        <div><label class="f" for="sPot">Poções usadas (opcional)</label><input type="number" id="sPot" min="0"></div>
        <div><label class="f" for="sLv">Nível na sessão</label><input type="number" id="sLv" min="1" value="${m.level}"></div>
      </div>
      <label class="f" for="sPotT">Poção usada na sessão</label>
      <select id="sPotT">${potOptions(m.potion || st.potion)}</select>
      <label style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:14px"><input type="checkbox" id="sEvent2x"${st.event2x ? " checked" : ""}> Evento "XP em Dobro" estava ativo nessa sessão</label>
      <p class="hint" id="sErr" role="alert" style="color:var(--bad)"></p>
      <div class="actions"><button class="btn primary" id="sAdd">Registrar sessão</button></div>
    </details>`;
  p.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => {
      state.sessions = state.sessions.filter((s: any) => s.id !== (b as HTMLElement).dataset.del);
      persist();
      renderSessions();
      renderResults();
    }),
  );
  $("sAdd").addEventListener("click", () => {
    const h = huntOf(($("sTarget") as HTMLInputElement).value),
      secs =
        (+($("sMin") as HTMLInputElement).value || 0) * 60 +
        (+($("sSec") as HTMLInputElement).value || 0),
      kills = +($("sKills") as HTMLInputElement).value || 0,
      xph = +($("sXph") as HTMLInputElement).value || 0;
    if (!h) {
      $("sErr").textContent = "Escolha um alvo da lista.";
      return;
    }
    if (secs < 30 || kills < 1 || xph <= 0) {
      $("sErr").textContent = "Preencha tempo (30 s ou mais), derrotados e XP/h.";
      return;
    }
    const bal = ($("sBal") as HTMLInputElement).value.trim(),
      pot = ($("sPot") as HTMLInputElement).value.trim(),
      pt = potByName(($("sPotT") as HTMLSelectElement).value);
    state.sessions.push({
      id: uid(),
      monId: m.id,
      target: h.n,
      seconds: secs,
      kills,
      xph,
      balh: bal === "" ? "" : +bal,
      potions: pot === "" ? "" : +pot,
      level: +($("sLv") as HTMLInputElement).value || m.level,
      potion: pt[0],
      heal: pt[1],
      vip: !!st.vip,
      xp2x: ($("sEvent2x") as HTMLInputElement).checked,
    });
    persist();
    renderSessions();
    renderResults();
    ($("sTarget") as HTMLElement).focus();
  });
}

/* ---------- resultados ---------- */
function bindControls() {
  const st = state.settings;
  const m = active();
  ($("potion") as HTMLSelectElement).innerHTML = potOptions(m.potion || st.potion);
  ($("potion") as HTMLSelectElement).value = m.potion || st.potion;
  $("potion").addEventListener("change", () => {
    m.potion = ($("potion") as HTMLSelectElement).value;
    persist();
    renderResults();
    renderSessions();
  });
  for (const k of ["w", "trainerLv", "healThreshold"]) {
    const el = $(k) as HTMLInputElement;
    el.value = st[k];
    const handler = () => {
      st[k] = el.type === "number" && el.value !== "" ? +el.value : el.value;
      if (k === "w") st.w = +el.value;
      persist();
      renderResults();
    };
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  }
  for (const k of ["stones", "vip", "event2x"]) {
    const el = $(k) as HTMLInputElement;
    el.checked = !!st[k];
    el.addEventListener("change", () => {
      st[k] = el.checked;
      persist();
      renderResults();
    });
  }
  ($("dailyType") as HTMLSelectElement).innerHTML =
    '<option value="">Nenhum</option>' +
    BASE.T.map(
      (t: string) =>
        `<option value="${t}"${st.dailyType === t ? " selected" : ""}>${TYPE_PT[t]}</option>`,
    ).join("");
  $("dailyType").addEventListener("change", () => {
    st.dailyType = ($("dailyType") as HTMLSelectElement).value;
    persist();
    renderResults();
  });
  for (const k of ["orre", "nightmare"]) {
    const el = $("map_" + k) as HTMLInputElement;
    el.checked = !!st.maps[k];
    el.addEventListener("change", () => {
      st.maps[k] = el.checked;
      persist();
      renderResults();
    });
  }
}
function dropsTable(h: any, lb: number, stones: boolean) {
  const rows = h.loot
    .map((d: any) => {
      const p = Math.min(1, d.p * lb),
        q = (d.mn + d.mx) / 2,
        v = !stones && d.it.c === "stone" ? 0 : p * q * d.it.p;
      return { d, p, v };
    })
    .sort((a: any, b: any) => b.v - a.v);
  const tot = rows.reduce((a: number, r: any) => a + r.v, 0);
  return `<div class="tablewrap"><table class="sess drops"><thead><tr><th>Item</th><th>Chance</th><th>Qtd.</th><th>Preço</th><th>$ por kill</th></tr></thead><tbody>${rows.map((r: any) => `<tr${r.v === 0 && r.d.it.c === "stone" ? ' class="off"' : ""}><td>${esc(r.d.it.n)}${r.d.it.c === "stone" ? ' <span class="tag x">pedra</span>' : ""}</td><td>${pct(r.p)}</td><td>${r.d.mn === r.d.mx ? r.d.mx : r.d.mn + "–" + r.d.mx}</td><td>$${nf.format(r.d.it.p)}</td><td>${nf1.format(r.v)}</td></tr>`).join("")}</tbody><tfoot><tr><td colspan="4">Total esperado por kill</td><td><b>$${nf1.format(tot)}</b></td></tr></tfoot></table></div>`;
}
function renderResults() {
  if (adding) {
    renderCapture();
    $("resName").textContent = "o novo pokémon";
    $("resHint").textContent = "Adicione o pokémon ao lado para ver as rotas.";
    $("pick").innerHTML = "";
    $("rows").innerHTML = "";
    return;
  }
  const m = active(),
    st = state.settings;
  const { list, hidden, pot } = rankFor(BASE, m, state.team, state.sessions, st);
  $("resName").textContent = m.name;
  $("wVal").textContent = st.w + "%";
  const mv = myMoves(m, spOf(m));
  $("resHint").textContent =
    `${list.length} hunts possíveis${+st.trainerLv > 0 ? ` até o nível ${+st.trainerLv}` : " (informe o nível do treinador para esconder as que você não pode fazer)"}. ${mv.length} golpe${mv.length > 1 ? "s" : ""} em uso. A poção de cada hunt é escolhida automaticamente pela força do golpe mais pesado do selvagem; a que você marcou (${esc(pot[0])}) vale só para registrar sessões.${hidden ? ` ${hidden} hunts escondidas por risco de desmaio.` : ""} ${new Set([...BUILTIN_HIDDEN, ...st.hidden]).size} hunts escondidas por não terem mapa confirmado.`;
  if (!list.length) {
    $("pick").innerHTML =
      `<p class="empty" style="margin-top:14px">Nenhuma hunt passa nos filtros. Aumente o prejuízo aceito ou mostre as hunts perigosas.</p>`;
    $("rows").innerHTML = "";
    return;
  }
  const b = list[0];
  const tags = (r: any) =>
    (r.src === "med" ? '<span class="tag m">medido</span>' : "") +
    (r.extrap ? '<span class="tag x">sem calibração</span>' : "") +
    (r.above && r.src === "est" ? '<span class="tag x">acima do pokémon</span>' : "") +
    (r.danger
      ? '<span class="tag d">perigosa</span>'
      : r.bars >= 1
        ? '<span class="tag d">apanha muito</span>'
        : "") +
    (r.burst
      ? '<span class="tag d" title="Um golpe só pode tirar metade do HP ou mais — poção pode não reagir a tempo">risco de desmaio</span>'
      : "") +
    (!r.potFull
      ? '<span class="tag x" title="Nem a poção mais forte enche o HP de volta ao máximo">poção não enche o HP</span>'
      : "") +
    (r.potInsuff
      ? '<span class="tag x" title="Nem a poção mais forte cura o golpe mais pesado do selvagem de uma vez">golpe mais forte que qualquer poção</span>'
      : "");
  $("pick").innerHTML = `<article class="pick" aria-label="Melhor rota">
    <div><div class="label">Melhor rota agora</div><div class="name">${esc(b.h.n)}</div>${b.h.t.map(badge).join("")} <span class="eff">nível ${b.h.l}</span>${tags(b)}</div>
    <div class="big">${big(b.xph)}<small>XP por hora</small></div>
    <div class="facts"><span>Saldo <b class="${b.net >= 0 ? "pos" : "neg"}">${money(b.net)}/h</b></span><span>Até o nível ${m.goal}: <b>${dur(b.hours)}</b></span><span>Ataque <b>${mult(b.oe)}</b> · recebe <b>${mult(b.de)}</b></span><span><b>${nf.format(Math.round(b.kph))}</b> kills/h</span><span>Poção recomendada: <b>${esc(b.potUsed[0])}</b>${b.potInsuff ? ' <span class="tag x">nem essa é suficiente</span>' : ""}</span><span>~<b>${nf.format(Math.round(b.P))}</b> poções/h</span>${(() => {
      const r = captureOf(b.h.val, +st.ballPrice, (st.capBoost ? 2 : 1) * (+st.capMult || 1));
      return r
        ? `<span>Captura: <b>${pct(r.c)}</b> por ${esc(st.ballName || "bola")} ($${nf.format(+st.ballPrice)})</span>`
        : "";
    })()}${b.worst ? `<span>Golpe mais forte do selvagem: <b>${esc(b.worst.n)}</b> (${TYPE_PT[b.worst.t]}, ${mult(b.worst.e)})</span>` : `<span>O selvagem não tem golpe de dano na base</span>`}</div>
    <div class="actions" style="grid-column:1/-1;margin-top:0"><button class="btn small ghost" data-hide="${esc(b.h.n)}">Não achei essa hunt no mapa</button></div>
    <details class="dropsbox"><summary>Drops de ${esc(b.h.n)}</summary>${b.h.loot.length ? dropsTable(b.h, 1, st.stones !== false) : `<p class="empty">Sem drops na base.</p>`}</details>
  </article>`;
  bestName = b.h.n;
  renderCapture();
  $("rows").innerHTML = list
    .slice(0, 40)
    .map(
      (r: any, i: number) =>
        `<tr>
    <td class="rank">${i + 1}</td>
    <td>${esc(r.h.n)} ${r.h.t.map(badge).join("")}${tags(r)} <button class="hide-btn" data-hide="${esc(r.h.n)}" aria-label="Ocultar ${esc(r.h.n)}" title="Não achei no mapa: ocultar">×</button></td>
    <td>${r.h.l}</td>
    <td class="eff">${mult(r.oe)} / ${mult(r.de)}</td>
    <td>${nf.format(Math.round(r.kph))}</td>
    <td>${big(r.xph)}</td>
    <td class="${r.net >= 0 ? "pos" : "neg"}">${money(r.net)}</td>
    <td>${dur(r.hours)}</td><td>${esc(r.potUsed[0])}</td><td>${nf.format(Math.round(r.P))}</td></tr>`,
    )
    .join("");
  document.querySelectorAll("[data-hide]").forEach((b) =>
    b.addEventListener("click", () => {
      const n = (b as HTMLElement).dataset.hide!;
      if (!st.hidden.includes(n)) st.hidden.push(n);
      persist();
      renderResults();
    }),
  );
}

/* ---------- captura ---------- */
let bestName = "";
function renderCapture() {
  const p = document.getElementById("capPanel");
  if (!p) return;
  const st = state.settings,
    name = st.capTarget || bestName,
    sp = BASE.BY_NAME[(name || "").toLowerCase()];
  const mult2 = (st.capBoost ? 2 : 1) * (+st.capMult || 1),
    r = sp ? captureOf(sp.val, +st.ballPrice, mult2) : null;
  const wasFocus = document.activeElement && (document.activeElement as HTMLElement).id;
  if (!document.getElementById("cTarget")) {
    p.innerHTML = `<h2>Custo de captura</h2>
      <p class="hint">Regra oficial do jogo: cada bola tem chance igual ao preço da bola dividido pelo valor do pokémon, e cada arremesso é sorteado de novo. Não existe número fixo de bolas.</p>
      <label class="f" for="cTarget">Pokémon</label><input type="text" id="cTarget" list="speciesList" autocomplete="off">
      <div class="row3">
        <div><label class="f" for="cName">Nome da bola</label><input type="text" id="cName" placeholder="ex.: Ultra Ball"></div>
        <div><label class="f" for="cBall">Preço da bola ($)</label><input type="number" id="cBall" min="1"></div>
        <div><label class="f" for="cMult">Outros bônus (×)</label><input type="number" id="cMult" min="0.1" step="0.05"></div>
      </div>
      <div class="checks" style="margin-top:8px"><label><input type="checkbox" id="cBoost"> Capture Boost ativo (×2)</label></div>
      <div class="calib" id="cOut" role="status"></div>`;
    ($("cTarget") as HTMLInputElement).addEventListener("input", (e) => {
      st.capTarget = (e.target as HTMLInputElement).value;
      persist();
      renderCapture();
    });
    ($("cName") as HTMLInputElement).addEventListener("input", (e) => {
      st.ballName = (e.target as HTMLInputElement).value;
      persist();
      renderCapture();
    });
    ($("cBall") as HTMLInputElement).addEventListener("input", (e) => {
      st.ballPrice = +(e.target as HTMLInputElement).value || 0;
      persist();
      renderCapture();
    });
    ($("cMult") as HTMLInputElement).addEventListener("input", (e) => {
      st.capMult = +(e.target as HTMLInputElement).value || 1;
      persist();
      renderCapture();
    });
    ($("cBoost") as HTMLInputElement).addEventListener("change", (e) => {
      st.capBoost = (e.target as HTMLInputElement).checked;
      persist();
      renderCapture();
    });
  }
  if (wasFocus !== "cTarget") {
    ($("cTarget") as HTMLInputElement).value = st.capTarget;
    ($("cTarget") as HTMLInputElement).placeholder = bestName
      ? `${bestName} (melhor rota do time)`
      : "ex.: Houndoom";
  }
  if (wasFocus !== "cName") ($("cName") as HTMLInputElement).value = st.ballName;
  if (wasFocus !== "cBall") ($("cBall") as HTMLInputElement).value = String(st.ballPrice);
  if (wasFocus !== "cMult") ($("cMult") as HTMLInputElement).value = String(st.capMult);
  ($("cBoost") as HTMLInputElement).checked = !!st.capBoost;
  const ball = st.ballName || "bola";
  $("cOut").innerHTML = !sp
    ? "Escolha um pokémon da lista."
    : !r
      ? `${esc(sp.n)} não tem valor na base, então não dá para calcular.`
      : `Valor de ${esc(sp.n)}: <b>$${nf.format(sp.val)}</b>. Chance por ${esc(ball)}: <b>${pct(r.c)}</b>.<br>
     Em média <b>${nf.format(Math.round(r.exp))}</b> bolas, custo médio <b>$${nf.format(Math.round(r.cost))}</b>.<br>
     Chance de já ter capturado: 50% em ${nf.format(r.n50)} bolas, 90% em ${nf.format(r.n90)}, 99% em ${nf.format(r.n99)}.<br>
     <span style="color:var(--muted)">Trocar de bola não muda o custo médio, só a velocidade: bola mais cara acerta mais na mesma proporção. Boost e bônus dividem o custo. Shinies seguem outra regra.</span>`;
}

/* ---------- backup ---------- */
function bindBackup() {
  const d = document.getElementById("backup") as any;
  d.addEventListener("toggle", () => {
    if (d.open && !($("bkText") as HTMLTextAreaElement).value.trim())
      ($("bkText") as HTMLTextAreaElement).value = JSON.stringify(state);
  });
  $("bkCopy").addEventListener("click", async () => {
    const t = $("bkText") as HTMLTextAreaElement;
    t.value = JSON.stringify(state);
    t.select();
    let ok = false;
    try {
      await navigator.clipboard.writeText(t.value);
      ok = true;
    } catch {
      try {
        ok = document.execCommand("copy");
      } catch {
        /* sem clipboard disponível */
      }
    }
    $("bkMsg").textContent = ok
      ? "Copiado. Cole num lugar seguro."
      : "Texto selecionado: copie com Ctrl+C.";
  });
  $("bkLoad").addEventListener("click", () => {
    let s;
    try {
      s = JSON.parse(($("bkText") as HTMLTextAreaElement).value);
    } catch {
      $("bkMsg").textContent = "Esse texto não é um backup válido.";
      return;
    }
    if (!s || !Array.isArray(s.team) || !Array.isArray(s.sessions)) {
      $("bkMsg").textContent = "Esse texto não é um backup válido.";
      return;
    }
    if (
      state.team.length &&
      !confirm("Substituir o time e as sessões deste navegador pelo backup?")
    )
      return;
    s.team = s.team.filter((m: any) => spOf(m));
    state = sane(s);
    state.activeId = state.team[0]?.id || null;
    adding = false;
    persist();
    renderAll();
    $("bkMsg").textContent = "Backup restaurado.";
  });
}

function renderAll() {
  const has = state.team.length > 0;
  if (has && !state.team.find((m: any) => m.id === state.activeId))
    state.activeId = state.team[0].id;
  $("welcome").hidden = has;
  $("main").hidden = !has;
  renderTeam();
  if (!has) {
    renderWelcome();
    return;
  }
  renderMon();
  renderSessions();
  bindControls();
  renderResults();
  renderCapture();
}
/* ---------- abas ---------- */
let activeTab = "hunt";
function renderTabs() {
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String((b as HTMLElement).dataset.tab === activeTab)),
    );
  document
    .querySelectorAll(".tabpanel")
    .forEach((p) => ((p as HTMLElement).hidden = p.id !== "tabpanel-" + activeTab));
  if (activeTab === "captura") renderCapture();
  if (activeTab === "hunt") renderQControls();
  if (activeTab === "time" && state.team.length) {
    bindControls();
    renderResults();
  }
}

/* ---------- hunt solta: mesmo ranking da aba Time, para um pokémon não salvo ---------- */
let qMon: any = null;
function bindHuntSolta() {
  $("qStatsRow").innerHTML = [
    ["hp", "HP"],
    ["atk", "Atk"],
    ["def", "Def"],
    ["spAtk", "SpA"],
    ["spDef", "SpD"],
    ["speed", "Vel"],
  ]
    .map(
      ([k, l]) =>
        `<div><label class="f" for="q_${k}">${l}</label><input type="number" id="q_${k}" min="1" data-k="${k}"></div>`,
    )
    .join("");
  $("qCalc").addEventListener("click", () => {
    const sp = spOf({ species: ($("qSpecies") as HTMLInputElement).value.trim() });
    const lvl = parseInt(($("qLevel") as HTMLInputElement).value);
    if (!sp) {
      $("qErr").textContent = "Escolha a espécie do seu pokémon na lista.";
      return;
    }
    if (!(lvl >= 1)) {
      $("qErr").textContent = "Informe o nível do seu pokémon.";
      return;
    }
    $("qErr").textContent = "";
    const q = parseFloat(String(($("qQ") as HTMLInputElement).value).replace(",", "."));
    const ivt = +($("qIvt") as HTMLInputElement).value || 96;
    const statInputs = [...document.querySelectorAll<HTMLInputElement>("#qStatsRow input")];
    const vals: any = {};
    for (const i of statInputs) vals[i.dataset.k!] = +i.value || 0;
    const filled = Object.values(vals).every((v: any) => v > 0);
    qMon = {
      id: "__q__",
      species: sp.n,
      level: lvl,
      goal: lvl + 10,
      curXp: 0,
      q: q > 0 ? q : 1,
      ivt,
      g: Math.min(32, Math.max(1, Math.round(ivt / 6))),
      stats: filled ? vals : null,
      statsLv: filled ? lvl : 0,
    };
    ($("qResultsPanel") as HTMLElement).hidden = false;
    renderQControls();
  });
}
function renderQRank() {
  if (!qMon) return;
  const st = state.settings;
  const { list, hidden } = rankFor(BASE, qMon, state.team, state.sessions, st);
  $("qResName").textContent = `${qMon.species} nv ${qMon.level}`;
  $("qwVal").textContent = st.w + "%";
  $("qResHint").textContent =
    `${list.length} hunts possíveis${+st.trainerLv > 0 ? ` até o nível ${+st.trainerLv}` : " (informe o nível do treinador para esconder as que você não pode fazer)"}.${hidden ? ` ${hidden} hunts escondidas por risco de desmaio.` : ""} ${new Set([...BUILTIN_HIDDEN, ...st.hidden]).size} hunts escondidas por não terem mapa confirmado.`;
  const tags = (r: any) =>
    (r.src === "med" ? '<span class="tag m">medido</span>' : "") +
    (r.above && r.src === "est" ? '<span class="tag x">acima do pokémon</span>' : "") +
    (r.danger
      ? '<span class="tag d">perigosa</span>'
      : r.bars >= 1
        ? '<span class="tag d">apanha muito</span>'
        : "") +
    (r.burst ? '<span class="tag d">risco de desmaio</span>' : "") +
    (!r.potFull ? '<span class="tag x">poção não enche o HP</span>' : "") +
    (r.potInsuff ? '<span class="tag x">golpe mais forte que qualquer poção</span>' : "");
  if (!list.length) {
    $("qPick").innerHTML =
      `<p class="empty" style="margin-top:14px">Nenhuma hunt passa nos filtros. Aumente o nível máximo ou mostre as hunts perigosas.</p>`;
    $("qRows").innerHTML = "";
    return;
  }
  const b = list[0];
  $("qPick").innerHTML = `<article class="pick" aria-label="Melhor rota">
    <div><div class="label">Melhor rota</div><div class="name">${esc(b.h.n)}</div>${b.h.t.map(badge).join("")} <span class="eff">nível ${b.h.l}</span>${tags(b)}</div>
    <div class="big">${big(b.xph)}<small>XP por hora</small></div>
    <div class="facts"><span>Saldo <b class="${b.net >= 0 ? "pos" : "neg"}">${money(b.net)}/h</b></span><span>Ataque <b>${mult(b.oe)}</b> · recebe <b>${mult(b.de)}</b></span><span><b>${nf.format(Math.round(b.kph))}</b> kills/h</span><span>Poção recomendada: <b>${esc(b.potUsed[0])}</b></span><span>~<b>${nf.format(Math.round(b.P))}</b> poções/h</span>${b.worst ? `<span>Golpe mais forte do selvagem: <b>${esc(b.worst.n)}</b> (${TYPE_PT[b.worst.t]}, ${mult(b.worst.e)})</span>` : `<span>O selvagem não tem golpe de dano na base</span>`}</div>
    <details class="dropsbox"><summary>Drops de ${esc(b.h.n)}</summary>${b.h.loot.length ? dropsTable(b.h, 1, st.stones !== false) : `<p class="empty">Sem drops na base.</p>`}</details>
  </article>`;
  $("qRows").innerHTML = list
    .slice(0, 40)
    .map(
      (r: any, i: number) =>
        `<tr>
    <td class="rank">${i + 1}</td>
    <td>${esc(r.h.n)} ${r.h.t.map(badge).join("")}${tags(r)}</td>
    <td>${r.h.l}</td>
    <td class="eff">${mult(r.oe)} / ${mult(r.de)}</td>
    <td>${nf.format(Math.round(r.kph))}</td>
    <td>${big(r.xph)}</td>
    <td class="${r.net >= 0 ? "pos" : "neg"}">${money(r.net)}</td>
    <td>${dur(r.hours)}</td>
    <td>${esc(r.potUsed[0])}</td>
    <td>${nf.format(Math.round(r.P))}</td></tr>`,
    )
    .join("");
}
function renderQControls() {
  const st = state.settings;
  ($("qHealThreshold") as HTMLSelectElement).value = st.healThreshold;
  ($("qDailyType") as HTMLSelectElement).innerHTML =
    '<option value="">Nenhum</option>' +
    BASE.T.map(
      (t: string) =>
        `<option value="${t}"${st.dailyType === t ? " selected" : ""}>${TYPE_PT[t]}</option>`,
    ).join("");
  const map: Record<string, string> = {
    w: "qw",
    trainerLv: "qTrainerLv",
    healThreshold: "qHealThreshold",
  };
  for (const k of ["w", "trainerLv", "healThreshold"]) {
    const el = $(map[k]) as HTMLInputElement;
    el.value = st[k];
    const handler = () => {
      st[k] = el.type === "number" && el.value !== "" ? +el.value : el.value;
      if (k === "w") st.w = +el.value;
      persist();
      renderQRank();
      if (activeTab === "time") renderResults();
    };
    el.addEventListener("input", handler);
    el.addEventListener("change", handler);
  }
  $("qDailyType").addEventListener("change", () => {
    st.dailyType = ($("qDailyType") as HTMLSelectElement).value;
    persist();
    renderQRank();
    if (activeTab === "time") renderResults();
  });
  const cmap: Record<string, string> = { stones: "qStones", vip: "qVip", event2x: "qEvent2x" };
  for (const k in cmap) {
    const el = $(cmap[k]) as HTMLInputElement;
    el.checked = !!st[k];
    el.addEventListener("change", () => {
      st[k] = el.checked;
      persist();
      renderQRank();
      if (activeTab === "time") renderResults();
    });
  }
  const mmap: Record<string, string> = { orre: "qMapOrre", nightmare: "qMapNightmare" };
  for (const k in mmap) {
    const el = $(mmap[k]) as HTMLInputElement;
    el.checked = !!st.maps[k];
    el.addEventListener("change", () => {
      st.maps[k] = el.checked;
      persist();
      renderQRank();
      if (activeTab === "time") renderResults();
    });
  }
  if (qMon) renderQRank();
}

(function init() {
  const sl = document.createElement("datalist");
  sl.id = "speciesList";
  sl.innerHTML = BASE.MONS.map((h: any) => `<option value="${esc(h.n)}">`).join("");
  document.body.appendChild(sl);
  const hl = document.createElement("datalist");
  hl.id = "huntList";
  hl.innerHTML = BASE.MONS.filter((h: any) => h.l > 0 && h.x > 0)
    .map((h: any) => `<option value="${esc(h.n)}">`)
    .join("");
  document.body.appendChild(hl);
  const d = new Date(BASE.meta.coleta);
  $("baseInfo").textContent =
    `${BASE.MONS.length} pokémon, coletada em ${d.toLocaleDateString("pt-BR")}`;
  document.querySelectorAll(".tab-btn").forEach((b) =>
    b.addEventListener("click", () => {
      activeTab = (b as HTMLElement).dataset.tab!;
      renderTabs();
    }),
  );
  bindHuntSolta();
  bindBackup();
  renderAll();
  renderTabs();
})();
