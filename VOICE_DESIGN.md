# Discord Voice Channel Support — Design Document

**Project:** OpenClaw  
**Date:** 2026-03-01  
**Status:** Research Complete  

---

## 1. Executive Summary

This document describes the architecture for Discord voice channel support in OpenClaw. The investigation reveals that **OpenClaw already ships a production-quality voice implementation** in its main repository (`openclaw/openclaw`). This document maps the existing architecture, analyzes the technology choices, and proposes preset configuration patterns for `oh-my-openclaw` to enable voice support through the apex preset.

### Key Findings

- OpenClaw uses **`@buape/carbon`** as its Discord framework (not raw `discord.js`)
- Voice is implemented via **`@discordjs/voice`** in `src/discord/voice/manager.ts`
- STT uses OpenClaw's **media understanding pipeline** (provider-agnostic transcription)
- TTS supports three providers: **OpenAI TTS**, **ElevenLabs**, and **Edge TTS** (free)
- oh-my-openclaw (this repository) manages voice configuration through preset `channels.discord.voice` settings

---

## 2. Architecture Overview

### 2.1 System Context

```
┌──────────────────────────────────────────────────────────────────┐
│                        oh-my-openclaw                            │
│                   (this repository — CLI)                        │
│                                                                  │
│  Manages presets that configure voice settings in openclaw.json  │
│  e.g. channels.discord.voice.enabled = true                     │
│       channels.discord.voice.autoJoin = [{guildId, channelId}]  │
│       channels.discord.voice.tts = { provider: "openai", ... }  │
└──────────────────────┬───────────────────────────────────────────┘
                       │ apply preset
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway                             │
│                (openclaw/openclaw — runtime)                     │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  Discord     │  │  Voice       │  │  Agent Runtime         │  │
│  │  Channel     │──│  Manager     │──│  (agentCommand)        │  │
│  │  (@buape/    │  │  (@discordjs/│  │                        │  │
│  │   carbon)    │  │   voice)     │  │  Routes messages to    │  │
│  └─────────────┘  └──────┬───────┘  │  configured AI agent   │  │
│                          │          └────────────────────────┘  │
│                   ┌──────┴───────┐                               │
│                   │              │                                │
│              ┌────▼────┐  ┌─────▼─────┐                         │
│              │  STT    │  │  TTS      │                         │
│              │  Pipeline│  │  Pipeline │                         │
│              │  (media  │  │  (openai/ │                         │
│              │  under-  │  │  eleven/  │                         │
│              │  standing)│  │  edge)   │                         │
│              └─────────┘  └──────────┘                          │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Voice Processing Pipeline

```
┌─────────────────── INBOUND (Listening) ──────────────────────┐
│                                                               │
│  Discord Voice Channel                                        │
│       │                                                       │
│       ▼                                                       │
│  VoiceConnection.receiver.subscribe(userId)                   │
│  [Opus packets, EndBehaviorType.AfterSilence @ 1000ms]       │
│       │                                                       │
│       ▼                                                       │
│  Opus Decoder (@discordjs/opus or opusscript fallback)        │
│  [48kHz, 16-bit, stereo PCM]                                 │
│       │                                                       │
│       ▼                                                       │
│  Duration Check (min 0.35s — skip noise/clicks)               │
│       │                                                       │
│       ▼                                                       │
│  WAV File Writer (PCM → WAV with 44-byte RIFF header)        │
│       │                                                       │
│       ▼                                                       │
│  Media Understanding Pipeline (transcribeAudio)               │
│  [Provider-agnostic: Whisper, Google, Azure, etc.]            │
│       │                                                       │
│       ▼                                                       │
│  Speaker Label Resolution (guild member nickname/username)    │
│       │                                                       │
│       ▼                                                       │
│  Agent Command ("SpeakerName: transcribed text")              │
│                                                               │
└───────────────────────────────────────────────────────────────┘

