/* ---------- hunt solta: mesmo ranking da aba Time, para um pokémon não salvo ---------- */
import { BASE, spOf } from "../core/base";
import { BUILTIN_HIDDEN } from "../core/constants";
import { rankFor } from "../core/ranking";
import { state, persist } from "../services/storage";
import { qMon, setQMon, activeTab } from "./state";
import {
  $,
  esc,
  nf,
  big,
  money,
  mult,
  matchup,
  animateMatchups,
  badge,
  TYPE_PT,
  typesAlpha,
} from "./format";
import { dropsTable, renderResults } from "./results";

export function bindHuntSolta() {
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
    setQMon({
      id: "__q__",
      species: sp.n,
      level: lvl,
      q: q > 0 ? q : 1,
      ivt,
      g: Math.min(32, Math.max(1, Math.round(ivt / 6))),
      stats: filled ? vals : null,
      statsLv: filled ? lvl : 0,
    });
    ($("qResultsPanel") as HTMLElement).hidden = false;
    renderQControls();
  });
}
export function renderQRank() {
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
    <div><div class="label">🏆 Melhor rota</div><div class="name">${esc(b.h.n)}</div>${b.h.t.map(badge).join("")} <span class="eff">nível ${b.h.l}</span>${tags(b)}</div>
    <div class="big">${big(b.xph)}<small>XP por hora</small></div>
    <div class="facts"><span>Saldo <b class="${b.net >= 0 ? "pos" : "neg"}">${money(b.net)}/h</b></span>${matchup(b.oe, b.de)}<span><b>${nf.format(Math.round(b.kph))}</b> kills/h</span><span>Poção recomendada: <b>${esc(b.potUsed[0])}</b></span><span>~<b>${nf.format(Math.round(b.P))}</b> poções/h</span>${b.worst ? `<span>Golpe mais forte do selvagem: <b>${esc(b.worst.n)}</b> (${TYPE_PT[b.worst.t]}, ${mult(b.worst.e)})</span>` : `<span>O selvagem não tem golpe de dano na base</span>`}</div>
    <details class="dropsbox"><summary>Drops de ${esc(b.h.n)}</summary>${b.h.loot.length ? dropsTable(b.h, 1, st.stones !== false) : `<p class="empty">Sem drops na base.</p>`}</details>
  </article>`;
  animateMatchups();
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
    <td>${esc(r.potUsed[0])}</td>
    <td>${nf.format(Math.round(r.P))}</td></tr>`,
    )
    .join("");
}
export function renderQControls() {
  const st = state.settings;
  ($("qHealThreshold") as HTMLSelectElement).value = st.healThreshold;
  ($("qDailyType") as HTMLSelectElement).innerHTML =
    '<option value="">Nenhum</option>' +
    typesAlpha(BASE.T)
      .map(
        (t: string) =>
          `<option value="${t}"${st.dailyType === t ? " selected" : ""}>${TYPE_PT[t]}</option>`,
      )
      .join("");
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
