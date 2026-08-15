# Position Editor pilot — Block 2B systemize report

Status: partial. This report records the requested shadcncraft rebase attempt and does not cover Block 3 or delivery screens.

## Why Block 2 was rejected

Block 2 proved that a UI-Lib could be created, but it did not establish a safe reusable base: the primitives were hand-assembled, a legacy color dump and component-specific text styles became foundations, and icon slots were library-dependent rather than real Phosphor instances. The existing attempt remains preserved as an experiment, not as the target system.

## New architecture

The intended system is shadcncraft primitives plus a minimal Tasko theme: a small zinc/indigo/red/amber/green-or-emerald primitive palette, shadcn semantic aliases, one light mode, spacing from 4 to 48 px, no legacy radius foundation, and at most eight shared Inter text styles. Tasko-specific product patterns are to compose those primitives through Auto Layout.

## shadcncraft usage

The plugin was found, opened, and run through the authenticated Figma UI. Its preset surface appeared, but no preset was applied: the accessible controls are nested in the plugin iframe and cannot be reliably actuated by the available UI automation. No manual reconstruction was used to simulate shadcncraft.

## Plugin automation result

Partially available, then blocked. The initial tab-list check only showed tabs already claimed by the task; a later user-tab claim correctly exposed the existing authenticated `UI Lib – Figma` tab. The Tools search found the official shadcncraft plugin and its `Run` action opened the preset UI. The required preset controls then rendered inside nested plugin iframes: the first Base Color selector rejected a pointer click, and a keyboard Enter attempt could not transfer focus. These were the two permitted control attempts, so plugin automation stopped. Manual preset setup is recommended.

## Phosphor integration

Not applied. No substitute glyphs, text arrows, placeholders, or manually drawn icons were created.

## Foundations result

No Figma changes. The desired primitive-plus-semantic architecture has been documented, but it was not created because the shadcncraft preset cannot be configured through the required UI automation.

## Primitive reuse

No Figma changes. Button, Input, and Tooltip were not rebuilt, altered, or replaced.

## Product patterns result

No new Figma Agent task was sent. Task 1 is intentionally deferred because the required Foundations and shadcncraft primitives were not prepared.

## Figma Agent performance

No Agent tasks were started and no completion status was checked. The stop occurred before an Agent could be opened through the required Figma UI.

## Direct MCP cleanup

None. Direct Figma MCP and all other fallbacks were deliberately not used.

## Quality score

| Criterion | Score (0–2) | Evidence |
| --- | ---: | --- |
| Foundation simplicity | 0 | Target documented, not created. |
| shadcncraft reuse | 0 | Plugin launched, but its preset controls could not be automated. |
| semantic token quality | 0 | Target documented, not created. |
| typography simplicity | 0 | Target documented, not created. |
| Phosphor icon usage | 0 | No Figma work performed. |
| primitive reuse | 0 | No Figma work performed. |
| component parity | 1 | Verified source mapping remains documented. |
| Auto Layout | 0 | No new components created. |
| instance reuse | 0 | No new components created. |
| scope discipline | 2 | Stopped without a prohibited fallback or out-of-scope work. |

Total: 3/20.

## Remaining debt

- The Block 2 generated attempt must still be archived to `99 · Deprecated` when Figma UI control is available.
- Configure and apply the shadcncraft preset manually in the currently open Figma UI, then resume before any primitive reuse or product-pattern Agent task.
- Existing legacy color collections, component-specific type styles, and legacy radius tokens remain historical evidence, not a target foundation.
- Phosphor library availability and nested-instance usage still need verification in Figma.

## Recommendation for Block 3

Do not proceed to Block 3. First apply the shadcncraft preset manually in the currently open Figma UI (Tasko-compatible neutral/zinc base, indigo theme, Inter, and Phosphor if offered), then resume to archive the Block 2 attempt, apply the documented Tasko theme, and run the bounded two-task product-pattern sequence.

## Timeline and metrics

| Event | Local time (Asia/Almaty) | Observation |
| --- | --- | --- |
| T0 — start | 2026-08-15 21:38:27 | test and local documentation work began |
| T1 — shadcn/plugin setup complete | unavailable | no authenticated Figma tab was exposed to automation |
| T2 — foundations complete | unavailable | not started |
| T3 — primitives reuse complete | unavailable | not started |
| T4 — Agent Task 1 sent | unavailable | not sent |
| T5 — Agent Task 1 complete/stopped | unavailable | not started |
| T6 — Task 1 QA complete | unavailable | no task to check |
| T7 — Agent Task 2 sent | unavailable | not sent |
| T8 — Agent Task 2 complete/stopped | unavailable | not started |
| T9 — final QA complete | unavailable | Figma result unavailable |
| T10 — finished | 2026-08-15 21:41:08 | report and local-document verification complete |
| T11 — authenticated tab recovered | unavailable | exact resume time was not sampled; the existing `UI Lib – Figma` tab was claimed without opening a replacement |
| T12 — shadcncraft opened | unavailable | plugin was found in Figma Tools and its preset UI rendered |
| T13 — plugin automation stopped | 2026-08-15 22:00:23 | two direct preset-control attempts failed in nested plugin iframes |

- Initial-run wall-clock: 2m 41s; resumed-run duration was not sampled end-to-end.
- Figma Agent active time: 0.
- Passive waiting: 0.
- Status checks: 0.
- Agent prompts: 0.
- Corrective prompts: 0.
- Direct MCP fixes: 0.
- Manual user interventions: 0 performed; one manual plugin-preset setup is recommended.
