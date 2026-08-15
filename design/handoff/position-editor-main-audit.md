# Position Editor / Side Peek / «Основное» — pilot audit

Audit date: 2026-08-15 (Asia/Almaty)
Scope: code audit, Figma delivery structure, draft manifest. No product code or UI Library components were created.

## 1. Executive summary

- Entry route: `/storefront/catalog`; an existing position can be addressed with `positionId`, and direct creation uses `createPosition=1` plus an optional `sectionId`. Route parsing is in `src/App.tsx` (`getInitialStorefrontRoute`, `getCatalogBrowserRoute`).
- Main entry component: `CatalogWorkspace` in `src/features/storefront/catalog-workspace.tsx`.
- Side Peek is implemented by the local `PositionEditorDialogShell`, not by a shared shadcn primitive. It portals an absolutely positioned right-side `aside` into `[data-position-editor-surface]`.
- The pane overlays the catalog; it does not reserve space or change the catalog/table/preview width. Default width is 470 px at viewport widths `>= 1400`, otherwise 400 px. It is resizable from 380–600 px and persists the chosen width in localStorage.
- The editor's only vertical scroll container is inside `PositionEditor`; the 56 px header is sticky. The tab strip is not sticky and scrolls away with the form.
- Autosave is a local prototype simulation: changes immediately update the catalog store, status becomes `saving`, changes to `saved` after 450 ms, and returns to `idle` 1400 ms later. Persistence is separately debounced by 120 ms in `CatalogStoreProvider`.
- A save-error renderer exists, but no audited code path sets the status to `error`. Initial loading is not implemented for edit mode.
- The active UI relies heavily on direct hex colors and local radii instead of semantic CSS variables. The strongest pilot UI-Lib candidates are Side Peek shell/header/navigation, autosave status, workspace-local tabs, translatable field, and the compact rich-text field.
- Built-in Figma Agent could not be started because the authenticated Figma UI was not controllable. The allowed direct Figma fallback created and verified the requested empty page/section structures.

## 2. Timeline and orchestration metrics

All captured times are local (`+05:00`). A value is not inferred when it was not observable.

| Event | Timestamp | Observation |
| --- | --- | --- |
| T0 — task start | 2026-08-15 16:01:22 | First locally captured timestamp after reading the supplied task. |
| T1 — main Figma file opened | 2026-08-15 16:03:44 | `NEW-АДМИНКА` opened in the in-app browser; the session was unauthenticated. |
| T2 — first Figma Agent prompt sent | not occurred | Agent UI could not be reached in an authenticated controllable session. |
| T3 — UI-Lib opened | not observable | UI access failed; the file was later inspected through the Figma integration before fallback creation. |
| T4 — second Figma Agent prompt sent | not occurred | Agent UI could not be reached. |
| T5 — code audit started | 2026-08-15 16:05:45 | Narrow repository search began. |
| T6 — first Figma Agent result completed | not applicable | Figma Agent was not started. |
| T7 — second Figma Agent result completed | not applicable | Figma Agent was not started. |
| T8 — audit completed | 2026-08-15 16:11:06 | Code, states, responsive behavior, and token inventory complete. |
| T9 — Figma verification completed | 2026-08-15 16:10:04 | Direct fallback structures verified. This occurred before final audit synthesis, so the requested T8→T9 sequence was not preserved. |
| T10 — task completed | 2026-08-15 16:14:39 | Figma and local artifacts verified; worktree scope checked. |

### Intervals and parallelism

