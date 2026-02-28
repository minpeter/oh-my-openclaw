# Apex Refactor: Single Preset + Install Command + Clean Flag

## TL;DR

> **Quick Summary**: Refactor oh-my-openclaw from multi-preset architecture to single "apex" preset. Delete 4 legacy presets, add `--clean` flag to `apply`, add `install` command as alias for `apply apex`, update all tests and documentation.
> 
> **Deliverables**:
> - Single built-in preset: apex (legacy presets deleted)
> - `--clean` flag on `apply` command (backup → wipe → fresh apply)
> - `install` command (alias for `apply apex`)
> - All tests passing with updated references
> - Updated AGENTS.md and README.md
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 → Task 3/4/5/6 → Task 7/8 → Task 9 → Final Wave

---

## Context

### Original Request
User wants to consolidate all built-in presets into a single "apex" preset with 100% of all capabilities. The repo should only manage one preset. Add an `install` command as a shortcut for `apply apex`, and a `--clean` flag for fresh installations that wipe existing config before applying.

### Interview Summary
**Key Discussions**:
- "우리 레포에는 apex 하나만 관리할거야" — ONE preset in repo, others can share via user presets
- "install이 항상 클린 설치인건 아니고 그냥 oh-my-openclaw apply apex의 alias" — install is NOT always clean, just an alias
- "--clean 추가" — Separate flag for clean install behavior

**Research Findings**:
- Apex preset already exists at `src/presets/apex/` with preset.json5, AGENTS.md, SOUL.md, TOOLS.md, USER.md, IDENTITY.md
- Legacy presets (default, developer, researcher, creative) still exist and need deletion
- `src/presets/index.ts` still registers all 5 presets — needs to be `['apex']` only
- `WORKSPACE_FILES` constant in `src/core/constants.ts` lists 7 MD file types for clean deletion
- `resolveWorkspaceDir()` reads from config — MUST be called BEFORE config deletion in clean mode

### Metis Review
**Identified Gaps** (addressed):
- **False assumption**: Legacy preset directories were NOT actually deleted yet — plan includes deletion
- **False assumption**: `index.ts` was NOT updated to `['apex']` only — plan includes update
- **Clean ordering bug**: Must resolve workspace dir from current config BEFORE deleting config
- **README.md missed**: Has 12+ references to old presets — plan includes update
- **`--clean --no-backup` danger**: Destructive combo needs consideration — defaulting to: allow with warning

---

## Work Objectives

### Core Objective
Transition oh-my-openclaw from a multi-preset manager to a single "apex" preset tool with `install` shortcut and `--clean` fresh-install capability.

### Concrete Deliverables
- `src/presets/index.ts` registering only `['apex']`
- Legacy preset directories deleted: `default/`, `developer/`, `researcher/`, `creative/`
- `src/commands/apply.ts` with `clean?: boolean` in ApplyOptions and clean implementation
- `src/cli.ts` with `--clean` option on `apply` + `install` command
- Updated test files: `list.test.ts`, `apply.test.ts`, `diff.test.ts`, `integration.test.ts`
- Updated `AGENTS.md` with apex-only philosophy and corrected structure
- Updated `README.md` with apex references, install command, and clean flag docs

### Definition of Done
- [x] `bun test` — all tests pass (0 failures)
- [x] `bun run typecheck` — no type errors
- [x] `bun run build` — builds successfully
- [x] `bun run src/cli.ts list --json` — returns array with exactly 1 preset named "apex"
- [x] `bun run src/cli.ts install --help` — shows install command help
- [x] `bun run src/cli.ts apply --help` — shows `--clean` option
- [x] `ls src/presets/ | grep -v apex | grep -v index | grep -v __tests__` — returns nothing

### Must Have
- Exactly ONE built-in preset: apex
- `install` command = `apply apex` with identical options
- `--clean` flag: backup → delete config + workspace MDs → apply fresh
- All existing tests adapted and passing
- Root AGENTS.md documents apex-only philosophy

