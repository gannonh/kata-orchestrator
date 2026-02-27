# Linear Integration for Kata Workflows

## Context

Kata has optional GitHub Milestone/Issue tracking (`github.enabled`). This feature adds Linear as a replacement tracker option. When `linear.enabled=true`, all workflows that currently create/update GitHub Issues/Milestones instead use Linear MCP tools. The design mirrors the existing GitHub integration pattern for consistency.

**Design decisions:**
- Linear replaces GitHub when enabled (mutually exclusive)
- Uses Linear MCP tools directly (`mcp__plugin_linear_linear__*`) in skill workflows, no wrapper scripts
- Kata Milestone → Linear Milestone (within a parent Linear Project), Kata Phase → Linear Issue, Kata Plan → checklist items on phase issue
- Provenance format: `linear:KAT-42` (human-readable identifier)

## Entity Mapping

| Kata Concept | Linear Entity | MCP Tool |
|---|---|---|
| Project setup | Linear Project | `list_projects` / `save_project` |
| Milestone (v1.0) | Linear Milestone | `save_milestone` / `list_milestones` |
| Phase | Linear Issue (labeled "phase") | `save_issue` / `list_issues` |
| Plan | Checklist item on phase issue | `save_issue` (update description) |
| Backlog issue | Linear Issue (status: backlog) | `save_issue` / `list_issues` |

## Tasks

### Task 1: Config schema — kata-lib.cjs

**File:** `skills/_shared/kata-lib.cjs`

Add to DEFAULTS (after line 67):
```javascript
'linear.enabled': 'false',
'linear.issue_mode': 'never',
'linear.team_id': '',
'linear.team_name': '',
'linear.project_id': '',
'linear.project_name': '',
```

Add to KNOWN_KEYS (after line 89):
```javascript
'linear.enabled': { type: 'boolean' },
'linear.issue_mode': { type: 'enum', values: ['auto', 'ask', 'never'] },
'linear.team_id': { type: 'string' },
'linear.team_name': { type: 'string' },
'linear.project_id': { type: 'string' },
'linear.project_name': { type: 'string' },
```

Add cross-key validation in `cmdCheckConfig()` — warn if both `github.enabled` and `linear.enabled` are true.

**Verify:** `node skills/_shared/kata-lib.cjs check-config` runs without error.

### Task 2: New reference doc — linear-integration.md

**File:** `skills/kata-execute-phase/references/linear-integration.md` (new)

Create parallel to `github-integration.md` (523 lines). Document:
- Overview: purpose, relationship to `pr_workflow`
- Config keys: `linear.enabled`, `linear.issue_mode`, `linear.team_id`, `linear.team_name`, `linear.project_id`, `linear.project_name`
- Integration points by skill (same table structure as github-integration.md `<summary>` section)
- MCP tool call patterns (replacing the `gh` CLI patterns)
- Issue mode behavior (auto/ask/never — same semantics as GitHub)
- Error handling (non-blocking, warn on failure)
- Provenance format: `linear:IDENTIFIER`

### Task 3: New reference doc — linear-mapping.md

**File:** `skills/kata-add-milestone/references/linear-mapping.md` (new)

Document entity mapping, milestone creation flow via MCP, phase issue creation flow via MCP, issue body template. Referenced by kata-add-milestone's `<execution_context>`.

### Task 4: kata-new-project — Linear setup option

**File:** `skills/kata-new-project/SKILL.md`

**Phase 5 (lines 314-321):** Replace "GitHub Tracking" question with "Issue Tracker" question:

```
{
  header: "Issue Tracker",
  question: "Enable external issue tracking?",
  options: [
    { label: "Linear", description: "Linear Project + Milestone tracking, Issues for phases" },
    { label: "GitHub", description: "GitHub Milestones, optionally Issues for phases" },
    { label: "None", description: "Keep planning local to .planning/ directory only" }
  ]
}
```

**If "Linear" selected, add Linear setup flow (before GitHub Repository Check block, lines 349-399):**

1. Call `mcp__plugin_linear_linear__list_teams` → present teams via AskUserQuestion
2. Call `mcp__plugin_linear_linear__list_projects` for selected team → present projects via AskUserQuestion (include "Create new project" option)
3. If "Create new project": call `mcp__plugin_linear_linear__save_project`
4. Store `linear.team_id`, `linear.team_name`, `linear.project_id`, `linear.project_name`
5. Ask Issue Creation follow-up (same auto/ask/never pattern, lines 336-346)
6. Set `linear.enabled=true`, `github.enabled=false`, `linear.issue_mode` based on choice

**If "GitHub" selected:** Existing flow unchanged. Sets `github.enabled=true`, `linear.enabled=false`.

**If "None":** Sets both disabled.

**Config output (lines 401-423):** Add `linear` block to the JSON template:

```json
"linear": {
  "enabled": true|false,
  "issue_mode": "auto|ask|never",
  "team_id": "...",
  "team_name": "...",
  "project_id": "...",
  "project_name": "..."
}
```

