import { defineConfig } from "vite";

// Publicado em GitHub Pages num subcaminho (lucas-kiozy.github.io/pokeidleworldhunt/),
// não na raiz do domínio — por isso o base abaixo. Rodar `npm run dev`/`vite build`
// localmente continua funcionando normalmente com esse mesmo caminho.
export default defineConfig({
  base: "/pokeidleworldhunt/",
});
