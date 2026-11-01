'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getConfig } = require('./env');
const { createGeminiClient } = require('./gemini-client');
const { isValidReferenceTime, isValidTimezone, validateOutput } = require('./validate');

const SYSTEM_PROMPT_PATH = path.resolve(__dirname, '..', 'prompts', 'system-prompt.md');
const runtimeConfig = getConfig();
let systemPrompt;
try {
  systemPrompt = fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8');
} catch {
  const error = new Error('The system prompt is missing or unreadable.');
  error.code = 'CONFIG_ERROR';
  throw error;
}

const client = createGeminiClient(runtimeConfig);
const config = {
  provider: runtimeConfig.provider,
  model: runtimeConfig.model,
  temperature: runtimeConfig.temperature,
};

function inputError(message) {
  const error = new Error(message);
  error.code = 'INVALID_REQUEST';
  return error;
}

async function parseReminder(text, nowIso, timezone = 'Asia/Kolkata') {
  if (typeof text !== 'string') {
    throw inputError('text must be a string.');
  }
  if (!isValidReferenceTime(nowIso)) {
    throw inputError('nowIso must be a valid ISO-8601 datetime with an offset.');
  }
  if (!isValidTimezone(timezone)) {
    throw inputError('timezone must be a valid IANA timezone.');
  }

  const raw = await client.generateContent({ systemPrompt, text, nowIso, timezone });
  let output;
  try {
    output = JSON.parse(raw);
  } catch {
    const error = new Error('Gemini returned text that is not valid JSON.');
    error.code = 'INVALID_MODEL_JSON';
    error.raw = raw;
    throw error;
  }

  const validation = validateOutput(output, { nowIso, timezone, promptText: systemPrompt });
  if (!validation.valid) {
    const error = new Error('Gemini output violates the required schema or invariants.');
    error.code = 'INVALID_MODEL_OUTPUT';
    error.raw = raw;
    error.validationErrors = validation.errors;
    throw error;
  }
  return output;
}

module.exports = { parseReminder, config };
