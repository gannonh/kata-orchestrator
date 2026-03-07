# KAT-259 Shadcn/ui v4 Migration Design

**Issue:** KAT-259  
**Linear URL:** https://linear.app/kata-sh/issue/KAT-259/shadcnui-v4-migration  
**Branch target:** `feature/kat-259-shadcnui-v4-migration`  
**Milestone:** Coordinator + Spec UX Parity (Specs 02-03)  
**Project:** Kata Desktop App  
**Lane:** `lane:ui-shared`

## Scope and Outcome

Migrate the desktop app's shadcn setup to the current v4 model and make preset `a1FAcdAe` the authoritative source for config, theme tokens, and regenerated UI primitives.

Required outcome:

- reinitialize the app with `npx shadcn@latest init --preset a1FAcdAe`
- treat upstream preset output as the source of truth rather than preserving current local primitive drift
- regenerate existing installed primitives through the v4 CLI path
- realign renderer consumers and tests to the regenerated component APIs and styling conventions
- preserve current shipped app behavior across the coordinator shell while adopting v4 structure
- leave the repo in a state where future shadcn updates can use normal preset/component workflows instead of bespoke local maintenance

This ticket is effectively a platform-enabler migration. It changes shared UI infrastructure that multiple renderer surfaces already depend on.

## Context Loaded

Sources reviewed for this design:

- Linear issue:
  - `KAT-259`
- Linear project documents:
  - `Execution Model: UI Baseline then Parallel Functional Vertical Slices`
  - `Desktop App Linear Workflow Contract`
  - `UI Ticket Fidelity Contract (Desktop App)`
- Local workspace guidance:
  - `AGENTS.md`
  - `package.json`
  - `components.json`
  - `src/renderer/app.css`
- Current shadcn state from CLI:
  - `npx shadcn@latest info --json`
  - `npx shadcn@latest init --help`
  - `npx shadcn@latest docs ...` for currently installed components
- Current implementation surface:
  - `src/renderer/components/ui/*`
  - `src/renderer/components/application-shell7.tsx`
  - `src/renderer/components/application-shell10.tsx`
  - `src/renderer/components/shadcnblocks/logo.tsx`
  - `tests/unit/renderer/ui/primitives.test.tsx`
- External guidance:
  - official shadcn CLI/docs surfaced via `npx shadcn@latest`

## Current State Summary

The app is already on Tailwind v4 and already uses shadcn-style generated source files, but the current setup is only partially aligned with v4:

- `components.json` is configured for `radix-vega`, Vite, CSS variables, and local aliases.
- The repo currently has 22 generated primitives in `src/renderer/components/ui/`.
- Renderer consumers import those primitives directly from shared `ui` paths, so primitive changes propagate broadly.
- Some current primitives use package patterns that indicate drift from a clean preset-generated state, especially mixed use of:
  - `radix-ui`
  - direct `@radix-ui/*` packages
- The current theme in `src/renderer/app.css` already contains extensive local token definitions that must be reconciled with preset output rather than blindly preserved.

This means the migration should not be treated as a package bump. It is a source-regeneration and downstream-realignment task.

## Assumptions and Constraints

- As of **March 7, 2026**, Linear shows `KAT-259` with no blockers and status `In Progress`.
- The team explicitly wants preset `a1FAcdAe` to be authoritative, not merely informative.
- The app is still early enough that breaking local primitive APIs in favor of upstream v4 output is acceptable if all current consumers are realigned in the same branch.
- TDD remains mandatory for implementation work.
- The project workflow contract still applies: completion requires linked evidence for behavior parity after the migration.

## Approaches Considered

### Approach 1 (Recommended): Preset-led reset plus downstream realignment

Run the v4 preset as the authoritative initializer, regenerate existing installed primitives, then update app code and tests to match the new output.

Pros:

- fully adopts the supported v4 preset workflow
- removes hidden divergence in current primitives
- leaves the repo maintainable for future shadcn updates
- aligns with the explicit user decision for authoritative preset ownership

