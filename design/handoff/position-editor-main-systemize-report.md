# Position Editor pilot — Block 2 systemize report

Status: complete. This report records the UI-Lib pilot only; it does not cover delivery screens.

## Scope

- UI-Lib pages: `01 · Foundations`, `02 · Primitives`, `03 · Product patterns`.
- Primitives: `Button`, `Input`, `Tooltip`.
- Product patterns: `PositionEditorDialogShell`, `SidePeekHeader`, `PositionSaveStatus`, `WorkspaceLocalTabs`, `PositionQueueControls`, `TranslatableField`.
- Excluded: full Position Editor, BasicTab, media, discount, nutrition, rich text, CatalogContextMenuContent, delivery screens.

## Code ↔ Figma mapping

The source mapping, exact token values, states, and candidate-extraction status are maintained in `position-editor-main-ui-lib-spec.md` and the normalized draft manifest. `SidePeekHeader` has no code export: its source is the inline header inside `PositionEditor` and its mapping status is `candidate-extraction`.

## Known legacy tokens

The current Side Peek uses direct values including `#292524`, `#57534D`, `#79716B`, `#E5E5E5`, `#E7E5E4`, `#C7C2BD`, `#F5F5F4`, `#56826A`, and `#C10007`. These remain under `legacy/position-editor/*`; no product-code color migration is part of this block.

## Deferred components

`BasicTab`, `BasicMediaStrip`, `MediaTile`, `DiscountBlock`, `KbjuBlock`, `DescriptionRichTextEditor`, `CatalogContextMenuContent`, and the full `PositionEditor` are deliberately out of scope.

## Timeline, prompts, QA, and metrics

All Figma Agent prompts were submitted with Enter. Direct Figma editing was used only in the explicitly listed fallbacks.

| Event | Local time (Asia/Almaty) | Observation |
| --- | --- | --- |
| T0 — Block 2 started | 2026-08-15 19:21:51 | local work began |
| T1 — repository inspection completed | 19:23:45.939 | source audit complete |
| T2 — Foundations specification ready | 19:28:29.846 | exact tables prepared |
| T3 — Foundations prompt submitted | 19:29:36.685 | Enter |
| T4 / T5 — Foundations started / parallel work started | 19:29:56.868 | UI reported started |
| T6 — first Foundations check | 19:30:20.390 | after manifest work |
| T7 — Foundations complete | 19:34:09.179 | UI reported finished |
| T8 — Foundations QA complete | 19:36:18.089 | UI/variable verification |
| T9 / T10 — Primitives retry submitted / started | 19:37:37.886 | first transport attempt had failed; retry used Enter |
| T11 — first Primitives check | 19:38:03.179 | Agent still planning |
| T12 / T13 — Primitives Agent completion / Agent QA | unavailable | Agent never completed; direct fallback completed the page (exact fallback timestamps were not sampled) |
| T14 — Product patterns prompt submitted | 19:55:02.592 | Enter |
| T15 — Product patterns started | exact timestamp unavailable | same UI operation displayed `Agent task started` |
| T16 — first Product patterns check | 19:55:55.389 | after useful local work |
| T17 — Product patterns initial run complete | 20:01:23.015 | UI reported finished |
| Product corrective prompt submitted | 20:02:10.978 | Enter; one corrective prompt for this task |
| Product correction complete | 20:05:22.778 | UI reported finished |
| T18 — final UI-Lib QA complete | 20:07:35.260 | structure plus three screenshots |
| T19 — manifest and documents verified | 20:08:32 | YAML and diff-integrity checks passed |
| T20 — Block 2 complete | 20:08:32 | ready for local checkpoint commit |

Submit observation: Foundations started from the first Enter submission. Primitives first showed `Couldn’t connect to Figma` (request ID `srid_VF7GAVYCVVX0J6FWXYS8KF9JR`) after the prompt appeared in history. The permitted single re-entry of the identical prompt through Enter then produced `Agent task started`. This is a transport retry, not a corrective prompt.

Primitives failure observation: the successful-retry task remained at Foundations inspection/planning for 4m17s and created no canvas objects. It was stopped and received one corrective prompt through Enter that instructs immediate creation on `02 · Primitives`; no further corrective prompt is permitted for this task.

