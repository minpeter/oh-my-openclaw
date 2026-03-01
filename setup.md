# Openclaw Setup Prompt

Set up Openclaw so it is immediately ready to use.

## Step 1 — Gather all required information upfront

Before doing anything else, use the `AskUserQuestion` tool in a **single call** with all questions at once:

- **Messenger** (multi-select): Which messengers do you want to connect?
  - Options: Telegram / Discord / WhatsApp / None
- **Bot tokens**: Paste the bot token(s) for the selected messenger(s).
  If you don't have one yet, type "none" and the setup will guide you.
- **AI provider**: Which AI provider will you use?
  - Options: Anthropic (Claude) / OpenAI / Google Gemini / Free (OpenRouter, Ollama, etc.)
- **API key**: Paste your API key, or type `env` if it is already set as an environment variable.

Do not proceed to Step 2 until the user has answered all four questions.

### If the user has no Discord token
Guide them step by step and confirm each step before proceeding:
1. Open discord.com/developers/applications → click **New Application** → enter a name → Create
2. Left menu → **Bot** → click **Reset Token** → copy the token
3. On the same Bot page, scroll down → enable **Message Content Intent**
4. Left menu → **OAuth2 → URL Generator** → check `bot` scope → check `Send Messages` + `Read Message History` permissions → open the generated URL to invite the bot to your server
Confirm "Have you completed this step?" after each step.

### If the user has no Telegram token
Guide them:
1. Open Telegram → message @BotFather → send `/newbot`
2. Follow the prompts → copy the token (format: `123456:ABC-DEF...`)

---

## Step 2 — Install Openclaw

`openclaw` is published to npm — no git clone or build required:

```bash
npm install -g openclaw
openclaw --help
```

---

## Step 3 — Apply the apex preset

```bash
./dist/oh-my-openclaw install
```

Notes:
- The only built-in preset is `apex`. The `install` subcommand is a shortcut for `apply apex`.
- Legacy config keys (e.g., top-level `identity`) are automatically migrated during apply — no manual `doctor --fix` needed afterward.
- If you see `Legacy key migration: identity → agents.list[].identity` in the output, that is normal and expected.
---

## Step 4 — Register messenger channel(s)

Run `doctor --fix` first if you haven't already, then enable and register each channel.

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

## Step 5 — Configure the AI provider

openclaw reads API keys from standard environment variables automatically — no extra config needed if the key is already set.

If you run OpenClaw via a LaunchAgent/service, shell env vars may not be inherited. Persist the key once in the agent auth store:

```bash
# Example (apex default provider)
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

## Step 6 — Set gateway mode and start

```bash
openclaw config set gateway.mode local
openclaw gateway run --force
```

Use `--force` so that any already-running gateway process is killed and restarted cleanly.

If `openclaw gateway restart` says `Gateway service not loaded`, install and start the service once:

```bash
openclaw gateway install
openclaw gateway start
```

### Node version manager warning

If the gateway service was installed while a Node version manager (nvm, fnm, volta, etc.) was active,
the LaunchAgent plist may point to a version-managed Node binary that can break on upgrades.
Fix this by installing system Node and repairing the service:

```bash
brew install node                          # /opt/homebrew/bin/node
openclaw doctor --repair --force --yes     # rewrites plist to use system Node
```

Wait until you see both channel lines in the log output:
```
[telegram] [default] starting provider (@<botname>)
[discord]  [default] starting provider (@<botname>)
```

Then verify:
```bash
openclaw health
openclaw gateway status   # confirm Node path is /opt/homebrew/bin/node
```

Expected output: both channels show `ok`, and the gateway command shows system Node.

---

## Step 7 — Handle pairing codes automatically

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

## Step 8 — Error recovery

If any command fails:
1. Read the error message carefully.
2. Apply the minimal fix from the table below.
3. Retry the failed command.
4. Tell the user exactly what was changed.

| Error | Fix |
|-------|-----|
| `Unknown channel: telegram` | `openclaw plugins enable telegram` first |
| `Unknown channel: discord` | `openclaw plugins enable discord` first |
| `Preset not found` | Use `./dist/oh-my-openclaw install`, not `apply developer` |
| `Invalid config` / migration warnings | `openclaw doctor --fix` |
| `gateway.mode is unset` | `openclaw config set gateway.mode local` |
| `gateway run` fails (port in use) | `openclaw gateway run --force` |
| `Gateway service not loaded` | `openclaw gateway install` then `openclaw gateway start` |
| `No API key found for provider "anthropic"` | `openclaw models auth paste-token --provider anthropic` then `openclaw gateway restart` |
| `plugins enable` blocked by config errors | Run `openclaw doctor --fix` first, then retry |
| Server/group messages silently ignored | `openclaw config set channels.<name>.groupPolicy open` |
| Node version manager warning in gateway | `brew install node` then `openclaw doctor --repair --force --yes` |
| Bot-to-bot messages not working (Discord) | Ensure `channels.discord.allowBots: true` is in your preset config |

---

## Full recovery pipeline (one-shot)

If the gateway is completely broken or you want to start fresh:

```bash
# 1. Apply apex preset (auto-migrates legacy keys)
./dist/oh-my-openclaw install

# 2. Fix any remaining config issues
openclaw doctor --fix --yes

# 3. Ensure system Node and restart gateway
brew install node
openclaw gateway install --force
openclaw doctor --repair --force --yes

# 4. Wait for gateway to start, then verify
sleep 15
openclaw health
openclaw gateway status
```
