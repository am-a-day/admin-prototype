# Tasko UI component parity

Date: 2026-08-16

## Source of truth

- Shared Input: `src/components/ui/input.tsx`
- Editor controls: `src/features/storefront/catalog/editor/position-editor.tsx`
- Workspace tabs: `src/features/storefront/catalog/editor/editor-tabs.tsx`
- Visual reference: Delivery node `2367:16897`

## Findings and decisions

### Input — architecture A

The shared React `Input` is not the white 36 px Position Editor field. Its API has:

- `Size=Default`: 40 px, transparent surface, 12 px radius, 12 px horizontal padding;
- `Size=Compact`: 30 px, transparent surface, 8 px radius, 8 px horizontal padding.

The existing published Figma `Input` component set was updated rather than duplicated:

- added `Size=Default|Compact` to the existing `State`, `Status`, and `hasValue?` variants;
- preserved `Placeholder` and `Value` text properties;
- removed the incorrect gray input fill from non-disabled states;
- retained semantic input, foreground, muted, destructive, and ring bindings.

The 36 px white shell in Position Editor is intentionally not modelled by the shared Input primitive.

### EditorField — architecture B

`EditorField` and `DiscountInputField` are Position Editor compositions, not usages of a generic Input Group or Select:

- price is numeric input + suffix;
- volume is numeric input + unit trigger with `CaretDown`;
- compact discount fields support disabled state.

Created one reusable Tasko UI component set: `EditorField`.

- variants: `Size=Editor|Compact`, `End=Suffix|Unit`, `State=Default|Disabled`;
- text properties: `Label`, `Value`, `Suffix`, `Unit`;
- `Editor` uses a white 36 px semantic shell; `Compact` uses 30 px;
- `Unit` reuses the existing Tasko UI Phosphor `CaretDown` component instance at 13 px;
- no currency is baked into the component API.

### WorkspaceLocalTabs — architecture C

The existing product component was corrected to match
`editor-tabs.tsx`:

- removed pill fill;
- active: 13 px medium foreground label with a 1 px `foreground` underline;
- inactive: 13 px muted label with a 1 px semantic `border` baseline;
- retained `Label`, optional `Count`, and optional `EndAction` component properties;
- retained the nested reusable Badge and end-action instances rather than changing their source components.

## Intentionally unchanged

- generic `TabsTrigger`;
- generic `Select`;
- `Input-Addon` (it is the existing cursor component, not an addon/group API);
- `TranslatableField`;
- Delivery pilot/capture and all product code;
- global spacing, typography scale, and primary theme.

## QA

An isolated temporary Tasko UI QA frame used live instances for `Input`, price,
volume, and active/inactive tabs, then was deleted.

- Price and volume match the white 36 px Position Editor shell, suffix/unit ending,
  and unit caret structure.
- Workspace tabs match the underline treatment and semantic active/inactive colors.
- Shared Input is source-correct at 40/30 px; it is not a replacement for the
  Position Editor's 36 px product composition.
- Structural audit found no unbound/raw paint or effect colors in the three
  scoped component sets.

## Publication

Tasko UI needs a normal library publish before the updated components can be
consumed from Delivery.