Cons:

- larger immediate blast radius
- requires coordinated updates across consumer components and tests

### Approach 2: Selective manual merge onto the current primitive layer

Apply the preset/config changes but preserve most local primitive files, updating only the minimum required pieces by hand.

Pros:

- smaller initial diff
- lower short-term disruption

Cons:

- preserves local drift
- makes future CLI-driven updates less reliable
- conflicts with the explicit goal of taking full advantage of v4 presets

### Approach 3: Parallel v4 layer and incremental migration

Generate a separate v4 UI layer and migrate call sites gradually before replacing the old one.

Pros:

- safer for a mature product
- easier staged rollout

Cons:

- duplicates the UI layer temporarily
- adds complexity with little benefit at the current repo maturity level

## Recommendation

Proceed with **Approach 1**.

The migration should intentionally reset the shared UI layer to the preset-defined v4 baseline, then make targeted downstream fixes where the app relied on pre-reset behavior. This is the cleanest path to a maintainable shadcn setup.

## Post-Implementation Addendum

Implemented on March 7, 2026:

- preset `a1FAcdAe` resolved the app to `radix-mira` with `taupe` base color via authoritative `components.json`
- `src/renderer/app.css` kept app-specific semantic status tokens and project font aliases on top of the preset-owned token structure
- downstream regressions were resolved by updating tests to assert semantic behavior instead of assuming pre-v4 generated internals such as `CardTitle` rendering a heading element

## Proposed Design

## 1) Authoritative Migration Contract

This ticket establishes the following rule:

- `components.json`, `src/renderer/app.css`, and the generated files under `src/renderer/components/ui/` are controlled first by the v4 preset and CLI output.
- local edits remain allowed after generation, but only as explicit downstream adaptations to product needs, not as accidental carryover from older generated output.
- when there is tension between preserving current generated source and adopting v4 preset output, v4 preset output wins unless preserving behavior requires a deliberate follow-up customization.

That rule is the design center for the rest of the migration.

## 2) Migration Boundary

This ticket should own:

- preset re-initialization
- regeneration of currently installed primitives
- dependency/package alignment required by regenerated output
- theme/token reconciliation in `src/renderer/app.css`
- renderer import/API fixes caused by regenerated primitives
- unit-test updates for primitive behavior baselines

This ticket should not own:

- speculative installation of primitives not currently needed
- redesign of feature surfaces unrelated to the migration
- visual redesign of application screens beyond what the preset changes force
- unrelated refactors in feature components

## 3) Component Inventory Strategy

The current installed primitive inventory from `shadcn info` is:

- `avatar`
- `badge`
- `breadcrumb`
- `button`
- `card`
- `checkbox`
- `collapsible`
- `command`
- `context-menu`
- `dialog`
- `drawer`
- `dropdown-menu`
- `input-group`
- `input`
- `scroll-area`
- `separator`
- `sheet`
- `sidebar`
- `skeleton`
- `tabs`
- `textarea`
- `tooltip`

Migration rule:

- re-install only the primitives the repo currently uses
- do not opportunistically add missing future primitives during this ticket
- if the preset introduces a different generated shape for one of these primitives, downstream consumers are updated to that shape in the same branch

This keeps the migration bounded and auditable.

## 4) Configuration and Theme Strategy

The migration should update configuration in this order:

1. Reinitialize the shadcn project with preset `a1FAcdAe`.
2. Accept the preset's canonical `components.json` structure and resolved alias expectations.
3. Reconcile `src/renderer/app.css` against preset output.

Theme reconciliation rules:

- preserve project-specific semantic tokens that the app actively uses, such as status and app-specific palette variables
- preserve the token naming contract required by `AGENTS.md` and existing renderer code
- prefer preset-defined base token structure, spacing, shadow, radius, and utility conventions when they differ from the current file layout
- remove obsolete CSS generated by previous shadcn output when the new preset supersedes it

In practice, `src/renderer/app.css` should end this migration as "preset baseline plus app-specific extensions", not "legacy file with bits of preset pasted in".

