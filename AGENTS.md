# Tasko Agent Instructions

## Project context

- Tasko is an actively evolving product UX/UI prototype used for rapid iteration and product-concept validation.
- The stack is React 19, TypeScript 5, Vite 6, Tailwind CSS 4, shadcn-style components on Radix primitives, and local React state/mock data.
- Unit and component tests use Vitest, Testing Library, and jsdom. Browser scenarios use Playwright.
- Main code lives in `src/`: `components/`, `contexts/`, `data/`, `features/`, and `lib/`.
- Shared UI primitives are in `src/components/ui`; shared workspace and layout patterns are in `src/components/workspace` and `src/components/layout`.
- Catalog-specific model, persistence, table, navigation, editor, and UI code lives under `src/features/storefront/catalog`.
- Unit/component tests are colocated as `src/**/*.test.{ts,tsx}`. Browser tests live in `e2e/`.
- The repository's existing visual system is more authoritative than generic UI conventions.
- Fast iteration matters, but never at the cost of losing or mixing the user's work.

### Confirmed commands

- `npm run dev` — start the Vite development server.
- `npm run build` — run `tsc -b`, then produce the Vite build.
- `npm run build:sites` — typecheck, build the Sites client, and prepare Sites output.
- `npm run preview` — preview a built Vite application.
- `npm test` — run the Vitest suite once.
- `npm run test:watch` — run Vitest in watch mode.
- `npm run test:e2e` — run Playwright tests in Chromium.
- There is no standalone `typecheck` npm script. When only a compiler check is justified, use the compiler phase `npx tsc -b` rather than claiming a nonexistent script.

## Instruction priority

When instructions conflict, use this order:

1. The user's current explicit task.
2. A task-specific Figma node or reference.
3. This `AGENTS.md`.
4. `DESIGN.md`.
5. Existing project patterns.
6. General agent preferences.

- Do not silently choose the easiest interpretation of a conflict.
- Resolve from available evidence; ask only when the conflict changes the product outcome or risks user work.

## Scope discipline

- Implement the requested task, not adjacent improvements.
- Do not start unrelated cleanup, modernization, or refactoring.
- Do not fix incidental bugs unless they block the requested result.
- Preserve behavior outside the stated scope.
- Report material out-of-scope issues briefly in the final response instead of fixing them.
- Prefer the smallest coherent diff that fully delivers the requested behavior.
- Do not turn a small UI task into an architecture project or maintenance of the entire test suite.
- **Do not expand the task just because nearby code could be cleaner.**

## Prototype development

- Optimize first for a working, reviewable user flow.
- Do not build a backend, API, migration, or production infrastructure without an explicit request.
- Mock behavior locally when that is sufficient to validate the UX.
- Reuse existing context, mock-data, state, storage, and persistence mechanisms.
- Do not design elaborate architecture for hypothetical future requirements.
- Add only validation and error handling needed to make the requested scenario understandable and safe.
- Avoid speculative abstractions and premature generalization.
- Do not over-engineer a prototype for an unconfirmed future.

## UI implementation

### shadcn and project primitives

- **If shadcn provides a component for the required UI pattern, always use the shadcn component.**
- Search `src/components/ui` and project wrappers before adding or implementing anything.
- Reuse an existing component when it is already present.
- In a future UI task, if the primitive exists in the official shadcn registry but is missing here, add the official component instead of hand-building a substitute.
- Do not recreate standard controls with `div`, ad hoc CSS, and custom JavaScript.
- Do not use native browser controls when an appropriate shadcn component exists.
- This applies to Button, Input, Textarea, Select, Checkbox, Radio Group, Switch, Dialog, AlertDialog, Sheet, Popover, DropdownMenu, ContextMenu, Tooltip, Tabs, Command, Badge, Table, Accordion, Calendar, and similar primitives.
- A custom component is appropriate only for a genuinely product-specific interaction.
- Prefer an existing Tasko wrapper over creating a second variation of the same primitive.
- Do not add new shadcn components unless the current user task calls for them.

### Icons