### Must NOT Have (Guardrails)
- Do NOT modify any `src/core/` modules (merge, backup, workspace, config-path, sensitive-filter, json5-utils)
- Do NOT change `export` or `diff` command LOGIC (only test preset name references)
- Do NOT extract clean logic into a separate module — keep inline in apply.ts
- Do NOT modify `ApplyOptions` beyond adding `clean?: boolean`
- Do NOT change `WORKSPACE_FILES` constant
- Do NOT add new dependencies
- Do NOT modify `src/presets/__tests__/apex.test.ts` (already correct)
- Do NOT modify `src/commands/__tests__/export.test.ts` (no old preset references)
- Do NOT modify `src/core/__tests__/types.test.ts` (tests constants only)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after (new features only; existing tests adapted)
- **Framework**: bun test (Bun's built-in test runner)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **CLI**: Use Bash — Run commands, assert output
- **Tests**: Use Bash — `bun test` with specific file paths

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 0 (Prerequisite — backup before destruction):
└── Task 0: Back up researcher preset to minpeter/demo-researcher [quick]

Wave 1 (Foundation — preset cleanup + index update):
└── Task 1: Delete legacy presets + update index.ts [quick]

Wave 2 (After Wave 1 — parallel test updates + feature implementation):
├── Task 2: Update list.test.ts [quick]
├── Task 3: Update apply.test.ts [quick]
├── Task 4: Update diff.test.ts [quick]
├── Task 5: Update integration.test.ts [quick]
├── Task 6: Add --clean flag to apply.ts + ApplyOptions [deep]
└── Task 7: Add install command to cli.ts [quick]

Wave 3 (After Wave 2 — new feature tests):
└── Task 8: Add tests for --clean and install command [unspecified-high]

Wave 4 (After Wave 3 — documentation):
├── Task 9: Update AGENTS.md [quick]
└── Task 10: Update README.md [quick]

Wave FINAL (After ALL tasks — independent review):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 0 → Task 1 → Task 6 → Task 8 → Task 9/10 → Final Wave
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 6 (Wave 2)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 0    | —         | 1 |
| 1    | 0         | 2, 3, 4, 5, 6, 7 |
| 2    | 1         | 8 |
| 3    | 1         | 8 |
| 4    | 1         | 8 |
| 5    | 1         | 8 |
| 6    | 1         | 8 |
| 7    | 1         | 8 |
| 8    | 2, 3, 4, 5, 6, 7 | 9, 10 |
| 9    | 8         | F1-F4 |
| 10   | 8         | F1-F4 |

### Agent Dispatch Summary

- **Wave 0**: **1 task** — T0 → `quick`
- **Wave 1**: **1 task** — T1 → `quick`
- **Wave 2**: **6 tasks** — T2-T5 → `quick`, T6 → `deep`, T7 → `quick`
- **Wave 3**: **1 task** — T8 → `unspecified-high`
- **Wave 4**: **2 tasks** — T9 → `quick`, T10 → `quick`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

---

- [x] 0. Back up researcher preset to minpeter/demo-researcher repo

  **What to do**:
  - Create a new PUBLIC GitHub repository: `minpeter/demo-researcher`
  - Initialize it with the 3 files from `src/presets/researcher/`:
    - `preset.json5` — preset manifest with config overrides
    - `AGENTS.md` — agent persona instructions
    - `SOUL.md` — agent soul/personality definition
  - Add a brief `README.md` explaining this is a user-preset example for oh-my-openclaw
  - Push to `main` branch
  - Verify the repo is publicly accessible

  **Must NOT do**:
  - Do NOT modify the original files in `src/presets/researcher/`
  - Do NOT back up other presets (default, developer, creative)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple file copy + repo creation via `gh` CLI
  - **Skills**: []
    - No special skills needed — just bash + gh CLI

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 0 (prerequisite)
  - **Blocks**: Task 1
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `src/presets/researcher/preset.json5` — Full preset manifest to copy (26 lines, JSON5 format with name/description/version/config/workspaceFiles)
  - `src/presets/researcher/AGENTS.md` — Agent persona file (4 lines, research assistant instructions)
  - `src/presets/researcher/SOUL.md` — Soul file (3 lines, accuracy-focused personality)

  **External References**:
  - `gh repo create` — GitHub CLI for repository creation: `gh repo create minpeter/demo-researcher --public`
  - oh-my-openclaw README.md "Creating Custom Presets" section — explains how user presets work at `~/.openclaw/oh-my-openclaw/presets/`

  **WHY Each Reference Matters**:
  - The 3 preset files are the EXACT content to push to the new repo — copy as-is, no modifications
  - The README.md should explain that users install this by cloning/copying into `~/.openclaw/oh-my-openclaw/presets/researcher/`

  **Acceptance Criteria**:

  - [x] `gh repo view minpeter/demo-researcher` — repo exists and is public
  - [x] Repo contains exactly 4 files: `preset.json5`, `AGENTS.md`, `SOUL.md`, `README.md`
  - [x] Content of `preset.json5` matches `src/presets/researcher/preset.json5` exactly

  **QA Scenarios:**

  ```
  Scenario: Repo exists and is publicly accessible
    Tool: Bash (gh CLI)
    Preconditions: gh CLI authenticated
    Steps:
      1. Run: gh repo view minpeter/demo-researcher --json name,visibility
      2. Parse JSON output
      3. Assert: name == "demo-researcher" AND visibility == "PUBLIC"
    Expected Result: Repository is public with correct name
    Failure Indicators: Command returns error or visibility != PUBLIC
    Evidence: .sisyphus/evidence/task-0-repo-public.txt

  Scenario: Repo contains correct preset files
    Tool: Bash (gh CLI + curl)
    Preconditions: Repo exists
    Steps:
      1. Run: gh api repos/minpeter/demo-researcher/contents --jq '.[].name' | sort
      2. Assert output contains: AGENTS.md, README.md, SOUL.md, preset.json5
      3. Run: curl -sL https://raw.githubusercontent.com/minpeter/demo-researcher/main/preset.json5
      4. Assert: content contains name researcher and ResearchBot
    Expected Result: All 4 files present with correct content
    Failure Indicators: Missing files or content mismatch
    Evidence: .sisyphus/evidence/task-0-repo-contents.txt
  ```

  **Commit**: NO (separate repo)

---

- [x] 1. Delete legacy presets + update index.ts to apex-only

  **What to do**:
  - Delete 4 legacy preset directories:
    - `rm -rf src/presets/default/`
    - `rm -rf src/presets/developer/`
    - `rm -rf src/presets/researcher/`
    - `rm -rf src/presets/creative/`
  - Edit `src/presets/index.ts` line 10: change `const presetNames = ['default', 'developer', 'researcher', 'creative', 'apex'];` to `const presetNames = ['apex'];`
  - Run `bun test src/presets/__tests__/apex.test.ts` to verify apex preset still loads correctly

  **Must NOT do**:
  - Do NOT delete `src/presets/apex/` directory
  - Do NOT delete `src/presets/__tests__/` directory
  - Do NOT modify `src/presets/__tests__/apex.test.ts`
  - Do NOT modify any files inside `src/presets/apex/`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple file deletion + one-line edit in index.ts
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (foundation)
  - **Blocks**: Tasks 2, 3, 4, 5, 6, 7
  - **Blocked By**: Task 0

  **References**:

  **Pattern References**:
  - `src/presets/index.ts:10` — Line to edit: `const presetNames = ['default', 'developer', 'researcher', 'creative', 'apex'];` must become `const presetNames = ['apex'];`
  - `src/presets/__tests__/apex.test.ts` — Existing apex tests (77 lines) that must still pass after this change

  **WHY Each Reference Matters**:
  - index.ts is the preset registry — this is the single source of truth for which presets are built-in
  - apex.test.ts validates the preset loads correctly — run this to confirm nothing broke

  **Acceptance Criteria**:

  - [x] `ls src/presets/` shows only: `__tests__/`, `apex/`, `index.ts`
  - [x] `bun test src/presets/__tests__/apex.test.ts` passes (6 tests, 0 failures)
  - [x] `grep presetNames src/presets/index.ts` shows `['apex']` only

  **QA Scenarios:**

  ```
  Scenario: Legacy preset directories are deleted
    Tool: Bash
    Preconditions: None
    Steps:
      1. Run: ls src/presets/ | sort
      2. Assert output is exactly: __tests__ apex index.ts
      3. Run: test -d src/presets/default && echo EXISTS || echo GONE
      4. Assert: GONE
      5. Run: test -d src/presets/developer && echo EXISTS || echo GONE
      6. Assert: GONE
    Expected Result: Only apex, __tests__, and index.ts remain
    Failure Indicators: Any legacy directory still exists
    Evidence: .sisyphus/evidence/task-1-presets-deleted.txt

  Scenario: Apex preset loads correctly after index change
    Tool: Bash
    Preconditions: index.ts updated
    Steps:
      1. Run: bun test src/presets/__tests__/apex.test.ts
      2. Assert: all 6 tests pass, 0 failures
    Expected Result: All apex tests pass
    Failure Indicators: Any test failure
    Evidence: .sisyphus/evidence/task-1-apex-tests.txt
  ```

  **Commit**: YES
  - Message: `refactor(presets): remove legacy presets, keep only apex`
  - Files: `src/presets/index.ts`, deleted `src/presets/{default,developer,researcher,creative}/`
  - Pre-commit: `bun test src/presets/__tests__/apex.test.ts`

---

- [x] 2. Update list.test.ts for single apex preset

  **What to do**:
  - Edit `src/commands/__tests__/list.test.ts`:
    - Test name line 38: change `'lists built-in presets (5 entries) with expected fields'` to `'lists built-in presets (1 entry) with expected fields'`
    - Remove lines 43-45: `expect(combined).toContain('default')`, `toContain('developer')`, `toContain('researcher')`, `toContain('creative')`
    - Add: `expect(combined).toContain('apex')`
    - Line 49: change `expect(nameLines.length).toBe(5)` to `.toBe(1)`
    - Line 52: change `expect(versionLines.length).toBe(5)` to `.toBe(1)`
    - Line 60: change `expect(json).toHaveLength(5)` to `.toHaveLength(1)`

  **Must NOT do**:
  - Do NOT change test structure or helper functions (beforeEach, afterEach)
  - Do NOT add new tests in this task

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple string replacements in one test file
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4, 5, 6, 7)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/commands/__tests__/list.test.ts:38-53` — The two tests to modify: builtin preset count check (line 38-53) and JSON output check (line 55-68)
  - `src/presets/apex/preset.json5:2` — Apex preset name is `'apex'` (the string to assert in output)

  **WHY Each Reference Matters**:
  - The test asserts specific counts (5) that must become 1, and preset names that must become 'apex'

  **Acceptance Criteria**:

  - [x] `bun test src/commands/__tests__/list.test.ts` passes (2 tests, 0 failures)

  **QA Scenarios:**

  ```
  Scenario: List test passes with single apex preset
    Tool: Bash
    Preconditions: Task 1 completed (legacy presets deleted)
    Steps:
      1. Run: bun test src/commands/__tests__/list.test.ts
      2. Assert: 2 tests pass, 0 failures
    Expected Result: All list tests pass
    Failure Indicators: Test failure mentioning count mismatch or missing preset name
    Evidence: .sisyphus/evidence/task-2-list-tests.txt
  ```

  **Commit**: YES (groups with Tasks 3, 4, 5)
  - Message: `test: update all tests to reference apex preset`
  - Files: `src/commands/__tests__/list.test.ts`

---

- [x] 3. Update apply.test.ts for apex preset

  **What to do**:
  - Edit `src/commands/__tests__/apply.test.ts`:
    - Test "prints gateway restart reminder" (line 291-306):
      - Line 297: change `applyCommand('developer')` to `applyCommand('apex')`
      - Line 302: change `"Preset 'developer' applied"` to `"Preset 'apex' applied"`
      - Line 305: change `expect(config.identity).toEqual({ name: 'DevBot', theme: 'coding assistant', emoji: '\uD83D\uDCBB' })` to `expect(config.identity).toEqual({ name: 'Apex', theme: 'all-in-one power assistant', emoji: '\u26A1' })`
  - All other tests in this file use user presets (not builtin) and need NO changes

  **Must NOT do**:
  - Do NOT modify tests that use user presets (merge-preset, workspace-preset, backup-preset, etc.)
  - Do NOT change test helper functions

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 3 line changes in one test
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 4, 5, 6, 7)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/commands/__tests__/apply.test.ts:291-306` — The single test to modify: "prints gateway restart reminder"
  - `src/presets/apex/preset.json5:9-13` — Apex identity values: `name: 'Apex'`, `theme: 'all-in-one power assistant'`, `emoji: '\u26A1'`

  **WHY Each Reference Matters**:
  - The test applies a builtin preset and checks the merged config values match — must match apex config exactly

  **Acceptance Criteria**:

  - [x] `bun test src/commands/__tests__/apply.test.ts` passes (all 7 tests, 0 failures)

  **QA Scenarios:**

  ```
  Scenario: Apply test passes with apex preset
    Tool: Bash
    Preconditions: Task 1 completed
    Steps:
      1. Run: bun test src/commands/__tests__/apply.test.ts
      2. Assert: 7 tests pass, 0 failures
    Expected Result: All apply tests pass including gateway restart reminder
    Failure Indicators: Test failure on identity values or preset name
    Evidence: .sisyphus/evidence/task-3-apply-tests.txt
  ```

  **Commit**: YES (groups with Tasks 2, 4, 5)
  - Message: `test: update all tests to reference apex preset`
  - Files: `src/commands/__tests__/apply.test.ts`

