require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Telegraf } = require('telegraf');
const axios = require('axios');
const Redis = require('ioredis');
const simpleGit = require('simple-git');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================================================
// LOGGER CLASS
// ============================================================================
class Logger {
  constructor() {
    this.logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    this.appLogPath = path.join(this.logsDir, 'app.log');
    this.errorLogPath = path.join(this.logsDir, 'error.log');
  }

  _write(level, message, meta = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta
    };
    const logLine = JSON.stringify(logEntry) + '\n';

    // Write to app.log
    fs.appendFileSync(this.appLogPath, logLine);

    // Write to error.log if error or warn
    if (level === 'error' || level === 'warn') {
      fs.appendFileSync(this.errorLogPath, logLine);
    }

    // Console output
    console.log(`[${level.toUpperCase()}] ${message}`, meta);
  }

  info(message, meta = {}) {
    this._write('info', message, meta);
  }

  warn(message, meta = {}) {
    this._write('warn', message, meta);
  }

  error(message, meta = {}) {
    this._write('error', message, meta);
  }

  debug(message, meta = {}) {
    this._write('debug', message, meta);
  }
}

const logger = new Logger();

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map(); // sessionId -> [{timestamp}]
  }

  isAllowed(sessionId) {
    const now = Date.now();

    if (!this.requests.has(sessionId)) {
      this.requests.set(sessionId, []);
    }

    const userRequests = this.requests.get(sessionId);

    // Remove expired requests
    const validRequests = userRequests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    this.requests.set(sessionId, validRequests);

    if (validRequests.length >= this.maxRequests) {
      logger.warn('Rate limit exceeded', { sessionId, count: validRequests.length });
      return false;
    }

    validRequests.push(now);
    this.requests.set(sessionId, validRequests);
    return true;
  }

  reset(sessionId) {
    this.requests.delete(sessionId);
  }

  cleanup() {
    const now = Date.now();
    for (const [sessionId, timestamps] of this.requests.entries()) {
      const validRequests = timestamps.filter(
        timestamp => now - timestamp < this.windowMs
      );
      if (validRequests.length === 0) {
        this.requests.delete(sessionId);
      } else {
        this.requests.set(sessionId, validRequests);
      }
    }
  }
}

const rateLimiter = new RateLimiter(100, 60000);

// ============================================================================
// INPUT VALIDATION
// ============================================================================
function validateInput(input, type, options = {}) {
  const { min, max, allowed, required = true } = options;

  if (required && (input === undefined || input === null || input === '')) {
    return { valid: false, error: 'Input is required' };
  }

  if (!required && (input === undefined || input === null || input === '')) {
    return { valid: true };
  }

  switch (type) {
    case 'string':
      if (typeof input !== 'string') {
        return { valid: false, error: 'Input must be a string' };
      }
      if (min !== undefined && input.length < min) {
        return { valid: false, error: `Input must be at least ${min} characters` };
      }
      if (max !== undefined && input.length > max) {
        return { valid: false, error: `Input must be at most ${max} characters` };
      }
      break;

    case 'number':
      const num = Number(input);
      if (isNaN(num)) {
        return { valid: false, error: 'Input must be a number' };
      }
      if (min !== undefined && num < min) {
        return { valid: false, error: `Input must be at least ${min}` };
      }
      if (max !== undefined && num > max) {
        return { valid: false, error: `Input must be at most ${max}` };
      }
      break;

    case 'enum':
      if (!allowed || !allowed.includes(input)) {
        return { valid: false, error: `Input must be one of: ${allowed.join(', ')}` };
      }
      break;

    case 'buffer':
      if (!Buffer.isBuffer(input)) {
        return { valid: false, error: 'Input must be a buffer' };
      }
      if (max !== undefined && input.length > max) {
        return { valid: false, error: `Buffer size must be at most ${max} bytes` };
      }
      break;

    default:
      return { valid: false, error: 'Unknown validation type' };
  }

  return { valid: true };
}

// ============================================================================
// CONFIGURATION
// ============================================================================
const PORT = process.env.PORT || 3000;
const SESSION_TIMEOUT_MINUTES = parseInt(process.env.SESSION_TIMEOUT_MINUTES || '60', 10);
const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_MESSAGE_LENGTH = 10000;

