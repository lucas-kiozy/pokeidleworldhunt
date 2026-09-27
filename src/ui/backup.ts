/* ---------- backup ---------- */
import { spOf } from "../core/base";
import { state, persist, replaceState } from "../services/storage";
import { setAdding } from "./state";
import { $ } from "./format";
import { renderAll } from "./app";

export function bindBackup() {
  const d = document.getElementById("backup") as any;
  d.addEventListener("toggle", () => {
    if (d.open && !($("bkText") as HTMLTextAreaElement).value.trim())
      ($("bkText") as HTMLTextAreaElement).value = JSON.stringify(state);
  });
  $("bkCopy").addEventListener("click", async () => {
    const t = $("bkText") as HTMLTextAreaElement;
    t.value = JSON.stringify(state);
    t.select();
    let ok = false;
    try {
      await navigator.clipboard.writeText(t.value);
      ok = true;
    } catch {
      try {
        ok = document.execCommand("copy");
      } catch {
        /* sem clipboard disponível */
      }
    }
    $("bkMsg").textContent = ok
      ? "Copiado. Cole num lugar seguro."
      : "Texto selecionado: copie com Ctrl+C.";
  });
  $("bkLoad").addEventListener("click", () => {
    let s;
    try {
      s = JSON.parse(($("bkText") as HTMLTextAreaElement).value);
    } catch {
      $("bkMsg").textContent = "Esse texto não é um backup válido.";
      return;
    }
    if (!s || !Array.isArray(s.team) || !Array.isArray(s.sessions)) {
      $("bkMsg").textContent = "Esse texto não é um backup válido.";
      return;
    }
    if (
      state.team.length &&
      !confirm("Substituir o time e as sessões deste navegador pelo backup?")
    )
      return;
    s.team = s.team.filter((m: any) => spOf(m));
    replaceState(s);
    state.activeId = state.team[0]?.id || null;
    setAdding(false);
    persist();
    renderAll();
    $("bkMsg").textContent = "Backup restaurado.";
  });
}
