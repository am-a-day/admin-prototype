# Scope

Block 3 delivers the production-oriented Figma handoff for Position Editor → Side Peek → «Основное» in [Delivery · Catalog](https://www.figma.com/design/vJsF007tTNiL73S40cW8NU/NEW-%D0%90%D0%90%D0%94%D0%9C%D0%98%D0%9D%D0%9A%D0%90?node-id=2307-90). Product code was not changed and Figma Agent was not used.

## Cross-file preflight

`Tasko UI` is published and enabled as a Delivery team library. Before the handoff build, a temporary native `Library preflight` Section with exactly one Tasko UI `Button` was created and then removed.

- node type: `INSTANCE`;
- main component set: remote `Tasko UI / Button`;
- detached: no;
- component properties: available;
- semantic bindings: preserved;
- local Button copy: not created.

## Delivery canvas

All four pre-existing native Sections are now populated:

| Section | Root | Result |
| --- | --- | --- |
| `Position editor · Context` (`2307:91`) | `01 · Default editing` (`2328:92`) | Full 1440×900 Catalog with 470 px right-overlay Side Peek. |
| `Position editor · Main flow` (`2307:92`) | `Position editor · Main flow` (`2328:93`) | Catalog → opened → editing → saving → saved. |
| `Position editor · States` (`2307:93`) | `Position editor · States` (`2328:94`) | Required isolated states and KBJU confirmation. |
| `Position editor · Responsive` (`2307:94`) | `Position editor · Responsive` (`2328:95`) | 1440×900 / 470 and 1280×800 / 400 coverage. |

## Canonical components reused

The final programmatic audit found 114 live remote Tasko UI instances and zero detached instances. The build includes 5 Buttons, 56 Inputs, 4 Textareas, 18 WorkspaceLocalTabs instances, 2 Spinners, a canonical Alert Dialog, and nested Phosphor icon instances. All local frames and text with fills or strokes use semantic variable bindings; no unbound local paint was found.

`WorkspaceLocalTabs` was quality-checked and reused: its active/inactive, count, and end-action properties match the current React structure. The historical `PositionSaveStatus` was inspected but not reused: it exposes four states yet has no exposed semantic bindings. Saving, saved, and spec-only error are therefore local state compositions built from canonical Spinner / Phosphor instances and semantic variables. No new Tasko-specific component was created.

## Local compositions

The Side Peek shell/header, Catalog context, media strip, discount block, description block, KBJU grid, flow cards, and isolated state cards are local feature compositions. Canonical controls are kept as live instances; no local replacement was made for Button, Input, Textarea, Alert Dialog, Spinner, or icons.

## States and responsive behavior

Rendered states: default, saving, saved, validation error, long title, long description/content, and `Save error · spec only`. The save-error renderer is documented as unreachable in the current prototype. Create mode is called out as a separate entry state with the same form composition rather than a duplicate full screen.

The Figma-approved KBJU layout is 2×2 at both 400 px and 470 px Side Peek widths; four columns may appear only around a pane width of 560 px or more. The 400 px responsive sample retains usable content, title truncation, media, form controls, long description, vertical scroll ownership, and 2×2 KBJU.

## Prototype ↔ Figma differences and implementation debt

- Autosave status is rendered with normalized semantic variables; current code still contains direct color values.
- Current code selects the KBJU four-column grid from viewport `lg`, not actual pane width. It needs a pane-width-based update.
- Filled KBJU deletion uses `window.confirm` in code; the handoff uses canonical Alert Dialog.
- The save-error state remains specification-only and must not be treated as Ready for dev.

## QA

Visual QA covered Context, Main flow, States, Responsive, and a close-up of the saving state. Four visual defects were found and fixed: wrapped saving copy, long-title overlap, spec-only error overlap, and Alert Dialog action localization.

Final structural QA verified:

- all four target Sections contain exactly one named handoff root;
- all 114 component instances remain remote and none is detached;
- cross-file Button, Input, Textarea, WorkspaceLocalTabs, Spinner, and Alert Dialog relationships are present;
- zero local fill/stroke bindings are missing.

## Completion boundary

This is a Block 3 handoff draft only. Block 4 Verify was not started, and nothing is marked Ready for dev.
