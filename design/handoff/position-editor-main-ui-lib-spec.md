# Position Editor pilot — UI-Lib specification (draft)

Status: draft. Source of truth is the current React code and `src/index.css`; this specification does not alter product code.

## Naming contract

- Components: PascalCase (`Button`, `PositionSaveStatus`, `WorkspaceLocalTabs`).
- Internal layers/slots: kebab-case (`button-icon`, `side-peek-header`, `tabs-list`, `tabs-trigger`).
- Properties: lowercase. Use only `variant`, `size`, `state`, `density`, `presentation`, and `side` where the code supports the concept.
- Variables: slash hierarchy. Color variables stay under `primitive/*`, `semantic/*`, or `legacy/position-editor/*`.
- No default layer names such as `Frame 123`, `Rectangle 456`, `Component 1`, or `Group 42`.

## Foundations

Create exactly these native collections/styles. There is one mode, `Default (light)`; source code does not define dark mode.

### Colors

| Figma variable | Type | Exact value | Source CSS variable/class | Mode | Usage | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `primitive/white` | color | `#FFFFFF` | `white`, `bg-white` | Default (light) | surfaces, Tooltip foreground | shared |
| `primitive/zinc-950` | color | `#09090B` | `bg-zinc-950` | Default (light) | Tooltip surface | shared |
| `primitive/transparent` | color | `#000000` at 0% opacity | `bg-transparent` | Default (light) | Input base surface | shared |
| `semantic/background`, `semantic/card` | color | `oklch(1 0 0)` / sRGB `#FFFFFF` | `--background`, `--card` | Default (light) | canvas/surface | shared |
| `semantic/foreground`, `semantic/card-foreground`, `semantic/primary`, `semantic/secondary-foreground`, `semantic/accent-foreground` | color | `oklch(0.21 0.006 285.885)` / sRGB `#18181B` | corresponding CSS variables | Default (light) | default text | shared |
| `semantic/primary-foreground` | color | `oklch(0.985 0 0)` / sRGB `#FAFAFA` | `--primary-foreground` | Default (light) | Button/default text | shared |
| `semantic/secondary`, `semantic/muted`, `semantic/accent` | color | `oklch(0.967 0.001 286.375)` / sRGB `#F4F4F5` | corresponding CSS variables | Default (light) | secondary/muted/hover surface | shared |
| `semantic/muted-foreground` | color | `oklch(0.552 0.016 285.938)` / sRGB `#71717B` | `--muted-foreground` | Default (light) | muted text | shared |
| `semantic/border`, `semantic/input` | color | `oklch(0.92 0.004 286.32)` / sRGB `#E4E4E7` | `--border`, `--input` | Default (light) | generic/default Input border | shared |
| `semantic/ring` | color | `oklch(0.705 0.015 286.067)` / sRGB `#9F9FA9` | `--ring` | Default (light) | Input/default focus | shared |
| `legacy/position-editor/text-primary` | color | `#292524` | direct class | Default (light) | compact fields, header title | legacy |
| `legacy/position-editor/text-title` | color | `#1C1917` | direct class | Default (light) | active local tab | legacy |
| `legacy/position-editor/text-secondary` | color | `#57534D` | direct class | Default (light) | header and queue actions | legacy |
| `legacy/position-editor/text-muted` | color | `#79716B` | direct class | Default (light) | status/inactive tab | legacy |
| `legacy/position-editor/text-quiet` | color | `#A8A29E` | direct class | Default (light) | compact placeholder | legacy |
| `legacy/position-editor/border-control` | color | `#E5E5E5` | direct class | Default (light) | compact Input/TranslatableField | legacy |
| `legacy/position-editor/border-pane` | color | `#E7E5E4` | direct class | Default (light) | pane boundary/local tabs | legacy |
| `legacy/position-editor/border-focus` | color | `#C7C2BD` | direct class | Default (light) | compact focus | legacy |
| `legacy/position-editor/surface-quiet` | color | `#F5F5F4` | direct class | Default (light) | action hover | legacy |
| `legacy/position-editor/surface-canvas` | color | `#FBFBF9` | direct class | Default (light) | catalog quiet surface | legacy |
| `legacy/position-editor/saved` | color | `#56826A` | direct class | Default (light) | saved icon | legacy |
| `legacy/position-editor/save-error` | color | `#C10007` | direct class | Default (light) | error status/focus | legacy |
| `legacy/position-editor/focus-ring` | color | `#292524` at 10% opacity | direct class | Default (light) | action focus ring | legacy |
| `legacy/position-editor/primary-action`, `legacy/position-editor/primary-action-hover` | color | `#4F39F6`, `#4030D4` | `--color-indigo-600`, direct class | Default (light) | catalog CTA/hover | legacy |