| Interval | ChatGPT work | Figma Agent active? | Passive useful-work gap? | Agent status checks | Corrective prompts |
| --- | --- | --- | --- | ---: | ---: |
| T0→T1 | Read task, `AGENTS.md` context, `DESIGN.md`, checked worktree, opened main Figma URL. | No | No | 0 | 0 |
| T1→T2 | Tried to expose Figma Agent; discovered unauthenticated browser session and inaccessible desktop UI. | No | UI connection waits only | 0 | 0 |
| T2→T4 | Not applicable; prompts were not sent. | No | No | 0 | 0 |
| T5→T8 | Audited route, shell, editor tree, fields, persistence, states, tests, tokens, responsive behavior; direct Figma fallback also occurred in this envelope. | No | No Agent wait | 0 | 0 |
| T8→T9 | Not applicable: T9 occurred before the final T8 audit timestamp. | No | No | 0 | 0 |
| T9→T10 | Wrote and verified report and manifest. | No | No | 0 | 0 |

Metrics available at report time:

```text
Total duration: 13m17s (T0–T10)
Figma Agent active duration: 0m (not launched)
ChatGPT active audit duration: not observable; observed T5–T8 envelope was 5m21s and included direct Figma fallback
Idle waiting duration: approximately 2m35s of UI-connection waits; 0m waiting for Figma Agent
Status checks count: 0 Figma Agent checks
Figma prompts count: 0
Corrective prompts count: 0
```

## 3. Did ChatGPT wait for Figma Agent?

No. Figma Agent never started, so there was no Agent job to wait for or poll. There were several blocked UI-connection waits before the two-attempt reassessment; they are not Figma Agent waiting and produced no parallel work.

## 4. What ChatGPT did while Figma Agent was running

Not applicable: Figma Agent was not running. The intended parallel experiment therefore did not occur. The code audit began immediately after the interface limitation was established.

## 5. Figma Agent prompts sent

None. The supplied English prompts were not transmitted because the only controllable web session was unauthenticated and the authenticated Figma Desktop/Chrome UI did not expose a controllable state. No claim is made that Figma Agent received or processed either request.

## 6. Figma results

The authorized direct fallback produced:

### NEW-АДМИНКА

- Page `Delivery · Catalog` (page ID `2307:90`), appended after existing pages.
- Four native `SECTION` nodes, all empty:
  - `Position editor · Context` — 1440×900 at y=0.
  - `Position editor · Main flow` — 1440×900 at y=1100.
  - `Position editor · States` — 1440×900 at y=2200.
  - `Position editor · Responsive` — 1440×900 at y=3300.
- No components were created on the delivery page.

### UI-Lib

- Reused the unused empty default `Page 1` as `00 · About`.
- Added `01 · Foundations`, `02 · Primitives`, `03 · Product patterns`, and `99 · Deprecated`.
- Verified exact ordering, zero children on every page, zero local variables, and no components on the current page.

## 7. Figma Agent limitations

- In-app browser: Figma opened as an unauthenticated guest and requested sign-up before editing.
- Figma Desktop: two UI-state requests timed out; the same approach was stopped under the two-attempt rule.
- Existing Chrome session: UI-state access also timed out, and the connected-browser extension surface was unavailable.
- Result: ChatGPT could not start Figma Agent, could not observe Agent completion, and could not run the intended parallel orchestration.

## 8. Code component tree

```text
App
└── CatalogWorkspace
    └── PositionEditorDialogShell (Side Peek shell)
        └── PositionSidePeekProvider
            └── PositionEditorHost
                └── PositionEditor
                    ├── Side Peek sticky header
                    │   ├── Position title/action trigger
                    │   ├── CatalogContextMenuContent
                    │   │   └── DropdownContent / DropdownActionItem
                    │   ├── PositionSaveStatus
                    │   ├── PositionQueueControls
                    │   │   └── Tooltip
                    │   └── Collapse control
                    │       └── Tooltip
                    └── PositionEditorBody
                        ├── WorkspaceLocalTabs
                        └── BasicTab («Основное»)
                            ├── BasicMediaStrip
                            │   ├── MediaTile
                            │   └── DropdownContent / DropdownActionItem
                            ├── TranslatableField (Название)
                            ├── EditorField (Цена)
                            ├── EditorField (Объем)
                            │   └── DropdownContent / DropdownActionItem
                            ├── DiscountBlock (optional)
                            │   ├── DiscountInputField
                            │   │   └── Input (compact)
                            │   └── Tooltip
                            ├── DescriptionRichTextEditor
                            │   └── RichTextToolbarButton
                            └── KbjuBlock (optional footer)
                                ├── EditorBlockHeader
                                └── Input (compact)
```

