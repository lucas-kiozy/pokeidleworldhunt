/* ---------- time ---------- */
import { spOf } from "../core/base";
import { state, persist, uid, oldData, importOldInto, active } from "../services/storage";
import { adding, setAdding } from "./state";
import { $, esc, TYPE_COLOR } from "./format";
import { renderAll } from "./app";

export function renderTeam() {
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
      setAdding(false);
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
    setAdding(true);
    renderAll();
    setTimeout(() => ($("aSpecies") as HTMLElement | null)?.focus(), 0);
  });
}

// importado por ./mon.ts também: o painel do pokémon reaproveita este formulário quando `adding` é true
export function addForm(withCancel: boolean) {
  return `<div class="row3">
      <div style="grid-column:span 2"><label class="f" for="aSpecies">Espécie</label><input type="text" id="aSpecies" list="speciesList" autocomplete="off" placeholder="ex.: Dragonite"></div>
      <div><label class="f" for="aLevel">Nível</label><input type="number" id="aLevel" min="1" placeholder="ex.: 60"></div>
    </div>
    <label class="f" for="aQ">Qualidade (opcional, aparece na ficha do pokémon no jogo)</label>
    <input type="number" id="aQ" min="0.8" max="5" step="0.01" placeholder="1,00">
    <p class="hint" id="aErr" role="alert" style="color:var(--bad)"></p>
    <div class="actions"><button class="btn primary" id="aAdd">Adicionar ao time</button>${withCancel ? `<button class="btn ghost" id="aCancel">Cancelar</button>` : ""}</div>`;
}
export function bindAddForm() {
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
      q: q > 0 ? q : 1,
      ivt: 96,
      moves: null,
      tm: "",
      potion: state.settings.potion,
    });
    state.activeId = id;
    setAdding(false);
    persist();
    renderAll();
  });
  const cancelBtn = document.getElementById("aCancel");
  if (cancelBtn)
    cancelBtn.addEventListener("click", () => {
      setAdding(false);
      renderAll();
    });
  ["aSpecies", "aLevel", "aQ"].forEach((k) =>
    $(k).addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") $("aAdd").click();
    }),
  );
}

export function renderWelcome() {
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
  if (od) $("impOld").addEventListener("click", () => importOld(od));
  $("goBackup").addEventListener("click", (e) => {
    e.preventDefault();
    ($("backup") as any).open = true;
    $("backup").scrollIntoView({ behavior: "smooth" });
  });
}

function importOld(d: { o: any; team: any[] }) {
  importOldInto(d);
  renderAll();
}

export function removeMon(id: string) {
  const mm = state.team.find((x: any) => x.id === id);
  if (!mm) return;
  if (!confirm(`Remover ${mm.name} e as sessões dele?`)) return;
  state.team = state.team.filter((x: any) => x.id !== id);
  state.sessions = state.sessions.filter((s: any) => s.monId !== id);
  if (state.activeId === id) state.activeId = state.team[0]?.id || null;
  persist();
  renderAll();
}
