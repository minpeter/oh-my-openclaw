# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-01
**Commit:** de90b7a
**Branch:** main

## OVERVIEW

Bun + TypeScript CLI for applying/exporting OpenClaw preset bundles. Runtime entry is `src/cli.ts` via Bun launcher (`bin/oh-my-openclaw.js`); compiled binary (`dist/oh-my-openclaw`) is the distribution path.

## STRUCTURE

```
oh-my-openclaw/
├── AGENTS.md                  # root policy + cross-module map
├── bin/oh-my-openclaw.js      # Bun launcher; imports src/cli.ts directly
├── src/
│   ├── cli.ts                 # Commander wiring for list/apply/export/diff/install
│   ├── commands/              # user-facing command flows
│   │   ├── AGENTS.md          # command-layer invariants and change checklist
│   │   └── __tests__/         # command-level tests
│   ├── core/                  # shared logic (merge, backup, path, filtering, remote)
│   │   ├── AGENTS.md          # core invariants and module contracts
│   │   └── __tests__/         # unit tests for each core module
│   └── presets/
│       ├── index.ts           # built-in preset loading
│       └── apex/              # built-in preset payload (not project policy docs)
├── .github/workflows/         # code-quality CI
└── dist/                      # build artifacts (gitignored)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add/modify CLI behavior | `src/cli.ts`, `src/commands/` | `install` is wired directly to `applyCommand('apex')` in `src/cli.ts` |
| Change apply flow | `src/commands/apply.ts` | Preset resolution, backup/clean, merge, workspace/skills copy |
| Change diff behavior | `src/commands/diff.ts` | Structural diff + workspace file add/replace reporting |
| Change export behavior | `src/commands/export.ts` | Sensitive-field filtering + preset manifest write |
| Change merge semantics | `src/core/merge.ts` | `null` deletes keys; arrays replace |
| Change remote preset handling | `src/core/remote.ts` | GitHub ref parse + cache clone (`owner--repo`) |
| Change config path resolution | `src/core/config-path.ts` | `OPENCLAW_CONFIG_PATH` > `OPENCLAW_STATE_DIR` > default |
| Change workspace file policy | `src/core/constants.ts`, `src/core/workspace.ts` | Controlled by `WORKSPACE_FILES` and resolved workspace path |
| Change preset loading/saving | `src/core/preset-loader.ts`, `src/presets/index.ts` | User presets override built-ins by name |

## CONVENTIONS

- Runtime/tooling: Bun-only execution (`bun test`, `bun build`, `bun build --compile`).
- Lint/format: Biome (`ultracite/biome/core`); single quotes enforced.
- Type checking: strict TS (`strict: true`, `moduleResolution: bundler`, `types: ["bun-types"]`).
- Imports: built-ins use `node:` prefix; relative internal imports (no path aliases).
- Config format: JSON5 for read/write snapshots (`readJson5`, `writeJson5`).
- Error handling: expected fs errors are handled explicitly (e.g., `ENOENT`), unknowns re-thrown.

## DEEP MERGE SEMANTICS (CRITICAL)

| Override Value | Behavior |
|---|---|
| Object | Recursive merge |
| Array | Full replacement (no append) |
| Scalar | Overwrite |
| `null` | Delete key |
| `undefined` | No-op (keep base value) |

Implementation source: `src/core/merge.ts`.

## PRESET RESOLUTION ORDER

0. GitHub ref (`owner/repo` or URL) -> clone/cache as user preset (`owner--repo`)
1. User preset: `~/.openclaw/oh-my-openclaw/presets/<name>/`
2. Built-in preset: `src/presets/<name>/`
3. User preset with same name overrides built-in

## MODEL ROUTING

The apex preset includes a `config.routing` key that enables task-type based model selection. When applied, OpenClaw uses this to route requests to different models depending on the task context.

### Routing Schema

```json5
{
  routing: {
    defaultModel: 'provider/model-name',  // fallback for unmatched tasks
    rules: [
      {
        name: 'rule-name',
        description: 'Human-readable purpose',
        triggers: ['trigger-1', 'trigger-2'],  // task-type keywords
        model: 'provider/model-name',
      },
    ],
  },
}
```

### Apex Defaults

| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Coding (`tmux-opencode`, `code`, `development`, `debugging`, `refactoring`, `architecture`, `code-review`) | `anthropic/claude-opus-4-6` | Strongest reasoning for complex code tasks |
| Everything else (conversation, simple queries) | `anthropic/claude-sonnet-4-6` | Faster, cost-efficient for routine interactions |

### How It Works

- Routing config lives in `config.routing` within `preset.json5` and merges into `openclaw.json` via `deepMerge`.
- `defaultModel` is the fallback when no rule triggers match the current task type.
- Each rule has a `triggers` array of keyword strings. If the task type matches any trigger, that rule's `model` is used.
- Rules are evaluated in order; first match wins.
- The `rules` array replaces entirely on merge (standard array merge semantics — no append).
- To disable routing, set `routing: null` in a user preset override (delete semantics).

## ANTI-PATTERNS

- Assuming JSON5 comments survive apply; they are dropped when config is rewritten.
- Treating `null` like a regular scalar in preset config; it is delete semantics.
- Expecting array append/merge behavior in preset config; arrays replace entirely.
- Using `--clean` + `--no-backup` casually; this can remove current config/workspace with no backup.

## TEST PATTERNS

- Runner: `bun test`.
- Layout: `src/core/__tests__`, `src/commands/__tests__`, plus `src/__tests__/integration.test.ts`.
- Naming: `*.test.ts` only.
- Isolation: temp dirs + env override/reset per test file.
- Output assertions: CLI tests monkey-patch `console.log` and restore in cleanup.

## COMMANDS

```bash
bun install
bun run check
bun run check:biome
bun run check:types
bun test
bun run build
bun run build:compile
bun run clean
```

## NOTES

- `src/presets/apex/AGENTS.md` is preset payload content, not repository policy guidance.
- `bin/oh-my-openclaw.js` runs source (`src/cli.ts`) directly; Bun runtime is required for launcher path.
- CI exists at `.github/workflows/code-quality.yml` and runs typecheck/lint/test/build.
- `build:compile` output (`dist/oh-my-openclaw`) is the intended standalone executable.
- `diff` is a structural comparison against raw preset config; `apply` filters sensitive paths before merge, so outputs are not strict apply previews.
- Apply flow ends with a manual operational step: run `openclaw gateway restart`.
- Project policy allows aggressive cleanup/migrations for this local-only environment.
