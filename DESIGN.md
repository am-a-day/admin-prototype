# Tasko Admin Design System

## Product design principles

- Tasko is a working B2B admin interface, not a marketing site.
- Favor high information density without visual noise.
- Use familiar controls and predictable placement so frequent operations stay fast.
- Preserve the user's list, filter, selection, and editor context wherever possible.
- Use progressive disclosure for secondary controls, explanations, and advanced settings.
- Avoid extra screens and confirmations unless an action is consequential or destructive.
- Build on calm neutral surfaces with a limited indigo product accent and restrained semantic colors.
- Prefer direct manipulation and contextual actions over duplicated permanent toolbars.

## Visual hierarchy

- Page titles establish the workspace; section titles divide meaningful tasks; labels name controls; helper text explains persistent context.
- Admin and catalog workspaces commonly use compact `12px`–`14px` text, with stronger weight rather than large type for local hierarchy.
- Use existing page wrappers such as `PageScroll`, `PageContent`, `CompactContent`, and `ContentHeader` where the edited flow already relies on them.
- Keep spacing rhythmic: small gaps within controls, medium gaps between related fields, and larger gaps between sections.
- Use a card or bordered surface when it communicates a distinct object, group, or interaction boundary.
- Do not wrap an entire page or every subsection in separate cards when spacing and headings already establish structure.
- Prefer concise helper text or a Tooltip to a large disclaimer block for minor guidance.
- Keep dense tables and side panels visually quieter than full-page content.

## Color

- The current admin/catalog action accent is indigo: `indigo-600` / `#4f39f6`, with darker hover states such as `#4030d4` where already used.
- `src/index.css` defines neutral semantic tokens: `background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `border`, `input`, and `ring`.
- The base canvas and cards are white; quiet workspace surfaces use warm zinc/stone neutrals such as `#fbfbf9`, `#fafaf9`, and `#f5f5f4` in established catalog flows.
- Primary text commonly uses `#292524`; secondary text uses `#57534d` or `#79716b`; subdued metadata uses `#a8a29e`/`#a6a09b`.
- Borders are light and warm, commonly tokenized `border` or established values around `#e7e5e4`.
- Semantic states use restrained red/rose for destructive actions, amber/orange for warnings, emerald/green for success or availability, and blue only where the current flow already establishes it.
- Do not introduce arbitrary new colors or gradients. Reuse a semantic token or a value already established in the same subsystem.
- The generic shadcn `primary` token is currently neutral-dark, while newer admin/catalog CTAs use indigo. For a new primary admin CTA, follow the surrounding product flow or task-specific Figma; do not default to black when indigo is the established action accent.
- Preserve legacy color choices outside the task rather than performing an unrequested palette migration.

## Typography

- The application font stack is Inter, then system sans-serif fallbacks, as defined in `src/index.css`.
- Use the current screen's title pattern: full workspace pages may use a larger strong title, while dense catalog headers use compact `14px`–`18px` semibold titles.
- Section titles are visually stronger than body copy but should not compete with the page title.
- Body and control text is normally `13px`–`14px`; labels and metadata commonly use `11px`–`13px`.
- Helper text uses a muted color and a readable line height; it should remain subordinate to the field value.
- Table headers use compact muted text; table rows use compact normal or medium-weight text for scanability.
- Use tabular numbers for counts and values that must align.
- Truncate long entity names in constrained rows, navigation, buttons, and headers; expose full context through the surrounding interaction when needed.
- Avoid heavy `font-black` styling in newly changed dense admin surfaces unless the existing local pattern or Figma explicitly uses it.

## Spacing and sizing

- Tailwind utility spacing and existing component classes are the source of truth; do not create a second spacing scale.
- Dense catalog controls commonly use `h-7`, `h-8`, or `30px`; general form controls use `h-9` or `h-10` depending on their wrapper.
- `Button` currently provides default `h-10`, small `h-8`, large `h-11`, and icon `h-9 w-9` sizes.
- Catalog table rows are currently `38px` high; preserve that rhythm unless the task explicitly redesigns the table.
- Compact action icons are generally `14px`–`18px` inside `28px`–`32px` hit areas.
- Popovers and menus use compact internal padding, roughly `7px`–`10px` radii, and clear grouping rather than large card padding.
- Alert dialogs currently use a `420px` maximum width and `20px` padding; use the wrapper rather than duplicating these values.
- Base radius tokens derive from `--radius: 0.75rem`; product components also use established compact `7px`–`14px` radii.
- Align labels, values, trailing actions, and icons to a shared row axis. Avoid one-off offsets that make repeated rows wobble.

## Components

### Buttons

- Use `src/components/ui/button.tsx` or an existing product wrapper such as catalog action buttons.
- Match the surrounding size and hierarchy; reserve indigo fill for the primary forward action in current admin/catalog flows.
- Use outline or ghost treatment for secondary/contextual actions and a semantic destructive style for irreversible actions.

### Inputs and textareas

- Use shared `Input`, `Textarea`, or a domain wrapper such as localized/translatable fields.
- Preserve existing compact vs default sizing, border, focus ring, placeholder color, and disabled behavior.

### Select and Command

- Use the shared Radix/shadcn Select for a bounded option set.
- Use a searchable Command-style picker for long, filterable, or hierarchical choices when available.

### Checkbox, radio, and switch

- Use the existing shared primitives and keep labels clickable.
- Checkbox supports checked and indeterminate selection; preserve those states for table selection.
- Radio is for one choice within a visible set. Switch is for an immediately understandable on/off setting.