┌─────────────────── OUTBOUND (Speaking) ───────────────────────┐
│                                                               │
│  Agent Reply Text                                             │
│       │                                                       │
│       ▼                                                       │
│  TTS Directive Parser (extract [[tts:...]] overrides)         │
│       │                                                       │
│       ▼                                                       │
│  Text-to-Speech Engine                                        │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐                  │
│  │  OpenAI  │  │ ElevenLabs │  │ Edge TTS │                  │
│  │  TTS API │  │    API     │  │  (free)  │                  │
│  └────┬─────┘  └─────┬──────┘  └────┬─────┘                  │
│       └──────────┬───┘───────────────┘                        │
│                  ▼                                             │
│  Audio File (MP3/Opus)                                        │
│       │                                                       │
│       ▼                                                       │
│  createAudioResource(audioPath)                               │
│       │                                                       │
│       ▼                                                       │
│  AudioPlayer.play(resource)                                   │
│       │                                                       │
│       ▼                                                       │
│  Discord Voice Channel (playback)                             │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 2.3 Concurrency Model

```
┌─────────────── Per-Guild Voice Session ─────────────────┐
│                                                          │
│  processingQueue ──────► Sequential STT + Agent turns    │
│  (Promise chain)         One speaker processed at a time │
│                                                          │
│  playbackQueue ────────► Sequential audio playback       │
│  (Promise chain)         One reply played at a time      │
│                                                          │
│  activeSpeakers ───────► Set<userId>                     │
│  (dedup guard)           Prevents double-capture         │
│                                                          │
│  On new speaker:                                         │
│    1. Stop current playback (barge-in)                   │
│    2. Capture audio until silence                        │
│    3. Enqueue to processingQueue                         │
│    4. Enqueue TTS result to playbackQueue                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. OpenClaw Discord Library Analysis

### 3.1 Framework: `@buape/carbon`

OpenClaw does **not** use `discord.js` directly. Instead, it uses **Carbon** (`@buape/carbon`), a lighter-weight Discord API framework. Carbon provides:

- REST client for Discord API calls
- Gateway WebSocket management
- Plugin system (including a `VoicePlugin`)
- Channel/guild/member fetching

The voice plugin (`@buape/carbon/voice`) provides the `getGatewayAdapterCreator()` method needed by `@discordjs/voice` to bridge between Carbon's gateway and the voice subsystem.

### 3.2 Voice Library: `@discordjs/voice`

Despite not using discord.js for the main bot framework, OpenClaw uses the standalone `@discordjs/voice` package (v0.19.x) for all voice functionality. This package is framework-agnostic — it works with any Discord library that provides a voice adapter.

Key APIs used:

| API | Purpose |
|-----|---------|
| `joinVoiceChannel()` | Establish voice connection to a channel |
| `entersState()` | Wait for connection/player state transitions |
| `createAudioPlayer()` | Create audio playback controller |
| `createAudioResource()` | Wrap audio file for playback |
| `VoiceConnection.receiver` | Access `VoiceReceiver` for incoming audio |
| `receiver.subscribe(userId)` | Get per-user Opus audio stream |
| `EndBehaviorType.AfterSilence` | Auto-end stream after silence duration |
| `VoiceConnectionStatus.*` | Connection lifecycle states |
| `AudioPlayerStatus.*` | Player lifecycle states |

### 3.3 oh-my-openclaw (This Repository)

This repository contains **zero Discord bot code**. It is a CLI tool for managing OpenClaw configuration presets. Its relationship to voice is purely through configuration injection:

- `src/presets/apex/preset.json5` defines `channels.discord` settings
- `src/core/constants.ts` marks `channels.*.botToken` and `channels.*.token` as sensitive fields
- `src/core/sensitive-filter.ts` strips tokens during export/diff operations

---

## 4. Dependencies

### 4.1 Runtime Dependencies (OpenClaw Gateway)

| Package | Version | Purpose | Required |
|---------|---------|---------|----------|
| `@discordjs/voice` | ^0.19.0 | Voice connection, audio player, receiver | Yes |
| `@discordjs/opus` | ^0.9.0 | Native Opus codec (C++ bindings via N-API) | Recommended |
| `opusscript` | ^0.1.1 | Pure JS Opus fallback (slower, higher CPU) | Fallback |
| `@buape/carbon` | latest | Discord framework + voice plugin | Yes |
| `sodium-native` or `tweetnacl` | latest | Voice encryption (required by @discordjs/voice) | Yes |
| `ffmpeg` | system | Audio format conversion (if needed) | Optional |

### 4.2 STT Dependencies

Transcription is handled by OpenClaw's media understanding pipeline (`src/media-understanding/runner.ts`), which abstracts over multiple providers:

| Provider | API | Audio Format | Streaming | Notes |
|----------|-----|-------------|-----------|-------|
| OpenAI Whisper | `POST /v1/audio/transcriptions` | WAV, MP3, FLAC, etc. | No (batch) | Most common choice; excellent multilingual |
| Google Cloud Speech | Streaming Recognition API | Linear16 PCM, FLAC | Yes | Real-time streaming possible |
| Azure Cognitive Services | Speech SDK | WAV, PCM | Yes | Low-latency streaming |
| Deepgram | WebSocket/REST API | WAV, PCM, Opus | Yes | Fast, good for real-time |

OpenClaw's architecture sends a **WAV file** to the provider, so it uses batch transcription rather than streaming. The audio path is:

```
Opus stream → PCM decode → WAV file → Media Understanding → Transcription text
```

### 4.3 TTS Dependencies

| Provider | API | Output Formats | Voices | Latency | Cost |
|----------|-----|---------------|--------|---------|------|
| **Edge TTS** | Microsoft Edge cloud | MP3, Opus, WebM | 300+ | ~500ms | Free |
| **OpenAI TTS** | `POST /v1/audio/speech` | MP3, Opus, AAC, FLAC, PCM | 6 standard + custom | ~800ms | $15/1M chars |
| **ElevenLabs** | REST API v1 | MP3, Opus, PCM | 1000+ cloned/premade | ~600ms | Freemium |

Provider selection follows a fallback chain: configured provider → remaining providers in order.

### 4.4 System Requirements

| Requirement | Details |
|-------------|---------|
| Node.js | v18+ (for @discordjs/voice compatibility) |
| Build tools | `node-gyp` compatible (for @discordjs/opus native build) |
| Memory | ~50-100MB additional per active voice session |
| Network | Stable connection for UDP voice + API calls |
| Discord Bot | `GUILD_VOICE_STATES` intent must be enabled |
| Bot Permissions | `Connect`, `Speak`, `Use Voice Activity` |

---

## 5. Component Design

### 5.1 DiscordVoiceManager (Existing Implementation)

Location: `openclaw/openclaw/src/discord/voice/manager.ts`

```
DiscordVoiceManager
├── Constructor(client, cfg, discordConfig, accountId, runtime)
├── Properties
│   ├── sessions: Map<guildId, VoiceSessionEntry>
│   ├── botUserId: string
│   └── voiceEnabled: boolean
├── Public Methods
│   ├── join(guildId, channelId) → VoiceOperationResult
│   ├── leave(guildId, channelId?) → VoiceOperationResult
│   ├── autoJoin() → void
│   ├── status() → VoiceOperationResult[]
│   ├── destroy() → void
│   ├── setBotUserId(id) → void
│   └── isEnabled() → boolean
└── Private Methods
    ├── handleSpeakingStart(entry, userId)
    ├── processSegment(entry, wavPath, userId, duration)
    ├── enqueueProcessing(entry, task)
    ├── enqueuePlayback(entry, task)
    ├── handleReceiveError(entry, err)
    ├── recoverFromDecryptFailures(entry)
    └── resolveSpeakerLabel(guildId, userId)