---

- [x] 4. Update diff.test.ts for apex preset

  **What to do**:
  - Edit `src/commands/__tests__/diff.test.ts`:
    - Line 42: `diffCommand('developer')` to `diffCommand('apex')`
    - Line 45 comment: update to mention apex preset
    - Line 48: `expect(combined).toMatch(/identity|agents|tools/)` — this stays the same (apex has same keys)
    - Line 53 comment: update
    - Line 56-57: keep the identity.name setup (`'OldBot'`) since it's testing diff against apex
    - Line 61: `diffCommand('developer')` to `diffCommand('apex')`
    - Line 67: `expect(combined).toContain('DevBot')` to `expect(combined).toContain('Apex')`
    - Line 113: `diffCommand('developer', { json: true })` to `diffCommand('apex', { json: true })`
    - Line 122: `expect(parsed.preset).toBe('developer')` to `expect(parsed.preset).toBe('apex')`
    - Line 128-131 comment and assertion: update to reflect apex
    - Line 139: `diffCommand('developer', { json: true })` to `diffCommand('apex', { json: true })`
    - Lines 148-151: update workspace files assertion to match apex's 5 files (`AGENTS.md, SOUL.md, TOOLS.md, USER.md, IDENTITY.md`)

  **Must NOT do**:
  - Do NOT change tests that use user presets (test-remove, empty-preset, nonexistent-preset-xyz)
  - Do NOT modify diff command logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: String replacements across one test file
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3, 5, 6, 7)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/commands/__tests__/diff.test.ts:36-152` — Tests referencing 'developer': lines 42, 61, 113, 139 (command calls) and 67, 122 (assertions)
  - `src/presets/apex/preset.json5:9-10` — Apex identity.name is `'Apex'` (for assertion on line 67)
  - `src/presets/apex/preset.json5:41` — Apex workspaceFiles: `['AGENTS.md', 'SOUL.md', 'TOOLS.md', 'USER.md', 'IDENTITY.md']`

  **WHY Each Reference Matters**:
  - Must know exact apex values to write correct assertions
  - workspaceFiles count changed from 2 (developer) to 5 (apex)

  **Acceptance Criteria**:

  - [x] `bun test src/commands/__tests__/diff.test.ts` passes (6 tests, 0 failures)

  **QA Scenarios:**

  ```
  Scenario: Diff test passes with apex preset
    Tool: Bash
    Preconditions: Task 1 completed
    Steps:
      1. Run: bun test src/commands/__tests__/diff.test.ts
      2. Assert: 6 tests pass, 0 failures
    Expected Result: All diff tests pass with apex references
    Failure Indicators: Test failure on preset name or workspace file count
    Evidence: .sisyphus/evidence/task-4-diff-tests.txt
  ```

  **Commit**: YES (groups with Tasks 2, 3, 5)
  - Message: `test: update all tests to reference apex preset`
  - Files: `src/commands/__tests__/diff.test.ts`

---

- [x] 5. Update integration.test.ts for apex preset

  **What to do**:
  - Edit `src/__tests__/integration.test.ts`:
    - Line 100: `applyCommand('developer', { noBackup: true })` to `applyCommand('apex', { noBackup: true })`
    - Line 104: `expect(identity?.name).toBe('DevBot')` to `expect(identity?.name).toBe('Apex')`
    - Line 187: `applyCommand('developer')` to `applyCommand('apex')`
    - Line 189: `applyCommand('researcher')` to `applyCommand('apex')` (two consecutive applies of same preset still creates 2 backups)
    - Update test name on line 184 if it mentions specific preset names
  - All other tests use user presets and need NO changes

  **Must NOT do**:
  - Do NOT modify tests using user presets (cycle-preset, md-only-preset, etc.)
  - Do NOT change test helper functions

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 4 line changes in one file
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3, 4, 6, 7)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/__tests__/integration.test.ts:99-105` — "apply to nonexistent config" test: uses developer preset, asserts DevBot
  - `src/__tests__/integration.test.ts:184-194` — "multiple applies create backups" test: uses developer + researcher
  - `src/presets/apex/preset.json5:10` — Apex identity.name: `'Apex'`

  **WHY Each Reference Matters**:
  - Must know exact line numbers and old values to make correct replacements
  - The "multiple applies" test still works with same preset applied twice — each apply creates a backup

  **Acceptance Criteria**:

  - [x] `bun test src/__tests__/integration.test.ts` passes (all 8 tests, 0 failures)

  **QA Scenarios:**

  ```
  Scenario: Integration tests pass with apex references
    Tool: Bash
    Preconditions: Task 1 completed
    Steps:
      1. Run: bun test src/__tests__/integration.test.ts
      2. Assert: all tests pass, 0 failures
    Expected Result: All integration tests pass
    Failure Indicators: Test failure on preset name or identity values
    Evidence: .sisyphus/evidence/task-5-integration-tests.txt
  ```

  **Commit**: YES (groups with Tasks 2, 3, 4)
  - Message: `test: update all tests to reference apex preset`
  - Files: `src/__tests__/integration.test.ts`

