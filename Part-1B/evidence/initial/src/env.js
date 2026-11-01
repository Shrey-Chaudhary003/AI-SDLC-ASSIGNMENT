'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');
const CONFIG_KEYS = ['GEMINI_API_KEY', 'LLM_MODEL'];

function loadEnv(filePath = ENV_FILE, env = process.env) {
  let contents;
  try {
    contents = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return env;
    }
    throw error;
  }

  for (const sourceLine of contents.split(/\r?\n/u)) {
    const line = sourceLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const name = line.slice(0, separator).trim();
    if (!CONFIG_KEYS.includes(name) || env[name] !== undefined) {
      continue;
    }

    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    if (value) {
      env[name] = value;
    }
  }

  return env;
}

function getConfig({ filePath = ENV_FILE, env = process.env } = {}) {
  loadEnv(filePath, env);
  const missing = CONFIG_KEYS.filter((key) => typeof env[key] !== 'string' || !env[key].trim());
  if (missing.length > 0) {
    const error = new Error(`Missing required configuration: ${missing.join(', ')}`);
    error.code = 'CONFIG_ERROR';
    throw error;
  }

  return {
    provider: 'gemini',
    model: env.LLM_MODEL.trim(),
    apiKey: env.GEMINI_API_KEY,
    temperature: 0.1,
  };
}

module.exports = { ENV_FILE, getConfig, loadEnv };