```

### 5.2 VoiceSessionEntry (Per-Guild State)

```typescript
type VoiceSessionEntry = {
  guildId: string;
  channelId: string;
  sessionChannelId: string;           // For session routing (text+voice share session)
  route: AgentRoute;                  // Which agent handles this channel
  connection: VoiceConnection;        // @discordjs/voice connection
  player: AudioPlayer;                // @discordjs/voice audio player
  playbackQueue: Promise<void>;       // Sequential TTS playback
  processingQueue: Promise<void>;     // Sequential STT + agent processing
  activeSpeakers: Set<string>;        // Dedup guard for concurrent speakers
  decryptFailureCount: number;        // DAVE encryption error tracking
  lastDecryptFailureAt: number;       // Timestamp for error window
  decryptRecoveryInFlight: boolean;   // Recovery lock
  stop: () => void;                   // Cleanup function
};
```

### 5.3 Audio Processing Utilities

| Function | Purpose |
|----------|---------|
| `decodeOpusStream(stream)` | Decode Opus packets to raw PCM using @discordjs/opus |
| `buildWavBuffer(pcm)` | Create WAV container with 44-byte RIFF header |
| `writeWavFile(pcm)` | Write PCM to temp WAV file, return path + duration |
| `estimateDurationSeconds(pcm)` | Calculate duration from PCM byte length |
| `scheduleTempCleanup(dir, delayMs)` | Schedule temp directory removal (30 min default) |
| `createOpusDecoder()` | Try @discordjs/opus, fallback to opusscript |
| `transcribeAudio(cfg, agentId, filePath)` | Run media understanding pipeline on WAV file |

---

## 6. Configuration Schema

### 6.1 Voice Configuration in openclaw.json

```jsonc
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "BOT_TOKEN",              // Discord bot token
      "allowBots": true,                  // Allow bot-to-bot messages
      "groupPolicy": "open",             // Server message policy
      "voice": {
        "enabled": true,                  // Master voice toggle
        "autoJoin": [                     // Auto-join on gateway start
          {
            "guildId": "123456789",
            "channelId": "987654321"
          }
        ],
        "daveEncryption": true,           // Discord Audio/Video Encryption
        "decryptionFailureTolerance": 3,  // Failures before reconnect
        "tts": {                          // Voice-specific TTS overrides
          "provider": "openai",           // "openai" | "elevenlabs" | "edge"
          "openai": {
            "voice": "alloy",             // Voice name
            "model": "gpt-4o-mini-tts"    // TTS model
          },
          "elevenlabs": {
            "voiceId": "pMsXgVXv3BLzUgSXRplE",
            "modelId": "eleven_multilingual_v2",
            "voiceSettings": {
              "stability": 0.5,
              "similarityBoost": 0.75,
              "style": 0.0,
              "useSpeakerBoost": true,
              "speed": 1.0
            }
          },
          "edge": {
            "enabled": true,
            "voice": "en-US-MichelleNeural",
            "lang": "en-US"
          }
        }
      }
    }
  }
}
```

### 6.2 Preset Configuration (oh-my-openclaw)

To enable voice via the apex preset, `src/presets/apex/preset.json5` would include:

```json5
{
  config: {
    channels: {
      discord: {
        allowBots: true,
        voice: {
          enabled: true,
          // autoJoin is user-specific, not set in preset
          tts: {
            provider: 'edge',  // Free default; users can override
          },
        },
      },
    },
  },
}
```

### 6.3 Sensitive Field Considerations

The following voice-related fields should be protected during export/diff:

| Field Path | Already Protected | Notes |
|------------|-------------------|-------|
| `channels.discord.token` | Yes | Bot token |
| `channels.discord.botToken` | Yes | Alternative token field |
| `channels.discord.voice.tts.openai.apiKey` | No | Needs addition |
| `channels.discord.voice.tts.elevenlabs.apiKey` | No | Needs addition |

---

## 7. Voice Connection Lifecycle

### 7.1 State Machine

```
                    ┌──────────┐
         ┌────────►│ Signalling│
         │         └─────┬─────┘
         │               │ Server info received
         │               ▼
         │         ┌───────────┐
    rejoin()  ┌───►│ Connecting │
         │    │    └─────┬──────┘
         │    │          │ UDP + Encryption ready
         │    │          ▼
         │    │    ┌──────────┐
         │    │    │  Ready   │◄──── Normal operating state
         │    │    └─────┬────┘
         │    │          │ Network interruption
         │    │          ▼
         │    │  ┌──────────────┐
         └────┤  │ Disconnected │───► Try reconnect (5s timeout)
              │  └──────────────┘     If fails → Destroyed
              │                       If succeeds → Signalling/Connecting
              │
              │  ┌──────────────┐
              └─►│  Destroyed   │───► Session cleaned up
                 └──────────────┘
