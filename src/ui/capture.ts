/* ---------- captura ---------- */
import { BASE } from "../core/base";
import { captureOf } from "../core/ranking";
import { state, persist } from "../services/storage";
import { bestName } from "./state";
import { $, esc, nf, pct } from "./format";

export function renderCapture() {
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
