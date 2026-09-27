/* Calibração do time, ranking de hunts e captura. Sem DOM, sem storage (A-LAYER). */
import { DEF, DANGER_HPS, VIP_XP, EVENT_XP2, DAILY_TYPE_BONUS, BUILTIN_HIDDEN } from "./constants";
import { crowdInt, crowdAt, mapOf, fightOf, recommendPotion, lootPerKill, totalXp } from "./battle";

/* calibração do time: tempo fixo e escala da luta são comuns a todos (validado com Venusaur e Golem);
   XP real/base e fator de poção são por pokémon, com o time como reserva */
export function calibrateTeam(B: any, team: any[], sessions: any[]) {
  const pts: [number, number][] = [],
    per: any = {};
  const xe: number[] = [];
  let hSum = 0,
    dSum = 0;
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
export function calibFor(c: any, mon: any) {
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

export function rankFor(B: any, mon: any, team: any[], sessions: any[], st: any) {
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
  const list: any[] = [];
  let hidden = 0;
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
    const loot = lootPerKill(h, 1, !!st.stones) * daily;
    let P = (dmgKill * kph) / effHeal,
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
export function captureOf(val: number, ballPrice: number, mult?: number) {
  if (!(val > 0) || !(ballPrice > 0)) return null;
  const c = Math.min(1, (ballPrice / val) * (mult || 1));
  const n = (q: number) => (c >= 1 ? 1 : Math.ceil(Math.log(1 - q) / Math.log(1 - c)));
  return { c, exp: 1 / c, cost: ballPrice / c, n50: n(0.5), n90: n(0.9), n99: n(0.99) };
}
/* mesma conta do ranking, mas para UM par (meu pokémon, hunt) só — usado na aba "Hunt solta".
   Reaproveita a calibração do time salvo (se houver sessões), sem precisar salvar nada. */
export function singleHuntCalc(B: any, mon: any, team: any[], sessions: any[], h: any, st: any) {
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
