/* Persistência do time/sessões/configurações (localStorage) — estado só neste navegador. */
import { potByName, spOf, huntOf } from "../core/base";

export const LS_KEY = "piw-hunt-planner-v2",
  LS_OLD = "piw-hunt-planner-v1";

export const DEF_SETTINGS = {
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

export const uid = () => Math.random().toString(36).slice(2, 10);
export const emptyState = () => ({
  v: 2,
  activeId: null as string | null,
  team: [] as any[],
  sessions: [] as any[],
  settings: { ...DEF_SETTINGS },
});

export function lsGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
export function lsSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
    return true;
  } catch {
    return false;
  }
}

export function sane(s: any) {
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

export let state: any;
try {
  state = sane(JSON.parse(lsGet(LS_KEY) || "null"));
} catch {
  state = emptyState();
}

/* usado no restauro de backup (ui/backup.ts): troca o conteúdo do estado salvo por um novo,
   sem quebrar a referência que os outros módulos importaram */
export function replaceState(raw: any) {
  state = sane(raw);
}

export function persist() {
  const ok = lsSet(LS_KEY, JSON.stringify(state));
  const el = document.getElementById("saveStatus");
  if (el) el.textContent = ok ? "salvo neste navegador" : "este navegador não permite salvar";
}

export function oldData() {
  try {
    const o = JSON.parse(lsGet(LS_OLD) || "null");
    if (!o || !Array.isArray(o.team)) return null;
    const team = o.team.filter((m: any) => spOf({ species: m.species || m.name }));
    return team.length ? { o, team } : null;
  } catch {
    return null;
  }
}
/* usado pela tela de boas-vindas (ui/team.ts) para trazer dados salvos numa versão anterior do app */
export function importOldInto(d: { o: any; team: any[] }) {
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
}

/* ---------- seletores sobre o estado ---------- */
export const active = () =>
  state.team.find((m: any) => m.id === state.activeId) || state.team[0] || null;
export const monSessions = (m: any) => state.sessions.filter((s: any) => s.monId === m.id);
