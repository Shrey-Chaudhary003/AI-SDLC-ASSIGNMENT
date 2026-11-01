'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { isValidReferenceTime, isValidTimezone, validateOutput } = require('./validate');

const MAX_BODY_BYTES = 10 * 1024;
const MAX_TEXT_CODE_POINTS = 8000;
const PROMPT_LEAK_WINDOW_WORDS = 10;
const SYSTEM_PROMPT_PATH = path.resolve(__dirname, '..', 'prompts', 'system-prompt.md');
const FRONTEND_PATH = path.resolve(__dirname, 'public', 'index.html');

function requestError(message) {
  const error = new Error(message);
  error.code = 'INVALID_REQUEST';
  return error;
}

function safeConfigError(message) {
  const error = new Error(message);
  error.code = 'CONFIG_ERROR';
  return error;
}

function readStaticFile(filePath, description) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    throw safeConfigError(`The ${description} is missing or unreadable.`);
  }
}

function validPort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw safeConfigError('PORT must be an integer from 1 to 65535.');
  }
  return port;
}

function parseRequestBody(rawBody) {
  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw requestError('Request body must be valid JSON.');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw requestError('Request body must be a JSON object.');
  }
  if (Object.keys(body).some((key) => !['text', 'nowIso', 'timezone'].includes(key))) {
    throw requestError('Request body contains unsupported fields.');
  }
  if (typeof body.text !== 'string') {
    throw requestError('text must be a string.');
  }
  if ([...body.text].length > MAX_TEXT_CODE_POINTS) {
    throw requestError('text must not exceed 8000 Unicode code points.');
  }

  const timezone = body.timezone === undefined ? 'Asia/Kolkata' : body.timezone;
  if (!isValidTimezone(timezone)) {
    throw requestError('timezone must be a valid IANA timezone.');
  }
  if (body.nowIso !== undefined && !isValidReferenceTime(body.nowIso)) {
    throw requestError('nowIso must be a valid ISO-8601 datetime with an offset.');
  }

  return { text: body.text, nowIso: body.nowIso, timezone };
}

async function readBody(request) {
  const chunks = [];
  let totalBytes = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      tooLarge = true;
    } else {
      chunks.push(chunk);
    }
  }
  if (tooLarge) {
    throw requestError('Request body must not exceed 10 KB.');
  }
  return Buffer.concat(chunks).toString('utf8');
}

function wordTokens(value) {
  return String(value).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

function containsPromptText(raw, promptText) {
  const sourceWords = wordTokens(promptText);
  const rawWords = wordTokens(raw);
  if (sourceWords.length < PROMPT_LEAK_WINDOW_WORDS) {
    return false;
  }
  const sourceWindows = new Set();
  for (let index = 0; index + PROMPT_LEAK_WINDOW_WORDS <= sourceWords.length; index += 1) {
    sourceWindows.add(sourceWords.slice(index, index + PROMPT_LEAK_WINDOW_WORDS).join(' '));
  }
  for (let index = 0; index + PROMPT_LEAK_WINDOW_WORDS <= rawWords.length; index += 1) {
    if (sourceWindows.has(rawWords.slice(index, index + PROMPT_LEAK_WINDOW_WORDS).join(' '))) {
      return true;
    }
  }
  return false;
}

function redactRaw(raw, { promptText, apiKey }) {
  let safeRaw = typeof raw === 'string' ? raw : '';
  if (containsPromptText(safeRaw, promptText)) {
    return '[redacted]';
  }
  if (apiKey) {
    safeRaw = safeRaw.split(apiKey).join('[redacted]');
  }
  return safeRaw;
}

function errorResponse(error, context) {
  const code = error && error.code;
  if (code === 'INVALID_REQUEST') {
    return { status: 400, body: { error: { code, message: error.message } } };
  }
  if (code === 'INVALID_MODEL_JSON' || code === 'INVALID_MODEL_OUTPUT') {
    return {
      status: 502,
      body: {
        error: {
          code,
          message: code === 'INVALID_MODEL_JSON'
            ? 'The model returned invalid JSON.'
            : 'The model output failed validation.',
          raw: redactRaw(error.raw, context),
        },
      },
    };
  }
  if (code === 'PROVIDER_ERROR') {
    return { status: 502, body: { error: { code, message: 'The model provider rejected the request.' } } };
  }
  if (code === 'SERVICE_ERROR') {
    return { status: 503, body: { error: { code, message: 'The model service is temporarily unavailable.' } } };
  }
  if (code === 'CONFIG_ERROR') {
    return { status: 500, body: { error: { code, message: 'The server is not configured.' } } };
  }
  return { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } } };
}

