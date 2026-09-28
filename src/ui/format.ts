/* Formatação de números/texto e rótulos visuais (tipos, poções) usados pelas telas. */
import { BASE } from "../core/base";

export const $ = (id: string) => document.getElementById(id) as HTMLElement;

export const nf = new Intl.NumberFormat("pt-BR"),
  nf1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }),
  nf2 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function big(n: number) {
  const a = Math.abs(n);
  if (a >= 1e6) return nf2.format(n / 1e6) + " mi";
  if (a >= 1e4) return nf1.format(n / 1e3) + " mil";
  return nf.format(Math.round(n));
}
export function money(n: number) {
  return (n >= 0 ? "+$" : "−$") + big(Math.abs(n));
}
export function dur(h: number) {
  if (!isFinite(h)) return "—";
  if (h === 0) return "pronto";
  const m = Math.round(h * 60);
  if (m < 60) return m + " min";
  if (h < 48) {
    const hh = Math.floor(m / 60),
      mm = m % 60;
    return hh + "h" + (mm ? " " + String(mm).padStart(2, "0") : "");
  }
  return nf1.format(h / 24) + " dias";
}
export function pct(p: number) {
  return p >= 0.01 ? nf1.format(p * 100) + "%" : nf2.format(p * 100) + "%";
}
export function esc(s: unknown) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
export const mult = (x: number) => "×" + nf2.format(x);

// Teto de escala das barras de ataque/recebe: amp() amplifica o multiplicador
// bruto de tipo até uma dupla vantagem (raw 4 -> ~5,5), então 6 cobre o pior
// caso real sem esmagar as diferenças mais comuns (0 a ~2,5) numa faixa curta.
const MATCHUP_MAX = 6;
export function matchup(oe: number, de: number) {
  const w = (v: number) => Math.max(4, Math.min(100, (v / MATCHUP_MAX) * 100));
  return `<div class="matchup">
    <div class="matchup-row atk"><span class="lbl">Ataque</span><span class="track"><span class="fill" data-w="${w(oe)}"></span></span><b>${mult(oe)}</b></div>
    <div class="matchup-row def"><span class="lbl">Recebe</span><span class="track"><span class="fill" data-w="${w(de)}"></span></span><b>${mult(de)}</b></div>
  </div>`;
}
// Duplo rAF: garante que o navegador pinte a barra em width:0 antes de
// aplicar o valor final, senão a transição de CSS não tem "de onde" animar.
export function animateMatchups() {
  requestAnimationFrame(() => {
    document.querySelectorAll<HTMLElement>(".matchup .fill[data-w]").forEach((el) => {
      const w = el.dataset.w!;
      requestAnimationFrame(() => {
        el.style.width = w + "%";
      });
    });
  });
}

export const potOptions = (sel: string) =>
  BASE.POT.map(
    (p: any) =>
      `<option value="${esc(p[0])}"${p[0] === sel ? " selected" : ""}>${esc(p[0])} (cura ${nf.format(p[1])})</option>`,
  ).join("");

export const TYPE_PT: Record<string, string> = {
  NORMAL: "Normal",
  FIRE: "Fogo",
  WATER: "Água",
  ELECTRIC: "Elétrico",
  GRASS: "Planta",
  ICE: "Gelo",
  FIGHTING: "Lutador",
  POISON: "Venenoso",
  GROUND: "Terrestre",
  FLYING: "Voador",
  PSYCHIC: "Psíquico",
  BUG: "Inseto",
  ROCK: "Pedra",
  GHOST: "Fantasma",
  DRAGON: "Dragão",
  DARK: "Sombrio",
  STEEL: "Aço",
  FAIRY: "Fada",
};
// Usado em todo select que lista tipos (ex.: "Tipo do Dia") para exibi-los em
// ordem alfabética (pelo nome em português), não na ordem interna do jogo.
export const typesAlpha = (types: string[]) =>
  [...types].sort((a, b) => TYPE_PT[a].localeCompare(TYPE_PT[b], "pt-BR"));
// Cores dos badges de tipo seguem a paleta oficial do jogo Pokémon (não a paleta de marca do site,
// que é para chrome/UI — ver memória "poke-idle-color-palette"), exceto Água/Gelo, que a própria
// paleta do usuário define (--color-water-ice / #38BDF8). Hex literal aqui (não var()) porque
// badgeColors() abaixo precisa calcular a luminância a partir do valor real.
export const TYPE_COLOR: Record<string, string> = {
  NORMAL: "#A8A77A",
  FIRE: "#EE8130",
  WATER: "#38BDF8",
  ELECTRIC: "#F7D02C",
  GRASS: "#7AC74C",
  ICE: "#38BDF8",
  FIGHTING: "#C22E28",
  POISON: "#A33EA1",
  GROUND: "#E2BF65",
  FLYING: "#A98FF3",
  PSYCHIC: "#F95587",
  BUG: "#A6B91A",
  ROCK: "#B6A136",
  GHOST: "#735797",
  DRAGON: "#6F35FC",
  DARK: "#705746",
  STEEL: "#B7B7CE",
  FAIRY: "#D685AD",
};
function srgbToLinear(c: number) {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}
function relLuminance(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function contrastRatio(l1: number, l2: number) {
  const hi = Math.max(l1, l2),
    lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}
function mixWithBlack(hex: string, amount: number) {
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c * (1 - amount));
  return (
    "#" +
    [r, g, b]
      .map(mix)
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
  );
}
/* Garante 4,5:1 (WCAG 2.2 AA) no texto de cada chip de tipo sem trocar a
   cor "oficial" do tipo: escolhe texto claro ou escuro (o que der mais
   contraste) e, se nem assim chegar a 4,5:1 — caso real medido com
   axe-core: Psíquico deu só 3,14:1 com texto branco —, escurece o fundo em
   passos pequenos até passar. Ver memória "poke-idle-color-palette". */
function badgeColors(hex: string) {
  const lum = relLuminance(hex);
  const white = contrastRatio(1, lum),
    dark = contrastRatio(relLuminance("#1D2433"), lum);
  if (Math.max(white, dark) >= 4.5) return { bg: hex, fg: dark >= white ? "#1D2433" : "#FFFFFF" };
  let bg = hex;
  for (let i = 0; i < 12 && contrastRatio(1, relLuminance(bg)) < 4.5; i++)
    bg = mixWithBlack(bg, 0.1);
  return { bg, fg: "#FFFFFF" };
}
export function badge(t: string) {
  const { bg, fg } = badgeColors(TYPE_COLOR[t]);
  return `<span class="tb" style="background:${bg};color:${fg}">${TYPE_PT[t]}</span>`;
}
