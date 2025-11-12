# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Goon VoiceFlow is a production-ready conversational AI agent that supports multiple platforms (Telegram, WebUI), multiple LLM providers (OpenRouter, Mistral), and includes voice capabilities (TTS via ElevenLabs, STT via Deepgram). The system uses Redis for session persistence and is designed to run as a systemd service.

## Architecture

### Core Components

- **server.js**: Main application server handling WebSocket connections, Telegram bot integration, session management, and LLM provider orchestration
- **Session Management**: In-memory Map with Redis persistence for durability across restarts
- **Multi-Platform**: Unified session handling for both Telegram and WebUI clients with platform-specific message delivery
- **LLM Provider Fallback**: Primary provider (OpenRouter) with automatic fallback to Mistral on failure

### Key Design Patterns

1. **Session State Machine**: Sessions progress through states: `consent` → `telegram`/`webui` → `terminal_unhappy` (if consent denied)
2. **Session Persistence**: Dual storage (in-memory + Redis) with automatic expiration based on SESSION_TIMEOUT_MINUTES
3. **User Defaults**: Users can save their configuration preferences permanently via `/save` command, stored in Redis with key pattern `defaults:{sessionId}`
4. **Provider Switching**: Dynamic provider/model switching mid-conversation without session reset

### Session ID Conventions

- Telegram: `tg_{userId}`
- WebUI: `web_{sessionId}` (generated client-side, stored in localStorage)

## Recent Enhancements (v1.2.0)

### Security & Reliability
- **Rate Limiting**: 100 requests per minute per session/IP with graceful degradation
- **Input Validation**: Comprehensive command validation with length/type/range checks
- **Buffer Limits**: 10MB max for audio, 1000 chars for TTS, 4000 chars for input
- **Error Recovery**: Graceful shutdown handlers (SIGTERM, SIGINT) with resource cleanup

### Observability
- **Structured Logging**: JSON-formatted logs with request tracking, saved to `logs/app.log` and `logs/error.log`
- **Health Endpoint**: GET `/health` returns system status, uptime, session count, service configuration
- **Metrics Endpoint**: GET `/metrics` provides active metrics for monitoring
- **Performance Tracking**: LLM call latency, token usage, voice service confidence scores

### Error Handling
- Try-catch blocks in all async handlers (WebSocket, Telegram, Express)
- Detailed error logging with context (sessionId, provider, status code)
- User-friendly error messages with graceful fallbacks
- Unhandled exception and rejection tracking

## Development Commands

### Running the Application

```bash
# Production mode
npm start

# Development mode with auto-reload
npm run dev
```

### TypeScript

The project has a TypeScript configuration but the main application is JavaScript. TypeScript source files are in `src/` and compile to `dist/`:

```bash
# Compile TypeScript
npx tsc

# The compiled output goes to dist/ but server.js is the actual entrypoint
```

### Testing the Application

```bash
# Start the server
npm start

# Access WebUI
curl http://localhost:3000

# Check health
curl http://localhost:3000/health

# Get metrics
curl http://localhost:3000/metrics

# Test Telegram webhook (if configured)
curl -X POST http://localhost:3000/telegram-webhook

# Download project ZIP
curl http://localhost:3000/package -o project.zip
```

## Production Deployment

### systemd Service

The application is designed to run as a systemd service. Use the provided `goon_setup.sh` script for deployment:

```bash
# Deploy entire stack
sudo bash goon_setup.sh

# Manual service management
sudo systemctl daemon-reload
sudo systemctl enable --now goon-voiceflow
sudo systemctl restart goon-voiceflow
sudo systemctl status goon-voiceflow

# View logs
journalctl -u goon-voiceflow -f
```

### Configuration

All configuration is via environment variables in `.env`:

**Critical Variables:**
- `OPENROUTER_API_KEY` / `OPENROUTER_MODEL`: Primary LLM provider
- `MISTRAL_API_KEY` / `MISTRAL_MODEL`: Fallback LLM provider
- `REDIS_URL`: Required for session persistence and user defaults (format: `redis://host:port`)
- `TELEGRAM_BOT_TOKEN`: Required for Telegram integration
- `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID`: Optional TTS
- `DEEPGRAM_API_KEY`: Optional STT

**Note:** Without Redis, sessions are memory-only and user defaults (`/save` command) won't persist across restarts.

## Code Modification Guidelines

### Adding New Commands

Commands are handled in the `handleInput()` function (server.js:553). Command structure:

```javascript
else if (input.startsWith('/newcommand ')) {
  const arg = input.slice(12).trim();
  // Process command
  session.params.someParam = arg;
  await saveSession(session);
  response = '✓ Success message';
}
```

Always call `saveSession(session)` after modifying session state.

### Adding New LLM Providers

1. Add provider configuration to `LLM_PROVIDERS` object (server.js:143):
```javascript
newprovider: {
  apiKey: process.env.NEWPROVIDER_API_KEY,
  model: process.env.NEWPROVIDER_MODEL || 'default-model',
  endpoint: 'https://api.newprovider.com/v1/chat/completions'
}
```

2. Update `callLLM()` if provider requires custom headers/request format
3. Add to `/provider` command validation list
4. Add detailed logging in callLLM success/error handlers

### Session Parameter Defaults

Default session parameters are defined in `loadSession()` (server.js:158-162). When adding new parameters:

1. Add to default params object
2. Consider whether users should be able to save it via `/save`
3. Include in `/settings` output if user-facing

### WebSocket Message Protocol

Messages between WebUI and server use JSON format:

**Client → Server:**
- `{type: 'init', sessionId: string}` - Initialize session
- `{type: 'text', content: string}` - Text message
- `{type: 'audio', buffer: base64}` - Audio data for transcription

**Server → Client:**
- `{type: 'sessionId', sessionId: string}` - Confirm session init
- `{type: 'text', content: string}` - Text response
- `{type: 'audio', buffer: base64}` - TTS audio data
- `{type: 'error', content: string}` - Error message

### HTML/UI Generation

The WebUI HTML is generated programmatically in server.js (lines 862-972). To modify the UI, edit the template string in `fs.writeFileSync('public/index.html', ...)`. The UI is regenerated on each server start.

## Important Notes

- The project uses both `server.js` (main application) and `src/index.ts` (minimal TypeScript stub) - `server.js` is the actual entrypoint
- Session cleanup: Terminal sessions are automatically deleted after 5 seconds (server.js:670)
- History trimming: Conversation history is automatically truncated to `memorySize * 2` messages to manage context windows
- Rate limiting: 100 requests per minute per session/IP with automatic cleanup every 30 seconds
- Redis keys use prefixes: `session:{id}` for sessions, `defaults:{id}` for user-saved defaults
- Logging: All requests logged to files with structured JSON format; error logs in `logs/error.log`
- GitHub push endpoint (`/github-push`) supports automated deployments but requires GITHUB_TOKEN and GITHUB_REPO env vars
- Health check endpoint available at `/health` for monitoring and load balancer integration