---

- [x] 6. Add --clean flag to apply command

  **What to do**:
  - Edit `src/commands/apply.ts`:
    - Add `clean?: boolean` to `ApplyOptions` interface (line 17-20)
    - In `applyCommand()` function, AFTER reading currentConfig and resolving workspaceDir, add clean logic block:
      ```
      if (options.clean) {
        // Step 1: backup (already handled above, but ensure it runs even without configExists)
        // Step 2: delete workspace MD files
        for (const filename of WORKSPACE_FILES) {
          try { await fs.unlink(path.join(workspaceDir, filename)); } catch {}
        }
        // Step 3: delete config file
        try { await fs.unlink(paths.configPath); } catch {}
        // Step 4: reset currentConfig for fresh apply
        currentConfig = {};
        configExists = false;
        console.log(pc.yellow('Clean install: existing config and workspace files removed.'));
      }
      ```
    - Import `WORKSPACE_FILES` from `'../core/constants'`
    - In dry-run block, add clean indicator: `if (options.clean) console.log(pc.yellow('Mode: CLEAN INSTALL'));`
    - CRITICAL ORDERING: clean logic must go AFTER `resolveWorkspaceDir()` call (line 66) but BEFORE the merge logic (line 60-64). Restructure the function so workspace dir is resolved first, then clean wipes, then merge happens.
  - Edit `src/cli.ts`:
    - Add `.option('--clean', 'Remove existing config and workspace files before applying (clean install)')` to the apply command (after line 41)
    - Update action handler to pass `clean: options.clean` to applyCommand

  **Must NOT do**:
  - Do NOT extract clean logic into a separate module/function
  - Do NOT modify any `src/core/` modules
  - Do NOT change the backup logic in backup.ts
  - Do NOT add `clean` as a parameter to any core function

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Requires careful ordering of operations within applyCommand and understanding the function flow
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3, 4, 5, 7)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/commands/apply.ts:17-20` — `ApplyOptions` interface: add `clean?: boolean` here
  - `src/commands/apply.ts:31-114` — Full `applyCommand()` function: understand flow before inserting clean logic
  - `src/commands/apply.ts:52-58` — Config reading block: currentConfig and configExists are set here
  - `src/commands/apply.ts:60-64` — Merge logic: clean must reset currentConfig to {} BEFORE this runs
  - `src/commands/apply.ts:66` — `resolveWorkspaceDir()` call: MUST happen BEFORE clean deletes config (uses config to find custom workspace path)
  - `src/core/constants.ts:15-23` — `WORKSPACE_FILES` array: 7 MD files to delete during clean
  - `src/cli.ts:36-52` — Current apply command registration: add --clean option here

  **API/Type References**:
  - `src/commands/apply.ts:17-20` — `ApplyOptions` interface shape to extend
  - `src/core/workspace.ts:6-14` — `resolveWorkspaceDir()` reads from config — must be called BEFORE config deletion

  **WHY Each Reference Matters**:
  - The function flow matters critically: workspace dir uses config, so config must exist when resolveWorkspaceDir runs
  - WORKSPACE_FILES must be imported (not hardcoded) to stay in sync with any future changes
  - cli.ts pattern shows how other options are registered with Commander

  **Acceptance Criteria**:

  - [x] `bun run typecheck` passes with no errors
  - [x] `bun run src/cli.ts apply --help` shows `--clean` option in output
  - [x] ApplyOptions interface has `clean?: boolean`

  **QA Scenarios:**

  ```
  Scenario: --clean option appears in help
    Tool: Bash
    Preconditions: cli.ts updated
    Steps:
      1. Run: bun run src/cli.ts apply --help
      2. Assert: output contains "--clean"
      3. Assert: output contains "Remove existing config"
    Expected Result: --clean flag is documented in help output
    Failure Indicators: --clean not listed
    Evidence: .sisyphus/evidence/task-6-clean-help.txt

  Scenario: Typecheck passes with new ApplyOptions
    Tool: Bash
    Preconditions: apply.ts updated
    Steps:
      1. Run: bun run typecheck
      2. Assert: exit code 0, no errors
    Expected Result: No type errors
    Failure Indicators: Type error mentioning ApplyOptions or clean
    Evidence: .sisyphus/evidence/task-6-typecheck.txt
  ```

  **Commit**: YES
  - Message: `feat(apply): add --clean flag for fresh installations`
  - Files: `src/commands/apply.ts`, `src/cli.ts`
  - Pre-commit: `bun run typecheck`

---

- [x] 7. Add install command to cli.ts

  **What to do**:
  - Edit `src/cli.ts`:
    - After the diff command block (after line 91), add a new install command:
      ```
      program
        .command('install')
        .description('Install the apex preset (shortcut for: apply apex)')
        .option('--dry-run', 'Show what would change without applying')
        .option('--no-backup', 'Skip creating a backup')
        .option('--clean', 'Remove existing config and workspace files before applying')
        .action(async (options: { dryRun?: boolean; backup?: boolean; clean?: boolean }) => {
          try {
            await applyCommand('apex', {
              dryRun: options.dryRun,
              noBackup: !options.backup,
              clean: options.clean,
            });
          } catch (err) {
            console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
          }
        });
      ```
  - The install command has NO preset argument — hardcoded to 'apex'
  - Options mirror the apply command exactly

  **Must NOT do**:
  - Do NOT accept a preset argument on install
  - Do NOT create a separate install.ts command file
  - Do NOT modify the apply command registration

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Copy-paste pattern from apply command with minor changes
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 3, 4, 5, 6)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/cli.ts:36-52` — Apply command registration pattern: copy this structure for install command, remove argument, hardcode 'apex'
  - `src/cli.ts:79-91` — Diff command registration: shows position where install command should be added (after this block)

  **WHY Each Reference Matters**:
  - Must follow exact Commander.js registration pattern used in existing commands
  - Position matters for CLI help output ordering

  **Acceptance Criteria**:

  - [x] `bun run src/cli.ts install --help` shows correct help output
  - [x] `bun run src/cli.ts --help` lists install command
  - [x] `bun run typecheck` passes

  **QA Scenarios:**

  ```
  Scenario: Install command appears in main help
    Tool: Bash
    Preconditions: cli.ts updated
    Steps:
      1. Run: bun run src/cli.ts --help
      2. Assert: output contains "install"
      3. Assert: output contains "apex preset"
    Expected Result: Install command listed in help
    Failure Indicators: install not in help output
    Evidence: .sisyphus/evidence/task-7-install-help.txt

  Scenario: Install command help shows correct options
    Tool: Bash
    Preconditions: cli.ts updated
    Steps:
      1. Run: bun run src/cli.ts install --help
      2. Assert: output contains --dry-run
      3. Assert: output contains --no-backup
      4. Assert: output contains --clean
      5. Assert: output does NOT contain "<preset>" argument
    Expected Result: All 3 options present, no preset argument
    Failure Indicators: Missing option or unexpected argument
    Evidence: .sisyphus/evidence/task-7-install-options.txt
  ```

  **Commit**: YES (groups with Task 6)
  - Message: `feat(apply): add --clean flag for fresh installations`
  - Files: `src/cli.ts`