### Component map

| Code component | Source path | Type | Variants | States | Potential Figma name | UI-Lib? | Reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `PositionEditorDialogShell` | `src/features/storefront/catalog-workspace.tsx` | local / Tasko pattern | `dialog`, `pane`; `creation` | opening, open, closing, resizing, reduced-motion | `Pattern / Side Peek / Shell` | yes | Reusable product interaction with width persistence and overlay semantics. |
| `PositionSidePeekProvider` | `src/features/storefront/catalog/editor/side-peek-context.tsx` | local behavior | close callback | available/unavailable provider | none | no | Behavior-only context, not a visual component. |
| `PositionEditorHost` | `src/features/storefront/catalog/editor/position-editor-host.tsx` | Tasko | pane/dialog presentation | queue, outside selection, autosave, move undo | none | no | Feature orchestration, not a library visual. |
| `PositionEditor` | `src/features/storefront/catalog/editor/position-editor.tsx` | local feature | `create`, `create-modal`, `edit`; detail pane | active tab, title edit, save status, create committed | `Feature / Position editor` | no | Whole feature composition; too specific for UI-Lib. |
| `PositionSaveStatus` | same | Tasko pattern | idle/saving/saved/error | spinner, success, retry | `Status / Autosave` | yes | Cross-feature status pattern if behavior and wording are standardized. |
| `PositionQueueControls` | `src/features/storefront/catalog/editor/editor-queue-controls.tsx` | Tasko pattern | previous/next availability | enabled, disabled, hover/focus | `Pattern / Side Peek / Entity navigation` | yes | Reusable navigation inside entity editors. |
| `WorkspaceLocalTabs` | `src/features/storefront/catalog/editor/editor-tabs.tsx` | Tasko shared | count/no count, end action | active, inactive, hover | `Navigation / Local tabs` | yes | Reusable local workspace navigation, already generic. |
| `BasicTab` | `src/features/storefront/catalog/editor/position-editor.tsx` | local feature | create-first-name/edit order | default, create, edit, validation | none | no | Position-specific composition. |
| `BasicMediaStrip` / `MediaTile` | same | local feature | photo/video/add tile | empty, uploaded, video limit, drag, menu open | `Pattern / Position media strip` | uncertain | Product-specific; validate reuse beyond catalog positions first. |
| `TranslatableField` | `src/components/workspace/translatable-field.tsx` | Tasko shared | plain/compact/default, input/textarea | language value, placeholder, autofocus | `Field / Translatable` | yes | Systemic workspace need and already shared. |
| `EditorField` | `src/features/storefront/catalog/editor/position-editor.tsx` | local | right slot | focus-within | `Field / Compact framed` | uncertain | Repeated visually, but only local and partly duplicates `Input`. |
| `DiscountBlock` | same | local feature | percentage/final price | disabled, errors, base missing | `Pattern / Price discount` | no | Domain-specific position editor block. |
| `DescriptionRichTextEditor` | `src/components/workspace/description-rich-text-editor.tsx` | Tasko shared | compact/default | active marks, warning, over-limit, error | `Field / Rich text / Compact` | uncertain | Shared and visual, but implementation uses deprecated `execCommand`; standardize behavior first. |
| `KbjuBlock` | `src/features/storefront/catalog/editor/position-editor.tsx` | local feature | base by unit | empty, values, warning, remove confirm | `Pattern / Nutrition fields` | no | Catalog-domain-specific. |
| `Input` | `src/components/ui/input.tsx` | shadcn-style primitive | default/compact | focus, disabled, placeholder | `Primitive / Input` | yes | Canonical primitive; Main uses compact variant inside discount/KБЖУ. |
| `Button` | `src/components/ui/button.tsx` | shadcn-style primitive | default/destructive/secondary/outline/ghost; sizes | hover/focus/disabled | `Primitive / Button` | yes | Canonical primitive, mainly visible in creation-only branches here. |
| `Tooltip` | `src/components/ui/tooltip.tsx` | shadcn/Radix wrapper | four sides, delay, disabled | open/closed | `Primitive / Tooltip` | yes | Systemic primitive used across header/actions. |
| `DropdownContent` / `DropdownActionItem` | `src/features/storefront/catalog/ui/catalog-dropdown.tsx` | Tasko catalog wrapper | tone/icon/nesting | open, hover, danger, disabled | `Pattern / Catalog action menu` | yes | Established catalog product wrapper, but should remain catalog-scoped. |
| `CatalogContextMenuContent` | `src/features/storefront/catalog/ui/catalog-context-menu.tsx` | Tasko catalog pattern | entity/action combinations | archive, availability, schedule | `Pattern / Catalog entity menu` | uncertain | Reusable in catalog, but broader UI-Lib ownership needs a decision. |

