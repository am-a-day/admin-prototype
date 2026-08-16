# Tasko UI theme sync

Date: 2026-08-16
Scope: published `Tasko UI` Figma library only. No Delivery changes and no product-code changes.

## Source of truth

- `src/index.css` provides the active light semantic theme: `#FFFFFF`, `#18181B`, `#F4F4F5`, `#71717B`, `#E4E4E7`, and `#9F9FA9`.
- `--color-indigo-600` and the current primary actions use Tasko indigo `#4F39F6` with white foregrounds.
- The active product UI font is Inter. The existing Figma UI text styles already use Inter; the separate `code` style remains intentionally Space Mono.

## Audit and mapping

The existing `Shadcn Theme` collection has Light and Dark modes. The prototype provides active light-theme values only, so this sync changes Light only. All existing semantic variables were direct values rather than aliases; no primitive was needed or added.

| Figma semantic variable | Light before | Light after |
| --- | --- | --- |
| `foreground`, `card-foreground` | `#171717` | `#18181B` |
| `card` | `#FEFEFC` | `#FFFFFF` |
| `border` | `#E5E5E5` | `#E4E4E7` |
| `muted-foreground` | `#6B6C67` | `#71717B` |
| `muted` | `#F4F5F1` | `#F4F4F5` |
| `primary` | `#0070F3` | `#4F39F6` |
| `ring` | `#0070F3` | `#9F9FA9` |
| `accent` | `#E8EAE4` | `#F4F4F5` |
| `accent-foreground`, `secondary-foreground` | `#171717` | `#18181B` |
| `secondary` | `#FEFEFC` | `#F4F4F5` |
| `input` | `#FEFEFC` at 80% | `#E4E4E7` |
| `primary/10` through `primary/90` | `#0070F3` at existing alpha | `#4F39F6` at the same alpha |

`background` and `primary-foreground` already matched the prototype and were retained. `popover`, `popover-foreground`, `destructive`, `destructive-foreground`, `success`, and `warning` have no active counterpart in the product theme, so they were deliberately not changed. Dark was deliberately not changed.

## Figma changes

- Updated 22 existing Light-mode semantic variables in `Shadcn Theme`.
- Added no primitive variables, collections, modes, typography styles, components, pages, frames, or examples.
- Manually modified no component nodes.
- No raw component-color overrides were introduced. The pre-existing Button, Input, and Tabs component sets each contain one raw solid paint; these were not edited.

## QA

Programmatic checks passed:

- 13 base semantics and 9 `primary/*` opacity semantics resolve to their planned Light values.
- Sample Dark values for `primary`, `ring`, `primary/10`, and `primary/80` are unchanged.
- Button (`15538:96596`), Input (`1243:2056`), and Tabs (`13748:2243`) remain native component sets with their original properties and semantic variable bindings.
- Button uses `primary`, `primary-foreground`, and `primary/80`; Input uses `border`, `input`, `primary`, and `primary/10`; Tabs uses `card`, `muted`, `border`, and `primary`.
- Existing UI typography styles remain Inter; no duplicate text styles or components were created.

Visual checks passed on existing canonical components:

- Button: default, hover, outline/ghost, loading, and destructive states retain their structures; primary states are Tasko indigo.
- Input: default, focus, invalid, and disabled states retain their structures; focus now uses the indigo theme family.
- Tabs: default and line variants retain their layout; active underline is Tasko indigo.

## Follow-up

**PUBLISH REQUIRED** — publish the updated `Tasko UI` library so consuming files receive the Light theme sync.
