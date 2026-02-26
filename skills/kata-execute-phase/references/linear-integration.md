<linear_integration>

Linear integration for Kata projects. Documents all integration points and configuration.

<overview>

## Purpose

Linear integration adds automatic Milestone and Issue creation to Kata workflows via Linear MCP tools. When enabled, Kata mirrors your roadmap structure to Linear:

- **Milestones** map to Kata milestones (e.g., v1.1.0) within a parent Linear Project
- **Issues** map to Kata phases within milestones (labeled "phase")
- **Checklist items** on phase issues map to Kata plans

This provides visibility into project progress via Linear's native tools.

**Mutual exclusivity:** Linear and GitHub integration are mutually exclusive. Enable one or the other, not both. If both `github.enabled` and `linear.enabled` are true, `check-config` warns.

## Relationship to pr_workflow

Linear integration (`linear.*`) and `pr_workflow` are independent but complementary:

| Config Key       | Controls                              | Independent? |
| ---------------- | ------------------------------------- | ------------ |
| `linear.enabled` | Linear Milestone/Issue creation       | Yes          |
| `pr_workflow`    | Branch strategy and PR-based releases | Yes          |

**Recommendation:** Enable both for full integration:
- `linear.enabled: true` -- Milestones and Issues track planning
- `pr_workflow: true` -- PRs track execution

Either can be used independently:
- `linear.enabled: true` + `pr_workflow: false` -- Issues without PRs (direct commits)
- `linear.enabled: false` + `pr_workflow: true` -- PRs without Issues (branch workflow only)

