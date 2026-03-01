# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-01
**Commit:** f504c1d
**Branch:** main

## OVERVIEW

CLI tool for managing [OpenClaw](https://github.com/minpeter/openclaw) configuration presets. Bun + TypeScript + Commander.js. Provides 5 subcommands (`list`, `apply`, `export`, `diff`, `install`) to merge JSON5 config overrides and copy workspace markdown files (AGENTS.md, SOUL.md, etc.).

## STRUCTURE

```
oh-my-openclaw/
├── bin/oh-my-openclaw.js   # Bun shebang launcher (imports src/cli.ts directly)
├── src/
│   ├── cli.ts              # CLI entry — Commander program + 5 subcommands
│   ├── commands/            # list, apply, export, diff, install implementations
│   │   └── __tests__/       # Command-level tests
│   ├── core/                # Shared logic (merge, backup, filter, config resolution)
│   │   ├── remote.ts         # GitHub URL parsing, clone, and cache logic
│   │   └── __tests__/       # Unit tests per core module
│   └── presets/             # Built-in preset templates
│       ├── index.ts         # Loads + caches built-in presets
│       └── apex/            # preset.json5 + workspace markdown files
├── dist/                    # Build output (gitignored)
└── .sisyphus/               # Build orchestration artifacts (internal)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add/modify CLI commands | `src/commands/` | Each file exports one async command function |
| Change merge behavior | `src/core/merge.ts` | Deep merge with null-delete semantics |
| Modify sensitive field filtering | `src/core/sensitive-filter.ts` | Glob-pattern matching on key paths |
| Change config path resolution | `src/core/config-path.ts` | Env var overrides: `OPENCLAW_CONFIG_PATH` > `OPENCLAW_STATE_DIR` > `~/.openclaw/` |
| Apply remote GitHub presets | `src/core/remote.ts` | `isGitHubRef()`, `parseGitHubRef()`, `cloneToCache()` |
| Add workspace file types | `src/core/constants.ts` | `WORKSPACE_FILES` array |
| Add built-in presets | `src/presets/` | Built-in is apex-only; use user presets (`~/.openclaw/oh-my-openclaw/presets/<name>/`) for sharing custom variants |
| Understand backup flow | `src/core/backup.ts` | Timestamped copies to `~/.openclaw/oh-my-openclaw/backups/` |
| Read/write JSON5 configs | `src/core/json5-utils.ts` | Wraps `json5` package with `ConfigSnapshot` type |

## CONVENTIONS

- **Runtime**: Bun only. `#!/usr/bin/env bun` shebang. Types via `bun-types`.
- **Imports**: `node:` prefix for built-ins (`node:path`, `node:fs/promises`). Relative paths only — no aliases, no `baseUrl`.
- **Import order**: Built-in > external (`commander`, `picocolors`, `json5`) > internal. Not enforced by linter.
- **Style**: Single quotes, semicolons, 2-space indent. No formatter configured — follow existing files.
- **TypeScript**: `strict: true`, `target: ES2022`, `moduleResolution: bundler`.
- **Config format**: JSON5 everywhere (not plain JSON). Use `readJson5`/`writeJson5` from `json5-utils.ts`.
- **Error handling**: Empty `catch {}` blocks are intentional for optional file operations (preset scanning, backup listing). Named catches (`catch (err)`) re-throw selectively.
- **Console output**: `picocolors` for colored terminal output. `pc.bold()`, `pc.green()`, `pc.yellow()`, `pc.dim()`, `pc.red()`.

## DEEP MERGE SEMANTICS (CRITICAL)

The merge strategy in `src/core/merge.ts` has specific rules:

| Override Value | Behavior |
|---------------|----------|
| **Object** | Recursive deep merge with base |
| **Array** | Entirely replaces base array (NO append) |
| **Scalar** | Overwrites base value |
| **`null`** | **Deletes** the key from base |
| **`undefined`** | Preserves base value (no-op) |

Inputs are never mutated — always returns new object.

## PRESET RESOLUTION ORDER

0. Remote GitHub presets: if input matches `owner/repo` or GitHub URL → `isGitHubRef()` → clone → cache as user preset
1. User presets: `~/.openclaw/oh-my-openclaw/presets/<name>/`
2. Built-in presets: `src/presets/<name>/`
3. User presets with same name **override** built-ins.
4. Sensitive fields (`auth`, `env`, `meta`, `*.apiKey`, `*.botToken`, etc.) are **stripped** on export/diff.

## APEX-ONLY PHILOSOPHY

This repo manages exactly **ONE** built-in preset: **apex**.

- Apex includes 100% of all capabilities (identity, tools, models, workspace files)
- Other presets can be shared as user presets (e.g., `minpeter/demo-assistant`)
- User presets go to `~/.openclaw/oh-my-openclaw/presets/<name>/`
- Use `oh-my-openclaw install` to apply apex in one command
- Remote presets can be applied directly from GitHub: `oh-my-openclaw apply owner/repo` or `oh-my-openclaw apply https://github.com/owner/repo`. They are cached as user presets at `~/.openclaw/oh-my-openclaw/presets/owner--repo/`. Use `--force` to re-download.

## ANTI-PATTERNS

- **Known MVP limitation**: Applying a preset to a JSON5 config **loses all comments**. Warning is printed at apply time.
- No other explicit anti-pattern markers found in codebase.

## TEST PATTERNS

- **Runner**: `bun test` (Bun's built-in test runner). No Jest/Vitest.
- **Location**: Co-located `__tests__/` dirs next to source. Plus `src/__tests__/` for integration tests.
- **Naming**: `<module>.test.ts` (never `.spec.ts`).
- **Structure**: `describe('<module>')` + sentence-form `test('...')`.
- **Fixtures**: No shared fixture dirs. Each test file creates temp dirs via `mkdtemp()` and cleans up in `afterEach`.
- **Isolation**: Tests override `process.env.OPENCLAW_CONFIG_PATH` to temp paths. Restore original env in `afterEach`.
- **CLI output capture**: Monkey-patch `console.log` to collect output strings, restore in `finally` block.
- **Placeholder**: `src/__tests__/placeholder.test.ts` exists (smoke test, can be removed).

## COMMANDS

```bash
bun install              # Install deps
bun test                 # Run all tests
bun run typecheck        # tsc --noEmit
bun run build            # ESM bundle → dist/cli.js
bun run build:compile    # Native binary → dist/oh-my-openclaw
bun run clean            # rm -rf dist
```

## NOTES

- `src/presets/*/AGENTS.md` and `SOUL.md` are **preset content files** (agent personas copied to user workspace). They are NOT project documentation.
- `bin/oh-my-openclaw.js` imports `src/cli.ts` directly — requires Bun runtime, does not use `dist/`.
- `package.json` has no `bin`/`main`/`exports` fields. CLI distribution is via compiled binary only.
- No CI/CD pipeline (no `.github/workflows`). Validation was done via `.sisyphus/evidence/` artifacts.
- `build:compile` uses Bun's `--compile --bytecode` for single-file native binary.
- Target filesystem: `~/.openclaw/` (config, workspace, presets, backups). After applying, user must manually run `openclaw gateway restart`.
- Project policy: There are currently no real end users. For this machine-local environment, aggressive migrations and breaking updates are acceptable to eliminate legacy quickly.
