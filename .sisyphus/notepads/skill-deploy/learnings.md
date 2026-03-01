## [2026-03-01] Session start: skill-deploy

### Baseline
- Tests: 135 pass, 0 fail (16 files)
- Worktree: /Users/minpeter/github.com/minpeter/oh-my-openclaw-skill-deploy
- Branch: skill-deploy (from main @ 1097566)

### Conventions (from codebase)
- Runtime: Bun only. `node:` prefix for built-ins.
- Style: single quotes, semicolons, 2-space indent
- TypeScript: strict: true, moduleResolution: bundler
- No npm dependencies to be added
- picocolors for colors in commands/, NOT in core/
- core/ modules: no picocolors, plain console.log

### Key paths
- User skills target: ~/.agents/skills/<name>/
- Preset skills source: <preset-dir>/skills/<name>/
- Apex preset dir (worktree): src/presets/apex/
- WORKSPACE_FILES constant in src/core/constants.ts

### Skill structure (confirmed from ~/.agents/skills/)
- Each skill: directory with SKILL.md + optional subdirs
- SKILL.md frontmatter: name, description, optional metadata
- User skills have only SKILL.md (no scripts/ in ralph-tui-*)
- Bundled skills (openclaw) have SKILL.md + scripts/

### apply.ts flow (lines)
- 35: applyCommand(presetName, options)
- 36: resolveOpenClawPaths()
- 41-62: preset resolution (remote → user → builtin)
- 64-70: read current config
- 74-104: --clean handling
- 107-110: config merge
- 112-126: dry-run output
- 128-145: backup
- 147-155: write config
- 157-160: copy workspace files
- 162-163: success log
- Skills deploy: INSERT AFTER LINE 160

### [2026-03-01] Task-1 skills module implementation
- Added `src/core/skills.ts` with `copySkills(presetDir, skills, options?)` and `promptOverwrite(skillName)`.
- `copySkills` uses `fs.cp(src, dest, { recursive: true })` to copy full skill directories including nested assets.
- Existing target handling: non-TTY skips with fixed warning, `force` overwrites without prompt, TTY asks via `readline`.
- `dryRun` logs `Would install skill: <name>` and performs no filesystem writes.
- Missing source skill directory throws exact error: `Skill '<name>' not found in preset at <srcDir>`.
- Guarded empty `skills` input to avoid creating `~/.agents/skills/` when nothing is requested.
- QA evidence saved: `.sisyphus/evidence/task-1-copy-skills.txt`, `.sisyphus/evidence/task-1-skip-existing.txt`.

### [2026-03-01] Task-2 preset manifest and apex metadata
- `PresetManifest` now includes optional `skills?: string[]` directly after `workspaceFiles?: string[]` in `src/core/types.ts`.
- Built-in apex preset manifest (`src/presets/apex/preset.json5`) now declares `skills: ['prompt-guard']` after `workspaceFiles`.
- Typecheck evidence path for this task: `.sisyphus/evidence/task-2-type-check.txt`.