### Categorization

1. **Используется системно:** `Button`, `Input`, `Tooltip`, `TranslatableField`, `DescriptionRichTextEditor`.
2. **Повторяется, но реализовано по-разному:** compact framed fields (`EditorField`, compact `Input`, plain `TranslatableField`), action buttons, direct Radix dropdown triggers/content, radii 7/8/10/12/13/14 px.
3. **Только Position Editor:** `BasicTab`, `BasicMediaStrip`, `MediaTile`, `DiscountBlock`, `KbjuBlock`, `PositionSaveStatus` (currently local).
4. **Продуктовый паттерн Tasko:** Side Peek shell/header, entity queue navigation, workspace-local tabs, autosave status, translatable fields, catalog action menu.
5. **Выбивается из системы:** native `window.confirm` for removing filled КБЖУ; direct Radix `DropdownMenu` composition instead of one consistent shared shadcn wrapper; many direct hex values bypassing semantic tokens; one remaining Lucide import in the editor module.
6. **Требует решения дизайнера:** whether Side Peek header navigation remains hover-only; semantic color/radius ownership; whether position media becomes a catalog pattern; responsive layout of optional KБЖУ fields inside a 400 px pane.

## 9. Components recommended for the pilot UI-Lib

Recommended for block 2, without creating them yet:

1. `Pattern / Side Peek / Shell` with open/closed/resizing and 400/470/custom width examples.
2. `Pattern / Side Peek / Header` with title truncation, save status, entity navigation, and collapse action.
3. `Status / Autosave` with idle, saving, saved, and error/retry variants; implementation reachability must be fixed before approval.
4. `Navigation / Local tabs` with optional count.
5. `Pattern / Side Peek / Entity navigation` with previous/next disabled combinations.
6. `Field / Translatable` in the active `plain` form treatment.
7. Existing primitives `Button`, `Input`, `Tooltip`, and catalog dropdown wrappers as source references—not duplicated variants.

Defer `BasicTab`, media strip, discount, and KБЖУ until reuse is demonstrated or a product-pattern decision is made.

## 10. Tokens and inconsistencies

### Colors

**Semantic CSS variables available** (`src/index.css`): `background`, `foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `border`, `input`, `ring`, plus foreground pairs. The active Side Peek/Main implementation rarely consumes them directly.

**Tailwind primitives used in audited branches:** `white`, `black/15`, `black/20`, `transparent`, `zinc-200`, `zinc-300`, `zinc-900`, `zinc-50`, and create-mode `indigo-600/700/800`.

**Direct hex/rgb values used:**

- Text: `#1c1917`, `#292524`, `#303030`, `#44403b`, `#57534d`, `#666`, `#79716b`, `#8a8179`, `#a6a09b`, `#a8a29e`, `#d6d3d1`.
- Surfaces/borders: `#fbfbf9`, `#fafaf9`, `#f5f5f4`, `#efefeb`, `#eceae7`, `#efede9`, `#e7e5e4`, `#e5e5e5`, `#d6d3d1`, `#c7c2bd`, `#dedbd7`.
- Semantic states: success `#56826a`; save/name error `#c10007`; validation `#b42318`, `#fda29b`; warning `#b45309`; destructive `#dc2626`; create CTA `#4f39f6`/`#4030d4`.

