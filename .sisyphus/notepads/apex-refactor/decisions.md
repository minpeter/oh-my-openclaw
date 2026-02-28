# Decisions — apex-refactor

## --clean + --no-backup combination
Decision: ALLOW (do not force backup), but print a warning message.
Rationale: Standard CLI behavior — user explicitly chose --no-backup.

## --clean deletion scope
Decision: Only delete files listed in WORKSPACE_FILES constant (7 MD files).
Do NOT rm -rf the workspace directory or delete arbitrary files.
Rationale: Safest option, stays in sync with WORKSPACE_FILES constant.

## install command location
Decision: Inline in src/cli.ts, after the diff command block.
Do NOT create a separate install.ts command file.
Rationale: The plan explicitly states this; install is a one-liner alias.

## clean logic placement
Decision: Inline in src/commands/apply.ts, NOT extracted to a module.
Rationale: Plan explicitly states "Do NOT extract clean logic into a separate module".

## README.md update scope
Decision: Targeted updates only (preset names, add install section, add --clean docs).
Do NOT rewrite sections unrelated to presets.