**GitHub Tracking conditional logic (lines 430-449):** Add parallel Linear conditional block.

### Task 5: kata-add-milestone — Linear milestone + phase issues

**File:** `skills/kata-add-milestone/SKILL.md`

**Phase 5.5 (lines 163-264):** Add Linear branch before the `GITHUB_ENABLED=false` skip:

```bash
LINEAR_ENABLED=$(node scripts/kata-lib.cjs read-config "linear.enabled" "false")
```

If `LINEAR_ENABLED=true`:
1. Read `linear.project_id` from config
2. Call `mcp__plugin_linear_linear__list_milestones` to check if `v${VERSION}` exists
3. If not: call `mcp__plugin_linear_linear__save_milestone` with project ID, name `v${VERSION}`, description
4. Display: `Linear Milestone v${VERSION} created`

**Phase 9.5 (lines 1041-1210):** Add Linear branch parallel to GitHub:

After line 1043, add:
```bash
LINEAR_ENABLED=$(node scripts/kata-lib.cjs read-config "linear.enabled" "false")
```

If `LINEAR_ENABLED=true` and issue_mode permits:
1. Read `linear.issue_mode`, `linear.team_name`, `linear.project_name` from config
2. For each phase parsed from ROADMAP.md (reuse existing parsing logic from lines 1086-1153):
   - Check if issue exists via `mcp__plugin_linear_linear__list_issues` with title filter
   - If not: call `mcp__plugin_linear_linear__save_issue` with team, title `Phase ${PHASE_NUM}: ${PHASE_NAME}`, description (goal + success criteria + plans placeholder), project, labels `["phase"]`
3. Display summary: `Linear Phase Issues: [N] created for milestone v${VERSION}`

**Execution context:** Add `@./references/linear-mapping.md` reference.

### Task 6: kata-plan-phase — Linear issue update

**File:** `skills/kata-plan-phase/SKILL.md`

**Step 13 (lines 630-716):** Add Linear branch after the GitHub section:

```bash
LINEAR_ENABLED=$(node scripts/kata-lib.cjs read-config "linear.enabled" "false")
LINEAR_ISSUE_MODE=$(node scripts/kata-lib.cjs read-config "linear.issue_mode" "never")
```

If `LINEAR_ENABLED=true` and `LINEAR_ISSUE_MODE != never`:
1. Find phase issue via `mcp__plugin_linear_linear__list_issues` with project and title filter `Phase ${PHASE}:`
2. Build plan checklist (reuse existing logic from lines 670-687)
3. Get current issue via `mcp__plugin_linear_linear__get_issue`
4. Update description replacing plans placeholder with checklist via `mcp__plugin_linear_linear__save_issue`

**offer_next (lines 723-761):** Add Linear status line: `Linear Issue: ${IDENTIFIER} updated with ${PLAN_COUNT} plan checklist items`

### Task 7: kata-execute-phase — Linear checkbox + status updates

**File:** `skills/kata-execute-phase/SKILL.md`

**Step 0.6 (around line 57):** Add Linear config reads:
```bash
LINEAR_ENABLED=$(node scripts/kata-lib.cjs read-config "linear.enabled" "false")
LINEAR_ISSUE_MODE=$(node scripts/kata-lib.cjs read-config "linear.issue_mode" "never")
```

**Step 4 (around line 258):** After wave completion, add Linear branch:
If `LINEAR_ENABLED=true` and `LINEAR_ISSUE_MODE != never`:
1. Find phase issue via `list_issues`
2. Get current description via `get_issue`
3. Update checkboxes `- [ ]` → `- [x]` for completed plans
4. Call `save_issue` with updated description

**Step 8 (around line 594):** On phase completion, add:
```
mcp__plugin_linear_linear__save_issue({
  id: PHASE_ISSUE_ID,
  state: "done"
})
```

**offer_next:** Add Linear status line.

**File:** `skills/kata-execute-phase/scripts/update-issue-checkboxes.sh`

Add Linear guard after line 29:
```bash
LINEAR_ENABLED=$(node "$SCRIPT_DIR/kata-lib.cjs" read-config "linear.enabled" "false")
if [ "$LINEAR_ENABLED" = "true" ]; then
  echo "Skipped: Linear updates handled by orchestrator via MCP tools"
  exit 0
fi
```

**File:** `skills/kata-execute-phase/scripts/create-draft-pr.sh`

After line 34, add:
```bash
LINEAR_ENABLED=$(node "$SCRIPT_DIR/kata-lib.cjs" read-config "linear.enabled" "false")
```

At line 58, add Linear branch — skip `CLOSES_LINE` when Linear enabled (Linear handles PR linking via its own Git integration).

**File:** `skills/kata-execute-phase/references/github-integration.md`

Add note in `<overview>` about mutual exclusivity with Linear. Add cross-reference to `linear-integration.md`.

### Task 8: kata-add-issue — Linear sync

