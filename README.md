# Goon VoiceFlow - Production-Ready Conversational AI Agent

A multi-platform conversational AI agent with robust OpenAI-compatible LLM support, per-provider model profiles, OpenAI + ElevenLabs TTS, and Deepgram STT.

## What’s New (April 2026 refresh)

- **OpenAI-compatible LLM architecture**
  - Built-in providers: `openrouter`, `mistral`, `openai`
  - Runtime command to add **custom OpenAI-compatible providers** (`/provideradd`)
  - Per-provider model pinning (`/modelset`) and active provider switching (`/provider`)
  - Configurable fallback provider (`fallbackProvider` in session settings)
- **Modern OpenAI TTS integration**
  - Uses OpenAI `audio/speech` with configurable model/voice/format/speed
  - Default model: `gpt-4o-mini-tts`
  - Still supports ElevenLabs as an alternate provider
- **Deepgram STT upgrades**
  - Deepgram `/v1/listen` with configurable model (default `nova-3`), language, punctuation
- **Capability visibility**
  - New `/capabilities` HTTP endpoint for runtime provider readiness

## Features

### 🎯 Multi-Platform Support
- **WebSocket WebUI** with real-time chat + voice
- **Telegram Bot** with text and voice messages
- Unified session lifecycle and consent handling

### 🧠 LLM Routing + Custom Provider Support
- Built-in LLM providers with defaults from environment variables
- Add unlimited custom OpenAI-compatible providers at runtime
- Save custom provider models per session/user (`/save`)
- Automatic fallback to a secondary provider when primary fails

### 🎙️ Speech Stack
- **TTS**: OpenAI Audio Speech + ElevenLabs
- **STT**: Deepgram (pre-recorded audio transcription)

### 🔒 Reliability
- Input validation and rate limiting
- Graceful error handling and structured logs
- Redis-backed session/default persistence (optional)

### 📊 Observability
- `/health` for service checks
- `/metrics` for counters and uptime
- `/capabilities` for provider readiness matrix

## Quick Start

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Environment Variables

```bash
# Core
PORT=3000
NODE_ENV=production
SESSION_TIMEOUT_MINUTES=60
REDIS_URL=redis://localhost:6379
TELEGRAM_BOT_TOKEN=...

# Built-in LLM providers
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-4o-mini
MISTRAL_API_KEY=...
MISTRAL_MODEL=mistral-small-latest
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
DEFAULT_FALLBACK_PROVIDER=mistral

# TTS defaults
TTS_PROVIDER=openai
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=alloy
TTS_AUDIO_FORMAT=mp3
TTS_SPEED=1.0
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...

# STT defaults
STT_PROVIDER=deepgram
DEEPGRAM_API_KEY=...
DEEPGRAM_MODEL=nova-3
DEEPGRAM_LANGUAGE=en
DEEPGRAM_PUNCTUATE=true
```

## Runtime Commands

- `/help` - show commands
- `/settings` - show active session configuration
- `/provider <name>` - switch active LLM provider
- `/providers` - list available built-in + custom providers
- `/provideradd <name> <baseUrl> <apiKey> [defaultModel]` - add custom OpenAI-compatible provider
- `/model <model-name>` - set model for current provider
- `/modelset <provider> <model-name>` - persist a model for a specific provider
- `/temperature <0.0-2.0>`
- `/systemprompt <prompt>`
- `/memory <1-100>`
- `/maxtokens <100-4000>`
- `/tts <on|off>`
- `/ttsprovider <openai|elevenlabs>`
- `/ttsvoice <voice>`
- `/ttsmodel <model>`
- `/sttmodel <model>`
- `/voiceid <id>` (legacy alias for ElevenLabs voice)
- `/save` - save session settings as defaults
- `/status`
- `/reset`

## Monitoring

```bash
curl http://localhost:3000/health
curl http://localhost:3000/metrics
curl http://localhost:3000/capabilities
```

## Notes on API freshness

This implementation was refreshed against OpenAI and Deepgram docs current as of **April 26, 2026**, including OpenAI Audio Speech (`/v1/audio/speech`, `gpt-4o-mini-tts`) and Deepgram STT (`/v1/listen`, `nova-3`).

## License

MIT
