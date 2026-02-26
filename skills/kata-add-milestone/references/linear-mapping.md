# Kata-Linear Primitive Mapping

This document defines how Kata concepts map to Linear primitives when `linear.enabled=true`.

## Mapping Table

| Kata Concept  | Linear Primitive     | Created By                  | Notes                                                            |
| ------------- | -------------------- | --------------------------- | ---------------------------------------------------------------- |
| **Project**   | Linear Project       | `new-project` (Phase 5)    | Parent container. Team + Project selected during project init.   |
| **Milestone** | Linear Milestone     | `add-milestone` (Phase 5.5) | 1:1 mapping. Version becomes milestone name within the project. |
| **Phase**     | Linear Issue         | `add-milestone` (Phase 9.5) | Assigned to project. `phase` label applied.                     |
| **Plan**      | Checklist in Issue   | `plan-phase` (Step 13)      | Plans become `- [ ]` items in phase issue description.          |
| **Task**      | N/A                  | Not mapped                  | Tasks are internal execution units, not surfaced to Linear.     |

## Linear Config Keys

| Key                  | Values               | Effect                                   |
| -------------------- | -------------------- | ---------------------------------------- |
| `linear.enabled`     | `true`/`false`       | Master toggle for all Linear integration |
| `linear.issue_mode`  | `auto`/`ask`/`never` | When to create phase Issues              |
| `linear.team_id`     | UUID string          | Linear team identifier                   |
| `linear.team_name`   | string               | Human-readable team name                 |
| `linear.project_id`  | UUID string          | Linear project identifier                |
| `linear.project_name`| string               | Human-readable project name              |

## Milestone Creation Flow (Phase 5.5)

When `linear.enabled=true`:

1. **Read project ID from config:**
   ```
   LINEAR_PROJECT_ID = read-config "linear.project_id"
   ```

2. **Check for existing milestone:**
   ```
   Call mcp__plugin_linear_linear__list_milestones({projectId: LINEAR_PROJECT_ID})
   Check if any milestone.name == "v${VERSION}"
   ```

3. **Create if doesn't exist:**
   ```
   Call mcp__plugin_linear_linear__save_milestone({
     name: "v${VERSION}",
     description: "${MILESTONE_DESC}",
     projectId: LINEAR_PROJECT_ID
   })
   ```

4. **Idempotent:** Re-running add-milestone with same version skips creation.

## Phase Issue Creation Flow (Phase 9.5)

When `linear.enabled=true` and Linear Milestone created, phase issues are created for each phase in the milestone.

### When It Runs

- After ROADMAP.md is committed (Phase 9)
- After Linear Milestone is created (Phase 5.5)
- Only when `linear.enabled=true`

### issue_mode Check

The `linear.issue_mode` config controls phase issue creation:

| Value   | Behavior                                        |
| ------- | ----------------------------------------------- |
| `auto`  | Create issues automatically                     |
| `ask`   | Prompt user via AskUserQuestion before creating |
| `never` | Skip phase issue creation silently              |

### Label Creation (Idempotent)

```
Call mcp__plugin_linear_linear__create_issue_label({
  teamId: LINEAR_TEAM_ID,
  name: "phase",
  color: "#0E8A16",
  description: "Kata phase tracking"
})
```

### ROADMAP Parsing

Phases are extracted from ROADMAP.md within the current milestone section (same parsing as GitHub flow):

1. Find milestone section by `### v${VERSION}` header
2. Extract phase blocks between `#### Phase N:` headers
3. Parse each phase's goal, requirements, and success criteria

Key variables:
- `PHASE_NUM` - Phase number (e.g., "3", "2.1")
- `PHASE_NAME` - Phase name from header
- `PHASE_GOAL` - From `**Goal**:` line
- `REQUIREMENT_IDS` - From `**Requirements**:` line (optional)
- `SUCCESS_CRITERIA_AS_CHECKLIST` - Numbered list converted to `- [ ]` format

### Issue Existence Check (Idempotent)

Before creating, check if phase issue already exists:

```
Call mcp__plugin_linear_linear__list_issues({
  teamId: LINEAR_TEAM_ID,
  projectId: LINEAR_PROJECT_ID,
  labels: ["phase"]
})
Filter results where title starts with "Phase ${PHASE_NUM}:"
```

If a matching issue exists, skip creation and report existing identifier.

### Issue Creation

```
Call mcp__plugin_linear_linear__save_issue({
  teamId: LINEAR_TEAM_ID,
  title: "Phase ${PHASE_NUM}: ${PHASE_NAME}",
  description: ISSUE_BODY,
  projectId: LINEAR_PROJECT_ID,
  labels: ["phase"]
})
```

### Issue Body Template

```markdown
## Goal

{phase goal from ROADMAP.md}

## Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2
...

## Requirements

{requirement IDs, if any}

## Plans

<!-- Checklist added by /kata-plan-phase -->
_Plans will be added after phase planning completes._

---
Created by Kata | Phase {N} of milestone v{VERSION}
```

### Error Handling

All operations are non-blocking:
- Missing milestone: Warning, skip phase issues
- MCP tool failure: Warning, skip phase issues
- Issue creation failure: Warning per phase, continue to next phase
- Planning files always persist locally regardless of Linear status

## Plan Checklist Sync (Phase 4)

During `kata-plan-phase`:
- Plans added as `- [ ]` items under `## Plans` section
- Replaces placeholder text with actual plan checklist

During `kata-execute-phase`:
- Plans start as `- [ ]` items
- `execute-phase` updates to `- [x]` as each plan completes
- Issue description is edited in place via `save_issue`

On phase completion:
- Issue state set to "done" via `save_issue`

## Provenance Format

Local issue files reference their Linear counterpart:

```markdown
provenance: linear:KAT-42
```

Format: `linear:IDENTIFIER` where IDENTIFIER is the human-readable Linear issue key (team key + number).