Primitives fallback observation: the corrective task also remained in planning and was stopped without canvas changes. The minimal direct fallback then created only the three required native Sections and component sets on `02 · Primitives`. The initial fallback script failed atomically before creating anything because a hug-sizing property was applied before its text node joined an Auto Layout parent; the corrected retry created the intended objects.

Foundation audit note: the Agent-created variables have the expected names and values, but the native inspection reports `ALL_SCOPES` and no WEB code syntax on the collections. This is a non-blocking library-hygiene defect inherited from the successful Agent run; it was not broadened into the Primitives fallback.

### Foundations QA checklist

- Verify native color and number variable collections, one `Default (light)` mode, and no dark mode.
- Verify the named `Colors`, `Typography`, `Spacing`, `Radius`, `Effects`, and `Component dimensions` native Sections.
- Verify only Inter text styles and the three confirmed effect styles.
- Verify semantic and `legacy/position-editor/*` tokens remain separate; no component set belongs on this page.
- Verify exact values from the UI-Lib specification, no full Tailwind palette, no default layers, and no changes outside `01 · Foundations`.

Foundations result: passed by UI inspection. The page contains six selected native Sections (`Colors`, `Typography`, `Spacing`, `Radius`, `Effects`, `Component dimensions`); the Variables UI shows six native collections with 3 primitive, 15 semantic, 15 legacy/position-editor, 12 spacing, 8 radius, and 8 dimension variables. The displayed semantic values include `#FFFFFF`, `#18181B`, `#FAFAFA`, `#F4F4F5`, `#E4E4E7`, and `#9F9FA9`. The Agent reported 12 Inter Text Styles, 3 Effect Styles, Auto Layout specimen rows, no components, and no other-page edits.

### Primitives task boundary

The next task is limited to `Button`, `Input`, and `Tooltip` on `02 · Primitives`. It must use the Foundations variables/styles, native component sets, Auto Layout, exact source variants, named icon slots, and no product compositions. `Button` retains the code's `destructive` variant but must not invent a missing theme color.

Source parity to verify:

- `Button`: variants `default`, `destructive`, `secondary`, `outline`, `ghost`; sizes `default` (h40), `sm` (h32), `lg` (h44), and `icon` (36×36). Base radius is 16 px; `sm` radius is 12 px.
- `Input`: `default` h40/r16 with semantic `input` and `ring`; `compact` h30/r8 with `legacy/position-editor/border-control` and `border-focus`.
- `Tooltip`: sides `right`, `left`, `top`, `bottom`; 6 px side offset; zinc-950 surface; Inter 12 px; 12 px radius; confirmed two-shadow effect.

### Primitives fallback result

- `Button` is a native Auto Layout component set with 20 `variant × size` combinations: `default`, `destructive`, `secondary`, `outline`, `ghost` × `default`, `sm`, `lg`, `icon`. It exposes an editable `label`; its `button-icon` slot is named and documented as needing an icon library. Existing semantic/legacy colors, spacing, radii, and text styles are bound rather than re-created.
- `Input` is a native Auto Layout component set with `size=default|compact` and editable `value`. Its 40 px default and 30 px compact controls use the source-confirmed semantic and legacy border/text tokens.
- `Tooltip` is a native Auto Layout component set with `side=top|right|bottom|left` and editable `content`, using the existing tooltip text and effect styles.
- Native canvas inspection shows exactly the three Sections `Button`, `Input`, and `Tooltip` on `02 · Primitives`; no product pattern or screen was added. The page screenshot shows an orderly non-overlapping layout, readable text, correct Button size tiers, Input border treatment, and tooltip shadows.
- CSS-only hover/focus/disabled behavior is recorded in descriptions instead of added as unsupported React axes. This preserves source parity but leaves interaction-state visual specimens for a future iteration.

### Product-pattern task boundary

`03 · Product patterns` is limited to six components. The shell has `presentation=pane` samples at 400 px and 470 px plus `presentation=dialog`, a 380–600 px description, overlay behavior, and a left border rather than shadow. The candidate `SidePeekHeader` composes nested save status and queue controls; its navigation is hover/focus-only. `PositionSaveStatus.error` is a visible `spec-only` renderer that remains unreachable in the prototype. No full Position Editor screen or deferred field/domain blocks belong in this task.

### Product patterns result

