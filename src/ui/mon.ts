/* ---------- painel do pokémon ativo ---------- */
import { BASE, spOf } from "../core/base";
import { statsOf, ivAvg, monStats, hasStats, inferIv, myMoves, combatHp } from "../core/battle";
import { persist, active, needXp } from "../services/storage";
import { adding } from "./state";
import { $, esc, nf, nf1, big, badge, TYPE_PT, TYPE_COLOR } from "./format";
import { addForm, bindAddForm, removeMon } from "./team";
import { renderTeam } from "./team";
import { renderSessions } from "./sessions";
import { renderResults } from "./results";

export function renderMon() {
  const p = $("monPanel");
  if (adding) {
    p.innerHTML = `<h2>Novo pokémon</h2><p class="hint">Espécie e nível bastam. O resto dá para ajustar depois.</p>${addForm(true)}`;
    bindAddForm();
    return;
  }
  const m = active(),
    sp = spOf(m);
  const est = statsOf(sp, m.level, ivAvg(m), +m.q || 1);
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
