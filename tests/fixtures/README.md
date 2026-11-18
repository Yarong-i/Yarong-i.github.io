# Test fixtures

Fictional research records (source system `QA-FIXTURE`, dates in 2030, stocks `9000xx`) for checking the research
screens and rules. They are read only by `npm run build:fixtures` (output `dist-fixtures/`, cache
`node_modules/.astro-fixtures`). The real build reads `src/content/research` and fails if `QA-FIXTURE` appears in `dist/`.
