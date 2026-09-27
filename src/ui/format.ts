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
// Cores dos badges de tipo seguem a paleta oficial do jogo Pokémon (não a paleta de marca do site,
// que é para chrome/UI — ver memória "poke-idle-color-palette"), exceto Água/Gelo, que a própria
// paleta do usuário define (--color-water-ice / #38BDF8). Hex literal aqui (não var()) porque
// textOn() abaixo precisa calcular a luminância a partir do valor real.
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
function textOn(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1D2433" : "#FFFFFF";
}
export function badge(t: string) {
  return `<span class="tb" style="background:${TYPE_COLOR[t]};color:${textOn(TYPE_COLOR[t])}">${TYPE_PT[t]}</span>`;
}