**File:** `skills/kata-add-issue/SKILL.md`

**Step sync_to_github (line 158):** Add parallel Linear branch:

If `LINEAR_ENABLED=true`:
1. Create backlog label via `create_issue_label` (idempotent)
2. Call `save_issue` with team, title, description, project, labels `["backlog"]`
3. Update local file provenance: `linear:${IDENTIFIER}`

Skip the GitHub path entirely when `LINEAR_ENABLED=true`.

**Success criteria:** Add `- [ ] Linear Issue created (if linear.enabled=true)` alongside the GitHub criterion (line 308-309).

### Task 9: kata-check-issues — Linear queries

**File:** `skills/kata-check-issues/SKILL.md`

**Step 1 (line 93):** Add Linear config check:
```bash
LINEAR_ENABLED=$(node scripts/kata-lib.cjs read-config "linear.enabled" "false")
```

**Step 2 (line 101):** Add Linear provenance dedup:
```bash
LOCAL_PROVENANCE_LINEAR=$(grep -h "^provenance: linear:" .planning/issues/open/*.md .planning/issues/in-progress/*.md 2>/dev/null | grep -oE '[A-Z]+-[0-9]+' | sort -u)
```

**Step 3 (line 105):** Add Linear query branch:
If `LINEAR_ENABLED=true`: call `list_issues` with project and backlog status. Display Linear-only issues with `[LIN]` indicator (parallel to `[GH]`).

**Action handlers:** For each action (Work on it now, Mark complete, Link to phase, Pull to local), add Linear branches that mirror GitHub logic:
- "Pull to local" (line 302): create local file with `provenance: linear:IDENTIFIER`
- "Work on it now" (line 355): call `save_issue` to set state "in progress" and assign
- "Mark complete" (line 936): call `save_issue` to set state "done"
- "View on Linear" (new option for `[LIN]` issues)

### Task 10: kata-complete-milestone — Linear milestone closure

**File:** `skills/kata-complete-milestone/SKILL.md`

**Step 6.7 (line 295):** Add Linear branch:
```
If linear.enabled:
1. List phase issues via list_issues with project + milestone filter
2. Set each to "done" via save_issue
3. Set milestone target date to today via save_milestone (marks it as complete)
```

**File:** `skills/kata-complete-milestone/references/milestone-complete.md`

Add `close_linear_milestone` step parallel to `close_github_milestone`.

**PR body (lines 320-338):** When Linear enabled, omit `Closes #N` lines (Linear doesn't use GitHub's auto-close convention).

### Task 11: kata-track-progress — Linear status display

**File:** `skills/kata-track-progress/SKILL.md`

Add Linear status section in the report step:

If `LINEAR_ENABLED=true`:
1. Call `get_project` with project ID
2. Call `list_milestones` for current milestone status
3. Display:
```
Linear Status:
  Project: ${PROJECT_NAME}
  Milestone: v${VERSION} (X/Y issues done)
  Current Phase: ${IDENTIFIER} (${STATE})
```

### Task 12: kata-configure-settings — Linear toggle

**File:** `skills/kata-configure-settings/SKILL.md`

Add Linear config reads alongside GitHub reads. Replace implicit GitHub settings with "Issue Tracker" subsection (Linear/GitHub/None). When switching to Linear from None/GitHub, trigger Linear setup flow (team/project selection via MCP). When switching away, set `linear.enabled=false`.

### Task 13: planning-config.md — Linear schema docs

**File:** `skills/kata-execute-phase/references/planning-config.md`

Update `<config_schema>` section to include `linear.*` keys. Add `<linear_integration>` section parallel to any GitHub references. Note mutual exclusivity.

## Implementation Sequence

1. **Task 1** (kata-lib.cjs) — foundation, everything depends on this
2. **Tasks 2-3** (reference docs) — documentation, no skill dependencies
3. **Task 4** (kata-new-project) — entry point for new projects
4. **Task 5** (kata-add-milestone) — milestone + phase issue creation
5. **Task 6** (kata-plan-phase) — plan checklist updates
6. **Task 7** (kata-execute-phase) — execution-time updates, scripts
7. **Tasks 8-9** (kata-add-issue, kata-check-issues) — backlog lifecycle
8. **Tasks 10-11** (kata-complete-milestone, kata-track-progress) — completion + visibility
9. **Tasks 12-13** (kata-configure-settings, planning-config) — settings management

## Verification

1. **Config validation:** `node skills/_shared/kata-lib.cjs check-config` with a config.json containing `linear.*` keys
2. **Build:** `npm run build:plugin` succeeds
3. **Tests:** `npm run test:scripts` passes, `npm test` passes
4. **Manual smoke test:** Create test project with `--plugin-dir`, run `/kata-new-project`, select Linear, verify config.json written with `linear.*` keys
5. **MCP tool availability:** Verify `mcp__plugin_linear_linear__list_teams` returns results (requires Linear auth configured)