```

### 7.2 Error Recovery

**Disconnect Recovery:**
1. On disconnect, race between `Signalling` and `Connecting` states (5s timeout)
2. If neither reached → destroy connection and clean up session
3. If reached → natural reconnection flow

**DAVE Decrypt Failure Recovery:**
1. Track decrypt failures within a 30-second window
2. After 3 consecutive failures → trigger rejoin sequence
3. Leave current channel → rejoin same channel
4. Prevents infinite recovery loops via `decryptRecoveryInFlight` lock

**Barge-in Behavior:**
- When a new speaker starts while TTS is playing, playback is immediately stopped
- This prevents the bot from talking over users

---

## 8. Audio Format Reference

### 8.1 Discord Audio Specifications

| Parameter | Value |
|-----------|-------|
| Codec | Opus |
| Sample Rate | 48,000 Hz |
| Channels | 2 (stereo) |
| Bit Depth | 16-bit |
| Frame Size | 20ms (960 samples per channel) |

### 8.2 Format Conversion Chain

```
Discord → Opus packets
       → @discordjs/opus decode → 48kHz 16-bit stereo PCM (raw)
       → WAV wrapper (44-byte RIFF header + PCM data)
       → STT API (accepts WAV)

Agent reply text
       → TTS API → MP3/Opus file
       → createAudioResource(filePath)
       → Discord AudioPlayer → Voice channel
