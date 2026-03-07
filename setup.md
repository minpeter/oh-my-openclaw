# Openclaw Setup Prompt

Set up Openclaw so it is immediately ready to use.

## Step 1 — Gather all required information upfront

Before doing anything else, use the `AskUserQuestion` tool to collect all configuration interactively. The user should never have to type free-form prompts for selection-based questions — always present choices as selectable options.

### 1-A. Messenger selection

Use `AskUserQuestion` (multi-select):

> **Which messengers do you want to connect?**
> - Telegram
> - Discord
> - WhatsApp
> - None (skip for now)

### 1-B. Bot token status

For **each** messenger selected above, use `AskUserQuestion` (single-select):

> **Do you already have a bot token for {messenger}?**
> - Yes, I have a token ready
> - No, guide me through creating one

If the user selects "Yes" → ask them to paste the token (this is the only free-text input needed).
If the user selects "No" → proceed to the guided token creation below before asking for the next messenger.

### 1-C. AI provider selection

Use `AskUserQuestion` (single-select):

> **Which AI provider will you use?**
> - Anthropic (Claude)
> - OpenAI
> - Google Gemini
> - Free (OpenRouter, Ollama, etc.)

### 1-D. API key status

Use `AskUserQuestion` (single-select):

> **How is your API key configured?**
> - I'll paste it now
> - It's already set as an environment variable (`env`)

If the user selects "I'll paste it now" → ask them to paste the API key (free-text input).
If the user selects `env` → no further input needed.

Do not proceed to Step 2 until all four sections (1-A through 1-D) are answered.

---

### If the user has no Discord token
Guide them step by step and use `AskUserQuestion` (single-select) to confirm each step:

1. Open discord.com/developers/applications → click **New Application** → enter a name → Create

   > **Have you completed this step?**
   > - Yes, done
   > - I need help

2. Left menu → **Bot** → click **Reset Token** → copy the token

   > **Have you completed this step?**
   > - Yes, I copied the token
   > - I need help

3. On the same Bot page, scroll down → enable **Message Content Intent**

   > **Have you completed this step?**
   > - Yes, enabled
   > - I need help

4. Left menu → **OAuth2 → URL Generator** → check `bot` scope → check `Send Messages` + `Read Message History` permissions → open the generated URL to invite the bot to your server

   > **Have you completed this step?**
   > - Yes, bot is in my server
   > - I need help

After all steps, ask the user to paste the token (free-text input).

### If the user has no Telegram token
Guide them:
1. Open Telegram → message @BotFather → send `/newbot`
2. Follow the prompts → copy the token (format: `123456:ABC-DEF...`)

Use `AskUserQuestion` to confirm:

> **Have you created the bot and copied the token?**
> - Yes, I have the token
> - I need help

Then ask the user to paste the token (free-text input).

---

## Step 2 — Install Openclaw CLI

> **IMPORTANT:** `openclaw` and `oh-my-openclaw` are **separate** packages with different install strategies:
> - `openclaw` — the main CLI. Install **globally**.
> - `oh-my-openclaw` — the preset manager. **Never** install globally. Always run via `bunx oh-my-openclaw@latest` to ensure you get the latest version.

Install the OpenClaw CLI globally:
```bash
npm install -g openclaw
openclaw --version
```

`oh-my-openclaw` does not need installation — it is always executed on-demand via `bunx`:
```bash
bunx oh-my-openclaw@latest --version
```

If `bunx` is not available, install bun first: `curl -fsSL https://bun.sh/install | bash`.

---

## Step 3 — Apply the apex preset

> **IMPORTANT:** The command is `bunx oh-my-openclaw@latest apply apex`, NOT `openclaw presets apply oh-my-openclaw`.
> OpenClaw does **not** have a built-in `presets` subcommand. The preset manager is provided by `oh-my-openclaw` and must be run via `bunx`.

```bash
bunx oh-my-openclaw@latest apply apex
```

- `apex` is the built-in power preset bundled with `oh-my-openclaw`.
- Legacy config keys (e.g., top-level `identity`) are automatically migrated during apply.
- If you see `Legacy key migration: identity → agents.list[].identity` in the output, that is normal and expected.
- `apex` automatically ensures `openclaw-memory-auto-recall` is installed during apply, writes the matching `plugins.entries['memory-auto-recall']` config, and runs `openclaw memory index` for you.
- After apply finishes, restart the gateway once so the freshly installed plugin and indexed memory state are live.

---

## Step 4 — Fix config validation errors

> **IMPORTANT:** The apex preset may write config keys that the current OpenClaw version treats as unknown (e.g., `agents.defaults.tools`, `routing`). These invalid keys will **block** subsequent commands like `openclaw plugins enable`. You **must** run `doctor --fix` before proceeding.

```bash
openclaw doctor --fix --yes
```

This command will:
- Remove unrecognized config keys
- Tighten file/directory permissions (`~/.openclaw` → 700, config → 600)
- Create missing directories (e.g., session store)
- Install the gateway LaunchAgent if not present

Do not skip this step — channel registration will fail without it.

---

## Step 5 — Register messenger channel(s)

Enable and register each channel.

### Telegram
```bash
openclaw plugins enable telegram
openclaw channels add --channel telegram --token "<token>"
openclaw config set channels.telegram.groupPolicy open
```

