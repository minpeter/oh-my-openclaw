# Remote GitHub Preset Apply

## TL;DR

> **Quick Summary**: Add remote GitHub preset support to `apply` command. Users can pass a GitHub URL or `owner/repo` shorthand to download, cache, and apply presets from public GitHub repos.
> 
> **Deliverables**:
> - `src/core/remote.ts` — GitHub URL parsing, git clone, caching logic
> - Updated `src/commands/apply.ts` — detect remote refs, integrate remote fetch
> - Updated `src/cli.ts` — `--force` flag on apply/install
> - Tests for remote module + integration tests
> - Updated AGENTS.md and README.md
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 → Task 2 → Task 4 → Task 5 → Final Wave

---

## Context

### Original Request
User wants to apply presets directly from remote GitHub repositories. Example: `oh-my-openclaw apply https://github.com/minpeter/demo-researcher` or `oh-my-openclaw apply minpeter/demo-researcher`.

### Interview Summary
**Key Discussions**:
- UX: `apply` command accepts both local preset names AND GitHub references (full URL + owner/repo shorthand)
- Caching: Downloaded presets saved as user presets at `~/.openclaw/oh-my-openclaw/presets/<repo-name>/`
- GitHub only (no arbitrary git URLs)
- Download: `git clone --depth 1` via Bun.$
- Cache policy: Use cached if exists, `--force` to re-download
- `install` stays apex-only (no URL support)

**Research Findings**:
- Hook point: `apply.ts:39-52` (preset resolution — user first, then builtin)
- `loadPreset()` expects local directory with `preset.json5` (name, description, version required)
- No HTTP/git deps in project — use Bun.$ for git clone
- Security: path traversal checks needed, timeout on git clone, cleanup temp dirs