Do not create a `destructive` semantic color: the Button source contains `bg-destructive`, but the current theme does not define that token.

### Spacing

| Figma variable | Type | Exact value | Source | Mode | Usage | Status |
| --- | --- | ---: | --- | --- | --- | --- |
| `spacing/2`, `spacing/4`, `spacing/6`, `spacing/8`, `spacing/10`, `spacing/12` | number | 2, 4, 6, 8, 10, 12 px | Tailwind scale; 2/6/10 are confirmed compact exceptions | Default | compact gaps/padding | shared |
| `spacing/16`, `spacing/20`, `spacing/24`, `spacing/28`, `spacing/32`, `spacing/36` | number | 16, 20, 24, 28, 32, 36 px | Tailwind scale | Default | pane, control, Button dimensions | shared |

### Radius

| Figma variable | Type | Exact value | Source CSS variable/class | Mode | Usage | Status |
| --- | --- | ---: | --- | --- | --- | --- |
| `radius/shared/sm`, `radius/shared/md`, `radius/shared/lg`, `radius/shared/xl` | number | 8, 10, 12, 16 px | `--radius-sm/md/lg/xl` | Default | shared controls | shared |
| `legacy/position-editor/radius/action-compact` | number | 7 px | `rounded-[7px]` | Default | title action | legacy |
| `legacy/position-editor/radius/badge` | number | 4 px | `rounded-[4px]` | Default | tab count | legacy |
| `legacy/position-editor/radius/pill` | number | 9999 px | `rounded-full` | Default | spinner/round shape | legacy |
| `legacy/position-editor/radius/dialog` | number | 14 px | `rounded-[14px]` | Default | dialog presentation | legacy |

### Typography — native Text Styles

Use `Inter` only, normal letter spacing / 0.

| Text style | Exact value | Source | Usage | Status |
| --- | --- | --- | --- | --- |
| `text/button/14-semibold` | Inter 14 px / 600 / 20 px | Button `text-sm font-semibold` | Button/default, lg, icon | shared |
| `text/button/12-semibold` | Inter 12 px / 600 / 16 px | Button `text-xs font-semibold` | Button/sm | shared |
| `text/body/14-regular` | Inter 14 px / 400 / 20 px | Input/default | default Input | shared |
| `text/body/13-regular` | Inter 13 px / 400 / 20 px | Input/compact, TranslatableField/plain | compact fields | shared |
| `text/title/14-semibold` | Inter 14 px / 600 / 20 px | PositionEditor header | Side Peek title | legacy |
| `text/title-edit/14-semibold` | Inter 14 px / 600 / 28 px | title input | title edit | legacy |
| `text/label/13-medium` | Inter 13 px / 500 / normal | WorkspaceLocalTabs | tabs/actions | legacy |
| `text/status/12-regular` | Inter 12 px / 400 / normal | PositionSaveStatus | autosave | legacy |
| `text/helper/12-regular` | Inter 12 px / 400 / 16 px | audited helper styles | helper/validation | legacy |
| `text/meta/11-regular` | Inter 11 px / 400 / 16 px | PositionEditor metadata | metadata | legacy |
| `text/count/10-medium` | Inter 10 px / 500 / normal | WorkspaceLocalTabs | tab count | legacy |
| `text/tooltip/12-regular` | Inter 12 px / 400 / 16 px | Tooltip `text-xs` | Tooltip | shared |

### Effects — native Effect Styles

| Effect style | Exact value | Source | Usage | Status |
| --- | --- | --- | --- | --- |
| `effect/field-shadow` | drop shadow x0 y1 blur2 spread0 `#000000` 10% | TranslatableField/plain | plain field | legacy |
| `effect/tooltip-shadow` | two shadows: x0 y20 blur25 spread-5 `#000000` 10%; x0 y8 blur10 spread-6 `#000000` 10% | Tailwind `shadow-xl` | Tooltip | shared |
| `legacy/position-editor/effect/dialog-shadow` | drop shadow x0 y14 blur40 spread0 `#1C1917` 20% | shell dialog | dialog only | legacy |

