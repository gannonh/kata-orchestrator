# KAT-259 Shadcn/ui v4 Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reset the app's shared shadcn layer to preset `a1FAcdAe`, regenerate the current primitive inventory under shadcn/ui v4, and realign renderer consumers and tests so the desktop shell still works on the new baseline.

**Architecture:** Treat shadcn v4 output as authoritative for `components.json`, `src/renderer/app.css`, and the generated files in `src/renderer/components/ui/`. Lock the current shared-primitive behavior with failing tests first, then run the preset-driven regeneration, then repair downstream consumers to the new upstream contracts instead of preserving legacy wrapper drift.

**Tech Stack:** React 19, TypeScript, shadcn/ui v4 CLI, Tailwind CSS v4, Vitest, Testing Library, Electron renderer shared primitives.

---

**Execution Rules:**
- Apply `@test-driven-development` on every task: red, then green, then refactor.
- Apply `@verification-before-completion` before claiming ticket completion.
- Keep preset `a1FAcdAe` authoritative. Do not preserve generated source just because it existed before.
- Keep the current primitive inventory fixed to the 22 installed components already present in `src/renderer/components/ui/`.
- Keep commits small: one commit per task.

### Task 1: Add guardrail tests for the shared primitive layer before regeneration

**Files:**
- Modify: `tests/unit/renderer/ui/primitives.test.tsx`
- Modify: `tests/unit/renderer/AppShell.test.tsx`
- Modify: `tests/unit/renderer/Hero1.test.tsx`

**Step 1: Write the failing primitive contract test**

Append tests like these to `tests/unit/renderer/ui/primitives.test.tsx`:

```tsx
it('renders overlay primitives with accessible trigger and content wiring', async () => {
  render(
    <TooltipProvider>
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button">Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Migration dialog</DialogTitle>
        </DialogContent>
      </Dialog>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button">Hover target</Button>
        </TooltipTrigger>
        <TooltipContent>Preset tooltip</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }))
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(screen.getByText('Migration dialog')).toBeTruthy()
})

it('renders dropdown menu content through the shared wrapper', () => {
  render(
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button">Open menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem>Preset item</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  fireEvent.pointerDown(screen.getByRole('button', { name: 'Open menu' }))
  expect(screen.getByRole('menu')).toBeTruthy()
  expect(screen.getByText('Preset item')).toBeTruthy()
})
```

**Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run tests/unit/renderer/ui/primitives.test.tsx
```

Expected: FAIL because the current baseline does not yet guarantee all of these wrapper semantics across the upcoming reset.

**Step 3: Write the smallest shell-level smoke assertion**

Add a focused regression assertion to `tests/unit/renderer/AppShell.test.tsx` or `tests/unit/renderer/Hero1.test.tsx` that proves a shared primitive still renders in a real consumer. For example:

```tsx
expect(screen.getByRole('button', { name: 'Collapse sidebar navigation' })).toBeTruthy()
expect(screen.getByRole('tablist', { name: 'Left panel modules' })).toBeTruthy()
```

If the existing test already covers this, tighten it with one assertion that specifically depends on the shared `sidebar`, `button`, or `tabs` primitives.

**Step 4: Run the targeted consumer tests**

Run:

```bash
npx vitest run tests/unit/renderer/AppShell.test.tsx tests/unit/renderer/Hero1.test.tsx
```

Expected: PASS now, and these become guardrails for the preset reset.

**Step 5: Commit**

```bash
git add tests/unit/renderer/ui/primitives.test.tsx tests/unit/renderer/AppShell.test.tsx tests/unit/renderer/Hero1.test.tsx
git commit -m "test(renderer): lock shared shadcn primitive guardrails"
```

### Task 2: Apply preset `a1FAcdAe` and regenerate the current primitive inventory

**Files:**
- Modify: `components.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/renderer/app.css`
- Modify: `src/renderer/components/ui/avatar.tsx`
- Modify: `src/renderer/components/ui/badge.tsx`
- Modify: `src/renderer/components/ui/breadcrumb.tsx`
- Modify: `src/renderer/components/ui/button.tsx`
- Modify: `src/renderer/components/ui/card.tsx`
- Modify: `src/renderer/components/ui/checkbox.tsx`
- Modify: `src/renderer/components/ui/collapsible.tsx`
- Modify: `src/renderer/components/ui/command.tsx`
- Modify: `src/renderer/components/ui/context-menu.tsx`
- Modify: `src/renderer/components/ui/dialog.tsx`
- Modify: `src/renderer/components/ui/drawer.tsx`
- Modify: `src/renderer/components/ui/dropdown-menu.tsx`
- Modify: `src/renderer/components/ui/input-group.tsx`
- Modify: `src/renderer/components/ui/input.tsx`
- Modify: `src/renderer/components/ui/scroll-area.tsx`
- Modify: `src/renderer/components/ui/separator.tsx`
- Modify: `src/renderer/components/ui/sheet.tsx`
- Modify: `src/renderer/components/ui/sidebar.tsx`
- Modify: `src/renderer/components/ui/skeleton.tsx`
- Modify: `src/renderer/components/ui/tabs.tsx`
- Modify: `src/renderer/components/ui/textarea.tsx`
- Modify: `src/renderer/components/ui/tooltip.tsx`

**Step 1: Run the preset reset command**

Run:

```bash
npx shadcn@latest init --preset a1FAcdAe --force --reinstall --yes
```

Expected: `components.json`, `src/renderer/app.css`, package dependencies, and the current generated primitive inventory update to the v4 preset baseline.

**Step 2: Verify the CLI sees the new authoritative state**

Run:

```bash
npx shadcn@latest info --json
```

Expected:
- project still resolves as Vite + Tailwind v4
- aliases still point to `@renderer/components/ui`
- installed component list still matches the current 22-component inventory

**Step 3: Reconcile app-specific theme extensions on top of the preset baseline**

Adjust `src/renderer/app.css` so the file has this shape:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@import "tw-animate-css";

/* preset-owned base tokens first */
:root {
  --background: ...;
  --foreground: ...;
  --radius: ...;
}

.dark {
  --background: ...;
  --foreground: ...;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-status-todo: var(--status-todo);
  --font-sans: var(--font-sans);
}
```

Keep app-specific semantic extensions like status tokens only if they are still actively consumed by renderer code.

**Step 4: Run the guardrail tests after regeneration**

Run:

```bash
npx vitest run tests/unit/renderer/ui/primitives.test.tsx tests/unit/renderer/AppShell.test.tsx tests/unit/renderer/Hero1.test.tsx
```

Expected: FAIL in some places. Capture the failures; they define the downstream realignment work for the next task.

**Step 5: Commit**

```bash
git add components.json package.json pnpm-lock.yaml src/renderer/app.css src/renderer/components/ui
git commit -m "chore(renderer): reset shared ui to shadcn v4 preset"
```

### Task 3: Realign renderer consumers and tests to the regenerated v4 primitives

**Files:**
- Modify: `src/renderer/components/layout/AppShell.tsx`
- Modify: `src/renderer/components/application-shell7.tsx`
- Modify: `src/renderer/components/application-shell10.tsx`
- Modify: `src/renderer/components/shadcnblocks/logo.tsx`
- Modify: `tests/unit/renderer/AppShell.test.tsx`
- Modify: `tests/unit/renderer/Hero1.test.tsx`
- Modify: `tests/unit/renderer/ui/primitives.test.tsx`

**Step 1: Run the focused failing tests and note the broken contracts**

Run:

```bash
npx vitest run tests/unit/renderer/ui/primitives.test.tsx tests/unit/renderer/AppShell.test.tsx tests/unit/renderer/Hero1.test.tsx
```

Expected: FAIL with concrete breakpoints such as changed trigger semantics, changed wrapper exports, changed data-slot DOM, or class/behavior differences introduced by the regenerated primitives.

**Step 2: Update renderer consumers to the new primitive APIs**