---

- [x] 8. Add tests for --clean flag and install command

  **What to do**:
  - Add new tests to `src/commands/__tests__/apply.test.ts`:
    - Test: `'--clean removes config and workspace files before applying'`
      - Create temp env with config file and workspace MD files
      - Call `applyCommand('apex', { clean: true })` (using user preset that mimics apex to keep test isolated)
      - Assert: new config is applied fresh (no merge with old values)
      - Assert: workspace files are overwritten
    - Test: `'--clean creates backup before wiping'`
      - Create temp env with config file
      - Call `applyCommand(presetName, { clean: true })`
      - Assert: backup exists in backupsDir
    - Test: `'--clean with dry-run does not delete anything'`
      - Create temp env with config
      - Call `applyCommand(presetName, { clean: true, dryRun: true })`
      - Assert: original config unchanged, no files deleted
  - Add new test to `src/commands/__tests__/apply.test.ts` or `src/__tests__/integration.test.ts`:
    - Test: `'install command applies apex preset'`
      - Call `applyCommand('apex', { noBackup: true })` directly (install is just an alias in CLI layer)
      - Assert: apex config values are applied
  - Follow existing test patterns: `createTempEnv()`, `writeConfig()`, `readConfig()`, `captureLogs()`, `writeUserPreset()`

  **Must NOT do**:
  - Do NOT test the Commander CLI registration (that's tested via QA scenarios)
  - Do NOT modify existing tests
  - Do NOT create new test files

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple new test cases with careful setup/teardown following existing patterns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after all Wave 2 tasks)
  - **Blocks**: Tasks 9, 10
  - **Blocked By**: Tasks 2, 3, 4, 5, 6, 7

  **References**:

  **Pattern References**:
  - `src/commands/__tests__/apply.test.ts:21-39` — `createTempEnv()` helper: creates isolated temp directory with all required paths
  - `src/commands/__tests__/apply.test.ts:41-47` — `writeConfig()` and `readConfig()` helpers for JSON5 file I/O
  - `src/commands/__tests__/apply.test.ts:58-71` — `writeUserPreset()` helper: creates a user preset in presetsDir with manifest + optional workspace files
  - `src/commands/__tests__/apply.test.ts:73-87` — `captureLogs()` helper: captures console.log output
  - `src/commands/__tests__/apply.test.ts:89-96` — `afterEach` cleanup: restores env, deletes temp dirs
  - `src/core/constants.ts:15-23` — `WORKSPACE_FILES` array: what files to create in workspace for clean test

  **API/Type References**:
  - `src/commands/apply.ts:17-20` — Updated `ApplyOptions` interface with `clean?: boolean`

  **WHY Each Reference Matters**:
  - Must follow exact test patterns for consistency and proper cleanup
  - createTempEnv creates the temp directory structure that clean will operate on
  - WORKSPACE_FILES tells us which files to pre-create for the clean test

  **Acceptance Criteria**:

  - [x] `bun test src/commands/__tests__/apply.test.ts` passes (all tests including new ones)
  - [x] `bun test` — full test suite passes

  **QA Scenarios:**

  ```
  Scenario: All tests pass including new clean/install tests
    Tool: Bash
    Preconditions: Tasks 1-7 completed
    Steps:
      1. Run: bun test
      2. Assert: all tests pass, 0 failures
      3. Count total tests: should be more than before (new tests added)
    Expected Result: Full test suite green
    Failure Indicators: Any test failure
    Evidence: .sisyphus/evidence/task-8-all-tests.txt
  ```

  **Commit**: YES
  - Message: `test: add tests for --clean flag and install alias`
  - Files: `src/commands/__tests__/apply.test.ts`
  - Pre-commit: `bun test`