- Use the official `@phosphor-icons/react` package for every new or changed product icon.
- Do not add new Lucide, Heroicons, React Icons, or other icon-library usage.
- Do not draw a custom SVG when Phosphor provides a suitable icon.
- Use the same icon for the same action throughout a flow.
- Keep icon size, weight, optical alignment, and button placement consistent with the surrounding UI.
- Do not mass-migrate legacy Lucide icons outside the task scope.
- Replace a legacy icon when its component/screen is already being changed, or when migration is explicitly requested.

### General UI rules

- Reuse established spacing, typography, radii, control heights, button sizes, and interaction patterns.
- Use tokens and shared classes instead of arbitrary colors, shadows, radii, or sizes.
- Do not create near-duplicate components for a small visual difference.
- Use a Tooltip or concise helper text instead of a heavy disclaimer block when possible.
- Preserve consistency across admin screens and within the edited workflow.
- Avoid layout jumps when controls, selection, loading, or editors change state.
- Do not replace an intentional Figma decision with generic defaults merely because they are easier to implement.

## `DESIGN.md` usage

- **For every UI task, read `DESIGN.md` before implementation.**
- A task-specific Figma node is the primary visual reference for that task.
- `DESIGN.md` defines the shared visual language across Tasko.
- Existing shared components and tokens remain the implementation source of truth.
- If Figma and a current component differ, preserve the design intent without creating a parallel component system.
- If a material part of the design cannot be reproduced, call that out in the final report.

## Figma references

When the user supplies an accessible Figma node:

- Open the exact node, not only its file, title, thumbnail, or parent frame.
- Inspect hierarchy, layout, dimensions, spacing, states, and interactions.
- Reuse existing project components and tokens while matching the node's intent.
- Do not fall back to generic shadcn defaults when the design specifies otherwise.
- Do not modify neighboring screens outside the requested node or flow.

## Verification strategy

Match verification to the risk. Do not run the full unit or E2E suite after every UI iteration.

| Change | Expected verification | Usually skip |
| --- | --- | --- |
| Text, spacing, sizing, layout, styling, simple tabs, Tooltip, simple Popover/Dialog, visual states | Focused smoke check; TypeScript check if TS changed; browser/manual screenshot when available; build only if bundling may be affected | Full unit and E2E suites |
| Local interaction such as filters, selection, popover opening, language addition, or local form state | Existing targeted test when relevant; TypeScript check; short smoke check | Hundreds of unrelated tests |
| Store, persistence, autosave, DnD, creation/deletion, publication flow, shared transforms, migrations, major refactor, or critical flow | Targeted tests plus broader affected-area verification; consider build and relevant E2E | Unrelated suites while iterating |
| Major push, deploy, release snapshot, large migration/refactor, or explicit regression request | Full suite once near completion | Repeating full suites after each edit |

- Run a specific Vitest file with `npm test -- path/to/file.test.tsx` when a focused test exists.
- Use `npx tsc -b` for a compiler-only check when proportionate; `npm run build` also runs it before Vite.
- Use relevant Playwright specs only when the risk or user request warrants browser regression coverage.
- **Prefer shipping the requested UX change over expanding test coverage for every prototype iteration.**
- **Do not spend significant task time repairing unrelated legacy tests.**

## Test integrity

- Never weaken assertions merely to obtain a green result.
- Do not delete a scenario without understanding the behavior it protects.
- Do not reduce coverage or change expected behavior unless the product behavior intentionally changed.
- If a characterization or E2E test is obsolete, replace it with an equivalent check of the new intended scenario.
- Distinguish a pre-existing failure from a regression introduced by the task.
- Track unrelated stale tests separately; do not turn a UI task into test-infrastructure repair.
- **Never make verification pass by weakening assertions, deleting scenarios, narrowing coverage, masking exit codes, or changing expected behavior without confirming that the product behavior intentionally changed.**
- Final verification commands must preserve their real exit code.
- Do not append `exit 0` or `|| true`, suppress the status, or use a pipeline that hides a failure.

## Context and command-output discipline