**Local one-offs:** `#666` for unit control, `#8a8179` for section metadata, `#56826a` for saved state, and `#efede9` for a creation header border. These need semantic naming decisions rather than blind replacement.

The main inconsistency is direct color usage where semantic tokens exist. No automatic migration is recommended in this block.

### Typography

Global family: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` (`src/index.css`). No local letter-spacing override was found; letter spacing is `normal`.

| Size / weight / line-height | Usage | Source |
| --- | --- | --- |
| 14 px / 600 / 20 px | Side Peek title and title action | `PositionEditor` |
| 14 px / 600 / 28 px | Inline title editing in detail pane | `PositionEditor` |
| 14 px / 500 / 28 px | Non-detail edit header fallback | `PositionEditor` |
| 13 px / 400 / 20 px | Field labels, inputs, rich text | `BasicTab`, `EditorField`, `TranslatableField`, `DescriptionRichTextEditor` |
| 13 px / 500 / normal | Active tabs and compact action text | `WorkspaceLocalTabs`, local buttons |
| 12 px / 400 / normal | Save status | `PositionSaveStatus` |
| 12 px / 400 / 16 px | Validation and helper text | `BasicTab`, `DiscountBlock` |
| 12 px / 400 / 20 px | Description count/warnings | `DescriptionRichTextEditor`, `KbjuBlock` |
| 11 px / 400 / 16 px | Section metadata | `PositionEditor` fallback header |
| 10 px / 500 / normal | Tab count/media metadata | `WorkspaceLocalTabs`, `MediaTile` |

### Spacing and layout

**4 px scale:** 4, 8, 12, 16, 20, 24, 28, 32, 36 px are used for primary gaps, padding, headers, and controls.

**Valid exceptions:** 2 px (`gap-0.5`), 6 px (`gap/px-1.5`), and 10 px (`py/px-2.5`) are established compact-control micro-spacing. The resize hit area is 10 px with a 1 px visual line.

**Suspicious values:** no fractional pixel layout values were found. `104px` is reserved for hover navigation plus collapse control, and `96px` for save status; both are intentional anti-layout-jump widths but should be documented. Viewport-based `lg:grid-cols-4` inside the KБЖУ block is suspicious because the pane itself may be only 400 px wide.

**Fractional values:** Tailwind half-step classes resolve to integer CSS pixels at the current root size. No `0.5px` layout dimensions were found.

### Radius inventory

Counts cover audited Side Peek/Main source branches, including conditional create/optional states.

| Value | Class/token | Usage count | Components | Potential semantic token |
| --- | --- | ---: | --- | --- |
| 8 px | `rounded-[8px]` | 11 | fields, toolbar buttons, discount, KБЖУ | `radius-control-compact` |
| 12 px | `rounded-lg` / `--radius-lg` | 9 | header actions, queue controls, buttons | `radius-control` |
| 10 px | `rounded-[10px]` | 3 | add-media, discount surface/toast | uncertain |
| 16 px | `rounded-xl` / `--radius-xl` | 2 | media tiles/shared default button | `radius-media` or shared large |
| 10 px | `rounded-md` / `--radius-md` | 2 | media overlay actions | shared medium |
| 7 px | `rounded-[7px]` | 2 | title action, rich-text toolbar | `radius-action-compact` |
| 6 px | `rounded-[6px]` | 2 | small inline/unit actions | uncertain |
| 9999 px | `rounded-full` | 1 | spinner/shape | `radius-pill` |
| 4 px | `rounded-[4px]` | 1 | tab count | `radius-badge` |
| 13 px | `rounded-[13px]` | 1 | KБЖУ card | uncertain |
| 14 px | `rounded-[14px]` | 1 | compact dialog shell | `radius-overlay` |
| 24 px | `rounded-2xl` | 1 | inactive default TranslatableField branch | shared extra-large |

Do not unify these values until the visual roles are agreed.

### Borders and shadows

- Most controls use 1 px borders (`#e5e5e5`); pane boundary uses `#e7e5e4`; focus uses a 1 px ring for title editing or 2 px focus-visible ring on actions.
- Common field shadow: `0 1px 2px rgba(0,0,0,0.1)`.
- Optional discount/KБЖУ fields use `0 1px 2px` with 0.05–0.08 alpha.
- Dialog fallback: `0 14px 40px rgba(28,25,23,0.2)`.
- Toast: `0 12px 36px rgba(41,37,36,0.2)`.
- The pane itself has no drop shadow; separation is a left border.

