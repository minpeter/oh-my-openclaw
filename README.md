# oh-my-openclaw

OpenClaw configuration preset manager.

## What is this?
oh-my-openclaw is a CLI utility for managing configuration presets for [OpenClaw](https://github.com/minpeter/openclaw), a self-hosted AI agent gateway. It allows you to switch between different agent personalities, toolsets, and model configurations with a single command by bundling `openclaw.json` overrides and workspace markdown files.

## Quick Start

### Installation
Prerequisites: [Bun](https://bun.sh)

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Build the binary:
   ```bash
   bun run build:compile
   ```
4. Add the resulting binary in `dist/oh-my-openclaw` to your PATH or run it directly.

### Basic Workflow
1. **List** available presets: `oh-my-openclaw list`
2. **Diff** a preset against your current config: `oh-my-openclaw diff developer`
3. **Apply** the preset: `oh-my-openclaw apply developer`
4. **Export** your current setup as a new preset: `oh-my-openclaw export my-custom-setup`

## Commands

### list
Lists all built-in and user-defined presets.
```bash
oh-my-openclaw list
```
**Example Output:**
```
Available presets:

  default [builtin]
    Clean default OpenClaw configuration (default, minimal)
    v1.0.0

  developer [builtin]
    Full-stack developer setup with elevated tools and coding-optimized model (coding, developer, elevated)
    v1.0.0
```

### apply
Applies a preset to your OpenClaw configuration. It merges the preset's JSON config into your `openclaw.json` and copies any bundled workspace files (like `AGENTS.md`) to your `.openclaw` directory.
```bash
oh-my-openclaw apply <preset> [options]
```
- **Arguments:** `<preset>` - Name of the preset to apply.
- **Flags:**
  - `--dry-run`: Show what would change without making any modifications.
  - `--no-backup`: Skip creating a backup of your current configuration (default: backups are created).

### export
Saves your current `openclaw.json` and workspace markdown files as a new reusable preset.
```bash
oh-my-openclaw export <name> [options]
```
- **Arguments:** `<name>` - Name for the new preset.
- **Flags:**
  - `--description <desc>`: Add a short description.
  - `--version <ver>`: Specify a version (default: 1.0.0).
  - `--force`: Overwrite an existing preset with the same name.

### diff
Shows a structural comparison between your current configuration and a specific preset.
```bash
oh-my-openclaw diff <preset> [options]
```
- **Flags:**
  - `--json`: Output the diff in JSON format.

## Built-in Presets

| Name | Description | Use Case |
| :--- | :--- | :--- |
| **default** | Clean default OpenClaw configuration | A fresh start with standard settings. |
| **developer** | Full-stack setup with elevated tools | Coding, debugging, and system operations. |
| **researcher** | Research-focused with web search tools | Information gathering and synthesis. |
| **creative** | Image generation and creative models | Brainstorming and artistic exploration. |

## How It Works

### Deep Merge Semantics
When applying a preset, oh-my-openclaw uses a deep merge strategy for `openclaw.json`:
- **Scalars (String, Number, Boolean):** Overwrite existing values.
- **Objects:** Merged recursively.
- **Arrays:** Entirely replaced by the preset's array.
- **Null:** Deletes the key from the target configuration.

### Sensitive Field Protection
To prevent accidental exposure of secrets, certain fields are filtered during exports and diffs. These include:
- `auth`, `env`, `meta`
- `gateway.auth`
- `hooks.token`
- `models.providers.*.apiKey`
- `channels.*.botToken`, `channels.*.token`

### Automatic Backups
Before applying any changes, oh-my-openclaw automatically creates a timestamped backup of your `.openclaw` directory in `~/.openclaw/backups/`.

## Creating Custom Presets
Presets are stored in `~/.openclaw/oh-my-openclaw/`. You can create them manually by making a directory with a `preset.json5` file and any accompanying markdown files (`AGENTS.md`, `SOUL.md`, etc.).

### Preset Format Example (`preset.json5`)
```json5
{
  name: "my-preset",
  description: "My custom configuration",
  version: "1.0.0",
  config: {
    identity: {
      name: "CustomBot",
      emoji: "🤖"
    }
  },
  workspaceFiles: ["AGENTS.md"]
}
```

## Development
- **Prerequisites:** Bun
- **Install dependencies:** `bun install`
- **Run tests:** `bun test`
- **Type check:** `bun run typecheck`
- **Build binary:** `bun run build:compile`

## Architecture
- `src/core/`: Core logic including merge strategy, backup system, and sensitive field filtering.
- `src/commands/`: CLI command implementations (`list`, `apply`, `export`, `diff`).
- `src/presets/`: Built-in preset templates and manifests.

## License
MIT
