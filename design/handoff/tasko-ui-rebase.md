# Canonical base

- Canonical upstream: [Shadcn/ui Figma Library — UI Kit, Components, Design System (2026)](https://www.figma.com/design/ov1ltJWzueueEUHShcQAmk/Shadcn-ui-Figma-Library-%E2%80%93-UI-Kit--Components--Design-System--2026---Community-).
- Tasko duplicate: [Tasko UI](https://www.figma.com/design/VjHj3vPArq0S7aBAzWipqg/Tasko-UI).
- The duplicate preserves the upstream native variables, modes, styles, component sets, properties, nested instances, Auto Layout, and icon relationships. The earlier `UI-Lib` file remains an untouched historical experiment.

## Adopted without changes

- Canonical primitive palette, semantic Shadcn theme hierarchy, Tailwind colour modes, spacing, radius, effect styles, and shared typography scale.
- Button, Textarea, Tooltip, Tabs, Popover, Dropdown Menu, Sheet, Dialog, Alert Dialog, Checkbox, Radio Group, Select/Field equivalents, Table, Sidebar, and other standard Shadcn components.
- Canonical Phosphor icon system and its nested component instances.

## Adopted with Tasko delta

| Tasko code | Canonical Figma component | Confirmed delta |
| --- | --- | --- |
| `Button` | `Button` | Tasko-supported subset: `default/destructive/secondary/outline/ghost` and `default/sm/lg/icon`; do not clone the kit set. |
| `Input` | `Input` | Code has a confirmed compact density. Add only that density if it is absent from the canonical component. |
| `Tooltip` | `Tooltip` | Four placement directions are code behaviour/configuration; no custom Tasko Tooltip. |
| `PositionEditorDialogShell` | `Sheet` / `Dialog` / `Resizable` patterns | Compose only after the simple patterns pass QA; preserve 400/470 px examples and document, rather than tokenise, resize constraints. |

Tasko uses Inter. Its base semantic `primary` remains neutral-dark in `src/index.css`, while the current catalog CTA uses the explicit `--color-indigo-600: #4f39f6`; the canonical kit's primitive palette and semantic hierarchy are therefore retained unchanged in this block. Deciding whether indigo should become the shared semantic primary is a theme migration decision, not a reason to fork the canonical architecture. Direct Position Editor hex values and local radius exceptions are migration debt, not new library tokens.

## Tasko-specific patterns

- `PositionSaveStatus` — code peer `src/features/storefront/catalog/editor/position-editor.tsx`; `error` is spec-only.
- `PositionQueueControls` — `src/features/storefront/catalog/editor/editor-queue-controls.tsx`; four availability combinations.
- `WorkspaceLocalTabs` — `src/features/storefront/catalog/editor/editor-tabs.tsx`; active/inactive, optional count, optional end action.
- `TranslatableField` — `src/components/workspace/translatable-field.tsx`; actual `multiline`, `compact`, `plain`, and `rows` behaviour only.
- Deferred until Task 1 QA: `SidePeekHeader` and `PositionEditorDialogShell`.

The first Agent task for the four simple patterns was accepted through Enter but did not yield a verifiable completed canvas result within its four-minute limit. No correction was sent and no Task 2 composition was started. Treat every item above as an architecture/mapping destination, not as a completed Figma component, until a future bounded run visibly completes it.

## Prototype debt NOT migrated into UI-Lib

- `legacy/position-editor/*` collections and component-specific colour/radius token dumps.
- Direct hex colours, including warm-zinc side-peek surfaces and local success/error shades.
- Component-specific typography such as `title-edit`, `status`, `meta`, `count`, and `tooltip`.
- One-off 7/13/14 px radii and compact-spacing exceptions as global foundations.
- CSS-only interaction states, runtime persistence, resize ranges, and unavailable save-error behaviour as Figma component axes.

## Code ↔ Figma mapping

| Code peer | Figma destination | Mapping state |
| --- | --- | --- |
| `Button` | canonical `Button` | adopted; subset documented |
| `Input` | canonical `Input` | adopted; compact delta to verify |
| `Tooltip` | canonical `Tooltip` | adopted unchanged |
| `PositionSaveStatus` | Tasko · Product patterns | submitted; not verified created |
| `PositionQueueControls` | Tasko · Product patterns | submitted; not verified created |
| `WorkspaceLocalTabs` | Tasko · Product patterns | submitted; not verified created |
| `TranslatableField` | Tasko · Product patterns | submitted; not verified created |
| `SidePeekHeader` | Tasko · Product patterns | not started; candidate extraction |
| `PositionEditorDialogShell` | Tasko · Product patterns | not started; compose canonical Sheet/Dialog/Resizable patterns |

## Open questions

- Does the canonical Input set already have a compact density that meets the 30 px Tasko use case?
- Which existing semantic alias should own the Tasko indigo action accent without creating a parallel theme?
- Should the canonical text-style family be changed to Inter after resolving Figma's current Missing Fonts indicator, or is Inter already available in the shared style implementation?
- Should Side Peek navigation remain hover/focus-only at compact widths?
