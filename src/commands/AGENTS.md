# COMMANDS KNOWLEDGE BASE

Use root `AGENTS.md` for global repo rules and CI/release policy.

## OVERVIEW

`src/commands` is the orchestration layer for all user-facing flows: `list`, `apply`, `install`, `diff`, `export`, `restore`, `upload`.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Apply/install behavior | `src/commands/apply.ts`, `src/cli.ts` | `install` routes to `applyCommand('apex')` |
| Diff output behavior | `src/commands/diff.ts` | Config diff + workspace add/replace summary |
| Export behavior | `src/commands/export.ts` | Sensitive filter + manifest write + workspace export |
| List behavior | `src/commands/list.ts` | Built-in and user preset listing (`--json` mode) |
| Restore behavior | `src/commands/restore.ts` | List backups or restore latest/by-name |
| Upload behavior | `src/commands/upload.ts` | `gh` checks, optional repo create, staging, git push |

## FLOW INVARIANTS

- `apply`: resolve preset -> load current config/workspace -> backup or clean -> merge + legacy migration -> write config -> copy workspace files -> install skills -> print restart reminder.
- `install`: no independent command module; `src/cli.ts` invokes `applyCommand('apex', options)`.
- `diff`: load preset + current config -> filter sensitive paths -> migrate legacy keys -> compute structural diff -> emit text or JSON.
- `export`: read current config -> filter sensitive fields -> save preset manifest -> copy workspace files -> rewrite manifest with copied file list.
- `restore`: from backups dir, either list available backups or restore latest/specific file, then print restart reminder.
- `upload`: verify `gh` availability/auth -> parse repo ref -> gather filtered config/workspace/skills -> stage preset payload -> initialize git -> push to GitHub.

## CONVENTIONS (LOCAL)

- Keep command files as orchestration only; reusable mechanics belong in `src/core/*`.
- Keep CLI messages actionable and colored with `picocolors` where user-facing.
- Keep `--dry-run`, `--clean`, `--no-backup`, `--force` semantics stable across apply/install paths.
- Preserve `--dry-run` semantics: no final apply writes, but preset resolution/cache/network checks may still run.
- Preserve install/apply parity unless CLI contract changes intentionally.

## ANTI-PATTERNS

- Do not bypass backup flow unless user explicitly passes `--no-backup`.
- Do not apply/export raw config without sensitive-field filtering where required.
- Do not re-implement workspace file allowlist logic in commands; use core constants/helpers.
- Do not present `diff` as an exact `apply` preview.
- Do not remove the post-apply/post-restore restart reminder unless runtime behavior changes.
- Do not force-push from upload path unless `--force` path is explicitly selected.

## TEST CHECKLIST

- Run `bun test src/commands/__tests__` after command-layer changes.
- For `apply.ts` changes, run `bun test src/commands/__tests__/apply.test.ts` and `bun test src/__tests__/integration.test.ts`.
- For `diff.ts`/`export.ts` output changes, verify both text and `--json` assertions.
- For `restore.ts` changes, run `bun test src/commands/__tests__/restore.test.ts`.
- For `upload.ts` changes, run `bun test src/commands/__tests__/upload.test.ts`.
