/* ---------- orquestração das telas (equivalente ao Agente 00 do AGENTS.md, só que em runtime) ---------- */
import { state } from "../services/storage";
import { activeTab } from "./state";
import { $ } from "./format";
import { renderTeam, renderWelcome } from "./team";
import { renderMon } from "./mon";
import { renderSessions } from "./sessions";
import { bindControls, renderResults } from "./results";
import { renderCapture } from "./capture";
import { renderQControls } from "./hunt-solta";

export function renderAll() {
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
export function renderTabs() {
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