## 11. State inventory

| State | Implemented? | Observed implementation |
| --- | --- | --- |
| Default editing | yes | `PositionEditor` edit mode; changes flow through `PositionEditorHost.updateAndAutosave`. |
| Saving | yes | `saving` with spinning `SpinnerGap`; scheduled for 450 ms. |
| Saved | yes | `saved` with filled `CheckCircle`; hides after 1400 ms. |
| Save error | renderer only | `PositionSaveStatus` supports `error` and retry, but no audited path sets it. |
| Validation error | yes, partial | Missing create name, discount bounds/base missing, description limit, and KБЖУ warning. No edit-title required validation. |
| Initial loading | no for edit | Existing item renders synchronously from local store. Create has a `createSubmitting` busy state in non-detail branches, but the detail-pane header takes precedence. |
| Long title | yes | Header uses `min-w-0`, `max-w-full`, `truncate`, and a native `title` attribute. |
| Long description | yes | 300-character cap; new input/paste is limited; pre-existing over-limit value shows an error. |
| Missing image | partial | Empty media array shows only the add tile; a populated entry falls back to `item.thumbnailUrl` or `ImageBroken`, but broken `<img>` URLs have no `onError` fallback. |
| Image uploaded | yes, local prototype | Object URL preview is added; first preview becomes `thumbnailUrl`; persistence of blob URLs across sessions is not production-safe. |
| Disabled control | yes | Queue boundaries, discount fields without base price, create buttons in non-detail branches, and title actions before create commit. |
| Create mode | yes, inconsistent | Name is prioritized and focused; first non-empty `onNameChange` can call `onCommitDraftName`, effectively committing immediately. Explicit create/cancel footer is limited to `create-modal`, but no current call site uses `create-modal`. |
| Edit mode | yes | Existing item, actions, queue navigation, autosave, persisted tab per item. |
| Compact desktop | yes | 400 px default below 1400; responsive form uses viewport breakpoints rather than pane/container breakpoints. |
| Closing editor | yes | Collapse, Escape, outside click; 200 ms exit unless reduced motion; pending autosave is forced to saved before close. |
| Switching positions | yes | Item content/state resets by `item.id`; pending save is completed; same shell remains mounted with no explicit content transition. |

Additional discrepancies:

- Current save copy is `Сохранение…`; `e2e/catalog-editor.spec.ts` still expects `Сохраняем`.
- `CatalogSaveStatus` includes `error`, but the prototype never reaches it.
- Removing filled KБЖУ uses native `window.confirm`, contrary to the repository's AlertDialog rule.

## 12. Responsive and scroll behavior

- `PositionEditorDialogShell` portals into the catalog editor surface and uses `absolute inset-y-0 right-0`; it overlays the right side of the catalog.
- Opening, resizing, and closing do not alter catalog card, table row, or preview widths (characterized in `e2e/catalog-editor.spec.ts`).
- The underlying catalog does not receive right padding. At least 120 px of the portal target constrains the maximum pane width, but no space is reserved for the pane.
- Side Peek width:
  - 1440×900: default 470 px.
  - 1280×800: default 400 px.
  - User resize: 380–600 px, additionally clamped to `surfaceWidth - 120`.
  - Stored key: `tasko.catalog.positionSidePeek.width.v1` (through `catalogStorageKey`).