const LLM_PROVIDERS = {
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions'
  },
  mistral: {
    apiKey: process.env.MISTRAL_API_KEY,
    model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
    endpoint: 'https://api.mistral.ai/v1/chat/completions'
  }
};

// ============================================================================
// REDIS CLIENT
// ============================================================================
let redis = null;
if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL);
    redis.on('connect', () => logger.info('Redis connected'));
    redis.on('error', (err) => logger.error('Redis error', { error: err.message }));
  } catch (err) {
    logger.error('Failed to initialize Redis', { error: err.message });
  }
} else {
  logger.warn('REDIS_URL not set, running without persistence');
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================
const sessions = new Map();

function createSession(sessionId, platform = 'webui') {
  const session = {
    id: sessionId,
    platform,
    state: 'consent',
    history: [],
    params: {
      provider: 'openrouter',
      model: LLM_PROVIDERS.openrouter.model,
      temperature: 0.7,
      systemPrompt: 'You are a helpful AI assistant named Goon.',
      memorySize: 10,
      maxTokens: 1000,
      ttsEnabled: false,
      voiceId: process.env.ELEVENLABS_VOICE_ID || ''
    },
    createdAt: Date.now(),
    lastActivity: Date.now()
  };

  sessions.set(sessionId, session);
  logger.info('Session created', { sessionId, platform });
  return session;
}

async function loadSession(sessionId) {
  // Check in-memory first
  if (sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    session.lastActivity = Date.now();
    return session;
  }

  // Try loading from Redis
  if (redis) {
    try {
      const data = await redis.get(`session:${sessionId}`);
      if (data) {
        const session = JSON.parse(data);
        session.lastActivity = Date.now();
        sessions.set(sessionId, session);
        logger.info('Session loaded from Redis', { sessionId });
        return session;
      }
    } catch (err) {
      logger.error('Failed to load session from Redis', { sessionId, error: err.message });
    }
  }

  // Load user defaults if available
  let defaults = {};
  if (redis) {
    try {
      const defaultsData = await redis.get(`defaults:${sessionId}`);
      if (defaultsData) {
        defaults = JSON.parse(defaultsData);
        logger.info('User defaults loaded', { sessionId });
      }
    } catch (err) {
      logger.error('Failed to load defaults', { sessionId, error: err.message });
    }
  }

  // Create new session with defaults
  const platform = sessionId.startsWith('tg_') ? 'telegram' : 'webui';
  const session = createSession(sessionId, platform);

  // Apply defaults
  if (Object.keys(defaults).length > 0) {
    session.params = { ...session.params, ...defaults };
  }

  return session;
}

async function saveSession(session) {
  session.lastActivity = Date.now();
  sessions.set(session.id, session);

  if (redis) {
    try {
      await redis.setex(
        `session:${session.id}`,
        SESSION_TIMEOUT_MINUTES * 60,
        JSON.stringify(session)
      );
      logger.debug('Session saved to Redis', { sessionId: session.id });
    } catch (err) {
      logger.error('Failed to save session to Redis', { sessionId: session.id, error: err.message });
    }
  }
}

async function deleteSession(sessionId) {
  sessions.delete(sessionId);

  if (redis) {
    try {
      await redis.del(`session:${sessionId}`);
      logger.info('Session deleted', { sessionId });
    } catch (err) {
      logger.error('Failed to delete session from Redis', { sessionId, error: err.message });
    }
  }
}

async function saveUserDefaults(sessionId, params) {
  if (!redis) {
    return { success: false, error: 'Redis not available' };
  }

  try {
    await redis.set(`defaults:${sessionId}`, JSON.stringify(params));
    logger.info('User defaults saved', { sessionId });
    return { success: true };
  } catch (err) {
    logger.error('Failed to save user defaults', { sessionId, error: err.message });
    return { success: false, error: err.message };
  }
}

// ============================================================================
// LLM INTEGRATION
// ============================================================================
async function callLLM(session, userMessage) {
  const { provider, model, temperature, systemPrompt, maxTokens } = session.params;

  if (!LLM_PROVIDERS[provider]) {
    logger.error('Invalid LLM provider', { provider, sessionId: session.id });
    throw new Error(`Invalid provider: ${provider}`);
  }

  const config = LLM_PROVIDERS[provider];

  if (!config.apiKey) {
    logger.error('Provider API key not configured', { provider, sessionId: session.id });
    throw new Error(`${provider} API key not configured`);
  }

  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt },
    ...session.history,
    { role: 'user', content: userMessage }
  ];

  const requestBody = {
    model: model,
    messages: messages,
    temperature: temperature,
    max_tokens: maxTokens
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`
  };

  // Add OpenRouter-specific headers
  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/goon-voiceflow';
    headers['X-Title'] = 'Goon VoiceFlow';
  }

  logger.info('LLM request initiated', {
    sessionId: session.id,
    provider,
    model,
    messageCount: messages.length,
    temperature
  });

  try {
    const startTime = Date.now();
    const response = await axios.post(config.endpoint, requestBody, {
      headers,
      timeout: 30000
    });

    const duration = Date.now() - startTime;
    const assistantMessage = response.data.choices[0].message.content;

    logger.info('LLM request successful', {
      sessionId: session.id,
      provider,
      model,
      duration,
      responseLength: assistantMessage.length,
      tokensUsed: response.data.usage || {}
    });

    return assistantMessage;

  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error('LLM request failed', {
      sessionId: session.id,
      provider,
      model,
      duration,
      error: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data
    });

    // Try fallback provider if primary fails
    if (provider === 'openrouter' && LLM_PROVIDERS.mistral.apiKey) {
      logger.info('Attempting fallback to Mistral', { sessionId: session.id });

      try {
        const fallbackSession = {
          ...session,
          params: {
            ...session.params,
            provider: 'mistral',
            model: LLM_PROVIDERS.mistral.model
          }
        };

        return await callLLM(fallbackSession, userMessage);
      } catch (fallbackErr) {
        logger.error('Fallback provider also failed', {
          sessionId: session.id,
          error: fallbackErr.message
        });
        throw fallbackErr;
      }
    }

    throw err;
  }
}

// ============================================================================
// VOICE SERVICES
// ============================================================================
async function textToSpeech(text, voiceId) {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  if (!voiceId) {
    throw new Error('Voice ID not configured');
  }

  const validation = validateInput(text, 'string', { min: 1, max: 5000 });
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  logger.info('TTS request initiated', { textLength: text.length, voiceId });

  try {
    const startTime = Date.now();
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      },
      {
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY
        },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    const duration = Date.now() - startTime;
    const audioBuffer = Buffer.from(response.data);

    logger.info('TTS request successful', {
      duration,
      audioSize: audioBuffer.length,
      textLength: text.length
    });

    return audioBuffer;

  } catch (err) {
    logger.error('TTS request failed', {
      error: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText
    });
    throw err;
  }
}

async function speechToText(audioBuffer) {
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error('Deepgram API key not configured');
  }

  const validation = validateInput(audioBuffer, 'buffer', { max: MAX_AUDIO_SIZE });
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  logger.info('STT request initiated', { audioSize: audioBuffer.length });

  try {
    const startTime = Date.now();
    const response = await axios.post(
      'https://api.deepgram.com/v1/listen',
      audioBuffer,
      {
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/wav'
        },
        timeout: 30000
      }
    );

    const duration = Date.now() - startTime;
    const transcript = response.data.results.channels[0].alternatives[0].transcript;

    logger.info('STT request successful', {
      duration,
      audioSize: audioBuffer.length,
      transcriptLength: transcript.length
    });

    return transcript;

  } catch (err) {
    logger.error('STT request failed', {
      error: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText
    });
    throw err;
  }
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================
async function handleInput(session, input) {
  // Validate input
  const validation = validateInput(input, 'string', { min: 1, max: MAX_MESSAGE_LENGTH });
  if (!validation.valid) {
    return validation.error;
  }

  // Handle consent state
  if (session.state === 'consent') {
    if (input.toLowerCase().includes('yes') || input.toLowerCase().includes('agree') || input.toLowerCase().includes('accept')) {
      session.state = session.platform;
      await saveSession(session);
      return 'Thank you! You can now start chatting. Type /help for available commands.';
    } else {
      session.state = 'terminal_unhappy';
      await saveSession(session);
      setTimeout(() => deleteSession(session.id), 5000);
      return 'Consent denied. Session will be terminated.';
    }
  }

  // Handle terminal state
  if (session.state === 'terminal_unhappy') {
    return 'Session terminated. Please start a new conversation.';
  }

  // Handle commands
  if (input.startsWith('/')) {
    return await handleCommand(session, input);
  }

  // Trim history if needed
  const memorySize = session.params.memorySize;
  if (session.history.length > memorySize * 2) {
    session.history = session.history.slice(-memorySize * 2);
    logger.debug('History trimmed', { sessionId: session.id, newSize: session.history.length });
  }

  // Call LLM
  try {
    const response = await callLLM(session, input);

    // Update history
    session.history.push({ role: 'user', content: input });
    session.history.push({ role: 'assistant', content: response });

    await saveSession(session);

    return response;

  } catch (err) {
    logger.error('Failed to get LLM response', { sessionId: session.id, error: err.message });
    return `Error: ${err.message}. Please try again or contact support.`;
  }
}

async function handleCommand(session, input) {
  const parts = input.split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ').trim();

  logger.info('Command received', { sessionId: session.id, command, args });

  switch (command) {
    case '/help':
      return `Available commands:
/help - Show this help message
/reset - Clear conversation history
/settings - Show current settings
/provider <openrouter|mistral> - Switch LLM provider
/model <model-name> - Set model name
/temperature <0.0-2.0> - Set temperature
/systemprompt <prompt> - Set system prompt
/memory <number> - Set conversation memory size
/maxtokens <number> - Set max tokens
/tts <on|off> - Toggle text-to-speech
/voiceid <id> - Set ElevenLabs voice ID
/save - Save current settings as defaults
/status - Show session status`;

    case '/reset':
      session.history = [];
      await saveSession(session);
      return 'Conversation history cleared.';

    case '/settings':
      return `Current settings:
Provider: ${session.params.provider}
Model: ${session.params.model}
Temperature: ${session.params.temperature}
System Prompt: ${session.params.systemPrompt}
Memory Size: ${session.params.memorySize}
Max Tokens: ${session.params.maxTokens}
TTS Enabled: ${session.params.ttsEnabled}
Voice ID: ${session.params.voiceId || 'not set'}`;

    case '/provider':
      const validation = validateInput(args, 'enum', { allowed: ['openrouter', 'mistral'] });
      if (!validation.valid) {
        return 'Usage: /provider <openrouter|mistral>';
      }
      session.params.provider = args;
      session.params.model = LLM_PROVIDERS[args].model;
      await saveSession(session);
      return `Provider switched to ${args} with model ${session.params.model}`;

    case '/model':
      if (!args) {
        return 'Usage: /model <model-name>';
      }
      session.params.model = args;
      await saveSession(session);
      return `Model set to ${args}`;

    case '/temperature':
      const tempValidation = validateInput(parseFloat(args), 'number', { min: 0, max: 2 });
      if (!tempValidation.valid) {
        return 'Usage: /temperature <0.0-2.0>';
      }
      session.params.temperature = parseFloat(args);
      await saveSession(session);
      return `Temperature set to ${args}`;

    case '/systemprompt':
      if (!args) {
        return 'Usage: /systemprompt <prompt>';
      }
      session.params.systemPrompt = args;
      await saveSession(session);
      return 'System prompt updated.';

    case '/memory':
      const memValidation = validateInput(parseInt(args, 10), 'number', { min: 1, max: 100 });
      if (!memValidation.valid) {
        return 'Usage: /memory <1-100>';
      }
      session.params.memorySize = parseInt(args, 10);
      await saveSession(session);
      return `Memory size set to ${args}`;

    case '/maxtokens':
      const tokenValidation = validateInput(parseInt(args, 10), 'number', { min: 100, max: 4000 });
      if (!tokenValidation.valid) {
        return 'Usage: /maxtokens <100-4000>';
      }
      session.params.maxTokens = parseInt(args, 10);
      await saveSession(session);
      return `Max tokens set to ${args}`;

    case '/tts':
      const ttsValidation = validateInput(args, 'enum', { allowed: ['on', 'off'] });
      if (!ttsValidation.valid) {
        return 'Usage: /tts <on|off>';
      }
      session.params.ttsEnabled = args === 'on';
      await saveSession(session);
      return `TTS ${args === 'on' ? 'enabled' : 'disabled'}`;

    case '/voiceid':
      if (!args) {
        return 'Usage: /voiceid <id>';
      }
      session.params.voiceId = args;
      await saveSession(session);
      return `Voice ID set to ${args}`;

    case '/save':
      const result = await saveUserDefaults(session.id, session.params);
      if (result.success) {
        return 'Current settings saved as your defaults.';
      } else {
        return `Failed to save defaults: ${result.error}`;
      }

    case '/status':
      return `Session Status:
ID: ${session.id}
Platform: ${session.platform}
State: ${session.state}
History Length: ${session.history.length}
Created: ${new Date(session.createdAt).toISOString()}
Last Activity: ${new Date(session.lastActivity).toISOString()}`;

    default:
      return `Unknown command: ${command}. Type /help for available commands.`;
  }
}

// ============================================================================
// EXPRESS SERVER
// ============================================================================
const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Metrics
const metrics = {
  requests: 0,
  sessions: 0,
  llmCalls: 0,
  ttsCalls: 0,
  sttCalls: 0,
  errors: 0,
  startTime: Date.now()
};

// Health endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
    redis: redis ? 'connected' : 'not configured',
    activeSessions: sessions.size
  };
  res.json(health);
  logger.debug('Health check', health);
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const metricsData = {
    ...metrics,
    uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
    activeSessions: sessions.size,
    timestamp: new Date().toISOString()
  };
  res.json(metricsData);
  logger.debug('Metrics requested', metricsData);
});

// Package download endpoint
app.get('/package', async (req, res) => {
  try {
    logger.info('Package download requested');

    const archive = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=goon-voiceflow.zip');

    archive.pipe(res);

    // Add files
    const filesToInclude = [
      'server.js',
      'package.json',
      'package-lock.json',
      '.env.example',
      'README.md',
      'CLAUDE.md',
      'goon_setup.sh'
    ];

    for (const file of filesToInclude) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: file });
      }
    }

    // Add public directory
    const publicDir = path.join(__dirname, 'public');
    if (fs.existsSync(publicDir)) {
      archive.directory(publicDir, 'public');
    }

    await archive.finalize();
    logger.info('Package download completed');

  } catch (err) {
    logger.error('Package download failed', { error: err.message });
    metrics.errors++;
    res.status(500).json({ error: 'Failed to create package' });
  }
});

// GitHub push endpoint
app.post('/github-push', async (req, res) => {
  try {
    if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
      return res.status(400).json({ error: 'GitHub not configured' });
    }

    logger.info('GitHub push requested');

    const git = simpleGit(__dirname);

    // Configure git
    await git.addConfig('user.name', 'Goon VoiceFlow');
    await git.addConfig('user.email', 'bot@goon-voiceflow.local');

    // Add all changes
    await git.add('.');

    // Commit
    const commitMessage = req.body.message || 'Automated deployment update';
    await git.commit(commitMessage);

    // Push
    const remote = `https://${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPO}.git`;
    await git.push(remote, 'main');

    logger.info('GitHub push successful');
    res.json({ success: true, message: 'Changes pushed to GitHub' });

  } catch (err) {
    logger.error('GitHub push failed', { error: err.message });
    metrics.errors++;
    res.status(500).json({ error: 'Failed to push to GitHub' });
  }
});

