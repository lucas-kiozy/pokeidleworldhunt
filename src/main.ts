// Migrado de planejador-de-hunt-piw.html (2026-09-26), depois dividido em
// src/core (lógica pura, testável) + src/services (persistência) + src/ui (DOM),
// conforme a arquitetura descrita em AGENTS.md. Este arquivo é só o bootstrap.
//
// tsconfig está com "strict": false e duas regras do ESLint (no-explicit-any e
// no-unsanitized/property) rebaixadas a warn em src/ui/**, src/services/** e
// src/core/base.ts — débito técnico assumido nesta migração (o código original
// não era tipado e monta HTML por template string); ver eslint.config.js.
import { BASE } from "./core/base";
import { $, esc } from "./ui/format";
import { setActiveTab } from "./ui/state";
import { renderAll, renderTabs } from "./ui/app";
import { bindHuntSolta } from "./ui/hunt-solta";
import { bindBackup } from "./ui/backup";

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
      setActiveTab((b as HTMLElement).dataset.tab!);
      renderTabs();
    }),
  );
  bindHuntSolta();
  bindBackup();
  renderAll();
  renderTabs();
})();