**Note:** Linear handles PR linking via its own Git integration. When `linear.enabled=true`, omit `Closes #N` lines from PR bodies (Linear does not use GitHub's auto-close convention).

</overview>

<config_keys>

## Configuration Keys

### `linear.enabled` (default: `false`)

Master toggle for Linear Milestone/Issue creation.

**When `true`:**
- Milestones created when starting new Kata milestones
- Issues created/updated based on `issue_mode`
- Progress tracking shows Linear status

**When `false`:**
- No Linear MCP calls
- Planning stays local to `.planning/` directory

### `linear.issue_mode` (default: `never`)

Controls when phase Issues are created.

| Value   | Behavior                                                                |
| ------- | ----------------------------------------------------------------------- |
| `auto`  | Create Issues automatically for each phase, no prompting                |
| `ask`   | Prompt once per milestone; decision applies to all phases in milestone  |
| `never` | Never create phase Issues (Milestones still created if `enabled: true`) |

**The `ask` flow:**

1. When starting first phase in a milestone, user is prompted:
   "Create Linear Issues for phases in v1.1.0? (y/n)"
2. Response is cached for that milestone
3. All subsequent phases in that milestone follow the cached decision
4. Next milestone prompts again

**Design rationale:**
- `auto` for teams that want full Linear mirroring
- `ask` for teams that want control per-milestone
- `never` for teams that only want milestone-level tracking (no phase granularity)

### `linear.team_id` (default: `''`)

Linear team UUID. Set during project initialization when user selects a team.

### `linear.team_name` (default: `''`)

Human-readable team name for display purposes.

### `linear.project_id` (default: `''`)

Linear project UUID. Set during project initialization when user selects or creates a project.

### `linear.project_name` (default: `''`)

Human-readable project name for display purposes.

</config_keys>

<integration_points>

## Integration Points by Skill

| Skill                     | Phase | Linear Action                       | Config Keys Checked                   |
| ------------------------- | ----- | ----------------------------------- | ------------------------------------- |
| `kata-new-project`        | 2     | Config onboarding, team/project     | None (creates config)                 |
| `kata-add-milestone`      | 2     | Create Linear Milestone             | `linear.enabled`                      |
| `kata-configure-settings` | 2     | Display/update linear.* settings    | N/A                                   |
| `kata-add-milestone`      | 3     | Create phase Issues (Phase 9.5)     | `linear.enabled`, `linear.issue_mode` |
| `kata-plan-phase`         | 4     | Update phase Issue with plan list   | `linear.enabled`, `linear.issue_mode` |
| `kata-execute-phase`      | 4     | Update Issue checklist per wave     | `linear.enabled`, `linear.issue_mode` |
| `kata-add-issue`          | --    | Create backlog Issue                | `linear.enabled`                      |
| `kata-check-issues`       | --    | Query/display Linear issues         | `linear.enabled`                      |
| `kata-complete-milestone` | 5     | Close milestone + phase issues      | `linear.enabled`                      |
| `kata-track-progress`     | 5     | Show Linear project/milestone/issue | `linear.enabled`                      |

### kata-new-project

**Hook:** During config onboarding (Phase 5)
**Action:** Present "Issue Tracker" choice (Linear / GitHub / None). If Linear selected:
1. Call `mcp__plugin_linear_linear__list_teams` -- present teams via AskUserQuestion
2. Call `mcp__plugin_linear_linear__list_projects` for selected team -- present projects (include "Create new project")
3. If "Create new project": call `mcp__plugin_linear_linear__save_project`
4. Store `linear.team_id`, `linear.team_name`, `linear.project_id`, `linear.project_name`
5. Ask issue_mode follow-up (auto/ask/never)
6. Set `linear.enabled=true`, `github.enabled=false`

### kata-add-milestone (Phase 5.5: Milestone Creation)

**Hook:** After milestone directory created, before returning
**Action:** Create Linear Milestone via MCP
**Config checked:** `linear.enabled`, `linear.project_id`

```
If LINEAR_ENABLED=true:
1. Read linear.project_id from config
2. Call list_milestones to check if v${VERSION} exists
3. If not: call save_milestone with project ID, name v${VERSION}, description
4. Display: "Linear Milestone v${VERSION} created"
```

### kata-add-milestone (Phase 9.5: Phase Issue Creation)

**Hook:** After ROADMAP.md committed and Linear Milestone created
**Action:** Create Issue for each phase in milestone
**Config checked:** `linear.enabled`, `linear.issue_mode`

```
If LINEAR_ENABLED=true and issue_mode permits:
1. Read linear.team_name, linear.project_name from config
2. For each phase parsed from ROADMAP.md:
   - Check if issue exists via list_issues with title filter
   - If not: call save_issue with team, title, description, project, labels ["phase"]
3. Display summary
```

### kata-plan-phase (Step 13: Plan Checklist Update)

**Hook:** After PLAN.md files created
**Action:** Update phase issue with plan checklist
**Config checked:** `linear.enabled`, `linear.issue_mode`

```
If LINEAR_ENABLED=true and ISSUE_MODE != never:
1. Find phase issue via list_issues with project and title filter
2. Build plan checklist from PLAN.md files
3. Get current issue via get_issue
4. Update description replacing plans placeholder with checklist via save_issue
```

### kata-execute-phase (Step 4: Wave Completion)

**Hook:** After each wave completes
**Action:** Check off completed plans in issue
**Config checked:** `linear.enabled`, `linear.issue_mode`

```
If LINEAR_ENABLED=true and ISSUE_MODE != never:
1. Find phase issue via list_issues
2. Get current description via get_issue
3. Update checkboxes for completed plans
4. Call save_issue with updated description
```

### kata-execute-phase (Step 8: Phase Completion)

**Hook:** When phase execution completes
**Action:** Set phase issue state to "done"

```
mcp__plugin_linear_linear__save_issue({
  id: PHASE_ISSUE_ID,
  state: "done"
})
```

### kata-add-issue

**Hook:** When creating backlog issues
**Action:** Create Linear issue with "backlog" label
**Config checked:** `linear.enabled`

```
If LINEAR_ENABLED=true:
1. Create backlog label via create_issue_label (idempotent)
2. Call save_issue with team, title, description, project, labels ["backlog"]
3. Update local file provenance: linear:${IDENTIFIER}
```

### kata-check-issues

**Hook:** When checking issue status
**Action:** Query Linear issues, display alongside local issues
**Config checked:** `linear.enabled`

```
If LINEAR_ENABLED=true:
1. Call list_issues with project and backlog/phase status
2. Display Linear-only issues with [LIN] indicator
3. Action handlers (work on, mark complete, link, view) use Linear MCP tools
```

### kata-complete-milestone

**Hook:** When completing a milestone
**Action:** Close phase issues and milestone
**Config checked:** `linear.enabled`

```
If LINEAR_ENABLED=true:
1. List phase issues via list_issues with project + milestone filter
2. Set each to "done" via save_issue
3. Set milestone target date to today via save_milestone (marks as complete)
```

### kata-track-progress

**Hook:** When displaying status
**Action:** Include Linear project/milestone/issue status
**Config checked:** `linear.enabled`

```
If LINEAR_ENABLED=true:
1. Call get_project with project ID
2. Call list_milestones for current milestone status
3. Display:
   Linear Status:
     Project: ${PROJECT_NAME}
     Milestone: v${VERSION} (X/Y issues done)
     Current Phase: ${IDENTIFIER} (${STATE})
```

</integration_points>

<issue_mode_behavior>

## issue_mode Detailed Behavior

### `auto` Mode

Issues created immediately when phase planning completes. No prompts.

**Timeline:**
1. `/kata-plan-phase 1` -- Phase 1 planned -- Issue created
2. `/kata-plan-phase 2` -- Phase 2 planned -- Issue created

**Use when:** Full Linear visibility with no manual intervention.

### `ask` Mode

Prompts once per milestone. Decision cached in STATE.md.

**Timeline:**
1. `/kata-plan-phase 1` -- "Create Issues for v1.1.0?" -- User: "y"
2. Phase 1 planned -- Issue created (decision cached)
3. `/kata-plan-phase 2` -- Phase 2 planned -- Issue created (no prompt, uses cache)
4. New milestone v1.2.0 starts...
5. `/kata-plan-phase 1` -- "Create Issues for v1.2.0?" -- User: "n"
6. Phase 1 planned -- No issue created

**Cache location:** STATE.md under `### Linear Decisions`

```markdown
### Linear Decisions

| Milestone | Issues? | Decided    |
| --------- | ------- | ---------- |
| v1.1.0    | yes     | 2026-01-25 |
| v1.2.0    | no      | 2026-01-26 |
```

**Use when:** Control per-milestone without per-phase prompts.

### `never` Mode

No phase Issues created. Milestones still created if `linear.enabled: true`.

**Timeline:**
1. `/kata-add-milestone v1.1.0` -- Linear Milestone created
2. `/kata-plan-phase 1` -- Phase 1 planned -- No issue

**Use when:** Milestone-level tracking only, or Issues managed manually.

</issue_mode_behavior>

<mcp_tool_patterns>

## Linear MCP Tool Patterns

All Linear integration uses `mcp__plugin_linear_linear__*` MCP tools. Authentication handled externally by the Linear MCP server configuration.

### Team Operations

```
# List available teams
mcp__plugin_linear_linear__list_teams()
# Returns: array of {id, name, key}

# Get team details
mcp__plugin_linear_linear__get_team({teamId: "TEAM_UUID"})
```

### Project Operations

```
# List projects
mcp__plugin_linear_linear__list_projects({teamId: "TEAM_UUID"})
# Returns: array of {id, name, description, state}

# Create project
mcp__plugin_linear_linear__save_project({
  name: "Project Name",
  description: "Project description",
  teamIds: ["TEAM_UUID"]
})

# Get project details
mcp__plugin_linear_linear__get_project({projectId: "PROJECT_UUID"})
```

### Milestone Operations

```
# List milestones for project
mcp__plugin_linear_linear__list_milestones({projectId: "PROJECT_UUID"})
# Returns: array of {id, name, targetDate, sortOrder}

# Create milestone
mcp__plugin_linear_linear__save_milestone({
  name: "v1.1.0",
  description: "Milestone description",
  projectId: "PROJECT_UUID"
})

# Update milestone (mark complete by setting target date)
mcp__plugin_linear_linear__save_milestone({
  id: "MILESTONE_UUID",
  targetDate: "2026-02-25"
})
```

### Issue Operations

```
# List issues with filters
mcp__plugin_linear_linear__list_issues({
  teamId: "TEAM_UUID",
  projectId: "PROJECT_UUID",
  labels: ["phase"]
})

# Create issue
mcp__plugin_linear_linear__save_issue({
  teamId: "TEAM_UUID",
  title: "Phase 1: Feature Name",
  description: "## Goal\n\n...",
  projectId: "PROJECT_UUID",
  labels: ["phase"]
})

# Update issue
mcp__plugin_linear_linear__save_issue({
  id: "ISSUE_UUID",
  description: "Updated description with checkboxes"
})

# Get issue details
mcp__plugin_linear_linear__get_issue({issueId: "ISSUE_UUID"})

# Set issue state
mcp__plugin_linear_linear__save_issue({
  id: "ISSUE_UUID",
  state: "done"
})
```

### Label Operations

```
# Create label (idempotent)
mcp__plugin_linear_linear__create_issue_label({
  teamId: "TEAM_UUID",
  name: "phase",
  color: "#0E8A16",
  description: "Kata phase tracking"
})
```

### Issue Status Operations

```
# List available statuses for team
mcp__plugin_linear_linear__list_issue_statuses({teamId: "TEAM_UUID"})
# Returns: array of {id, name, type} where type is "backlog"|"unstarted"|"started"|"completed"|"cancelled"

# Get issue status
mcp__plugin_linear_linear__get_issue_status({statusId: "STATUS_UUID"})
```

</mcp_tool_patterns>

<error_handling>

## Error Handling

Linear operations are **non-blocking**. Failures warn but do not stop Kata workflows.

### MCP Tool Unavailability

If the Linear MCP server is not configured or not responding:

```
If MCP tool call fails:
  Display: "Warning: Linear MCP tools unavailable. Linear integration skipped."
  Continue without Linear operations.
```

### Authentication Failures

Linear MCP handles authentication internally. If the server returns auth errors:

```
Display: "Warning: Linear authentication failed. Check your Linear MCP server configuration."
Continue without Linear operations.
```

### API Errors

All operations are idempotent where possible:
- Milestone creation: check if exists first via `list_milestones`
- Issue creation: check if exists via `list_issues` with title filter
- Label creation: `create_issue_label` is idempotent

If creation fails after existence check:

```
Display: "Warning: Failed to create Linear [entity]. Continuing without Linear integration."
```

### Rate Limiting

If rate limited, warn and continue. Linear operations can be retried manually.

</error_handling>

<provenance_format>

## Provenance Format

Local issue files track their Linear counterpart using the provenance field:

```markdown
provenance: linear:KAT-42
```

The format is `linear:IDENTIFIER` where IDENTIFIER is the human-readable Linear issue identifier (team key + number).

**Comparison with GitHub provenance:**

| Tracker | Format            | Example              |
| ------- | ----------------- | -------------------- |
| GitHub  | `github:#NUMBER`  | `github:#42`         |
| Linear  | `linear:TEAM-NUM` | `linear:KAT-42`     |

</provenance_format>

<summary>

## Skills Affected Summary

| Skill                     | Phase | Linear Action                       | Config Keys Checked                   |
| ------------------------- | ----- | ----------------------------------- | ------------------------------------- |
| `kata-new-project`        | 2     | Config onboarding, team/project     | None (creates config)                 |
| `kata-add-milestone`      | 2     | Create Linear Milestone             | `linear.enabled`                      |
| `kata-configure-settings` | 2     | Display/update linear.* settings    | N/A                                   |
| `kata-add-milestone`      | 3     | Create phase Issues (Phase 9.5)     | `linear.enabled`, `linear.issue_mode` |
| `kata-plan-phase`         | 4     | Update phase Issue with plan list   | `linear.enabled`, `linear.issue_mode` |
| `kata-execute-phase`      | 4     | Update Issue checklist per wave     | `linear.enabled`, `linear.issue_mode` |
| `kata-add-issue`          | --    | Create backlog Issue                | `linear.enabled`                      |
| `kata-check-issues`       | --    | Query/display Linear issues         | `linear.enabled`                      |
| `kata-complete-milestone` | 5     | Close milestone + phase issues      | `linear.enabled`                      |
| `kata-track-progress`     | 5     | Show Linear project/milestone/issue | `linear.enabled`                      |

**See:** [planning-config.md](planning-config.md) for config schema and reading patterns.
**See:** [github-integration.md](github-integration.md) for the GitHub counterpart (mutually exclusive).

</summary>

</linear_integration>