```

### 8.3 Minimum Segment Filtering

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `MIN_SEGMENT_SECONDS` | 0.35s | Filter accidental noise, clicks, mic bumps |
| `SILENCE_DURATION_MS` | 1000ms | End-of-speech detection threshold |
| `PLAYBACK_READY_TIMEOUT_MS` | 15,000ms | Max wait for AudioPlayer to start |
| `SPEAKING_READY_TIMEOUT_MS` | 60,000ms | Max wait for playback to complete |

---

## 9. STT (Speech-to-Text) Analysis

### 9.1 OpenClaw's Approach

OpenClaw uses a **provider-agnostic media understanding pipeline** rather than directly calling a specific STT API. The flow is:

```typescript
async function transcribeAudio(params: {
  cfg: OpenClawConfig;
  agentId: string;
  filePath: string;  // WAV file path
}): Promise<string | undefined>
```

This calls `runCapability({ capability: "audio", ... })` which routes to the configured audio provider. This means:

- The STT provider is configured in `tools.media.audio` in openclaw.json
- Any provider supported by the media understanding system works
- Users can switch providers without code changes

### 9.2 Provider Comparison

| Provider | Batch Latency | Streaming | Languages | Accuracy | Cost |
|----------|--------------|-----------|-----------|----------|------|
| **OpenAI Whisper** | ~1-3s | No | 97+ | Excellent | $0.006/min |
| **Google Cloud Speech** | ~0.5-2s | Yes | 125+ | Excellent | $0.006/min |
| **Azure Speech** | ~0.5-2s | Yes | 100+ | Excellent | $0.0053/min |
| **Deepgram** | ~0.3-1s | Yes | 30+ | Very Good | $0.0043/min |
| **Whisper.cpp** (local) | ~2-10s | No | 97+ | Good-Excellent | Free |

### 9.3 Recommendation

OpenClaw's batch approach (record → WAV → transcribe) works well for conversational voice. For lower latency, streaming providers (Deepgram, Google, Azure) could be integrated into the media understanding pipeline in the future, though this would require architectural changes to pipe Opus frames directly instead of writing WAV files.

---

## 10. TTS (Text-to-Speech) Analysis

### 10.1 Existing Implementation

Location: `openclaw/openclaw/src/tts/tts.ts`

The TTS system supports three providers with automatic fallback:

```
Configured Provider → Fallback Provider 1 → Fallback Provider 2
```

### 10.2 Provider Details

#### Edge TTS (Default — Free)
- Microsoft's Edge browser TTS service
- 300+ voices across many languages
- No API key required
- Output: MP3 (configurable format)
- Voices: `en-US-MichelleNeural`, `en-US-GuyNeural`, etc.
- Configurable: pitch, rate, volume, subtitles

#### OpenAI TTS
- Models: `tts-1`, `tts-1-hd`, `gpt-4o-mini-tts`
- Voices: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`
- Output: MP3, Opus, AAC, FLAC, PCM
- Natural-sounding, good for conversational AI
- `gpt-4o-mini-tts` supports expressive voice directives

#### ElevenLabs
- 1000+ voices (premade + voice cloning)
- Model: `eleven_multilingual_v2`
- Fine-grained voice control: stability, similarity boost, style, speed
- Best voice quality for character/personality work
- Output: MP3, Opus, PCM

### 10.3 Voice-Specific TTS Overrides

OpenClaw supports per-channel TTS overrides via the voice config:

```typescript
const { cfg, resolved } = resolveVoiceTtsConfig({
  cfg: this.params.cfg,
  override: this.params.discordConfig.voice?.tts,  // Voice-specific overrides
});
```

This means the voice channel can use a different TTS provider/voice than text channels.

