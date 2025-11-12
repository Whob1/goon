# Goon VoiceFlow - Production-Ready Conversational AI Agent

A sophisticated, multi-platform conversational AI agent with voice capabilities, multiple LLM provider support, and enterprise-grade reliability features.

## Features

### 🎯 Multi-Platform Support
- **WebSocket WebUI** - Modern browser-based interface with real-time chat
- **Telegram Integration** - Full Telegram bot support with voice messages
- **Unified Session Management** - Seamless user experience across platforms

### 🧠 Intelligent LLM Provider System
- **Primary Provider**: OpenRouter (access to 400+ models)
- **Automatic Fallback**: Mistral AI with intelligent failover
- **Dynamic Switching**: Change models mid-conversation
- **Fine-Grained Control**: Temperature, system prompt, memory customization

### 🎙️ Voice Capabilities
- **Text-to-Speech**: ElevenLabs integration
- **Speech-to-Text**: Deepgram Nova-2 transcription
- **Dual Platform**: Voice on Telegram and WebUI

### 🔒 Security & Reliability
- **Rate Limiting**: 100 requests/minute per session
- **Input Validation**: Comprehensive validation of all commands
- **Error Recovery**: Graceful shutdown and resource cleanup
- **Structured Logging**: JSON logs with request tracking

### 📊 Observability
- `/health` endpoint for system monitoring
- `/metrics` endpoint for real-time metrics
- Structured JSON logging to `logs/app.log` and `logs/error.log`
- Request latency and performance tracking

## Quick Start

```bash
# Install
npm install

# Configure
cp .env.example .env  # Add your API keys

# Run
npm start
```

Visit `http://localhost:3000`

## Configuration

Set these environment variables in `.env`:

```bash
# At least one LLM provider required
OPENROUTER_API_KEY=your_key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
MISTRAL_API_KEY=your_key

# Optional but recommended
REDIS_URL=redis://localhost:6379
TELEGRAM_BOT_TOKEN=your_token
ELEVENLABS_API_KEY=your_key
DEEPGRAM_API_KEY=your_key

# Server config
PORT=3000
NODE_ENV=production
```

## Commands

- `/settings` - View configuration
- `/provider <openrouter|mistral>` - Switch AI provider
- `/model <name>` - Change model
- `/temp <0-2>` - Set creativity level
- `/system <prompt>` - Custom personality
- `/save` - Save your settings
- `/help` - List all commands

## Monitoring

```bash
# Health check
curl http://localhost:3000/health

# Metrics
curl http://localhost:3000/metrics

# Logs
tail -f logs/app.log
```

## Documentation

See `CLAUDE.md` for detailed development guide.

## License

MIT
