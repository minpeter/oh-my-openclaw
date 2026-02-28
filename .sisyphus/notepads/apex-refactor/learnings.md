# Learnings — apex-refactor

## Project Conventions
- Runtime: Bun only. `#!/usr/bin/env bun` shebang. Types via `bun-types`.
- Imports: `node:` prefix for built-ins. Relative paths only — no aliases.
- Style: Single quotes, semicolons, 2-space indent.
- TypeScript: `strict: true`, `target: ES2022`, `moduleResolution: bundler`.
- Config format: JSON5 everywhere. Use `readJson5`/`writeJson5` from `json5-utils.ts`.
- Error handling: Empty `catch {}` blocks OK for optional file ops. Named `catch (err)` re-throws.
- Console output: `picocolors` for colored terminal output.

## Test Conventions
- Runner: `bun test`
- Location: Co-located `__tests__/` dirs
- Naming: `<module>.test.ts` (never `.spec.ts`)
- Structure: `describe('<module>')` + sentence-form `test('...')`
- Isolation: Override `process.env.OPENCLAW_CONFIG_PATH` to temp paths in each test
- Cleanup: `afterEach` restores env and deletes temp dirs
- CLI output capture: Monkey-patch `console.log`, restore in `finally`
- Temp dirs: `mkdtemp()` pattern

## Key File Locations
- `src/commands/apply.ts` — ApplyOptions interface + applyCommand function
- `src/cli.ts` — Commander.js program + all command registrations
- `src/presets/index.ts` — presetNames array (currently ['default', 'developer', 'researcher', 'creative', 'apex'])
- `src/core/constants.ts` — WORKSPACE_FILES array (7 MD files)
- `src/core/workspace.ts` — resolveWorkspaceDir() — reads from config
- `src/core/backup.ts` — createBackup(), createWorkspaceBackup()

## Critical: Clean Flag Ordering
resolveWorkspaceDir() uses currentConfig to find custom workspace path.
MUST call resolveWorkspaceDir() BEFORE deleting config file in --clean mode.
Order: read config → resolve workspace dir → backup → delete workspace files → delete config → reset currentConfig → merge → apply

## Apex Preset Values (for test assertions)
- identity.name: 'Apex'
- identity.theme: 'all-in-one power assistant'
- identity.emoji: '⚡'
- workspaceFiles: ['AGENTS.md', 'SOUL.md', 'TOOLS.md', 'USER.md', 'IDENTITY.md'] (5 files)
- model: 'anthropic/claude-sonnet-4-5'

## [2026-03-01] Task 8: --clean and install tests
- Added 4 new tests to apply.test.ts (total now 12)
- Test 1: --clean removes config and workspace files before applying
- Test 2: --clean creates backup before wiping
- Test 3: --clean with --dry-run does not delete anything
- Test 4: install alias applies apex preset
- Full suite: 110 tests passing

## [2026-03-01] Task 9: AGENTS.md apex-only philosophy
- Added APEX-ONLY PHILOSOPHY section after PRESET RESOLUTION ORDER
- Updated OVERVIEW to mention 5 subcommands (list, apply, export, diff, install)
- Updated WHERE TO LOOK table for apex-only
- No legacy preset references remain

## [2026-03-01] Task 10: README.md apex-only update
- Updated Basic Workflow to use apex/install
- Updated list example output to show only apex
- Added --clean flag docs to apply section
- Added install command section
- Replaced 4-row Built-in Presets table with 1-row apex table
- Updated Architecture section to mention 5 commands
- No legacy preset references remain in commands/tables
