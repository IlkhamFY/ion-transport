# Data

Two tables. They are not added together.

| File | Rows | What it is |
|---|---:|---|
| `ion_transport_open.csv` | 13466 | CC BY articles. Every row has licence `cc by`. |
| `ion_transport_LiNa_open.csv` | 7078 | Lithium and sodium rows from that file. Off-scope papers are left out. The site explores this table. |
| `ion_transport_facts.csv` | 1355 | Numeric facts from articles that are not CC BY (544 CC BY-NC, 535 CC BY-NC-ND, 276 all rights reserved). The file itself is CC BY 4.0. |

The measured view is the lithium and sodium rows whose paper is not citation-only: 4320 rows, 723 papers, 743 formulas. Tier A is 1407 rows from 286 papers, and every Tier A row is in that view. Curated gold in the open file is 2402 rows. An agent checked those rows. A person has not.

Facts-file overlap with the open file, on DOI plus property plus value rounded to 6 decimals: 0 rows. 231 facts rows pass the mechanical Tier A gate (`would_be_tier_a`). They stay out of Tier A.

Same formula, room-temperature conductivity, two or more papers: 11 formulas. Median standard deviation 0.36 decades. 9 formulas fall inside half a decade.

Experimental spread on the measured view, not a model error. Conductivity: median material standard deviation 0.360 decades across 11 materials and 32 papers (95% interval 0.127 to 0.474). The pooled figure is 0.571 decades and is pulled up by the two widest materials. Activation energy, EIS Arrhenius only: median material standard deviation 0.080 eV across 16 materials and 43 papers (95% interval 0.053 to 0.100).

## Columns left out

The public tables drop `snippet`, `curation_reason` and `curation_batch`. Those fields are source wording or agent notes. Every record is still present. `locator` on a facts row is a short table label such as `Table 2`.

## Licences

The open file is the CC BY slice. The facts file is released CC BY 4.0 and records the source article licence on `source_article_licence`. A compilation can still carry a sui generis database right in the EU. This note is not a statement that a journal has accepted the manuscript.

Compilations that were not copied in: the Liverpool ion-conductivity database, the Laskowski and McHaffie compilations, DigBat / DDSE, and NIST.

## Reference targets

`gold_targets.csv` lists 33 materials and the measured activation energies used as reference targets. 21 are marked `score`. There is no predicted column.