## 5) Primitive Regeneration Strategy

The migration should use the v4 CLI flow rather than hand-editing generated primitives:

- initialize with preset `a1FAcdAe`
- regenerate existing primitives through shadcn CLI
- inspect regenerated files and keep only explicit downstream customizations that are still justified

Expected impact:

- files currently using `radix-ui` aggregate imports may be replaced or normalized by regenerated v4 output
- shared utility class strings and data-slot patterns may change
- accessibility composition details may shift to upstream defaults

Review rule after regeneration:

- treat each generated file as upstream-owned unless a local deviation is required to preserve actual app behavior
- if a local customization is kept, document why in the implementation plan or commit message rather than silently drifting again

## 6) Downstream Consumer Realignment

After regeneration, the migration updates all direct consumers of the shared primitives.

Known consumer classes:

- application shell prototypes
- shared shadcnblocks-backed components
- renderer feature surfaces importing `@renderer/components/ui/*`
- primitive baseline tests

Compatibility strategy:

- do not add adapter wrappers just to preserve the old API unless a consumer rewrite would be disproportionately expensive
- prefer updating call sites to match the regenerated primitive contracts
- keep import paths stable at `@renderer/components/ui/*` unless the preset explicitly changes the generated path contract

This keeps the codebase aligned with upstream rather than encoding a permanent compatibility layer around a migration that is supposed to reset the baseline.

## 7) Verification Strategy

Verification should prove both infrastructure correctness and no obvious renderer regressions.

Required verification layers:

- primitive-focused unit coverage for the regenerated shared UI layer
- renderer/component tests updated for any behavior or DOM changes introduced by v4 output
- a lint/typecheck pass across the app after regeneration
- at least one app-level smoke verification of the coordinator shell surfaces that consume shared primitives

Suggested concrete checks:

- `npm run lint`
- `npm run test`
- targeted `vitest` coverage for primitive baseline tests
- visual/manual smoke pass for the coordinator shell after migration

Because this is shared UI infrastructure, passing unit tests alone is not enough. A renderer smoke pass is required before calling the migration complete.

## 8) Evidence and Done Bar

To satisfy the desktop workflow contract, completion evidence for this migration should include:

- proof that preset `a1FAcdAe` was applied authoritatively
- passing lint/typecheck and test results
- updated primitive baseline evidence showing the regenerated layer works in the repo
- at least one renderer verification artifact or traceable note confirming the app still renders the shared shell correctly after the reset

This ticket should not be considered done if the preset was applied but the app still relies on stale local assumptions that only work accidentally.

## 9) Risks and Mitigations

- **Risk:** preset regeneration removes local tweaks that current screens depend on.  
  **Mitigation:** update call sites after regeneration instead of trying to preserve stale generated output.

- **Risk:** `src/renderer/app.css` merges become noisy and hide token regressions.  
  **Mitigation:** treat the file as a structured reconciliation task, preserving only active project-specific extensions on top of the preset baseline.

- **Risk:** tests overfit to old generated DOM/class details.  
  **Mitigation:** update tests to assert stable behavior and semantics instead of brittle internal structure where possible.

- **Risk:** the migration expands into opportunistic UI cleanup.  
  **Mitigation:** keep scope limited to preset adoption, primitive regeneration, consumer realignment, and verification.

## 10) Implementation Shape

The implementation plan for this design should break work into four ordered phases:

1. **Guardrail tests**
   - add or tighten failing tests that capture the current shared primitive contract at the behavior level
2. **Preset reset**
   - apply preset `a1FAcdAe` and regenerate the installed primitive inventory
3. **Consumer realignment**
   - update renderer code and tests to the regenerated output
4. **Verification and evidence**
   - run lint/tests and perform renderer smoke validation

That sequencing keeps the migration auditable and prevents the preset reset from turning into an unstructured diff.

## Approval Gate

If this design is approved, the next step is to create the implementation plan for KAT-259 and then execute the migration under TDD.