### 10.4 TTS Directive System

Agents can control TTS behavior inline via `[[tts:...]]` directives in their responses:

```
[[tts:voice=nova,model=gpt-4o-mini-tts]]Hello there![[/tts:text]]
```

Supported directive fields: provider, voice, model, voiceId, modelId, seed, voiceSettings, languageCode, applyTextNormalization.

---

## 11. Implementation Phases

### Phase 1: Preset Voice Configuration (oh-my-openclaw)

**Scope:** Add voice configuration to the apex preset in this repository.

**Changes required:**

1. Update `src/presets/apex/preset.json5`:
   - Add `channels.discord.voice.enabled: true`
   - Add default TTS configuration (Edge TTS as free default)

2. Update `src/core/constants.ts`:
   - Add TTS API key paths to `SENSITIVE_FIELDS`

3. Update workspace files to document voice commands:
   - `AGENTS.md`: Add voice channel interaction guidelines

**Estimated effort:** Small (1-2 hours)

### Phase 2: Voice Channel Management (OpenClaw Gateway)

**Scope:** Already implemented. Verify and document.

**Existing functionality:**
- `DiscordVoiceManager.join(guildId, channelId)` — Join a voice channel
- `DiscordVoiceManager.leave(guildId)` — Leave a voice channel
- `DiscordVoiceManager.autoJoin()` — Auto-join on gateway start
- `DiscordVoiceManager.status()` — List active voice sessions
- `DiscordVoiceManager.destroy()` — Clean up all sessions
- `DiscordVoiceReadyListener` — Auto-join hook on Discord ready event

**Configuration:**
```bash
openclaw config set channels.discord.voice.enabled true
openclaw config set channels.discord.voice.autoJoin '[{"guildId":"...","channelId":"..."}]'
openclaw gateway restart
```

**Estimated effort:** None (already shipped)

### Phase 3: Speech-to-Text Pipeline (OpenClaw Gateway)

**Scope:** Already implemented via media understanding pipeline.

**Existing flow:**
1. Capture Opus packets per speaker via `receiver.subscribe(userId)`
2. Decode Opus → PCM via `@discordjs/opus` (or opusscript fallback)
3. Filter short segments (< 0.35s)
4. Write WAV file to temp directory
5. Transcribe via `transcribeAudio()` → media understanding pipeline
6. Resolve speaker name (guild nickname → global name → username → userId)
7. Format as `"SpeakerName: transcript"` and send to agent

**Estimated effort:** None (already shipped)

### Phase 4: Text-to-Speech Pipeline (OpenClaw Gateway)

**Scope:** Already implemented with three providers.

**Existing flow:**
1. Receive agent reply text
2. Parse TTS directives (`[[tts:...]]`)
3. Resolve voice-specific TTS config (voice channel overrides)
4. Call TTS provider (OpenAI/ElevenLabs/Edge with fallback chain)
5. Write audio to temp file
6. Enqueue playback via `createAudioResource(audioPath)`
7. Play through `AudioPlayer`, wait for completion

**Estimated effort:** None (already shipped)

### Phase 5: Enhanced Features (Future)

| Feature | Description | Complexity |
|---------|-------------|------------|
| Streaming STT | Pipe Opus frames directly to Deepgram/Google streaming API | Medium |
| Multi-speaker tracking | Track and label multiple simultaneous speakers | Low |
| Voice activity detection | Replace silence-based detection with VAD model | Medium |
| Voice cloning | Clone user voices for personalized TTS responses | Low (ElevenLabs API) |
| Slash commands | `/join`, `/leave`, `/voice-status` Discord commands | Low |
| Per-user voice preferences | Different TTS voice per speaker | Low |
| Playback queue management | Skip, pause, priority queue for TTS responses | Medium |
| Wake word detection | Listen for trigger word before processing speech | High |

---

## 12. Security Considerations

### 12.1 Bot Permissions

Required Discord bot permissions for voice:

| Permission | Bit | Purpose |
|------------|-----|---------|
| `Connect` | 1 << 20 | Join voice channels |
| `Speak` | 1 << 21 | Transmit audio |
| `Use Voice Activity` | 1 << 25 | Speak without push-to-talk |

Required gateway intents:

| Intent | Purpose |
|--------|---------|
| `GuildVoiceStates` | Receive voice state updates (join/leave/mute) |
| `MessageContent` | Process text commands (if used alongside voice) |