function currentIsoWithOffset() {
  const now = new Date();
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  const offset = `${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.` +
    `${pad(now.getMilliseconds(), 3)}${offset}`;
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

function createServer(options = {}) {
  let parseReminder = options.parseReminder;
  let config = options.config;
  if (typeof parseReminder !== 'function' || !config) {
    const agent = require('./agent');
    parseReminder = parseReminder || agent.parseReminder;
    config = config || agent.config;
  }
  if (!config || typeof config.provider !== 'string' || typeof config.model !== 'string') {
    throw safeConfigError('The provider configuration is unavailable.');
  }

  const promptText = options.promptText === undefined
    ? readStaticFile(SYSTEM_PROMPT_PATH, 'system prompt')
    : options.promptText;
  const html = options.html === undefined
    ? readStaticFile(FRONTEND_PATH, 'frontend')
    : options.html;
  const apiKey = options.apiKey === undefined ? process.env.GEMINI_API_KEY : options.apiKey;
  const nowProvider = options.nowProvider || currentIsoWithOffset;

  return http.createServer(async (request, response) => {
    let pathname;
    try {
      pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    } catch {
      sendJson(response, 400, { error: { code: 'INVALID_REQUEST', message: 'Invalid request URL.' } });
      return;
    }

    if (request.method === 'GET' && pathname === '/') {
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': Buffer.byteLength(html),
        'cache-control': 'no-store',
      });
      response.end(html);
      return;
    }

    if (request.method === 'GET' && pathname === '/api/health') {
      sendJson(response, 200, { status: 'ok', provider: config.provider, model: config.model });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/parse') {
      try {
        const contentType = (request.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
        if (contentType !== 'application/json') {
          throw requestError('Content-Type must be application/json.');
        }
        const parsed = parseRequestBody(await readBody(request));
        const nowIso = parsed.nowIso === undefined ? nowProvider() : parsed.nowIso;
        if (!isValidReferenceTime(nowIso)) {
          throw requestError('nowIso must be a valid ISO-8601 datetime with an offset.');
        }

        const startedAt = performance.now();
        const result = await parseReminder(parsed.text, nowIso, parsed.timezone);
        const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
        const validation = validateOutput(result, {
          nowIso,
          timezone: parsed.timezone,
          promptText,
        });
        if (!validation.valid) {
          const error = new Error('Model output failed deterministic validation.');
          error.code = 'INVALID_MODEL_OUTPUT';
          error.raw = JSON.stringify(result);
          throw error;
        }

        sendJson(response, 200, {
          result,
          meta: {
            provider: config.provider,
            model: config.model,
            latencyMs,
            nowIso,
            timezone: parsed.timezone,
          },
          checks: validation.checks,
        });
      } catch (error) {
        const mapped = errorResponse(error, { promptText, apiKey });
        sendJson(response, mapped.status, mapped.body);
      }
      return;
    }

    sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
  });
}

function startServer({ port = process.env.PORT } = {}) {
  const server = createServer();
  const selectedPort = port === undefined || port === '' ? 3000 : validPort(port);
  server.listen(selectedPort, '127.0.0.1');
  return server;
}

if (require.main === module) {
  try {
    const server = startServer();
    server.on('listening', () => {
      const address = server.address();
      process.stdout.write(`Reminder Agent listening on 127.0.0.1:${address.port}\n`);
    });
    server.on('error', (error) => {
      process.stderr.write(`Server error: ${error.code || 'SERVER_ERROR'}\n`);
      process.exitCode = 1;
    });
  } catch (error) {
    process.stderr.write(`Server startup failed: ${error.code || 'SERVER_ERROR'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  createServer,
  currentIsoWithOffset,
  errorResponse,
  parseRequestBody,
  startServer,
};
