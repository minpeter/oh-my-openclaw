#!/bin/bash
set -euo pipefail

STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
CONFIG_FILE="${OPENCLAW_CONFIG_PATH:-$STATE_DIR/openclaw.json}"
MARKER="$STATE_DIR/.docker-initialized"

log() { echo "==> $1"; }
info() { echo "    $1"; }

# ────────────────────────────────────────────
# 1. Apply apex preset (first run or forced)
# ────────────────────────────────────────────
if [ ! -f "$MARKER" ] || [ "${FORCE_SETUP:-}" = "true" ]; then
  log "Applying apex preset..."
  oh-my-openclaw apply apex --no-backup

  touch "$MARKER"
else
  log "Preset already applied (set FORCE_SETUP=true to re-apply)"
fi

# Ensure config file exists
if [ ! -f "$CONFIG_FILE" ]; then
  mkdir -p "$(dirname "$CONFIG_FILE")"
  echo '{}' > "$CONFIG_FILE"
fi

# ────────────────────────────────────────────
# 2. Full config injection (single jq pass)
#    - gateway, provider, telegram, cleanup
#    - removes legacy keys doctor would strip
#    - pre-sets controlUi origins
# ────────────────────────────────────────────
BIND="${OPENCLAW_GATEWAY_BIND:-loopback}"
PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
BASE_URL="${OPENAI_BASE_URL:-https://api.openai.com/v1}"
MODEL="${MODEL_NAME:-openai/gpt-5.4}"

# Generate gateway auth token if not provided
GW_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-$(openssl rand -hex 24)}"

log "Configuring OpenClaw..."

tmp=$(mktemp)
jq \
  --arg bind "$BIND" \
  --argjson port "$PORT" \
  --arg api_key "${OPENAI_API_KEY:-}" \
  --arg base_url "$BASE_URL" \
  --arg model "$MODEL" \
  --arg tg_token "${TELEGRAM_BOT_TOKEN:-}" \
  --arg gw_token "$GW_TOKEN" \
  '
  # ── Gateway ──
  .gateway = (.gateway // {}) |
  .gateway.mode = "local" |
  .gateway.bind = $bind |
  .gateway.port = $port |
  .gateway.controlUi = (.gateway.controlUi // {}) |
  .gateway.controlUi.allowedOrigins = [
    "http://localhost:\($port)",
    "http://127.0.0.1:\($port)"
  ] |

  # ── Gateway auth (pre-set so doctor does not auto-generate) ──
  .gateway.auth = (.gateway.auth // {}) |
  .gateway.auth.mode = "token" |
  .gateway.auth.token = $gw_token |

  # ── Remove legacy keys (doctor would strip these) ──
  if .agents.defaults then .agents.defaults |= del(.tools) else . end |
  del(.routing) |

  # ── AI provider (if key given) ──
  if $api_key != "" then
    .models = (.models // {}) |
    .models.providers = (.models.providers // {}) |
    .models.providers.openai = (.models.providers.openai // {}) |
    .models.providers.openai.apiKey = $api_key |
    .models.providers.openai.baseUrl = $base_url |
    .models.providers.openai.models = [{ id: ($model | split("/") | last), name: ($model | split("/") | last), api: "openai-completions" }] |
    .agents = (.agents // {}) |
    .agents.defaults = (.agents.defaults // {}) |
    .agents.defaults.model = (.agents.defaults.model // {}) |
    .agents.defaults.model.primary = $model
  else . end |

  # ── Telegram (if token given) ──
  if $tg_token != "" then
    .plugins = (.plugins // {}) |
    .plugins.entries = (.plugins.entries // {}) |
    .plugins.entries.telegram = { enabled: true } |
    .channels = (.channels // {}) |
    .channels.telegram = (.channels.telegram // {}) |
    .channels.telegram.botToken = $tg_token |
    .channels.telegram.groupPolicy = "open" |
    .channels.telegram.enabled = true |
    .channels.telegram.streaming = "partial"
  else . end |

  # ── Disable Discord (prevent doctor auto-enable) ──
  .channels = (.channels // {}) |
  if .channels.discord then
    .channels.discord.enabled = false
  else . end
  ' "$CONFIG_FILE" > "$tmp" && mv "$tmp" "$CONFIG_FILE"

info "gateway: bind=$BIND port=$PORT"
[ -n "${OPENAI_API_KEY:-}" ] && info "provider: openai base=$BASE_URL model=$MODEL"
[ -n "${TELEGRAM_BOT_TOKEN:-}" ] && info "telegram: enabled"

# ────────────────────────────────────────────
# 3. Pre-create directories & fix permissions
#    (what doctor would do)
# ────────────────────────────────────────────
log "Setting up state directories..."
mkdir -p "$STATE_DIR/agents/main/sessions"
mkdir -p "$STATE_DIR/credentials"
mkdir -p "$STATE_DIR/canvas"
chmod 700 "$STATE_DIR"
chmod 600 "$CONFIG_FILE"

# ────────────────────────────────────────────
# 4. Doctor (should be clean now)
# ────────────────────────────────────────────
log "Running doctor check..."
openclaw doctor --fix --yes 2>/dev/null || true

# ────────────────────────────────────────────
# 5. Start gateway
# ────────────────────────────────────────────
log "Starting OpenClaw gateway..."
exec openclaw gateway run --force
