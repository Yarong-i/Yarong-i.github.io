# Repository rules

- Start every task with `git status --short --branch`. Preserve all pre-existing changes; if the tree is not clean, do not overwrite or discard them.
- Use Node.js 22 (`.nvmrc`). The supported range is `>=22 <24`; do not validate this repository with Node 24.
- Do not rewrite existing writing/project prose unless the user explicitly asks. Keep UTF-8 and do not “repair” Korean text based only on mojibake shown by a terminal.
- Never use `git add .` or `git clean`. Stage only explicitly reviewed paths. Never push unless the user explicitly requests it.
- Never commit `.env*`, credentials, tokens, account/bank data, server details, `node_modules/`, `dist/`, `.astro/`, logs, ZIP/PDF artifacts, screenshots, or generated images.
  Exception: the owner's public portfolio PDF at `public/files/yarong-portfolio.pdf` (replaced in place; see `docs/operations.md`).
- Theme: a black ground with white and grey type, plus the showcase accents cyan, violet and gold (tokens `--cyan`, `--violet`, `--gold` in `src/styles/global.css`). Real game/product images keep their own colours; the reaction test uses red/green signal colours with text labels; status colours always come with a text label. Primary buttons are white with black text.
  - Glow, light gradients and the slow drifting light are concentrated on Home's hero and featured projects (the bot band gets a quiet edge). Research tables, lists and text pages stay calm; do not repeat the same glow on every section.
  - Text contrast never depends on an accent or an effect. Motion is short and soft; under `prefers-reduced-motion` nothing moves and every section is complete; phones get lighter effects and need no hover.
  - Never: flashing, auto-scroll or scroll hijacking, cursor-following decoration or global custom cursors, decorative particles, fake live data, or mock-up game/Discord screens presented as real.
- Draft content is not secret: `draft: true` removes it from the built site, but a committed draft remains readable in the public repository.
- Project pages are generated for every project, including `private: true`; that flag is a label, not an access control.
- Before handoff run, with Node 22: `npm run astro check`, `npm run build`, and `git diff --check`. Also review `git diff` and `git status --short`.
- Do not commit or push unless the user explicitly asks.
- Never invent stock picks, scores, returns, update dates or user counts. Research records live in the public data repository `Yarong-i/yarong-research-data` (the research server's export, merged by that repository's workflow), not in this repository; `npm run research:pull` copies them locally. See `docs/adding-research.md` and `docs/research-auto-publish.md`.
- Never commit server-side publish files, server addresses or internal paths (`deploy/` is ignored).
- `media` images must be real screenshots or official key art of the project, never mock-ups.