---

- [x] 9. Update root AGENTS.md with apex-only philosophy

  **What to do**:
  - Edit `AGENTS.md` (root):
    - In OVERVIEW section: add sentence about apex-only philosophy
    - In STRUCTURE section: update the preset tree to show only `apex/` (remove default, developer, researcher, creative references)
    - In WHERE TO LOOK table: update "Add built-in presets" row to note there's only one (apex), user presets are for sharing
    - Add new section after PRESET RESOLUTION ORDER: `## APEX-ONLY PHILOSOPHY`
      - This repo manages exactly ONE built-in preset: apex
      - Apex includes 100% of all capabilities
      - Other people can share their own presets as user presets (e.g., `minpeter/demo-researcher`)
      - User presets go to `~/.openclaw/oh-my-openclaw/presets/`
    - Update cli.ts description: mention 5 subcommands (list, apply, export, diff, install)

  **Must NOT do**:
  - Do NOT rewrite the entire file
  - Do NOT remove sections unrelated to presets
  - Do NOT change CONVENTIONS, DEEP MERGE SEMANTICS, or TEST PATTERNS sections

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Targeted edits to specific sections of a markdown file
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 10)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 8

  **References**:

  **Pattern References**:
  - `AGENTS.md:1-111` — Current root AGENTS.md: sections OVERVIEW (line 7-9), STRUCTURE (line 11-30), WHERE TO LOOK (line 32-43), PRESET RESOLUTION ORDER (line 70-76)
  - `src/presets/apex/preset.json5` — Apex preset manifest: name, description, all capabilities

  **WHY Each Reference Matters**:
  - Must know exact line numbers and current content to make targeted edits
  - Apex manifest provides the content for the philosophy section

  **Acceptance Criteria**:

  - [x] AGENTS.md contains "apex" as the only preset in structure tree
  - [x] AGENTS.md has an apex-only philosophy section
  - [x] AGENTS.md structure tree does not mention default/developer/researcher/creative

  **QA Scenarios:**

  ```
  Scenario: AGENTS.md reflects apex-only architecture
    Tool: Bash (grep)
    Preconditions: AGENTS.md updated
    Steps:
      1. Run: grep -c 'apex' AGENTS.md
      2. Assert: count > 0
      3. Run: grep -c 'developer' AGENTS.md
      4. Assert: count == 0 (no old preset references)
      5. Run: grep -c 'APEX-ONLY\|apex-only' AGENTS.md
      6. Assert: count > 0 (philosophy section exists)
    Expected Result: Only apex references, no legacy presets
    Failure Indicators: Old preset names found or apex-only section missing
    Evidence: .sisyphus/evidence/task-9-agents-md.txt
  ```

  **Commit**: YES (groups with Task 10)
  - Message: `docs: update AGENTS.md and README.md for apex-only architecture`
  - Files: `AGENTS.md`

