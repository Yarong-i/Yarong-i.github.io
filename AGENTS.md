# Repository rules

- Start every task with `git status --short --branch`. Preserve all pre-existing changes; if the tree is not clean, do not overwrite or discard them.
- Use Node.js 22 (`.nvmrc`). The supported range is `>=22 <24`; do not validate this repository with Node 24.
- Do not rewrite existing writing/project prose unless the user explicitly asks. Keep UTF-8 and do not “repair” Korean text based only on mojibake shown by a terminal.
- Never use `git add .` or `git clean`. Stage only explicitly reviewed paths. Never push unless the user explicitly requests it.
- Never commit `.env*`, credentials, tokens, account/bank data, server details, `node_modules/`, `dist/`, `.astro/`, logs, ZIP/PDF artifacts, screenshots, or generated images.
- Keep the "black and light" theme: use the tokens in `src/styles/global.css` (deep black, white and grey type, a white light with a faint blue tint shown only as soft glow); no accent colours, primary buttons are white with black text; status colours always come with a text label. No glow, purple, excessive gradients, rounded-card repetition, decorative particles, heavy shadows, continuously moving backgrounds, fake live data, or global custom cursors.
- Draft content is not secret: `draft: true` removes it from the built site, but a committed draft remains readable in the public repository.
- Project pages are generated for every project, including `private: true`; that flag is a label, not an access control.
- Before handoff run, with Node 22: `npm run astro check`, `npm run build`, and `git diff --check`. Also review `git diff` and `git status --short`.
- Do not commit or push unless the user explicitly asks.
