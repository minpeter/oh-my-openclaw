# oh-my-openclaw

## 1.1.3

### Patch Changes

- e02885f: Remove proactive wake/back-online acknowledgements after gateway restart in the apex preset. The agent now recovers context silently and waits for explicit user input when no pending work exists.
- e02885f: Improve apex preset compatibility with strict OpenClaw schema validation by removing unsupported `routing` and `agents.defaults.tools` keys during apply. This also hardens deep merge behavior so null tombstones are stripped from newly added nested branches.

## 1.1.2

### Patch Changes

- 66fa226: Fix export command writing preset manifest twice during export
- eac8e88: Run fixNodePathIfNeeded only on macOS to avoid unnecessary path manipulation on other platforms
- 345af8d: Validate owner/repo format before attempting git clone to provide clear error messages

## 1.1.1

### Patch Changes

- 885472c: Add secret value pattern detection to sensitive filter. Detects Discord bot tokens, Slack/OpenAI/Anthropic/Groq/xAI API keys, GitHub PATs, npm tokens, and JWTs by value pattern regardless of field path.

## 1.1.0

### Minor Changes

- ec2aaac: Initial npm release - CLI tool for managing OpenClaw agent presets