// ============================================================================
// WEBSOCKET SERVER
// ============================================================================
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  let sessionId = null;

  logger.info('WebSocket connection established');

  ws.on('message', async (message) => {
    try {
      metrics.requests++;

      const data = JSON.parse(message.toString());

      // Handle session initialization
      if (data.type === 'init') {
        sessionId = data.sessionId || `web_${crypto.randomUUID()}`;

        // Rate limiting
        if (!rateLimiter.isAllowed(sessionId)) {
          ws.send(JSON.stringify({
            type: 'error',
            content: 'Rate limit exceeded. Please wait before sending more messages.'
          }));
          return;
        }

        const session = await loadSession(sessionId);
        metrics.sessions++;

        ws.send(JSON.stringify({
          type: 'sessionId',
          sessionId: session.id
        }));

        // Send consent message if new session
        if (session.state === 'consent') {
          ws.send(JSON.stringify({
            type: 'text',
            content: 'Welcome to Goon VoiceFlow! By using this service, you agree to our terms and conditions. Do you consent to continue? (yes/no)'
          }));
        }

        logger.info('WebSocket session initialized', { sessionId });
        return;
      }

      if (!sessionId) {
        ws.send(JSON.stringify({
          type: 'error',
          content: 'Session not initialized. Please send init message first.'
        }));
        return;
      }

      // Rate limiting
      if (!rateLimiter.isAllowed(sessionId)) {
        ws.send(JSON.stringify({
          type: 'error',
          content: 'Rate limit exceeded. Please wait before sending more messages.'
        }));
        return;
      }

      const session = await loadSession(sessionId);

      // Handle text message
      if (data.type === 'text') {
        const response = await handleInput(session, data.content);

        ws.send(JSON.stringify({
          type: 'text',
          content: response
        }));

        // Send TTS audio if enabled
        if (session.params.ttsEnabled && session.params.voiceId && session.state !== 'consent' && session.state !== 'terminal_unhappy') {
          try {
            metrics.ttsCalls++;
            const audioBuffer = await textToSpeech(response, session.params.voiceId);
            ws.send(JSON.stringify({
              type: 'audio',
              buffer: audioBuffer.toString('base64')
            }));
          } catch (err) {
            logger.error('TTS failed for WebSocket', { sessionId, error: err.message });
            metrics.errors++;
          }
        }
      }

      // Handle audio message
      if (data.type === 'audio') {
        try {
          metrics.sttCalls++;
          const audioBuffer = Buffer.from(data.buffer, 'base64');
          const transcript = await speechToText(audioBuffer);

          const response = await handleInput(session, transcript);

          ws.send(JSON.stringify({
            type: 'text',
            content: `[You said: ${transcript}]\n\n${response}`
          }));

          // Send TTS audio if enabled
          if (session.params.ttsEnabled && session.params.voiceId) {
            try {
              metrics.ttsCalls++;
              const audioBuffer = await textToSpeech(response, session.params.voiceId);
              ws.send(JSON.stringify({
                type: 'audio',
                buffer: audioBuffer.toString('base64')
              }));
            } catch (err) {
              logger.error('TTS failed for WebSocket', { sessionId, error: err.message });
              metrics.errors++;
            }
          }
        } catch (err) {
          logger.error('STT failed for WebSocket', { sessionId, error: err.message });
          metrics.errors++;
          ws.send(JSON.stringify({
            type: 'error',
            content: 'Failed to transcribe audio. Please try again.'
          }));
        }
      }

    } catch (err) {
      logger.error('WebSocket message handling failed', { error: err.message, stack: err.stack });
      metrics.errors++;
      ws.send(JSON.stringify({
        type: 'error',
        content: 'An error occurred. Please try again.'
      }));
    }
  });

  ws.on('close', () => {
    logger.info('WebSocket connection closed', { sessionId });
  });

  ws.on('error', (err) => {
    logger.error('WebSocket error', { sessionId, error: err.message });
    metrics.errors++;
  });
});

