# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-02
**Commit:** 60ba0e3
**Branch:** fix/silent-restart-notify

## OVERVIEW

Bun + TypeScript CLI for OpenClaw preset lifecycle management: list, apply/install, diff, export, restore, upload. Runtime entry is `src/cli.ts` via launcher `bin/apex.js`; optional compiled artifact is `dist/apex` from `bun run build:compile`.

## STRUCTURE

```
apex/
├── AGENTS.md                    # root map + cross-module invariants
├── bin/apex.js                  # launcher; imports src/cli.ts
├── src/
│   ├── cli.ts                   # Commander wiring for all commands
│   ├── commands/
│   │   ├── AGENTS.md            # command orchestration contracts
│   │   └── __tests__/           # command-layer tests
│   ├── core/
│   │   ├── AGENTS.md            # core module contracts and invariants
│   │   └── __tests__/           # core unit tests
│   └── presets/
│       ├── AGENTS.md            # preset authoring + loading rules
│       ├── index.ts             # built-in preset registry/cache
│       └── apex/                # built-in preset payload content
└── .github/workflows/           # CI and release workflows
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Wire CLI flags/commands | `src/cli.ts` | `install` is an alias path to `applyCommand('apex')` |
| Change apply/install behavior | `src/commands/apply.ts` | Preset resolution, clean/backup, merge, workspace + skills copy |
| Change restore behavior | `src/commands/restore.ts` | Backup listing + restore latest/by-name |
| Change upload behavior | `src/commands/upload.ts` | `gh` auth/repo checks, staging preset, git push |
| Change diff behavior | `src/commands/diff.ts` | Structural config diff + workspace add/replace reporting |
| Change export behavior | `src/commands/export.ts` | Sensitive-field filtering + preset manifest write |
| Change list behavior | `src/commands/list.ts` | Built-in + user preset listing (`--json` support) |
| Change merge semantics | `src/core/merge.ts` | `null` deletes keys; arrays replace |
| Change legacy key migration | `src/core/legacy-migration.ts` | Post-merge schema normalization |
| Change path/state layout | `src/core/config-path.ts` | `OPENCLAW_CONFIG_PATH` > `OPENCLAW_STATE_DIR` > default |
| Change remote preset handling | `src/core/remote.ts` | GitHub ref parse + cache clone (`owner--repo`) |
| Change preset loader contract | `src/core/preset-loader.ts`, `src/presets/index.ts` | Required manifest fields + built-in cache |
| Change workspace/skill policy | `src/core/workspace.ts`, `src/core/skills.ts`, `src/core/constants.ts` | `WORKSPACE_FILES` allowlist + skills install rules |
| Change CI/release gates | `.github/workflows/code-quality.yml`, `.github/workflows/release.yml` | PR checks vs main-branch release flow |

## CODE MAP

| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|
| `applyCommand` | Function | `src/commands/apply.ts` | high | Primary orchestration hub |
| `diffCommand` | Function | `src/commands/diff.ts` | high | Config/workspace structural comparison |
| `exportCommand` | Function | `src/commands/export.ts` | high | Safe preset creation from current state |
| `uploadCommand` | Function | `src/commands/upload.ts` | medium | Preset upload pipeline via `gh` + git |
| `restoreCommand` | Function | `src/commands/restore.ts` | medium | Backup discovery and restore entry |
| `deepMerge` | Function | `src/core/merge.ts` | high | Config merge semantics source of truth |
| `migrateLegacyKeys` | Function | `src/core/legacy-migration.ts` | medium | Legacy-to-current key translation |
| `resolveOpenClawPaths` | Function | `src/core/config-path.ts` | high | State/config path resolution + migration |
| `loadPreset` | Function | `src/core/preset-loader.ts` | high | Manifest validation and load contract |
| `getBuiltinPresets` | Function | `src/presets/index.ts` | medium | Built-in preset registry/cache |

## CONVENTIONS

- Bun-first tooling: run with `bun` (`bun test`, `bun run build`, `bun run build:compile`).
- Biome config extends `ultracite/biome/core`; single quotes enforced; `.sisyphus/**/*` lint/format disabled.
- TypeScript is strict with Bun runtime assumptions (`moduleResolution: bundler`, `types: ["bun-types"]`).
- Imports: Node built-ins use `node:`; internal modules use relative imports (no aliases).
- JSON5 is used for preset/config snapshots (`readJson5`/`writeJson5`); apply writes normalized JSON content.
- FS error policy: handle known codes (`ENOENT`) explicitly, rethrow unknown errors.

## ANTI-PATTERNS

- Assuming JSON5 comments survive apply; rewrite drops comments.
- Treating `null` as a scalar value; here it is a delete tombstone.
- Expecting array merge/append semantics; arrays are full replacement.
- Bypassing sensitive-field filtering in export/diff flows.
- Describing `diff` output as an exact `apply` preview.
- Using `--clean` with `--no-backup` casually on active environments.
- Treating `src/presets/apex/AGENTS.md` as repository policy (it is preset payload content).

## UNIQUE STYLES

- `install` is intentionally implemented as `apply apex` in CLI wiring.
- `--dry-run` avoids final writes but can still resolve remote presets/cache.
- Launcher executes source (`bin/apex.js` -> `src/cli.ts`); compiled binary is a separate path.
- Release workflow runs on `push` to `main`; code-quality runs on both `pull_request` and `push` to `main`.

## COMMANDS

```bash
bun install
bun run check
bun run check:biome
bun run check:types
bun test
bun test src/commands/__tests__
bun test src/core/__tests__
bun run build
bun run build:compile
bun run clean
```

## NOTES

- Preset resolution order: GitHub ref (`owner/repo` or URL; cached as `owner--repo`) -> user preset directory lookup by name -> built-in presets; user preset with same name wins.
- Legacy state directory `~/.openclaw/oh-my-openclaw/` auto-migrates to `~/.openclaw/apex/`.
- Apply/restore flows end with an operational reminder: run `openclaw gateway restart`.
- `upload` shells out to `gh` and `git`; non-authenticated `gh` sessions fail fast with actionable errors.