### Tooltip

- Use Tooltip for a short explanation of an icon, hidden rail label, or non-obvious mechanism.
- Give icon-only actions an accessible name independent of the Tooltip.

### Popover, DropdownMenu, and ContextMenu

- Use Popover for quick contextual work that benefits from staying near its trigger.
- Use DropdownMenu or ContextMenu for compact action lists and nested actions.
- Reuse the catalog dropdown constants/wrappers inside the catalog instead of styling a parallel menu.

### Dialog and AlertDialog

- Use Dialog for focused tasks that cannot fit a lightweight anchored interaction.
- Use AlertDialog for important or destructive confirmation.
- Do not open a dialog for every simple action, and do not use native browser dialogs.

### Tabs

- Tabs switch peer views without navigating away from the current work context.
- Keep labels short and preserve the surrounding layout when the active tab changes.

### Badge and status

- Use compact badges for state, not decoration.
- Combine text with restrained semantic color so meaning does not depend on color alone.

### Tables

- Optimize for fast scanning: stable columns, compact rows, muted headers, aligned numeric content, and truncation where necessary.
- Show hover actions and selection controls contextually; do not keep every action visually loud.
- Show a drag handle only where reordering is available and discoverable; avoid permanent noise.
- Use clear, actionable empty states that preserve the table's placement and context.
- Avoid column or toolbar shifts when selection, search, editing, or loading changes.
- Make columns sticky only when the workflow genuinely needs it, and add a subtle boundary when scrolled.

### Side Peek

- Side Peek keeps the table/list visible while an entity is inspected or edited.
- The catalog implementation is a right-side complementary pane with a restrained `200ms` entrance/exit transform and reduced-motion support.
- Switching entities inside an open Side Peek must update content without replaying the pane entrance animation.
- Keep entity context and relevant actions in the sticky header; do not duplicate those actions elsewhere.
- Width should match task complexity. The existing catalog pane is user-resizable within established limits and persists its width.
- Adapt or replace the presentation when space is insufficient; do not squeeze a complex two-column editor into a conventional narrow panel.

### Sidebar and navigation

- Keep navigation groups stable and labels concise.
- Use Phosphor icons consistently for new or changed navigation items.
- Compact/rail modes rely on Tooltip labels and clear active state.

### Empty states

- State what is empty and provide the most relevant next action.
- Keep them visually quiet and proportional to the surface.

### Search and filters

- Keep search close to the list it controls; the catalog currently uses a compact search field integrated into the table header/toolbar.
- Show active filters clearly and make removal/reset easy.
- Preserve query and filter context when opening and closing editors.

### Bulk actions

- Reveal bulk actions after selection and show the selected count.
- Keep the primary bulk action obvious, destructive actions distinct, and selection reversible.

### Drag handles

- Use the established DnD helpers and Phosphor `DotsSixVertical` treatment.
- Reveal handles contextually where possible and use a grabbing state during active reorder.

## shadcn policy

- Use shadcn/Radix for standard primitives and existing Tasko wrappers before raw primitives.
- Do not manually rebuild a component that shadcn already provides.
- Apply product styling through current tokens, utility patterns, and wrappers.

## Iconography

- Use `@phosphor-icons/react` for every new or changed product icon.
- Keep action semantics, weight, size, alignment, and accessible naming consistent.
- Do not introduce another icon library or custom SVG when a Phosphor icon exists.
- Lucide remains in legacy areas; do not migrate the entire interface outside a scoped task.

## Popovers and dialogs

- Prefer Popover for quick contextual actions and Dialog/AlertDialog for focused or consequential decisions.
- Do not use Dialog for every interaction or native browser UI for product controls.
- Anchor floating content predictably, preserve focus, support Escape, and avoid excessive footer actions.

## Tooltips and helper text

- Tooltip explains a short, non-obvious icon or mechanism.
- Helper text holds context that must remain visible while the user works.
- Use a disclaimer only for genuinely critical consequences or constraints.
- Do not explain obvious labels or repeat adjacent copy.

## Motion and stability

- Use short, calm transitions that clarify state; honor reduced-motion preferences.
- Avoid layout jumps when loading, selecting, creating, opening editors, or changing tabs.
- Do not replay Side Peek entrance motion when switching entities inside an already open pane.
- Preserve focus through overlays and return it sensibly when they close.
- Opening or creating an item must not make the underlying table jerk or change column rhythm.

## Responsive behavior

- Prioritize the main working area and the user's current action.
- Adapt Side Peek width/presentation when the viewport cannot support both list and editor.
- Disable sticky behavior when it harms narrow layouts or hides usable content.
- Let dense toolbars collapse or simplify based on their container, as current catalog bulk controls do.
- Do not add decorative responsive behavior without product value.

## Do / Don't

### Do

- Reuse shared shadcn components and Tasko wrappers.
- Use Phosphor icons for new and changed iconography.
- Use the established indigo accent for current admin/catalog primary actions.
- Preserve table row and column rhythm.
- Use Tooltip for concise explanations.
- Keep hover actions contextual and keyboard accessible.
- Preserve list, filter, selection, and Side Peek context.

### Don't

- Create native selects or hand-built standard controls.
- Introduce arbitrary colors, shadows, radii, or control sizes.
- Add black primary admin buttons when the surrounding product flow uses indigo.
- Show drag handles and every row action permanently.
- Add large disclaimer banners for minor help.
- Wrap every section in a separate card.
- Duplicate the same action in a header, row, and footer.
- Invent a parallel component system.
