/* ---------- resultados (ranking de hunts) ---------- */
import { BASE, spOf } from "../core/base";
import { BUILTIN_HIDDEN } from "../core/constants";
import { myMoves } from "../core/battle";
import { rankFor, captureOf } from "../core/ranking";
import { state, persist, active } from "../services/storage";
import { adding, setBestName } from "./state";
import {
  $,
  esc,
  nf,
  nf1,
  pct,
  big,
  money,
  mult,
  badge,
  TYPE_PT,
  potOptions,
  typesAlpha,
} from "./format";
import { renderCapture } from "./capture";
import { renderSessions } from "./sessions";

export function bindControls() {
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
    typesAlpha(BASE.T)
      .map(
        (t: string) =>
          `<option value="${t}"${st.dailyType === t ? " selected" : ""}>${TYPE_PT[t]}</option>`,
      )
      .join("");
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
export function dropsTable(h: any, lb: number, stones: boolean) {
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

export function renderResults() {
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
    <div class="facts"><span>Saldo <b class="${b.net >= 0 ? "pos" : "neg"}">${money(b.net)}/h</b></span><span>Ataque <b>${mult(b.oe)}</b> · recebe <b>${mult(b.de)}</b></span><span><b>${nf.format(Math.round(b.kph))}</b> kills/h</span><span>Poção recomendada: <b>${esc(b.potUsed[0])}</b>${b.potInsuff ? ' <span class="tag x">nem essa é suficiente</span>' : ""}</span><span>~<b>${nf.format(Math.round(b.P))}</b> poções/h</span>${(() => {
      const r = captureOf(b.h.val, +st.ballPrice, (st.capBoost ? 2 : 1) * (+st.capMult || 1));
      return r
        ? `<span>Captura: <b>${pct(r.c)}</b> por ${esc(st.ballName || "bola")} ($${nf.format(+st.ballPrice)})</span>`
        : "";
    })()}${b.worst ? `<span>Golpe mais forte do selvagem: <b>${esc(b.worst.n)}</b> (${TYPE_PT[b.worst.t]}, ${mult(b.worst.e)})</span>` : `<span>O selvagem não tem golpe de dano na base</span>`}</div>
    <div class="actions" style="grid-column:1/-1;margin-top:0"><button class="btn small ghost" data-hide="${esc(b.h.n)}">Não achei essa hunt no mapa</button></div>
    <details class="dropsbox"><summary>Drops de ${esc(b.h.n)}</summary>${b.h.loot.length ? dropsTable(b.h, 1, st.stones !== false) : `<p class="empty">Sem drops na base.</p>`}</details>
  </article>`;
  setBestName(b.h.n);
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
    <td>${esc(r.potUsed[0])}</td><td>${nf.format(Math.round(r.P))}</td></tr>`,
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