Make the smallest consumer changes needed in:

- `src/renderer/components/layout/AppShell.tsx`
- `src/renderer/components/application-shell7.tsx`
- `src/renderer/components/application-shell10.tsx`
- `src/renderer/components/shadcnblocks/logo.tsx`

Prefer call-site updates like these over adding compatibility wrappers:

```tsx
<DialogTrigger asChild>
  <Button type="button">Open</Button>
</DialogTrigger>

<TooltipTrigger asChild>
  <Button variant="ghost" size="icon-sm" />
</TooltipTrigger>
```

If the regenerated component now exports a slightly different shape, update the consumer to that shape directly.

**Step 3: Update tests to assert stable behavior rather than stale generated internals**

Adjust the affected tests so they check roles, visible text, trigger behavior, and accessible structure instead of overfitting to exact class strings or old DOM internals. For example:

```tsx
expect(screen.getByRole('dialog')).toBeTruthy()
expect(screen.getByRole('menu')).toBeTruthy()
expect(screen.getByRole('button', { name: 'Collapse sidebar navigation' })).toBeTruthy()
```

Do not remove useful assertions. Replace brittle ones with semantic checks.

**Step 4: Run the focused suite until it is green**

Run:

```bash
npx vitest run tests/unit/renderer/ui/primitives.test.tsx tests/unit/renderer/AppShell.test.tsx tests/unit/renderer/Hero1.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/renderer/components/layout/AppShell.tsx src/renderer/components/application-shell7.tsx src/renderer/components/application-shell10.tsx src/renderer/components/shadcnblocks/logo.tsx tests/unit/renderer/AppShell.test.tsx tests/unit/renderer/Hero1.test.tsx tests/unit/renderer/ui/primitives.test.tsx
git commit -m "feat(renderer): realign shell consumers to v4 primitives"
```

### Task 4: Run full verification and capture migration evidence

**Files:**
- Modify: `docs/plans/2026-03-07-kat-259-shadcn-ui-v4-migration-design.md`
- Create: `docs/plans/2026-03-07-kat-259-shadcn-ui-v4-migration-evidence.md`

**Step 1: Run lint and the full renderer unit suite**

Run:

```bash
npm run lint
npm run test
```

Expected: PASS.

If `npm run test` is too broad due to unrelated pre-existing failures, record that explicitly and run the narrowest ticket-relevant suite instead.

**Step 2: Run an app-level smoke verification**

Use one of the approved verification paths from `AGENTS.md`:

```bash
npm run dev -- --remote-debugging-port=9222
```

Then in a second terminal:

```bash
npx agent-browser close
npx agent-browser connect 9222
npx agent-browser tab
npx agent-browser tab 0
npx agent-browser snapshot -i
npx agent-browser screenshot /tmp/kat-259-v4-migration.png
```

Expected: the desktop shell loads without obvious breakage and shared primitives render in the real app.

**Step 3: Record evidence**

Write `docs/plans/2026-03-07-kat-259-shadcn-ui-v4-migration-evidence.md` with:

```md
# KAT-259 Evidence

- Preset applied: `a1FAcdAe`
- `npx shadcn@latest info --json`: verified
- `npm run lint`: PASS
- `npm run test`: PASS
- App smoke evidence: `/tmp/kat-259-v4-migration.png`
- Notes: any retained app-specific theme extensions or deliberate post-preset customizations
```

If the design doc needs a small post-implementation note about a justified customization, add that as a short addendum instead of rewriting the design.

**Step 4: Re-run the final ticket-relevant checks**

Run:

```bash
npx vitest run tests/unit/renderer/ui/primitives.test.tsx tests/unit/renderer/AppShell.test.tsx tests/unit/renderer/Hero1.test.tsx
npm run lint
```

Expected: PASS.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-07-kat-259-shadcn-ui-v4-migration-design.md docs/plans/2026-03-07-kat-259-shadcn-ui-v4-migration-evidence.md
git commit -m "docs(renderer): add v4 migration verification evidence"
```
