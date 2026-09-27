/* Pequenas flags de UI compartilhadas entre os módulos de renderização.
   Exportadas com setter porque um binding importado não pode ser reatribuído
   diretamente por outro módulo em ESM — só mutado via função do módulo dono. */

export let adding = false;
export function setAdding(v: boolean) {
  adding = v;
}

export let activeTab = "hunt";
export function setActiveTab(v: string) {
  activeTab = v;
}

export let bestName = "";
export function setBestName(v: string) {
  bestName = v;
}

export let qMon: any = null;
export function setQMon(v: any) {
  qMon = v;
}
