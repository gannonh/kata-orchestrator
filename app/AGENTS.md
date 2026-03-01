# AGENTS.md (Desktop App)

This file applies to work under `app/` and complements the root `AGENTS.md`.

## Scope

- Use this file for desktop-shell work in `app/`.
- Keep Kata core/plugin workflows in root `AGENTS.md`.
- Treat this file as the authoritative desktop planning/execution guide; keep root-level guidance summary-only.

## Project Management

Linear is the single source of truth for all desktop project management: task priority, execution order, blockers, status, and acceptance criteria.

- Project: [Kata Desktop App](https://linear.app/kata-sh/project/kata-desktop-app-bf73d7f4dfbb/overview)
- Execution model: Linear document "Execution Model: UI Baseline then Parallel Functional Vertical Slices"
- Workflow contract: Linear document "Desktop App Linear Workflow Contract"
- Use the `/kata-linear` skill for ticket lifecycle (start, end, next). Use `/linear` for general Linear queries.
- Always pass `includeRelations: true` when calling `get_issue` to see blocking dependencies.
- Always reference the attached media as the source of truth for design specs and mocks.

### Determining What to Work on Next

1. **Check `Todo` status first.** Query issues in the `Kata Desktop App` project with state `Todo`. These have been groomed and are ready to start.
2. **If nothing is in `Todo`, resolve from blocking relations.** Use `get_issue` with `includeRelations: true` on `track:ui-fidelity` issues to find the first issue whose blockers are all `Done`.
3. **Read the execution model document** in Linear for the full dependency contract between pillars (UI baseline vs. functional slices) and lanes.

## Design Specs and Mocks

- Spec index: `_plans/design/specs/README.md` (maps spec numbers to files and mocks)
- Spec files: `_plans/design/specs/*.md` (component inventories, states, interactions, visual tokens)
- Mock PNGs: `_plans/design/mocks/*.md` (numbered in user journey order, README has descriptions)

## Starting Work on an Issue

1. Fetch the issue from Linear with `get_issue` using `includeRelations: true`. Confirm all blockers are `Done`.
2. Identify which design spec(s) apply from the issue description or `_plans/design/specs/README.md`
3. Read the relevant spec file(s) and mock PNGs
4. Check existing components in `src/renderer/components/`
5. Create a feature branch
6. Write failing tests first (TDD is mandatory)

### Completing an Issue

- Do not move issues to `Done` without linked evidence (tests, screenshots, or traceable PR notes) for referenced spec states/interactions.
- After completing an issue, check if the next issue in the blocking chain can be promoted to `Todo`.

## Desktop Architecture

- Main process: `src/main/`
- Preload bridge: `src/preload/`
- Renderer UI: `src/renderer/`
- Unit tests: `tests/unit/`
- E2E/UAT tests: `tests/e2e/`


## Commands

From repo root (preferred):

```bash
# Run desktop app in dev mode
npm run dev

# Run desktop unit tests
npm run test:app

# Run desktop coverage gate
npm run test:app:coverage

# Run desktop quality gate (lint + coverage + @quality-gate E2E subset)
npm run test:app:quality-gate

# Run full CI pipeline locally (core + desktop)
npm run test:ci:local

# Run desktop CI-equivalent checks only
npm run -w app test:ci:local

# Run CI-tagged desktop E2E
npm run test:app:e2e:ci

# Run full desktop UAT E2E
npm run test:app:e2e
```

From `app/` directly:

```bash
npm run lint
npm run test
npm run test:coverage
npm run test:ci:local
npm run test:e2e:quality-gate
npm run test:e2e:ci
npm run test:e2e
```

## Claude Desktop Preview

The renderer can run as a standalone web app for use with Claude Desktop's server preview feature.

```bash
# From app/
npm run dev:web
```

This uses `vite.config.web.ts` which:
- Serves only the renderer on port 5199 (no Electron main/preload)
- Strips `frame-ancestors 'none'` from the CSP so the preview iframe can embed it

The `.claude/launch.json` config points to `dev:web`. After `preview_start`, the preview panel **will** stay on "Awaiting server..." indefinitely. This is a known Claude Preview limitation with this app. Do not debug it. Do not modify `launch.json` (the schema has no `url`/`startUrl` field to fix this).

After every `preview_start`, immediately run these two commands:

```
preview_eval: window.location.href = 'http://localhost:5199'
preview_resize: 1280x800
```

Port 5199 is hardcoded (`strictPort: true`) to avoid the mismatch where Vite auto-increments past the port the preview expects.

## Guardrails

- Keep renderer code browser-safe (`nodeIntegration: false`, `contextIsolation: true`).
- Expose APIs via preload only; avoid direct Node access from renderer.
- Add or update tests for behavior changes in main/preload/renderer.
- Keep E2E tags (`@quality-gate`, `@ci`, `@uat`) aligned with CI jobs.

## Mandatory TDD

1. Test Driven Development is mandatory for all code changes. 
2. Write tests before implementation, ensure they fail, then implement the feature until tests pass.
3. Use the Test Driven Development Agent Skill (`test-driven-development`) for guidance.

## Pencil Design Sync

Design source of truth: `pencil/ui-01.pen` (Pencil MCP). Code source of truth: `app/src/renderer/`.

### Token Contract

Both systems share the same CSS variable names. The canonical values live in `app/src/renderer/app.css` (OkLCh format). Pencil stores hex equivalents.

When a token changes:
1. Update `app.css` first (OkLCh values)
2. Convert to hex and push to Pencil via `set_variables`

Current token set (55 variables): core shadcn palette, sidebar, chart, status, alert, gradient, magicui, font, and radius tokens.

### Component Coverage

Pencil has 87 reusable components (variant-level). Code has 22 shadcn primitives in `src/renderer/components/ui/`. The Pencil components that have no code equivalent yet:

select, radio-group, switch, progress, accordion, alert, pagination, table, modal, list items, combobox, input-otp

Install these via `npx shadcn@latest add <name>` when a feature requires them. Do not install speculatively.

### Iteration Workflow

**Pencil-first** (new screens, layout exploration):
1. Design in Pencil using existing reusable components and `$variable` references
2. `get_screenshot` the frame for visual reference
3. Implement in React to match, using the same CSS variables
4. Verify with side-by-side comparison

**Code-first** (behavior-driven changes):
1. Build the React component
2. Update or create the corresponding Pencil frame to reflect the shipped state
3. Keep Pencil as a living record, not a stale spec

### Rules

- New Pencil components must use `$variable` references, not hardcoded colors
- Pencil component names should map to code: `Button/Default` = `button.tsx` variant `default`
- When adding a shadcn primitive to code, check if Pencil already has the component designed
- When designing a new component in Pencil, note the target code path in the component's `context` property

## SHADCN Adoption

- Desktop renderer UI standard is now SHADCN-first.
- SHADCN UI primitives live in `src/renderer/components/ui/`.
- SHADCN Blocks compositions live in `src/renderer/components/shadcnblocks/`.
- Keep utility/style composition aligned with the configured SHADCN aliases and tokens in `components.json`.

## Private Component Registry (React Source of Truth)

Private shadcn-compatible component registry:
- Repo: `https://github.com/gannonh/kata-shadcn`
- Deploy: `https://shadcn-registry-eight.vercel.app`

Rules:
1. Prefer installing from `@kata-shadcn` before creating new one-off components.
2. Shared component changes belong in `kata-shadcn` (source repo), not in generated downstream copies.
3. Pushing to `main` in `kata-shadcn` triggers Vercel deployment; verify install behavior after deploy.

### Auth

Endpoints under `/r/*` require an `x-registry-token` header except these public passthroughs for built-in shadcn dependencies:

- `/r/styles/*` — style definitions
- `/r/colors/*` — color registry
- `/r/icons/*` — icon registry

Compatibility endpoints under `/styles/*` proxy to the public shadcn registry for unscoped dependencies (e.g. `utils`, `button`) that the CLI resolves via `styles/{style}/{name}.json`.

When running a local copy of the registry, auth can be disabled when `REGISTRY_TOKEN` is not set (local dev mode). Do not assume this for the deployed Vercel URL.

### Setup

In the consuming project's `components.json`:

```json
{
  "registries": {
    "@kata-shadcn": {
      "url": "https://shadcn-registry-eight.vercel.app/r/{name}.json",
      "headers": {
        "x-registry-token": "${REGISTRY_TOKEN}"
      }
    }
  }
}
```

Add `REGISTRY_TOKEN=<token>` to the consuming project's `.env`.

Install a component:

```bash
npx shadcn add @kata-shadcn/hero1
```

The install prefix must match the registry key in `components.json` (`<registry-key>/<component-name>`).

For install verification without touching production component paths, use `--path` to a temp folder and verify `git status` afterward:

```bash
npx shadcn add @kata-shadcn/alert-alert-warning-1 --path ./tmp/registry-install --yes
```

### Discovery endpoints

Use the compact index for initial filtering (~80-100KB). Fetch the full index only when enriched metadata (tags, complexity, hashes) is needed. All endpoints require `x-registry-token: <token>`.

| Endpoint                    | Description                          | Response shape                                                                                                                                                  |
| --------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /r/index-compact.json` | Lightweight discovery (~80-100KB)    | `{ total, items: [{ name, category, url }] }`                                                                                                                   |
| `GET /r/index.json`         | Full enriched index                  | `{ total, items: [{ name, title, description, category, url, tags, complexity: { files, lines, dependencies }, contentHash, lastModified?, peerComponents }] }` |
| `GET /r/{name}.json`        | Single component (shadcn CLI format) | `{ name, type, title, description, files: [{ path, content, type }], dependencies?, registryDependencies? }`                                                    |

`lastModified` is omitted when git history is unavailable.

### Categories

Components are organized into 31 curated categories. Filter `items` client-side on the `category` field. Valid values:

About, Alert & Dialog, Avatar, Blog, Button, Card, Chart, Contact, Content, CTA, Data & Table, Feature, Footer, Forms - Input & Text, Forms - Select & Controls, Gallery, Hero, Navigation, Other, Pricing, Product, Progress & Skeleton, Projects, Services, Settings, Sidebar, Tabs & Accordion, Testimonial, Timeline, Tooltip & Popover, Trust & Logos

### Workflow

1. `GET /r/index-compact.json` — filter by `name` or `category` (e.g. `category === "Hero"`)
2. Pick an entry, note `name` and `url`
3. (Optional) `GET /r/{name}.json` — inspect full source and dependencies
4. Install: `npx shadcn add @kata-shadcn/{name}`

## Validating Work

- In addition to unit and e2e tests, validate your work using agent-browser and / or playwright cli. Use screenshots and video as proof when applicable.