### 12.2 Audio Privacy

- Audio is processed per-segment (not continuously recorded)
- WAV temp files are auto-cleaned after 30 minutes
- No permanent audio storage
- Transcriptions are sent through the same session as text messages
- Bot self-audio is excluded (`botUserId` check)

### 12.3 DAVE Encryption

Discord's Audio/Video Encryption (DAVE) is supported:
- `daveEncryption` config toggle (default: enabled)
- Decrypt failure detection and automatic recovery
- Configurable failure tolerance threshold

### 12.4 Sensitive Field Protection

API keys for TTS providers should not be exposed during preset export/diff. The following paths need protection in `src/core/constants.ts`:

```typescript
export const SENSITIVE_FIELDS = [
  // ... existing fields ...
  'messages.tts.openai.apiKey',
  'messages.tts.elevenlabs.apiKey',
  'channels.*.voice.tts.openai.apiKey',
  'channels.*.voice.tts.elevenlabs.apiKey',
] as const;
```

---

## 13. Testing Strategy

### 13.1 Existing Test Coverage

OpenClaw has tests at `src/discord/voice/manager.test.ts` that mock:
- `@discordjs/voice` (joinVoiceChannel, createAudioPlayer, entersState, etc.)
- Agent routing (`resolveAgentRoute`)
- Audio processing pipeline

### 13.2 oh-my-openclaw Test Areas

| Area | Test Type | Description |
|------|-----------|-------------|
| Preset voice config | Unit | Voice config preserved through apply/export cycle |
| Sensitive filter | Unit | TTS API keys stripped during export/diff |
| Diff output | Unit | Voice config changes shown correctly in diff |
| Integration | E2E | Apply voice-enabled preset → verify openclaw.json |

---

## 14. Summary

OpenClaw's Discord voice support is a **mature, production implementation** with:

- Full voice channel lifecycle management (join, leave, auto-join, reconnection)
- Speaker-level audio capture with silence-based endpoint detection
- Provider-agnostic STT via the media understanding pipeline
- Three TTS providers with automatic fallback (Edge TTS free default)
- DAVE encryption support with automatic error recovery
- Barge-in behavior (stop TTS when user speaks)
- Sequential processing queues preventing audio overlap

The primary work for **oh-my-openclaw** is Phase 1: adding voice configuration to the apex preset so users can enable voice support through the standard `oh-my-openclaw apply apex` workflow.

---

## Appendix A: Reference Implementations

| Project | URL | Notes |
|---------|-----|-------|
| OpenClaw Voice Manager | `openclaw/openclaw/src/discord/voice/manager.ts` | Production implementation |
| OpenClaw TTS System | `openclaw/openclaw/src/tts/tts.ts` | Multi-provider TTS |
| @discordjs/voice examples | `discordjs/voice/examples/` | Official basic + music bot examples |
| ElizaOS Discord Voice | `elizaOS/eliza/packages/client-discord/src/voice.ts` | AI agent voice reference |
| AIRI Discord Bot | `moeru-ai/airi/services/discord-bot/` | STT + voice with Opus decoding |

## Appendix B: Discord Gateway Adapter Bridge

Since OpenClaw uses Carbon instead of discord.js, the voice adapter bridge is required:

```typescript
// Carbon's VoicePlugin provides the adapter
const voicePlugin = client.getPlugin<VoicePlugin>("voice");
const adapterCreator = voicePlugin.getGatewayAdapterCreator(guildId);

// Pass to @discordjs/voice
const connection = joinVoiceChannel({
  channelId,
  guildId,
  adapterCreator,  // Carbon → @discordjs/voice bridge
  selfDeaf: false,  // Must be false to receive audio
  selfMute: false,
});
```

## Appendix C: Opus Decoder Fallback Strategy

```
Try @discordjs/opus (native C++ bindings)
  ├── Success → Use native decoder (fast, low CPU)
  └── Failure → Try opusscript (pure JavaScript)
                  ├── Success → Use JS decoder (slower, higher CPU, warn once)
                  └── Failure → Return empty buffer (log both errors)
```

Native `@discordjs/opus` requires `node-gyp` compatible build tools. If unavailable (e.g., minimal Docker image), the pure JS fallback ensures voice still works at reduced performance.
