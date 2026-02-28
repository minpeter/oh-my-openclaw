# Apex Preset — Decisions

## [2026-03-01] Session init

### Preset Config Decisions
- Use `tools.allow` with comprehensive list (NOT `tools.profile: 'full'`) for safety
- Full tools list for apex: `['exec', 'process', 'read', 'write', 'edit', 'apply_patch', 'browser', 'web_search', 'web_fetch', 'cron', 'image', 'memory_search', 'memory_get', 'message', 'canvas']`
- Model: `anthropic/claude-sonnet-4-5`

### TOOLS.md Sources
- tmux-opencode: https://gist.github.com/junhoyeo/bf37aef8f41d7b890ebbe2cb93c01595
- prompt-guard SKILL.md: https://raw.githubusercontent.com/seojoonkim/prompt-guard/main/SKILL.md
- MUST include COMPLETE content — no truncation

### Channel/Security Decisions
- Web UI: DISABLED by default
- Channels: Telegram, Discord, Terminal/CLI only
- All external input: MUST be scanned via prompt-guard

### Personality Decisions
- Adaptive personality — learns from user interaction
- Not hardcoded tone — must observe and mirror user style
- Name: Apex, Emoji: ⚡

### Commit Strategy
- Wave 1: No individual commits (group with Task 5)
- Task 5: `feat(presets): add apex all-in-one preset with tmux-opencode and prompt-guard`
- Task 6: `build: rebuild binary with apex preset`
