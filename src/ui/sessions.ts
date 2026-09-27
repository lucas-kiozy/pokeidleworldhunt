/* ---------- sessões do Hunt Analyzer ---------- */
import { BASE, huntOf, potByName } from "../core/base";
import { calibrateTeam, calibFor } from "../core/ranking";
import { state, persist, uid, active, monSessions } from "../services/storage";
import { adding } from "./state";
import { $, esc, nf, nf1, nf2, big, money, potOptions } from "./format";
import { renderResults } from "./results";

export function renderSessions() {
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
