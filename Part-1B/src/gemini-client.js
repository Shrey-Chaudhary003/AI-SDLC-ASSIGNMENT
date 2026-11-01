'use strict';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function codedError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  if (status !== undefined) {
    error.status = status;
  }
  return error;
}

function createGeminiClient({
  apiKey,
  model,
  fetchImpl,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  timeoutSignal = (milliseconds) => AbortSignal.timeout(milliseconds),
} = {}) {
  if (typeof apiKey !== 'string' || !apiKey || typeof model !== 'string' || !model) {
    throw codedError('CONFIG_ERROR', 'Gemini API key and model are required.');
  }
  if (typeof fetchImpl !== 'function' && typeof globalThis.fetch !== 'function') {
    throw codedError('CONFIG_ERROR', 'A fetch implementation is required.');
  }

  async function generateContent({ systemPrompt, text, nowIso, timezone }) {
    const url = `${ENDPOINT}/${encodeURIComponent(model)}:generateContent`;
    const requestBody = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{
        role: 'user',
        parts: [{
          text: JSON.stringify({ text, nowIso, timezone }),
        }],
      }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    };
    const delays = [1000, 2000];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      let response;
      try {
        response = await (fetchImpl || globalThis.fetch)(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(requestBody),
          signal: timeoutSignal(45_000),
        });
      } catch (cause) {
        const timedOut = cause && (cause.name === 'TimeoutError' || cause.name === 'AbortError');
        throw codedError(
          'SERVICE_ERROR',
          timedOut ? 'The Gemini request timed out.' : 'The Gemini service could not be reached.',
        );
      }

      if (!response.ok) {
        const status = response.status;
        if ((status === 429 || status === 503) && attempt < 2) {
          await sleep(delays[attempt]);
          continue;
        }
        if (status === 429 || status >= 500) {
          throw codedError('SERVICE_ERROR', 'The Gemini service returned an error.', status);
        }
        if (status >= 400) {
          throw codedError('PROVIDER_ERROR', 'Gemini rejected the request.', status);
        }
        throw codedError('SERVICE_ERROR', 'Gemini returned an unsuccessful response.', status);
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw codedError('SERVICE_ERROR', 'Gemini returned an unreadable response.', response.status);
      }

      const modelText = payload &&
        payload.candidates &&
        payload.candidates[0] &&
        payload.candidates[0].content &&
        Array.isArray(payload.candidates[0].content.parts)
        ? payload.candidates[0].content.parts
          .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
          .join('')
        : '';

      if (typeof modelText !== 'string' || !modelText.trim()) {
        throw codedError('INVALID_MODEL_JSON', 'Gemini returned no JSON text.');
      }
      return modelText;
    }

    throw codedError('SERVICE_ERROR', 'The Gemini service returned an error.');
  }

  return { generateContent };
}

module.exports = { createGeminiClient };