---

- [x] 10. Update README.md for apex-only architecture

  **What to do**:
  - Edit `README.md`:
    - Quick Start > Basic Workflow (line 24-28):
      - Change `oh-my-openclaw diff developer` to `oh-my-openclaw diff apex`
      - Change `oh-my-openclaw apply developer` to `oh-my-openclaw apply apex`
      - Add step 5: `oh-my-openclaw install` (quick install shortcut)
    - Commands > apply section (line 50-58):
      - Add `--clean` flag documentation
    - Add new `### install` command section after apply:
      - Description: Install the apex preset (shortcut for `apply apex`)
      - Same flags as apply: --dry-run, --no-backup, --clean
    - Built-in Presets table (line 79-86):
      - Replace 4-row table with single row for apex
    - Example Output in list section (line 37-48):
      - Replace default/developer examples with apex example

  **Must NOT do**:
  - Do NOT rewrite sections unrelated to presets (Deep Merge Semantics, Sensitive Fields, etc.)
  - Do NOT change Development/Architecture sections

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Targeted text replacements in markdown
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 9)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 8

  **References**:

  **Pattern References**:
  - `README.md:24-28` — Basic Workflow section: change preset names to apex, add install step
  - `README.md:37-48` — Example Output: replace with apex preset output
  - `README.md:50-58` — apply command docs: add --clean flag
  - `README.md:79-86` — Built-in Presets table: replace 4 rows with 1 apex row
  - `src/presets/apex/preset.json5` — Apex values for example output

  **WHY Each Reference Matters**:
  - Must know exact sections and line numbers to make targeted edits
  - Apex manifest provides accurate values for documentation

  **Acceptance Criteria**:

  - [x] README.md does not contain 'developer', 'researcher', or 'creative' as preset names
  - [x] README.md documents `install` command
  - [x] README.md documents `--clean` flag
  - [x] Built-in Presets table has exactly 1 row (apex)

  **QA Scenarios:**

  ```
  Scenario: README reflects apex-only architecture
    Tool: Bash (grep)
    Preconditions: README.md updated
    Steps:
      1. Run: grep -c 'install' README.md
      2. Assert: count > 0 (install command documented)
      3. Run: grep -c '\-\-clean' README.md
      4. Assert: count > 0 (clean flag documented)
      5. Run: grep 'developer\|researcher\|creative' README.md | grep -v 'tags\|description' | wc -l
      6. Assert: count == 0 (no old preset references in commands/tables)
    Expected Result: README documents install, --clean, and only references apex
    Failure Indicators: Old preset names in commands or tables
    Evidence: .sisyphus/evidence/task-10-readme.txt
  ```

  **Commit**: YES (groups with Task 9)
  - Message: `docs: update AGENTS.md and README.md for apex-only architecture`
  - Files: `README.md`

---
## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `bun run typecheck` + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together). Test edge cases: empty state, invalid input. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Detect cross-task contamination.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **After Wave 1**: `refactor(presets): remove legacy presets, keep only apex` — src/presets/index.ts, deleted directories
- **After Wave 2 (tests)**: `test: update all tests to reference apex preset` — all test files
- **After Wave 2 (features)**: `feat(apply): add --clean flag and install command` — src/commands/apply.ts, src/cli.ts
- **After Wave 3**: `test: add tests for --clean flag and install command` — test files
- **After Wave 4**: `docs: update AGENTS.md and README.md for apex-only architecture` — AGENTS.md, README.md

---

## Success Criteria

### Verification Commands
```bash
bun test                                    # Expected: all tests pass
bun run typecheck                           # Expected: no errors
bun run build                               # Expected: success
bun run src/cli.ts list --json              # Expected: [{"name":"apex",...}] (1 entry)
bun run src/cli.ts install --help           # Expected: shows install command help
bun run src/cli.ts apply --help             # Expected: shows --clean option
ls src/presets/ | grep -vE 'apex|index|__tests__' # Expected: empty
```

### Final Checklist
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] All tests pass
- [x] AGENTS.md documents apex-only philosophy
- [x] README.md reflects current state