- Start with a narrow search and read only relevant ranges from large files.
- Scope potentially broad output before running the command.
- Do not print entire large files, logs, generated artifacts, diffs, or full-suite output.
- Narrow the query before increasing an output limit.
- Do not rescan the whole repository without a new reason.
- Preserve the real exit code when trimming output.
- Do not repeat the same diagnostic command without new evidence.
- **Scope searches and command output before reading them. Do not dump full files, broad repository searches, complete logs, generated output, or large diffs when a focused query is sufficient.**

## Two-attempt rule

- **After two failed attempts using substantially the same approach, stop and reassess before continuing.**
- Recheck assumptions and evidence, then choose a materially different approach.
- Do not make endless small variations of the same failed solution.
- If genuinely blocked after reassessment, report the blocker concisely.

## Git safety and existing user work

- Check `git status` before substantial work and again before staging or committing.
- **Assume pre-existing uncommitted changes may be valuable.**
- Never discard, overwrite, or rewrite user changes for convenience.
- Preserve files that also contain work from another task; stage only the current logical unit, by hunk when needed.
- Verify staged changes before committing so adjacent work is not captured accidentally.
- If an operation could lose work, create a safe recoverable snapshot or request confirmation first.
- Before cleaning a worktree, branch, or stash, inspect unique changes and commits.
- Avoid low-level Git surgery unless it is genuinely necessary.
- Without explicit need and authority, do not use `git reset --hard`, destructive checkout, `git clean` on user work, force push, destructive rebase, or deletion of a branch/worktree/stash with unique changes.

## Autonomous local commits

- Local checkpoint commits may be created without separate confirmation.
- Commit after a coherent feature/fix, a meaningful phase of a long task, before switching subsystems, before risky refactoring, or when independent themes begin to mix.
- Do not commit after every tiny edit.
- Commits must be atomic, thematic, clearly named, and limited to one logical unit.
- Prefer a working state; use normal safe staging and `git add -p` when a file contains mixed work.
- Do not use `hash-object` or `update-index` when ordinary staging is sufficient.
- Never commit `.env` files, credentials, API tokens, secrets, build/cache artifacts, or temporary local files.

## Push policy

- Local commit permission is separate from push permission.
- Push only when the user explicitly asks to push, deploy, or sync.
- Do not push every checkpoint commit.
- Before pushing, verify status, current branch, and upstream; afterward, verify ahead/behind state.
- Force push requires a separate justification and explicit confirmation.

## Dependencies and refactoring

- Do not install a dependency when the current stack can reasonably solve the task.
- Do not update dependency versions incidentally.
- Do not rewrite a large legacy module solely because it is large.
- A large refactor needs a functional reason tied to the task.
- Preserve working behavior outside scope.
- Avoid speculative abstractions and cleanup for its own sake.

## Autonomy

- Make ordinary implementation decisions from the task, Figma, current components, architecture, and `DESIGN.md`.
- Do not ask about routine padding, local variable names, an obvious existing component, or minor internal implementation choices.
- Ask only when work may be lost, two options produce materially different product outcomes, credentials/external permissions are needed, or a critical requirement cannot be determined from context.

## Project Learnings

- Add a learning only after explicit user correction or a repeated confirmed agent error.
- Keep each learning to one concrete short line; update an existing rule instead of duplicating it.
- Keep no more than 20 active entries and remove obsolete ones.
- Do not use this section as a task diary.

- Treat a Figma frame width as viewport context: catalog tables fill the available workspace, while only their content columns keep Figma dimensions.
- Interpret requested catalog header spacing as the total inset from the workspace edge, including wrapper padding.

## Definition of done

1. The requested UX or behavior is implemented.
2. The changed scenario is verified.
3. Verification matches the actual risk.
4. There are no obvious runtime or console errors in the changed flow.
5. A completed logical unit is saved in a local commit when appropriate.
6. The task has not expanded into unrelated improvements.

Do not continue indefinitely in pursuit of a perfect repository-wide state.

## Final report

- Keep the final response short.
- State what changed and what was verified.
- Include the commit hash/message when a commit was created.
- Mention only important issues deliberately left out of scope.
- Do not paste long command logs or narrate the entire process.