### Metis Review
**Identified Gaps** (addressed):
- **Path traversal risk**: Current `presetName` has no validation — remote refs could inject `../` paths. Solution: strict allowlist regex on parsed owner/repo
- **Silent error swallowing**: `apply.ts:40-43` catch{} hides validation errors. Solution: remote-specific error handling in new code only (don't modify existing catch)
- **workspaceFiles allowlist**: Remote presets could declare arbitrary files. Solution: warn if files not in WORKSPACE_FILES list
- **install command scope**: Keep `install` as apex-only, no URL support

---

## Work Objectives

### Core Objective
Enable `oh-my-openclaw apply` to accept GitHub URLs or `owner/repo` shorthand, automatically downloading and caching the remote preset as a user preset before applying.

### Concrete Deliverables
- `src/core/remote.ts` — parseGitHubRef(), cloneToCache(), isGitHubRef() functions
- `src/commands/apply.ts` — remote ref detection + integration (modify preset resolution block)
- `src/cli.ts` — `--force` option on apply command
- `src/core/__tests__/remote.test.ts` — unit tests for URL parsing and ref detection
- `src/commands/__tests__/apply.test.ts` — integration test for remote apply flow
- Updated `AGENTS.md` — document remote apply feature
- Updated `README.md` — document remote apply usage

### Definition of Done
- [x] `bun test` — all tests pass (0 failures)
- [x] `bun run typecheck` — no type errors
- [x] `bun run build` — builds successfully
- [x] `bun run src/cli.ts apply --help` — shows `--force` option
- [x] `bun run src/cli.ts apply minpeter/demo-researcher --dry-run` — recognizes as remote ref

### Must Have
- `apply` accepts full GitHub URLs: `https://github.com/owner/repo`
- `apply` accepts shorthand: `owner/repo`
- Downloaded presets cached as user presets in `~/.openclaw/oh-my-openclaw/presets/<repo-name>/`
- Cached presets reused on subsequent applies (no re-download)
- `--force` flag triggers re-download even if cached
- All existing tests still pass
- `git clone --depth 1` for downloading

### Must NOT Have (Guardrails)
- Do NOT support non-GitHub git URLs
- Do NOT support private repo authentication (MVP scope)
- Do NOT add URL support to `install` command (stays apex-only)
- Do NOT modify `src/core/preset-loader.ts` (reuse as-is via loadPreset())
- Do NOT modify `src/core/workspace.ts` (reuse as-is)
- Do NOT modify `src/core/merge.ts`, `src/core/backup.ts`, `src/core/sensitive-filter.ts`
- Do NOT modify existing test helper functions
- Do NOT add new npm dependencies
- Do NOT extract or refactor existing apply logic beyond the preset resolution block

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after (new module + integration)
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
Wave 1 (Foundation — new module + types):
├── Task 1: Create src/core/remote.ts [deep]
└── Task 2: Add --force flag to CLI [quick]

Wave 2 (Integration — wire remote into apply):
└── Task 3: Integrate remote resolution into apply.ts [deep]

Wave 3 (Tests):
├── Task 4: Add unit tests for remote.ts [unspecified-high]
└── Task 5: Add integration tests for remote apply [unspecified-high]

Wave 4 (Documentation):
├── Task 6: Update AGENTS.md [quick]
└── Task 7: Update README.md [quick]

Wave FINAL (Review):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 3 → Task 4/5 → Task 6/7 → Final Wave
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 2 (Waves 1, 3, 4)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1    | —         | 3, 4 |
| 2    | —         | 3 |
| 3    | 1, 2      | 5 |
| 4    | 1         | 6, 7 |
| 5    | 3         | 6, 7 |
| 6    | 4, 5      | F1-F4 |
| 7    | 4, 5      | F1-F4 |

### Agent Dispatch Summary

- **Wave 1**: **2 tasks** — T1 → `deep`, T2 → `quick`
- **Wave 2**: **1 task** — T3 → `deep`
- **Wave 3**: **2 tasks** — T4 → `unspecified-high`, T5 → `unspecified-high`
- **Wave 4**: **2 tasks** — T6 → `quick`, T7 → `quick`
- **FINAL**: **4 tasks** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

- [x] 1. Create `src/core/remote.ts` — GitHub URL Parsing, Clone, and Cache Logic

  **What to do**:
  - Create `src/core/remote.ts` with three exported functions:
    - `isGitHubRef(input: string): boolean` — returns true if input looks like a GitHub reference (contains `/` but is not a filesystem path). Detection logic: input matches `owner/repo` pattern OR starts with `https://github.com/`.
    - `parseGitHubRef(input: string): { owner: string; repo: string }` — extracts owner and repo from either full URL (`https://github.com/owner/repo`) or shorthand (`owner/repo`). Strip trailing `.git`, strip trailing slashes. Validate owner/repo with strict regex: `/^[a-zA-Z0-9._-]+$/` for each segment (no `..`, no path traversal). Throw descriptive error on invalid input.
    - `cloneToCache(owner: string, repo: string, presetsDir: string, options?: { force?: boolean }): Promise<string>` — clones a GitHub repo into user preset directory. Cache path: `path.join(presetsDir, `${owner}--${repo}`)`. If directory exists AND `force` is not true, return cached path immediately (log `Using cached preset...`). If force or not cached: clone to a temp dir (`fs.mkdtemp` in `os.tmpdir()`), then move to cache path. Clone command: `git clone --depth 1 https://github.com/${owner}/${repo}.git ${tmpDir}` via `Bun.$`. Remove `.git` directory after clone. Set a 30-second timeout on git clone (Bun.$ supports `.timeout()`). Clean up temp dir in `finally` block. On clone failure, throw user-friendly error: `Failed to clone 'owner/repo'. Ensure the repository exists and is public.`
  - Import only: `node:path`, `node:fs/promises`, `node:os` (Bun.$ is global, no import needed)
  - Use single quotes, semicolons, 2-space indent per project conventions
  - Export all three functions as named exports

  **Must NOT do**:
  - Do NOT add any npm dependencies
  - Do NOT support non-GitHub URLs
  - Do NOT support private repo authentication
  - Do NOT import from other project modules (this is a standalone utility)
  - Do NOT use `fetch()` or GitHub API — use `git clone` via `Bun.$` only

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Core module with security-sensitive URL parsing, process spawning, filesystem operations, and error handling. Needs careful implementation.
  - **Skills**: `[]`
    - No special skills needed — pure TypeScript module, no UI or browser interaction
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser interaction
    - `git-master`: Not doing git operations on the project repo itself

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3 (integration), Task 4 (unit tests)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `src/core/preset-loader.ts:8-27` — Follow same function structure: async function, clear error messages, early returns. Note how it validates required fields (name, description, version) and throws descriptive errors.
  - `src/core/config-path.ts:8-31` — Follow same import pattern: `node:` prefix imports, `os.homedir()` usage, `fs.mkdirSync` for directory creation.
  - `src/core/constants.ts` — Reference `OH_MY_OPENCLAW_DIR` value ('oh-my-openclaw') and `PRESET_MANIFEST_FILENAME` ('preset.json5') for understanding preset directory structure.

  **API/Type References** (contracts to implement against):
  - `src/core/types.ts:12-18` — `ResolvedPaths` interface shows `presetsDir` field (the cache root directory).
  - `src/core/config-path.ts:24` — `presetsDir = path.join(stateDir, OH_MY_OPENCLAW_DIR, 'presets')` — this is the exact directory where cached remote presets go.

  **External References**:
  - Bun Shell API: `Bun.$` supports tagged template literals for shell commands with auto-escaping. Use `await Bun.$\`git clone --depth 1 ${url} ${tmpDir}\`.timeout(30_000)` pattern. The `$` global is available without import.

  **WHY Each Reference Matters:**
  - `preset-loader.ts` — Your cache path will be passed to `loadPreset()` later (Task 3), so the cloned directory must contain a valid `preset.json5` that passes `loadPreset()` validation.
  - `config-path.ts` — Shows the `presetsDir` path pattern so you put cached presets in the right place.
  - `constants.ts` — Understanding `OH_MY_OPENCLAW_DIR` ensures cache directories follow project conventions.

  **Acceptance Criteria**:
  - [ ] File exists: `src/core/remote.ts`
  - [ ] `bun run typecheck` — no type errors
  - [ ] All three functions are exported: `isGitHubRef`, `parseGitHubRef`, `cloneToCache`

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: isGitHubRef correctly identifies GitHub references
    Tool: Bash (bun eval)
    Preconditions: src/core/remote.ts exists and exports isGitHubRef
    Steps:
      1. Run: bun eval "import { isGitHubRef } from './src/core/remote'; console.log(JSON.stringify({ url: isGitHubRef('https://github.com/minpeter/demo-researcher'), shorthand: isGitHubRef('minpeter/demo-researcher'), local: isGitHubRef('apex'), dotdot: isGitHubRef('../malicious'), empty: isGitHubRef('') }))"
      2. Assert output is: {"url":true,"shorthand":true,"local":false,"dotdot":false,"empty":false}
    Expected Result: Full URLs and owner/repo shorthands return true; local names, path traversals, and empty strings return false
    Failure Indicators: Any of the boolean values are wrong, or import fails
    Evidence: .sisyphus/evidence/task-1-is-github-ref.txt

  Scenario: parseGitHubRef extracts owner and repo correctly
    Tool: Bash (bun eval)
    Preconditions: src/core/remote.ts exists
    Steps:
      1. Run: bun eval "import { parseGitHubRef } from './src/core/remote'; console.log(JSON.stringify([parseGitHubRef('https://github.com/minpeter/demo-researcher'), parseGitHubRef('minpeter/demo-researcher'), parseGitHubRef('https://github.com/minpeter/demo-researcher.git')]))"
      2. Assert output: [{"owner":"minpeter","repo":"demo-researcher"},{"owner":"minpeter","repo":"demo-researcher"},{"owner":"minpeter","repo":"demo-researcher"}]
    Expected Result: All three inputs parse to same owner/repo pair
    Failure Indicators: Different owner/repo values, or trailing .git not stripped
    Evidence: .sisyphus/evidence/task-1-parse-github-ref.txt

  Scenario: parseGitHubRef rejects path traversal attacks
    Tool: Bash (bun eval)
    Preconditions: src/core/remote.ts exists
    Steps:
      1. Run: bun eval "import { parseGitHubRef } from './src/core/remote'; try { parseGitHubRef('../etc/passwd'); console.log('FAIL: no error thrown') } catch(e) { console.log('OK: ' + e.message) }"
      2. Assert output starts with 'OK:' (error was thrown)
      3. Also test: bun eval "import { parseGitHubRef } from './src/core/remote'; try { parseGitHubRef('owner/repo/../../etc'); console.log('FAIL') } catch(e) { console.log('OK: ' + e.message) }"
    Expected Result: Both path traversal attempts throw errors
    Failure Indicators: Output starts with 'FAIL' meaning no error was thrown
    Evidence: .sisyphus/evidence/task-1-path-traversal-reject.txt

  Scenario: cloneToCache clones a real public repo
    Tool: Bash (bun eval)
    Preconditions: Network access available, src/core/remote.ts exists
    Steps:
      1. Create temp presetsDir: bun eval "import { mkdtemp } from 'node:fs/promises'; import { tmpdir } from 'node:os'; import { join } from 'node:path'; const d = await mkdtemp(join(tmpdir(), 'remote-test-')); const presetsDir = join(d, 'presets'); await import('node:fs/promises').then(f => f.mkdir(presetsDir, {recursive:true})); const { cloneToCache } = await import('./src/core/remote'); const cachePath = await cloneToCache('minpeter', 'demo-researcher', presetsDir); const { readdir } = await import('node:fs/promises'); const files = await readdir(cachePath); console.log(JSON.stringify({ cachePath: cachePath.includes('minpeter--demo-researcher'), hasPresetJson5: files.includes('preset.json5'), hasGitDir: files.includes('.git') })); await import('node:fs/promises').then(f => f.rm(d, {recursive:true, force:true}))"
      2. Assert: {"cachePath":true,"hasPresetJson5":true,"hasGitDir":false}
    Expected Result: Repo cloned, cached at owner--repo path, .git directory removed, preset.json5 exists
    Failure Indicators: Clone fails, .git not removed, preset.json5 missing, wrong cache path
    Evidence: .sisyphus/evidence/task-1-clone-to-cache.txt
  ```

  **Evidence to Capture:**
  - [ ] task-1-is-github-ref.txt — isGitHubRef test output
  - [ ] task-1-parse-github-ref.txt — parseGitHubRef test output
  - [ ] task-1-path-traversal-reject.txt — security validation output
  - [ ] task-1-clone-to-cache.txt — real clone test output

  **Commit**: YES
  - Message: `feat(core): add remote GitHub preset resolution module`
  - Files: `src/core/remote.ts`
  - Pre-commit: `bun run typecheck`

---

- [x] 2. Add `--force` Flag to CLI Apply Command

  **What to do**:
  - In `src/cli.ts`, add `.option('--force', 'Re-download remote preset even if cached')` to the `apply` command (after line 42, the existing `--clean` option).
  - Update the action handler type to include `force?: boolean` in the options destructuring.
  - Pass `force: options.force` to `applyCommand()` call.
  - In `src/commands/apply.ts`, add `force?: boolean` to the `ApplyOptions` interface (line 18-22).
  - The `force` option is NOT passed through for local presets — it only affects remote resolution (Task 3 will wire this up). For now, just accept it and store it.

  **Must NOT do**:
  - Do NOT add `--force` to `install` command (install is apex-only, no remote support)
  - Do NOT add any logic for using the force flag yet (Task 3 handles that)
  - Do NOT modify command descriptions or help text beyond the new option

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Two small edits to existing files — adding an option to CLI and a field to an interface. Trivial changes.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - All skills: This is a 5-line change across 2 files

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3 (integration needs --force wired in)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `src/cli.ts:42` — `.option('--clean', 'Remove existing config and workspace files before applying (clean install)')` — follow exact same pattern for `--force` option, placed on the next line.
  - `src/cli.ts:43` — `.action(async (preset: string, options: { dryRun?: boolean; backup?: boolean; clean?: boolean }) => {` — add `force?: boolean` to this type.
  - `src/cli.ts:45-49` — Object passed to `applyCommand()` — add `force: options.force` here.

  **API/Type References**:
  - `src/commands/apply.ts:18-22` — `ApplyOptions` interface — add `force?: boolean` field.

  **WHY Each Reference Matters:**
  - `cli.ts:42-49` — This is the exact code you're modifying. Follow the pattern of existing options (--clean, --dry-run).
  - `apply.ts:18-22` — The interface must match what CLI passes. This is the contract.

  **Acceptance Criteria**:
  - [ ] `bun run src/cli.ts apply --help` output includes `--force` option
  - [ ] `bun run typecheck` — no type errors
  - [ ] `ApplyOptions` interface in apply.ts has `force?: boolean` field

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: --force flag appears in apply help
    Tool: Bash
    Preconditions: src/cli.ts has been modified
    Steps:
      1. Run: bun run src/cli.ts apply --help
      2. Assert output contains '--force' and 'Re-download remote preset even if cached'
    Expected Result: Help text shows --force with description
    Failure Indicators: --force not in output, or wrong description
    Evidence: .sisyphus/evidence/task-2-force-help.txt

  Scenario: --force flag does NOT appear in install help
    Tool: Bash
    Preconditions: src/cli.ts modified
    Steps:
      1. Run: bun run src/cli.ts install --help
      2. Assert output does NOT contain '--force'
    Expected Result: install command has no --force option (apex-only)
    Failure Indicators: --force appears in install help
    Evidence: .sisyphus/evidence/task-2-install-no-force.txt

  Scenario: TypeScript compiles without errors
    Tool: Bash
    Preconditions: Both files modified
    Steps:
      1. Run: bun run typecheck
      2. Assert exit code 0 and no error output
    Expected Result: Clean typecheck pass
    Failure Indicators: Type errors related to force field or ApplyOptions
    Evidence: .sisyphus/evidence/task-2-typecheck.txt
  ```

  **Evidence to Capture:**
  - [ ] task-2-force-help.txt — apply --help output showing --force
  - [ ] task-2-install-no-force.txt — install --help output without --force
  - [ ] task-2-typecheck.txt — typecheck output

  **Commit**: YES (group with Task 1)
  - Message: `feat(cli): add --force flag to apply command for remote preset re-download`
  - Files: `src/cli.ts`, `src/commands/apply.ts`
  - Pre-commit: `bun run typecheck`

</invoke>

---

- [x] 3. Integrate Remote Resolution into `apply.ts`

  **What to do**:
  - In `src/commands/apply.ts`, modify the preset resolution block (lines 39-52) to detect and handle remote GitHub references BEFORE trying local/builtin lookup.
  - Import `{ isGitHubRef, parseGitHubRef, cloneToCache }` from `'../core/remote'`.
  - New flow at lines 39-52 (pseudo-code):
    ```
    if (isGitHubRef(presetName)) {
      const { owner, repo } = parseGitHubRef(presetName);
      const cachePath = await cloneToCache(owner, repo, paths.presetsDir, { force: options.force });
      preset = await loadPreset(cachePath);
      presetDir = cachePath;
      console.log(pc.green(`Remote preset '${owner}/${repo}' ready.`));
    } else {
      // existing local/builtin resolution logic (unchanged)
    }
    ```
  - If `isGitHubRef` returns true but clone/load fails, let the error propagate naturally (don't catch and fall through to local resolution — that would be confusing UX).
  - Add import for `pc` (picocolors) if not already imported (it already is on line 5).
  - The `options.force` is already available via Task 2's changes to `ApplyOptions`.

  **Must NOT do**:
  - Do NOT modify any code outside the preset resolution block (lines 39-52) and the import section
  - Do NOT modify `loadPreset()` in `preset-loader.ts`
  - Do NOT modify the merge, backup, write, or workspace copy logic
  - Do NOT add fallback to local preset if remote fails (remote failure = hard error)
  - Do NOT add any progress bars or spinners (keep output consistent with existing style)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Integration task touching the core apply flow. Must carefully modify the preset resolution conditional without breaking existing behavior. Needs to understand the full apply flow.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - All skills: Pure TypeScript integration, no UI or browser interaction needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential — after Wave 1)
  - **Blocks**: Task 5 (integration tests)
  - **Blocked By**: Task 1 (remote.ts must exist), Task 2 (--force option must be in ApplyOptions)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `src/commands/apply.ts:39-52` — **THE EXACT CODE BLOCK TO MODIFY**. Current flow: try userPresetPath → catch → try builtin → throw if not found. Your new code adds a FIRST branch: if isGitHubRef, handle remote. The else branch contains the existing code UNCHANGED.
  - `src/commands/apply.ts:33-34` — Function signature and `resolveOpenClawPaths()` call. Shows `paths.presetsDir` is available for passing to `cloneToCache()`.
  - `src/commands/apply.ts:5` — `import pc from 'picocolors'` — already imported, use for console output.

  **API/Type References**:
  - `src/core/remote.ts` — (created in Task 1) `isGitHubRef(input): boolean`, `parseGitHubRef(input): {owner, repo}`, `cloneToCache(owner, repo, presetsDir, opts): Promise<string>`.
  - `src/commands/apply.ts:18-22` — `ApplyOptions` (updated in Task 2) now has `force?: boolean`.
  - `src/core/preset-loader.ts:8` — `loadPreset(presetPath: string): Promise<PresetManifest>` — this is called with the cachePath returned by cloneToCache. It validates preset.json5 exists and has name/description/version.

  **WHY Each Reference Matters:**
  - `apply.ts:39-52` — This is the surgical insertion point. You MUST keep the existing else-branch logic byte-for-byte identical.
  - `remote.ts` API — You're calling all three functions from Task 1. Must match their exact signatures.
  - `preset-loader.ts` — `loadPreset()` is called on the cached directory. If the remote repo doesn't have a valid `preset.json5`, loadPreset will throw a clear error.

  **Acceptance Criteria**:
  - [ ] `bun run typecheck` — no type errors
  - [ ] `bun test` — all existing tests still pass (no regressions)
  - [ ] `isGitHubRef` import and usage is in apply.ts
  - [ ] `parseGitHubRef` import and usage is in apply.ts
  - [ ] `cloneToCache` import and usage is in apply.ts
  - [ ] Existing local preset resolution code is unchanged (diff shows only additions, not modifications to existing logic)

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Remote apply with real GitHub repo (happy path)
    Tool: Bash
    Preconditions: Network access, Task 1 and 2 complete. Set OPENCLAW_CONFIG_PATH to a temp path.
    Steps:
      1. Create temp env: export OPENCLAW_CONFIG_PATH=$(mktemp -d)/openclaw.json && mkdir -p $(dirname $OPENCLAW_CONFIG_PATH)/.openclaw/oh-my-openclaw/presets && mkdir -p $(dirname $OPENCLAW_CONFIG_PATH)/.openclaw/oh-my-openclaw/backups && echo '{identity:{name:"TestBot"}}' > $OPENCLAW_CONFIG_PATH
      2. Run: bun run src/cli.ts apply minpeter/demo-researcher --dry-run 2>&1
      3. Assert output contains 'Remote preset' and 'DRY RUN' and 'demo-researcher'
    Expected Result: CLI recognizes shorthand as remote ref, clones, and shows dry-run output
    Failure Indicators: 'Preset not found' error, or no remote detection
    Evidence: .sisyphus/evidence/task-3-remote-apply-dryrun.txt

  Scenario: Remote apply with full URL format
    Tool: Bash
    Preconditions: Same temp env as above
    Steps:
      1. Run: bun run src/cli.ts apply https://github.com/minpeter/demo-researcher --dry-run 2>&1
      2. Assert output contains 'Remote preset' and 'DRY RUN'
    Expected Result: Full URL also works for remote detection
    Failure Indicators: URL not recognized as remote ref
    Evidence: .sisyphus/evidence/task-3-remote-apply-url.txt

  Scenario: Local preset still works (no regression)
    Tool: Bash
    Preconditions: Default env with existing config
    Steps:
      1. Run: bun test src/commands/__tests__/apply.test.ts
      2. Assert all tests pass (0 failures)
    Expected Result: All existing apply tests pass unchanged
    Failure Indicators: Any test failure
    Evidence: .sisyphus/evidence/task-3-no-regression.txt

  Scenario: Cached remote preset reused on second apply
    Tool: Bash
    Preconditions: First apply already cloned repo to cache
    Steps:
      1. Run: bun run src/cli.ts apply minpeter/demo-researcher --dry-run 2>&1
      2. Assert output contains 'cached' or 'Using cached'
    Expected Result: Second run uses cache, does not re-clone
    Failure Indicators: Re-clones instead of using cache
    Evidence: .sisyphus/evidence/task-3-cached-reuse.txt
  ```

  **Evidence to Capture:**
  - [ ] task-3-remote-apply-dryrun.txt — dry-run with shorthand
  - [ ] task-3-remote-apply-url.txt — dry-run with full URL
  - [ ] task-3-no-regression.txt — existing test suite output
  - [ ] task-3-cached-reuse.txt — cache hit output

  **Commit**: YES
  - Message: `feat(apply): integrate remote GitHub preset resolution`
  - Files: `src/commands/apply.ts`
  - Pre-commit: `bun test`

---

- [x] 4. Add Unit Tests for `src/core/remote.ts`

  **What to do**:
  - Create `src/core/__tests__/remote.test.ts` with comprehensive unit tests.
  - Test structure: `describe('remote')` with nested `describe` blocks for each function.
  - **`isGitHubRef` tests:**
    - `test('returns true for owner/repo shorthand')` — `isGitHubRef('minpeter/demo-researcher')` → true
    - `test('returns true for full GitHub URL')` — `isGitHubRef('https://github.com/minpeter/demo-researcher')` → true
    - `test('returns true for URL with .git suffix')` — `isGitHubRef('https://github.com/minpeter/demo-researcher.git')` → true
    - `test('returns false for local preset name')` — `isGitHubRef('apex')` → false
    - `test('returns false for empty string')` — `isGitHubRef('')` → false
    - `test('returns false for path traversal')` — `isGitHubRef('../malicious')` → false
  - **`parseGitHubRef` tests:**
    - `test('parses owner/repo shorthand')` — returns `{ owner: 'minpeter', repo: 'demo-researcher' }`
    - `test('parses full GitHub URL')` — same result for `https://github.com/minpeter/demo-researcher`
    - `test('strips .git suffix')` — `https://github.com/owner/repo.git` → `{ owner: 'owner', repo: 'repo' }`
    - `test('strips trailing slash')` — `https://github.com/owner/repo/` → `{ owner: 'owner', repo: 'repo' }`
    - `test('throws on path traversal in owner')` — `'../evil/repo'` → throws
    - `test('throws on path traversal in repo')` — `'owner/../../etc'` → throws
    - `test('throws on invalid characters')` — `'owner/repo with spaces'` → throws
    - `test('throws on empty segments')` — `'/repo'` → throws (empty owner)
  - **`cloneToCache` tests** (these are inherently integration-ish since they touch filesystem + git):
    - `test('clones repo to cache directory')` — clone `minpeter/demo-researcher` to temp presetsDir, verify cache path is `presetsDir/minpeter--demo-researcher`, verify `preset.json5` exists, verify `.git` dir removed
    - `test('reuses cached preset on second call')` — call twice, second should return immediately with cache. Verify by checking that only 1 clone happened (mock or timing).
    - `test('force re-downloads even if cached')` — clone once, then clone with `{ force: true }`, verify directory is refreshed
    - `test('throws on non-existent repo')` — try `nonexistent-owner-xyz/nonexistent-repo-xyz`, assert error message contains 'Failed to clone'
  - Use temp directories via `fs.mkdtemp` and clean up in `afterEach` (follow pattern from `src/commands/__tests__/apply.test.ts:21-39`)
  - Import from `bun:test`: `{ afterEach, describe, expect, test }`

  **Must NOT do**:
  - Do NOT mock Bun.$ or filesystem operations (test real behavior)
  - Do NOT modify existing test files
  - Do NOT test apply integration (that's Task 5)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Substantial test file with ~12-15 test cases, temp directory management, real git clone operations requiring network access.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 5)
  - **Blocks**: Task 6 (docs), Task 7 (docs)
  - **Blocked By**: Task 1 (remote.ts must exist to test)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `src/commands/__tests__/apply.test.ts:21-39` — `createTempEnv()` pattern: use `fs.mkdtemp()` with `os.tmpdir()`, track temp dirs in array, clean up in `afterEach`. Copy this exact pattern for your temp presetsDir setup.
  - `src/commands/__tests__/apply.test.ts:89-96` — `afterEach` cleanup: restore `process.env`, delete all temp dirs. Follow this exact pattern.
  - `src/commands/__tests__/apply.test.ts:5` — Import pattern: `import { afterEach, describe, expect, test } from 'bun:test'`
  - `src/core/__tests__/` — Check existing test files in this directory for naming and structure conventions.

  **API/Type References**:
  - `src/core/remote.ts` — (created in Task 1) All three function signatures: `isGitHubRef(input: string): boolean`, `parseGitHubRef(input: string): { owner: string; repo: string }`, `cloneToCache(owner: string, repo: string, presetsDir: string, options?: { force?: boolean }): Promise<string>`

  **WHY Each Reference Matters:**
  - `apply.test.ts` — Shows the project's test conventions: how temp dirs are managed, how cleanup works, import style. Your tests MUST follow the same pattern for consistency.
  - `remote.ts` — You're testing these functions. Must match exact signatures.

  **Acceptance Criteria**:
  - [ ] File exists: `src/core/__tests__/remote.test.ts`
  - [ ] `bun test src/core/__tests__/remote.test.ts` — all tests pass
  - [ ] `bun test` — full suite still passes (no regressions)
  - [ ] At least 12 test cases covering all three functions

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All remote unit tests pass
    Tool: Bash
    Preconditions: src/core/__tests__/remote.test.ts exists, Task 1 complete
    Steps:
      1. Run: bun test src/core/__tests__/remote.test.ts 2>&1
      2. Assert: All tests pass (check for '0 fail' or 'pass' count matches total)
      3. Assert: Test count >= 12
    Expected Result: 12+ tests passing, 0 failures
    Failure Indicators: Any test failure, test count < 12
    Evidence: .sisyphus/evidence/task-4-unit-tests.txt

  Scenario: No regression in full test suite
    Tool: Bash
    Preconditions: New test file added
    Steps:
      1. Run: bun test 2>&1
      2. Assert: 0 failures across all test files
    Expected Result: Full suite passes including new tests
    Failure Indicators: Any pre-existing test fails
    Evidence: .sisyphus/evidence/task-4-full-suite.txt
  ```

  **Evidence to Capture:**
  - [ ] task-4-unit-tests.txt — remote.test.ts output
  - [ ] task-4-full-suite.txt — full test suite output

  **Commit**: YES
  - Message: `test(core): add unit tests for remote GitHub preset resolution`
  - Files: `src/core/__tests__/remote.test.ts`
  - Pre-commit: `bun test`

---

- [x] 5. Add Integration Tests for Remote Apply Flow

  **What to do**:
  - In `src/commands/__tests__/apply.test.ts`, add a new `describe('remote apply')` block at the end of the file (after the existing `describe('applyCommand')` block).
  - **Test cases to add:**
    - `test('applies remote preset via owner/repo shorthand')` — Create temp env, run `applyCommand('minpeter/demo-researcher')`, verify: config was merged (read configPath), workspace files copied (check AGENTS.md in workspaceDir), cached in presetsDir at `minpeter--demo-researcher`.
    - `test('applies remote preset via full URL')` — Same as above but with `applyCommand('https://github.com/minpeter/demo-researcher')`.
    - `test('uses cached preset on second apply')` — Apply twice, capture logs from second run, assert 'cached' or 'Using cached' appears.
    - `test('--force re-downloads cached preset')` — Apply once, then apply with `{ force: true }`, assert no 'cached' message (re-cloned).
    - `test('--dry-run with remote preset shows changes without applying')` — Apply with `{ dryRun: true }`, verify no files modified.
    - `test('throws on non-existent remote repo')` — Apply `nonexistent-xyz/nonexistent-xyz`, assert throws with meaningful error.
  - Use the existing `createTempEnv()`, `writeConfig()`, `readConfig()`, `captureLogs()` helpers already defined in the file.
  - Each test must clean up temp dirs (already handled by existing `afterEach`).

  **Must NOT do**:
  - Do NOT modify existing test cases
  - Do NOT modify helper functions (`createTempEnv`, `writeConfig`, etc.)
  - Do NOT mock remote operations (test real git clone)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Integration tests with real network operations, needs careful env setup and assertion design.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 4)
  - **Blocks**: Task 6 (docs), Task 7 (docs)
  - **Blocked By**: Task 3 (apply.ts integration must be wired)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `src/commands/__tests__/apply.test.ts:21-96` — All helper functions: `createTempEnv()` (lines 21-39), `writeConfig()` (41-43), `readConfig()` (45-47), `fileExists()` (49-56), `writeUserPreset()` (58-71), `captureLogs()` (73-87), `afterEach` (89-96). You MUST use these existing helpers, not create new ones.
  - `src/commands/__tests__/apply.test.ts:99-134` — Example test pattern: create temp env → write config → set up preset → call applyCommand → assert results. Follow this exact structure.
  - `src/commands/__tests__/apply.test.ts:366-388` — `--clean` test pattern showing how to capture logs and assert on output messages.

  **API/Type References**:
  - `src/commands/apply.ts:33` — `applyCommand(presetName: string, options: ApplyOptions)` — call with remote ref as presetName.
  - `src/commands/apply.ts:18-22` — `ApplyOptions` with `force?: boolean`.

  **External References**:
  - `https://github.com/minpeter/demo-researcher` — Public test repo. Should have `preset.json5` with name, description, version + at least AGENTS.md workspace file.

  **WHY Each Reference Matters:**
  - `apply.test.ts:21-96` — You MUST reuse these helpers. Creating duplicate helpers would violate the 'Must NOT do' constraint.
  - `apply.test.ts:99-134` — This is the canonical test pattern. Your tests should look nearly identical in structure.
  - `demo-researcher` repo — Real test target. Your tests depend on this repo having a valid preset structure.

  **Acceptance Criteria**:
  - [ ] `bun test src/commands/__tests__/apply.test.ts` — all tests pass (old + new)
  - [ ] At least 6 new test cases in `describe('remote apply')` block
  - [ ] No modifications to existing test helpers or test cases

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All apply tests pass including new remote tests
    Tool: Bash
    Preconditions: Tasks 1-4 complete, apply.test.ts updated
    Steps:
      1. Run: bun test src/commands/__tests__/apply.test.ts 2>&1
      2. Assert: 0 failures
      3. Assert: Total test count increased by >= 6 from baseline
    Expected Result: All old tests pass + all new remote tests pass
    Failure Indicators: Any failure, especially in remote describe block
    Evidence: .sisyphus/evidence/task-5-integration-tests.txt

  Scenario: Full test suite still passes
    Tool: Bash
    Preconditions: All new tests added
    Steps:
      1. Run: bun test 2>&1
      2. Assert: 0 failures across all files
    Expected Result: Complete test suite green
    Failure Indicators: Any test failure in any file
    Evidence: .sisyphus/evidence/task-5-full-suite.txt
  ```

  **Evidence to Capture:**
  - [ ] task-5-integration-tests.txt — apply test file output
  - [ ] task-5-full-suite.txt — full suite output

  **Commit**: YES
  - Message: `test(apply): add integration tests for remote GitHub preset apply`
  - Files: `src/commands/__tests__/apply.test.ts`
  - Pre-commit: `bun test`

---

- [x] 6. Update AGENTS.md — Document Remote Apply Feature

  **What to do**:
  - Update `AGENTS.md` to reflect the new remote apply capability.
  - **OVERVIEW section** (line 9): Update description to mention remote GitHub preset support. Change '5 subcommands' mention if needed, and note that `apply` now accepts GitHub URLs.
  - **STRUCTURE section**: Add `src/core/remote.ts` entry under `src/core/` with description: `# GitHub URL parsing, clone, and cache logic`
  - **WHERE TO LOOK table**: Add row: `| Apply remote GitHub presets | src/core/remote.ts | isGitHubRef(), parseGitHubRef(), cloneToCache() |`
  - **CONVENTIONS section**: No changes needed (same conventions apply).
  - **PRESET RESOLUTION ORDER section**: Add step 0: `0. Remote GitHub presets: if input contains '/', treat as GitHub ref → clone → cache as user preset`
  - **APEX-ONLY PHILOSOPHY section**: Add note: `Remote presets can be applied directly from GitHub: \`oh-my-openclaw apply owner/repo\` or \`oh-my-openclaw apply https://github.com/owner/repo\`. They are cached as user presets.`
  - **COMMANDS section**: Update `bun run` commands if any new ones are relevant (unlikely).
  - **NOTES section**: Add note about `--force` flag for remote presets.

  **Must NOT do**:
  - Do NOT rewrite entire AGENTS.md — surgical edits only
  - Do NOT change any information about existing features
  - Do NOT add speculative features or future plans
  - Do NOT change formatting style

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small documentation updates to an existing file. Surgical edits.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 7)
  - **Blocks**: Final Wave (F1-F4)
  - **Blocked By**: Task 4 (tests confirm feature works), Task 5 (integration tests confirm flow)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `AGENTS.md` (entire file) — Read this file fully to understand current structure, tone, and format before editing. Pay attention to how sections are organized and the level of detail.
  - `AGENTS.md:9` — OVERVIEW section to update.
  - `AGENTS.md:13-27` — STRUCTURE section to add new file.

  **API/Type References**:
  - `src/core/remote.ts` — Functions to document: `isGitHubRef()`, `parseGitHubRef()`, `cloneToCache()`.

  **WHY Each Reference Matters:**
  - `AGENTS.md` — Must maintain existing format and tone. This is the project knowledge base used by all agents.

  **Acceptance Criteria**:
  - [ ] AGENTS.md mentions remote GitHub preset support
  - [ ] AGENTS.md mentions `src/core/remote.ts` in structure and WHERE TO LOOK
  - [ ] AGENTS.md mentions `--force` flag
  - [ ] AGENTS.md mentions cache directory convention (`owner--repo`)
  - [ ] No existing content removed or corrupted

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: AGENTS.md contains remote apply documentation
    Tool: Bash (grep)
    Preconditions: AGENTS.md updated
    Steps:
      1. Run: grep -c 'remote' AGENTS.md
      2. Assert: count > 0
      3. Run: grep -c 'remote.ts' AGENTS.md
      4. Assert: count > 0
      5. Run: grep -c 'force' AGENTS.md
      6. Assert: count > 0
      7. Run: grep -c 'owner--repo' AGENTS.md
      8. Assert: count > 0
    Expected Result: All four search terms found in AGENTS.md
    Failure Indicators: Any grep returns 0 count
    Evidence: .sisyphus/evidence/task-6-agents-md.txt
  ```

  **Evidence to Capture:**
  - [ ] task-6-agents-md.txt — grep verification output

  **Commit**: YES (group with Task 7)
  - Message: `docs: update AGENTS.md and README.md for remote GitHub preset support`
  - Files: `AGENTS.md`, `README.md`
  - Pre-commit: `bun test`

---

- [x] 7. Update README.md — Document Remote Apply Usage

  **What to do**:
  - Update `README.md` to document the new remote apply feature for end users.
  - **Commands > apply section**: Add to description: note that `<preset>` can be a local name, `owner/repo` shorthand, or full `https://github.com/owner/repo` URL.
  - **Commands > apply > Flags**: Add `--force` flag: `Re-download a remote preset even if cached locally.`
  - **Quick Start > Basic Workflow section**: Add example: `oh-my-openclaw apply minpeter/demo-researcher # Apply from GitHub`
  - **Add new section** after 'Creating Custom Presets': `## Remote Presets` with:
    - Description of how remote presets work (URL formats, caching, --force)
    - Example usage:
      ```bash
      # Apply from GitHub (shorthand)
      oh-my-openclaw apply minpeter/demo-researcher

      # Apply from GitHub (full URL)
      oh-my-openclaw apply https://github.com/minpeter/demo-researcher

      # Force re-download
      oh-my-openclaw apply minpeter/demo-researcher --force
      ```
    - Note: remote presets are cached as user presets at `~/.openclaw/oh-my-openclaw/presets/owner--repo/`
    - Note: only public GitHub repos supported (MVP)

  **Must NOT do**:
  - Do NOT rewrite sections that aren't affected
  - Do NOT change the Architecture section
  - Do NOT add implementation details (keep it user-facing)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small documentation updates. Follows existing README structure.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 6)
  - **Blocks**: Final Wave (F1-F4)
  - **Blocked By**: Task 4 (tests confirm feature works), Task 5 (integration tests confirm flow)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References**:
  - `README.md` (entire file) — Read fully to understand current structure. Note the Commands section format, Quick Start format, and how 'Creating Custom Presets' section is structured.
  - `README.md` apply command section — Current flags listing (--dry-run, --no-backup, --clean). Add --force in same style.

  **WHY Each Reference Matters:**
  - `README.md` — Must maintain consistent user-facing documentation style.

  **Acceptance Criteria**:
  - [ ] README.md documents `owner/repo` shorthand syntax
  - [ ] README.md documents full URL syntax
  - [ ] README.md documents `--force` flag under apply
  - [ ] README.md has 'Remote Presets' section with examples
  - [ ] README.md mentions cache directory

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: README.md contains remote preset documentation
    Tool: Bash (grep)
    Preconditions: README.md updated
    Steps:
      1. Run: grep -c 'Remote Presets' README.md
      2. Assert: count > 0
      3. Run: grep -c 'owner/repo' README.md
      4. Assert: count > 0
      5. Run: grep -c '\-\-force' README.md
      6. Assert: count > 0
      7. Run: grep 'minpeter/demo-researcher' README.md
      8. Assert: at least one match
    Expected Result: All documentation additions present
    Failure Indicators: Any search term not found
    Evidence: .sisyphus/evidence/task-7-readme-md.txt
  ```

  **Evidence to Capture:**
  - [ ] task-7-readme-md.txt — grep verification output

  **Commit**: YES (group with Task 6)
  - Message: `docs: update AGENTS.md and README.md for remote GitHub preset support`
  - Files: `AGENTS.md`, `README.md`
  - Pre-commit: `bun test`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  - Verify `src/core/remote.ts` exists with all 3 functions
  - Verify `apply.ts` has remote resolution integration
  - Verify `--force` flag in `cli.ts` apply command
  - Verify all Must NOT Have constraints (no non-GitHub URLs, no install URL support, no modified preset-loader/workspace/merge/backup/sensitive-filter)
  - Verify all evidence files from Tasks 1-7 exist
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `bun run typecheck` + `bun test`. Review all changed/new files for: `as any`/`@ts-ignore`, empty catches without intentional comment, `console.log` in prod code (should use `pc.*`), commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic variable names.
  - Review `src/core/remote.ts` for code quality
  - Review changes to `src/commands/apply.ts` for minimal diff
  - Review changes to `src/cli.ts` for consistency
  - Verify no new dependencies added to `package.json`
  Output: `Build [PASS/FAIL] | Typecheck [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute real CLI commands:
  1. `bun run src/cli.ts apply minpeter/demo-researcher --dry-run` — verify remote detection + dry-run output
  2. `bun run src/cli.ts apply minpeter/demo-researcher` — verify actual apply (config merged, workspace files copied)
  3. `bun run src/cli.ts apply minpeter/demo-researcher` (second time) — verify cache hit message
  4. `bun run src/cli.ts apply minpeter/demo-researcher --force` — verify re-download
  5. `bun run src/cli.ts apply https://github.com/minpeter/demo-researcher --dry-run` — verify full URL format
  6. `bun run src/cli.ts apply nonexistent-xyz/nonexistent-repo --dry-run` — verify error handling
  7. `bun run src/cli.ts apply apex` — verify local presets still work
  8. `bun run src/cli.ts install` — verify install still works (no URL support)
  Save all outputs to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (`git log --oneline`, `git diff main...HEAD`). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance per task. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  - Verify `src/core/preset-loader.ts` was NOT modified
  - Verify `src/core/workspace.ts` was NOT modified
  - Verify `src/core/merge.ts`, `src/core/backup.ts`, `src/core/sensitive-filter.ts` were NOT modified
  - Verify `install` command has NO `--force` flag
  - Verify no new npm dependencies in `package.json`
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Wave | Commit Message | Files | Pre-commit |
|------|---------------|-------|------------|
| 1 | `feat(core): add remote GitHub preset resolution module` | `src/core/remote.ts` | `bun run typecheck` |
| 1 | `feat(cli): add --force flag to apply command for remote preset re-download` | `src/cli.ts`, `src/commands/apply.ts` | `bun run typecheck` |
| 2 | `feat(apply): integrate remote GitHub preset resolution` | `src/commands/apply.ts` | `bun test` |
| 3 | `test(core): add unit tests for remote GitHub preset resolution` | `src/core/__tests__/remote.test.ts` | `bun test` |
| 3 | `test(apply): add integration tests for remote GitHub preset apply` | `src/commands/__tests__/apply.test.ts` | `bun test` |
| 4 | `docs: update AGENTS.md and README.md for remote GitHub preset support` | `AGENTS.md`, `README.md` | `bun test` |

---

## Success Criteria

### Verification Commands
```bash
bun run typecheck           # Expected: no errors
bun test                    # Expected: all tests pass (0 failures), test count increased by ~18
bun run build               # Expected: builds successfully
bun run src/cli.ts apply --help  # Expected: shows --force option
bun run src/cli.ts apply minpeter/demo-researcher --dry-run  # Expected: recognizes as remote, shows dry-run
```

### Final Checklist
- [x] `src/core/remote.ts` exists with `isGitHubRef`, `parseGitHubRef`, `cloneToCache`
- [x] `src/commands/apply.ts` detects GitHub refs and clones before applying
- [x] `src/cli.ts` has `--force` option on apply command (NOT on install)
- [x] `src/core/__tests__/remote.test.ts` has 12+ test cases
- [x] `src/commands/__tests__/apply.test.ts` has 6+ new remote apply tests
- [x] `AGENTS.md` documents remote apply feature
- [x] `README.md` documents remote apply usage for end users
- [x] All existing tests still pass (0 regressions)
- [x] No new npm dependencies added
- [x] `src/core/preset-loader.ts` NOT modified
- [x] `src/core/workspace.ts` NOT modified
- [x] `src/core/merge.ts` NOT modified
- [x] Cache directory uses `owner--repo` naming convention
- [x] Path traversal attacks rejected by `parseGitHubRef`
- [x] `.git` directory removed from cached presets