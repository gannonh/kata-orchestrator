# KAT-162 Evidence Package

## Command Output Summary
- Command: `npm run -w app test:e2e -- tests/e2e/kat-162-slice-a-demo-proof.spec.ts`
- Result: PASS (`1 passed`)
- Scope: deterministic Slice A proof flow (`prompt -> run -> draft apply -> persist -> relaunch`)

## Acceptance Mapping

| Acceptance Item | Proof in Test | Artifact / Evidence |
| --- | --- | --- |
| prompt | Sends `KAT-162 demo proof baseline prompt` and verifies it in `message-list` | `test-results/kat-162/01-prompt-submitted.png` |
| run | Deterministic `run:submit` stub returns `run-kat-162-e2e`; test asserts deterministic run id | `tests/e2e/kat-162-slice-a-demo-proof.spec.ts` |
| apply | Verifies `Apply Draft to Spec`, clicks, and checks `Goal` + `Tasks` headings | `test-results/kat-162/02-run-completed-with-draft.png`, `test-results/kat-162/03-draft-applied-spec.png` |
| persist | Relaunch state file includes persisted run + applied spec metadata before relaunch | `tests/e2e/kat-162-slice-a-demo-proof.spec.ts` |
| relaunch | Relaunched app restores shell without Home, shows applied-run badge, and keeps baseline prompt visible | `test-results/kat-162/04-post-relaunch-restored-session.png` |

## Artifact List
- `test-results/kat-162/01-prompt-submitted.png`
- `test-results/kat-162/02-run-completed-with-draft.png`
- `test-results/kat-162/03-draft-applied-spec.png`
- `test-results/kat-162/04-post-relaunch-restored-session.png`
- `test-results/kat-162/kat-162-prompt-run-apply-persist-relaunch-1772733331600.json`

## Follow-up Issues
- None