### Component-specific dimensions

| Figma variable / annotation | Type | Exact value | Source | Usage | Status |
| --- | --- | ---: | --- | --- | --- |
| `dimension/side-peek/default-compact`, `dimension/side-peek/default-wide` | number | 400 px, 470 px | shell default-width function | static pane samples | legacy |
| `dimension/side-peek/resize-min`, `dimension/side-peek/resize-max` | number | 380 px, 600 px | shell constants | component description | legacy |
| `dimension/side-peek/visible-table-min` | number | 120 px | shell constant | resize constraint description | legacy |
| `dimension/side-peek/header-height` | number | 56 px | `h-14` | SidePeekHeader | legacy |
| `dimension/side-peek/save-status-width`, `dimension/side-peek/navigation-region-width` | number | 96 px, 104 px | PositionEditor | layout stability | legacy |

## Component mapping

| Figma component | Code peer | Source path | Code variants | Figma properties | States | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Button` | `Button` | `src/components/ui/button.tsx` | variant `default/destructive/secondary/outline/ghost`; size `default/sm/lg/icon`; `asChild` behavior-only | `variant`, `size`, `state` | default, hover, focus, disabled | mapped | Keep destructive for code parity but do not invent its undefined theme color. Icon is 36×36 and needs a `button-icon` slot. |
| `Input` | `Input` | `src/components/ui/input.tsx` | size `default/compact`; native type behavior-only | `size`, `state` | default, placeholder, focus, disabled | mapped | default h40/r16 uses semantic border/ring; compact h30/r8 uses legacy control border/focus. |
| `Tooltip` | `Tooltip`/`TooltipContent` | `src/components/ui/tooltip.tsx` | side `right/left/top/bottom`; disabled; 300ms default delay | `side`, `state` | closed, open | mapped | 6 px default offset; r12; no detached trigger. |
| `PositionEditorDialogShell` | `PositionEditorDialogShell` | `src/features/storefront/catalog-workspace.tsx` | presentation `dialog/pane`; creation boolean | `presentation` | open, closing, reduced motion, resizing | mapped | show static 400/470 pane only. 380–600 range, overlay, left border/no shadow belong in description. Dialog is supported by code. |
| `SidePeekHeader` | none | inline header inside PositionEditor | no standalone export | `state` | default, long-title, navigation-visible, saving, saved, error | candidate-extraction | nest `PositionSaveStatus`, `PositionQueueControls`, collapse action, title/action trigger. |
| `PositionSaveStatus` | `PositionSaveStatus` | `src/features/storefront/catalog/editor/position-editor.tsx` | `idle/saving/saved/error` | `state` | idle, saving, saved, error | mapped / spec-only error | Error renderer exists but is unreachable; do not mark Ready for dev. |
| `WorkspaceLocalTabs` | `WorkspaceLocalTabs` | `src/features/storefront/catalog/editor/editor-tabs.tsx` | active/inactive, count/no count, optional endAction | `state` | active, inactive, hover/focus | mapped | Count: h14/r4/text 10/500. |
| `PositionQueueControls` | `PositionQueueControls` | `src/features/storefront/catalog/editor/editor-queue-controls.tsx` | previous/next available or unavailable | `state` | both enabled, previous disabled, next disabled, both disabled | mapped | 32×32. Header visibility is hover/focus-only; document it. |
| `TranslatableField` | `TranslatableField` | `src/components/workspace/translatable-field.tsx` | multiline, compact, plain, rows, autoFocus, persist | `presentation`, `density`, `state` | default, placeholder, filled, focus | mapped | `presentation=plain/surface`; `density=compact/default`; do not invent language behavior. |

## Scope exclusions

Deferred: `BasicTab`, `BasicMediaStrip`, `MediaTile`, `DiscountBlock`, `KbjuBlock`, `DescriptionRichTextEditor`, `CatalogContextMenuContent`, full `PositionEditor`, and all delivery screens.

## Figma task boundaries

- Work only on the named UI-Lib page; organize it with native Sections.
- Use native variables, text/effect styles, components/component sets, Auto Layout, and nested instances.
- Do not publish the library or mark anything Ready for dev.
- Do not create a full Tailwind palette, dark mode, whole screens, or local colors where a listed variable exists.