### Discord
```bash
openclaw plugins enable discord
openclaw channels add --channel discord --token "<token>"
openclaw config set channels.discord.groupPolicy open
```

### WhatsApp
```bash
openclaw channels login --channel whatsapp
# Follow the QR code prompt in the terminal
```

### No messenger
Skip this step. The user can add a channel later with `openclaw channels add`.

---

## Step 6 — Configure the AI provider

OpenClaw reads API keys from standard environment variables automatically — no extra config needed if the key is already set.

If you run OpenClaw via a LaunchAgent/service, shell env vars may not be inherited. Persist the key once in the agent auth store:

```bash
# Example (oh-my-openclaw default provider)
openclaw models auth paste-token --provider anthropic
openclaw gateway restart
```

Use `--provider openai` or `--provider openrouter` when those are your primary providers.

| Provider | Env var read automatically | Default model set by apex preset |
|----------|---------------------------|----------------------------------|
| Anthropic | `ANTHROPIC_API_KEY` | `anthropic/claude-opus-4-6` ✓ |
| OpenAI | `OPENAI_API_KEY` | change with config set below |
| Gemini | `GEMINI_API_KEY` | change with config set below |

If the user said `env` → no action needed.

To switch the default model:
```bash
openclaw config set agents.defaults.model.primary openai/gpt-4o
```

---

## Step 7 — Set gateway mode, fix Node path, and start

### 7-A. Set gateway mode

```bash
openclaw config set gateway.mode local
```

### 7-B. Fix Node version manager path (always do this)

> **IMPORTANT:** If the user has **any** Node version manager installed (nvm, fnm, volta, etc.), the gateway LaunchAgent plist will point to a version-managed Node binary (e.g., `~/.nvm/versions/node/v22.x.x/bin/node`). This **will** break when the managed Node version changes or is removed.
>
> **Always** run the repair step proactively — do not wait for a breakage or treat this as optional. Most developers use a version manager, so this is the common case, not the exception.

```bash
brew install node                          # ensures /opt/homebrew/bin/node exists
openclaw gateway install --force           # (re)install the LaunchAgent
openclaw doctor --repair --force --yes     # rewrites plist to use /opt/homebrew/bin/node
```

### 7-C. Start the gateway and verify

```bash
openclaw gateway run --force
```

Use `--force` so that any already-running gateway process is killed and restarted cleanly.

Wait until you see channel lines in the log output:
```
[telegram] [default] starting provider (@<botname>)
[discord]  [default] starting provider (@<botname>)
```

Then verify:
```bash
openclaw health
openclaw gateway status   # confirm Node path is /opt/homebrew/bin/node
```

Expected output: all channels show `ok`, and `gateway status` shows system Node (`/opt/homebrew/bin/node`).

---

## Step 8 — Handle pairing codes automatically

When the user first messages the bot, they will receive a pairing prompt like:

```
Pairing code: K5MKBJLH
Ask the bot owner to approve with:
  openclaw pairing approve telegram K5MKBJLH
```

**Do not wait for the user to paste this** — approve it immediately as soon as they share it:

```bash
# Telegram
openclaw pairing approve telegram <CODE>

# Discord
openclaw pairing approve discord <CODE>
```

---

## Step 9 — Error recovery

If any command fails:
1. Read the error message carefully.
2. Apply the minimal fix from the table below.
3. Retry the failed command.
4. Tell the user exactly what was changed.

| Error | Fix |
|-------|-----|
| `command not found: openclaw` | `npm install -g openclaw` (separate from `oh-my-openclaw`) |
| `unknown command 'presets'` | Use `bunx oh-my-openclaw@latest apply apex` — OpenClaw has no `presets` subcommand |
| `Unknown channel: telegram` | `openclaw plugins enable telegram` first |
| `Unknown channel: discord` | `openclaw plugins enable discord` first |
| `Invalid config` / `Unrecognized key` | `openclaw doctor --fix --yes` — the apex preset may write keys the CLI doesn't recognize yet |
| `plugins enable` blocked by config errors | Run `openclaw doctor --fix --yes` first, then retry |
| `gateway.mode is unset` | `openclaw config set gateway.mode local` |
| `gateway run` fails (port in use) | `openclaw gateway run --force` |
| `Gateway service not loaded` | `openclaw gateway install` then `openclaw gateway start` |
| `No API key found for provider "anthropic"` | `openclaw models auth paste-token --provider anthropic` then `openclaw gateway restart` |
| Server/group messages silently ignored | `openclaw config set channels.<name>.groupPolicy open` |
| Node version manager warning in gateway | `brew install node` then `openclaw doctor --repair --force --yes` |
| Bot-to-bot messages not working (Discord) | Ensure `channels.discord.allowBots: true` is in your preset config |

---

## Full recovery pipeline (one-shot)

If the gateway is completely broken or you want to start fresh:

```bash
# 1. Ensure openclaw CLI is installed globally
npm install -g openclaw

# 2. Apply apex preset via bunx (auto-migrates legacy keys)
bunx oh-my-openclaw@latest apply apex

# 3. Fix any config validation errors
openclaw doctor --fix --yes

# 4. Ensure system Node and repair gateway service
brew install node
openclaw gateway install --force
openclaw doctor --repair --force --yes

# 5. Start gateway and verify
openclaw gateway run --force
# Wait for channel startup logs, then:
openclaw health
openclaw gateway status
```
