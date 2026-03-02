# CORE KNOWLEDGE BASE

Use root `AGENTS.md` for repository-level command/release policy.

## OVERVIEW

`src/core` defines cross-command contracts: merge semantics, schema migration, path resolution, backup, sensitive filtering, preset I/O, remote cache, workspace copy, and skill install.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Change merge semantics | `src/core/merge.ts` | `null` tombstone delete, arrays replace |
| Change legacy normalization | `src/core/legacy-migration.ts` | Post-merge schema migration for old keys |
| Add/remove sensitive keys | `src/core/constants.ts`, `src/core/sensitive-filter.ts` | Pattern matching with wildcard support |
| Change state/config path behavior | `src/core/config-path.ts` | Env-first precedence + legacy directory migration |
| Change backup mechanics | `src/core/backup.ts` | Timestamped backup creation/restore |
| Change preset I/O contract | `src/core/preset-loader.ts`, `src/core/json5-utils.ts` | `preset.json5` validation and read/write behavior |
| Change remote preset resolution | `src/core/remote.ts` | GitHub ref parse + local cache clone rules |
| Change workspace file policy | `src/core/workspace.ts`, `src/core/constants.ts` | `WORKSPACE_FILES` allowlist and workspace path resolution |
| Change skill install policy | `src/core/skills.ts`, `src/core/constants.ts` | Skill directory validation + overwrite behavior |
| Change shared type contracts | `src/core/types.ts` | Cross-module interface compatibility |

## MODULE CONTRACTS

- `merge.ts`: pure, non-mutating merge; no I/O side effects.
- `legacy-migration.ts`: migrate legacy merged config into current schema before final write.
- `config-path.ts`: single source for `configPath/stateDir/presetsDir/backupsDir` (workspace runtime resolution is handled in `workspace.ts`).
- `preset-loader.ts`: strict required fields (`name`, `description`, `version`) and user-overrides-built-in list behavior.
- `remote.ts`: only public GitHub clone path; cache key format `owner--repo`.
- `workspace.ts`: workspace path is derived from current config when available, then falls back to state dir.
- `skills.ts`: preset skills are copied directory-wise to `~/.agents/skills`; invalid names/path traversal blocked.

## CONVENTIONS (LOCAL)

- Handle known FS failures explicitly (`ENOENT` etc.); rethrow unknown failures.
- Keep command/business orchestration out of core; core should expose reusable primitives.
- Keep merge/filter utilities pure and deterministic.
- Return typed contracts for helpers used across command boundaries.

## ANTI-PATTERNS

- Do not change `deepMerge` semantics without updating `src/core/__tests__/merge.test.ts`.
- Do not bypass `migrateLegacyKeys` after merge when writing final config.
- Do not bypass `filterSensitiveFields` in export/diff-related flows.
- Do not alter env-first path precedence (`OPENCLAW_CONFIG_PATH`, `OPENCLAW_STATE_DIR`) casually.
- Do not swallow remote clone errors; preserve explicit, actionable user-facing failures.
- Do not weaken skill path/name validation; traversal and invalid names must remain blocked.

## TEST CHECKLIST

- Run `bun test src/core/__tests__` after core changes.
- Run `bun run check:types` when changing shared types/contracts.
- For `remote.ts` changes, run `bun test src/core/__tests__/remote.test.ts`.
- For `skills.ts` changes, run `bun test src/core/__tests__/skills.test.ts`.
- For `config-path.ts` changes, run `bun test src/core/__tests__/config-path.test.ts`.
