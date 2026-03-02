# PRESETS KNOWLEDGE BASE

Use root `AGENTS.md` for repository-level rules. This file covers only `src/presets` authoring/loading behavior.

`src/presets/apex/AGENTS.md` is workspace payload content copied at apply-time, not repository contributor policy.

## OVERVIEW

`src/presets` owns built-in preset registration plus preset payload content. It bridges `preset.json5` authoring and `src/core/preset-loader.ts` validation/runtime behavior.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add/remove built-in preset names | `src/presets/index.ts` | Built-ins are explicitly listed and cached |
| Edit apex preset config payload | `src/presets/apex/preset.json5` | Keep keys schema-compatible and merge-safe |
| Edit apex workspace payload files | `src/presets/apex/*.md` | Copied into user workspace on apply |
| Edit apex skills payload | `src/presets/apex/skills/*` | Copied to `~/.agents/skills` on apply |
| Change manifest validation contract | `src/core/preset-loader.ts`, `src/core/types.ts` | Required fields and preset structure rules |
| Change workspace/skill copy policy | `src/core/workspace.ts`, `src/core/skills.ts` | Runtime copy semantics and collision handling |

## PRESET AUTHORING RULES

- Required fields validated by loader are `name`, `description`, `version`; `config` is optional in schema but expected for config-changing presets.
- Merge semantics are defined in `src/core/merge.ts` (`null` deletes keys, arrays fully replace).
- `workspaceFiles` entries are copied by filename from the preset directory.
- `skills` entries map to `skills/<name>/` directories and must ship valid `SKILL.md` content.
- User presets with matching names override built-in presets at list/apply resolution time.

## ANTI-PATTERNS

- Do not treat `src/presets/apex/AGENTS.md` as repository contributor policy; it is preset payload content.
- Do not reintroduce legacy unsupported keys as active config values (`routing`, `agents.defaults.tools` should remain tombstone removal when needed).
- Do not store credentials/secrets in `preset.json5` or workspace payload files.

## TEST CHECKLIST

- Run `bun test src/presets/__tests__` after preset payload/registry changes.
- Run `bun test src/core/__tests__/preset-loader.test.ts` when manifest structure changes.
- Run `bun test src/core/__tests__/merge.test.ts` when merge-facing preset semantics change.
- Run `bun test src/core/__tests__/skills.test.ts` when `skills` payload layout changes.
