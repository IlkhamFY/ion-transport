# Release checklist

Snapshot counts, computed from the tables in this pack:

- Open CC BY file: 13466 rows, 1888 papers, 1880 DOIs, 1651 formulas.
- Lithium and sodium rows: 7078. Measured view: 4320. Tier A: 1407. Curated gold: 2402.
- Facts-only file: 1355 rows, 265 articles. Overlap with the open file: 0.
- Reference targets: 33 materials, 21 marked score. Model scores: none.

Included work: the open-file identity and physics corrections, the measured-view pattern summary, and the facts-only file. The facts rows are a separate table.

Left out of this pack:

- Staging extracts and private verification text.
- Source PDFs, logs, credentials, and machine paths.
- The extraction candidate that was not written into the open file.
- Supplementary-table rows that stayed in staging.
- Liverpool, Laskowski, McHaffie, DigBat / DDSE, and NIST compilations.
- Fixture leaderboard numbers.

Worker bundle, uncompressed 12547224 bytes, gzip 3807014 bytes. Limit used: 67108864 bytes uncompressed. The module embeds the site and the full tables listed in `docs/DATA.md`.

## Still to do, outside this archive

- Create the empty public repository and push this archive. The GitHub connector cannot create a repository from here.
- Upload `worker/index.mjs` with `worker/metadata.json` (`main_module` is `index.mjs`). Do not use a static-assets upload session. This archive was not deployed.
- Attach a hostname. `workers.dev` is not turned on.
- Leave the private repository's main branch unmerged until someone reviews the open pull request.
- Add model scores only after the runs finish. Do not invent them.