// ============================================================================
// TELEGRAM BOT
// ============================================================================
let bot = null;

if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

  // Start command
  bot.start(async (ctx) => {
    try {
      const sessionId = `tg_${ctx.from.id}`;
      const session = await loadSession(sessionId);
      metrics.sessions++;

      if (session.state === 'consent') {
        await ctx.reply(
          'Welcome to Goon VoiceFlow! By using this service, you agree to our terms and conditions. Do you consent to continue? (yes/no)'
        );
      } else {
        await ctx.reply(
          'Welcome back! Type /help for available commands or just start chatting.'
        );
      }

      logger.info('Telegram /start command', { sessionId, userId: ctx.from.id });

    } catch (err) {
      logger.error('Telegram /start failed', { error: err.message, userId: ctx.from?.id });
      metrics.errors++;
      await ctx.reply('An error occurred. Please try again.');
    }
  });

  // Text messages
  bot.on('text', async (ctx) => {
    try {
      metrics.requests++;

      const sessionId = `tg_${ctx.from.id}`;

      // Rate limiting
      if (!rateLimiter.isAllowed(sessionId)) {
        await ctx.reply('Rate limit exceeded. Please wait before sending more messages.');
        return;
      }

      const session = await loadSession(sessionId);
      const response = await handleInput(session, ctx.message.text);

      await ctx.reply(response);

      // Send voice if TTS enabled
      if (session.params.ttsEnabled && session.params.voiceId && session.state !== 'consent' && session.state !== 'terminal_unhappy') {
        try {
          metrics.ttsCalls++;
          const audioBuffer = await textToSpeech(response, session.params.voiceId);
          await ctx.replyWithVoice({ source: audioBuffer });
        } catch (err) {
          logger.error('TTS failed for Telegram', { sessionId, error: err.message });
          metrics.errors++;
        }
      }

      logger.info('Telegram text message processed', { sessionId, userId: ctx.from.id });

    } catch (err) {
      logger.error('Telegram text handler failed', { error: err.message, userId: ctx.from?.id });
      metrics.errors++;
      await ctx.reply('An error occurred. Please try again.');
    }
  });

  // Voice messages
  bot.on('voice', async (ctx) => {
    try {
      metrics.requests++;

      const sessionId = `tg_${ctx.from.id}`;

      // Rate limiting
      if (!rateLimiter.isAllowed(sessionId)) {
        await ctx.reply('Rate limit exceeded. Please wait before sending more messages.');
        return;
      }

      const session = await loadSession(sessionId);

      // Get file
      const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
      const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
      const audioBuffer = Buffer.from(response.data);

      // Transcribe
      metrics.sttCalls++;
      const transcript = await speechToText(audioBuffer);

      // Process
      const textResponse = await handleInput(session, transcript);

      await ctx.reply(`[You said: ${transcript}]\n\n${textResponse}`);

      // Send voice if TTS enabled
      if (session.params.ttsEnabled && session.params.voiceId) {
        try {
          metrics.ttsCalls++;
          const audioBuffer = await textToSpeech(textResponse, session.params.voiceId);
          await ctx.replyWithVoice({ source: audioBuffer });
        } catch (err) {
          logger.error('TTS failed for Telegram voice', { sessionId, error: err.message });
          metrics.errors++;
        }
      }

      logger.info('Telegram voice message processed', { sessionId, userId: ctx.from.id });

    } catch (err) {
      logger.error('Telegram voice handler failed', { error: err.message, userId: ctx.from?.id });
      metrics.errors++;
      await ctx.reply('Failed to process voice message. Please try again.');
    }
  });

  // Launch bot
  bot.launch().then(() => {
    logger.info('Telegram bot launched');
  }).catch((err) => {
    logger.error('Failed to launch Telegram bot', { error: err.message });
  });
} else {
  logger.warn('TELEGRAM_BOT_TOKEN not set, Telegram bot disabled');
}

