# Issues — apex-refactor

## [2026-03-01] Task 0: demo-researcher repo
- Status: IN PROGRESS
- No issues yet.

## Known: Legacy presets not yet deleted
- src/presets/index.ts still has ['default', 'developer', 'researcher', 'creative', 'apex']
- src/presets/default/, developer/, researcher/, creative/ still exist
- This is expected — Task 1 handles deletion after Task 0 completes.
## [TASK-0 COMPLETE] demo-researcher repo created at https://github.com/minpeter/demo-researcher

## [TASK-1 COMPLETE] Legacy presets deleted, index.ts now ['apex'] only

## [TASK-2] list.test.ts updated to expect 1 apex preset (was 5)

## [TASK-3] apply.test.ts "gateway restart reminder" test updated to use apex preset

## [TASK-4] diff.test.ts updated: 4 diffCommand calls changed to apex, workspace assertions updated to 5 files

## [TASK-5] integration.test.ts updated: developer/researcher replaced with apex in 4 places

## [TASK-7] install command added to cli.ts — alias for apply apex with same options

## [TASK-6] --clean flag added to apply command. Critical ordering: resolveWorkspaceDir before config deletion.