The initial Agent run created all six scoped Sections and component sets. Independent QA found three source-parity defects: `TranslatableField` used an invented `translation` axis, `WorkspaceLocalTabs` exposed `activity` rather than `active`, and `PositionEditorDialogShell` exposed a width axis rather than its source `presentation=dialog|pane` property. One Agent corrective prompt fixed those defects, corrected two source paths in descriptions, and added 400 px / 470 px pane examples as documentation rather than variants.

The corrective run left one obsolete, translation-axis `TranslatableField` component set. Because the one corrective prompt was exhausted, the minimal direct fallback removed only its confirmed node ID `18:87`; the correct set `18:184` remained. Final QA confirms exactly six Sections and six component sets, zero `translation` axes, no duplicate component-set names, no default layer names, and no raw unbound fills/strokes in the created components.

Final product-pattern inventory:

- `PositionSaveStatus`: `status=idle|saving|saved|error`; error is documented spec-only.
- `PositionQueueControls`: four enabled/disabled combinations.
- `WorkspaceLocalTabs`: `active`, `count`, and `endAction` axes.
- `TranslatableField`: `multiline`, `compact`, and `plain` actual props; `rows` remains a runtime description.
- `SidePeekHeader`: six documented examples with nested status and queue-control instances.
- `PositionEditorDialogShell`: `presentation=pane|dialog`, nested header, and separate 400 px / 470 px pane examples.

### Quality-score rubric

Each final category is scored 0 (not done/seriously wrong), 1 (partial), or 2 (correct): token correctness, variable usage, code-variant parity, Auto Layout quality, component-property quality, naming, layer cleanliness, instance reuse, visual fidelity, scope discipline, and documentation. The report must retain both the raw Agent score and the final post-correction/fallback score.

### Figma QA ledger

| Area | Required evidence | Result |
| --- | --- | --- |
| Foundations | native variables, Text Styles, Effect Styles, six native Sections, exact token segregation | passed with variable-scope/code-syntax hygiene note |
| Primitives | exactly three native component sets, supported properties, variables/styles, Auto Layout | passed by direct fallback after Agent failure |
| Product patterns | six scoped native components, nested instances, descriptions, no full screen | passed after one Agent correction and one-ID direct cleanup |
| Scope | no delivery-file edits, no publishing, no Ready for dev, no deferred components | passed |

### Performance metrics

- Figma Agent prompts: 6 (all via Enter).
- Corrective prompts: 2 (one Primitives, one Product patterns).
- Agent tasks completed: 2 of 3 delegated creation tasks (Foundations; Product patterns after correction). Primitives never completed.
- Direct fallbacks: 2 distinct actions: Primitives construction; removal of obsolete Product-pattern node `18:87`.
- Manual user interventions: 0.
- Observed Figma Agent time: at least 18m01s for completed/stopped runs with known UI durations; the first Primitives transport failure is excluded.
- Passive waiting measured explicitly: 10m50.069s.
- Status checks: 27.
- Exact useful-work duration and exact direct-fallback duration were not sampled, so they are intentionally not estimated.

### Quality score

| Criterion | Raw Agent | Final | Notes |
| --- | ---: | ---: | --- |
| Token correctness | 2 | 2 | exact source values verified |
| Variable usage | 1 | 1 | bindings are used; Foundation variable scopes/code syntax remain Agent hygiene debt |
| Code variant parity | 0 | 1 | Primitives Agent failed; Product correction fixed source axes; CSS-only interaction states are documented |
| Auto Layout quality | 1 | 2 | final components use Auto Layout and screenshot review shows no overlaps |
| Component-property quality | 0 | 1 | source axes exposed; some HTML/CSS-only behaviors remain descriptions |
| Naming | 2 | 2 | PascalCase sets and clean internal naming |
| Layer cleanliness | 2 | 2 | no default names found |
| Instance reuse | 2 | 2 | required nested Product-pattern instances present |
| Visual fidelity | 1 | 1 | scoped structural specimens are readable; icon slots remain deliberately library-dependent |
| Scope discipline | 2 | 2 | no delivery screens or deferred blocks |
| Documentation | 2 | 2 | spec, manifest, and descriptions completed |

Raw Figma Agent score: 15/22. Final score after correction/fallback: 18/22.

## Open questions for Handoff

- Is save error intended to become reachable in the prototype?
- Should Side Peek navigation remain hover/focus-only at compact widths?
- Should the KБЖУ grid become container-aware before it enters any library work?