// ============================================================================
// WEB UI GENERATION
// ============================================================================
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Goon VoiceFlow</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    #app {
      width: 90%;
      max-width: 800px;
      height: 90vh;
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    #header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      text-align: center;
      font-size: 24px;
      font-weight: bold;
    }
    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .message {
      margin-bottom: 15px;
      padding: 12px 16px;
      border-radius: 12px;
      max-width: 80%;
      word-wrap: break-word;
      white-space: pre-wrap;
    }
    .user {
      background: #667eea;
      color: white;
      margin-left: auto;
      text-align: right;
    }
    .assistant {
      background: white;
      color: #333;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .system {
      background: #ffeaa7;
      color: #333;
      text-align: center;
      margin: 0 auto;
      font-style: italic;
    }
    #input-area {
      padding: 20px;
      background: white;
      border-top: 1px solid #e0e0e0;
      display: flex;
      gap: 10px;
    }
    #input {
      flex: 1;
      padding: 12px;
      border: 2px solid #e0e0e0;
      border-radius: 25px;
      font-size: 16px;
      outline: none;
      transition: border-color 0.3s;
    }
    #input:focus {
      border-color: #667eea;
    }
    button {
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 25px;
      font-size: 16px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button:hover {
      transform: scale(1.05);
    }
    button:active {
      transform: scale(0.95);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  </style>
</head>
<body>
  <div id="app">
    <div id="header">Goon VoiceFlow</div>
    <div id="messages"></div>
    <div id="input-area">
      <input type="text" id="input" placeholder="Type your message..." />
      <button id="send">Send</button>
    </div>
  </div>

  <script>
    let ws;
    let sessionId = localStorage.getItem('sessionId');
    const messagesDiv = document.getElementById('messages');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send');

    function addMessage(content, type) {
      const div = document.createElement('div');
      div.className = 'message ' + type;
      div.textContent = content;
      messagesDiv.appendChild(div);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(protocol + '//' + window.location.host);

      ws.onopen = () => {
        console.log('Connected');
        ws.send(JSON.stringify({ type: 'init', sessionId }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'sessionId') {
          sessionId = data.sessionId;
          localStorage.setItem('sessionId', sessionId);
          console.log('Session ID:', sessionId);
        } else if (data.type === 'text') {
          addMessage(data.content, 'assistant');
        } else if (data.type === 'error') {
          addMessage(data.content, 'system');
        } else if (data.type === 'audio') {
          // Handle audio playback
          const audio = new Audio('data:audio/mpeg;base64,' + data.buffer);
          audio.play().catch(err => console.error('Audio playback failed:', err));
        }
      };

      ws.onclose = () => {
        console.log('Disconnected');
        addMessage('Connection lost. Reconnecting...', 'system');
        setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };
    }

    function sendMessage() {
      const text = input.value.trim();
      if (!text) return;

      addMessage(text, 'user');
      ws.send(JSON.stringify({ type: 'text', content: text }));
      input.value = '';
    }

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    connect();
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(publicDir, 'index.html'), htmlContent);
logger.info('WebUI HTML generated');

// ============================================================================
// SESSION CLEANUP
// ============================================================================
setInterval(() => {
  const now = Date.now();
  const timeout = SESSION_TIMEOUT_MINUTES * 60 * 1000;

  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > timeout) {
      deleteSession(sessionId);
      logger.info('Session expired and deleted', { sessionId });
    }
  }

  // Cleanup rate limiter
  rateLimiter.cleanup();

}, 60000); // Run every minute

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, starting graceful shutdown`);

  try {
    // Close WebSocket server
    wss.close(() => {
      logger.info('WebSocket server closed');
    });

    // Stop Telegram bot
    if (bot) {
      bot.stop(signal);
      logger.info('Telegram bot stopped');
    }

    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed');
    });

    // Close Redis connection
    if (redis) {
      await redis.quit();
      logger.info('Redis connection closed');
    }

    logger.info('Graceful shutdown completed');
    process.exit(0);

  } catch (err) {
    logger.error('Error during shutdown', { error: err.message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise
  });
  metrics.errors++;
});

// Uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack
  });
  metrics.errors++;

  // Attempt graceful shutdown
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// ============================================================================
// START SERVER
// ============================================================================
server.listen(PORT, () => {
  logger.info(`Goon VoiceFlow server started`, {
    port: PORT,
    nodeVersion: process.version,
    platform: process.platform,
    pid: process.pid,
    redis: redis ? 'enabled' : 'disabled',
    telegram: bot ? 'enabled' : 'disabled',
    openrouter: LLM_PROVIDERS.openrouter.apiKey ? 'configured' : 'not configured',
    mistral: LLM_PROVIDERS.mistral.apiKey ? 'configured' : 'not configured',
    elevenlabs: process.env.ELEVENLABS_API_KEY ? 'configured' : 'not configured',
    deepgram: process.env.DEEPGRAM_API_KEY ? 'configured' : 'not configured'
  });

  console.log('\n===========================================');
  console.log('🚀 Goon VoiceFlow Server Running');
  console.log('===========================================');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 WebUI: http://localhost:${PORT}`);
  console.log(`💊 Health: http://localhost:${PORT}/health`);
  console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`📦 Package: http://localhost:${PORT}/package`);
  console.log('===========================================\n');
});

module.exports = { app, server, logger, rateLimiter, sessions };