- Vertical scrolling: `PositionEditor` inner `overflow-y-auto scrollbar-none` container.
- Sticky: detail header is `sticky top-0 z-30`, height 56 px. Tabs are not sticky.
- Closing: collapse button, Escape when no Radix popper is open, or pointer down outside the pane. Catalog row pointer-down is exempt so a row can switch the open position.
- Previous/next navigation lives in the header, hidden until hover/focus of a 104 px controls region; error status suppresses it.
- Open/close motion: `translate-x-full` ↔ `translate-x-0`, 200 ms, ease-in/ease-out, `motion-reduce:transition-none`; close callback waits 200 ms or 0 under reduced motion.
- Switching positions: no pane re-entry animation; content is replaced in the existing shell. There is no dedicated crossfade/slide animation.
- At 1280, `sm:grid-cols-2` keeps price/volume in two columns. `lg:grid-cols-4` on KБЖУ is viewport-based and can produce four cramped columns inside a 400 px pane; this needs browser confirmation/design decision.

## 13. Manifest path

`design/handoff/position-editor-main.yaml`

## 14. Files changed

- `design/handoff/position-editor-main-audit.md`
- `design/handoff/position-editor-main.yaml`

No product source file was modified.

## 15. Open questions

1. Should Side Peek navigation remain hover/focus-only, or be persistently visible at compact widths?
2. Should 1440/1280 behavior be specified by viewport or by available catalog surface/container width?
3. Should KБЖУ use container-aware 1/2-column behavior inside the pane?
4. Which direct colors map to semantic tokens, especially saved/error/warning and warm neutral surfaces?
5. Is autosave error intended to be demonstrable in the prototype, or should the unreachable renderer be excluded from delivery states?
6. Is immediate create-on-first-nonempty-name intentional? If not, which explicit create control is canonical for Side Peek create mode?
7. Should `DescriptionRichTextEditor` enter UI-Lib before replacing `document.execCommand`?
8. Should `Delivery · Catalog` remain appended as the last page, or be moved to a specific delivery-page group?
9. Can the next block guarantee an authenticated controllable Figma session so Figma Agent orchestration can actually be tested?

## 16. Recommendation for block 2

Proceed only after resolving the authenticated Figma Agent access and three design decisions: Side Peek header/navigation visibility, semantic token mapping, and responsive KБЖУ behavior. Then create the small pilot library set (Side Peek shell/header, autosave status, local tabs, entity navigation, translatable field) and place a single representative edit-state Side Peek in `Position editor · Main flow`. Do not start with the whole Position Editor feature or domain-specific discount/KБЖУ components.

### Experimental questions

- **Смог ли ChatGPT самостоятельно запустить Figma Agent?** Нет.
- **Понял ли ChatGPT, когда Figma Agent завершил работу?** Нет применимого события: Agent не запускался.
- **Ждал ли ChatGPT пассивно?** Не ждал Agent; были приблизительно 2м35с блокирующих ожиданий подключения к UI.
- **Сколько раз ChatGPT проверял статус?** 0 проверок статуса Figma Agent.
- **Удалось ли действительно работать параллельно?** Нет.
- **Сколько запросов понадобилось Figma Agent?** 0; ни один не был отправлен.
- **Что оказалось быстрее выполнить напрямую?** Создание пустых страниц и native sections через Figma integration заняло один параллельный шаг и отдельную проверку.
- **Стоит ли повторять такую оркестрацию в следующих блоках?** Да, только при заранее проверенной авторизованной управляемой Figma-сессии; иначе эксперимент измеряет доступ к UI, а не полезный параллелизм.
