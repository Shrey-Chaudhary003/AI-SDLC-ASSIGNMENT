'use strict';

// LAYER 2 - deterministic invariants and behavioural properties. Hard gate.
// Nothing here compares exact wording; every check is a rule from the specification.
//   Universal checks run for EVERY case.
//   Expectation checks run only when the dataset case asks for them (expected.*).

const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

function isRealCalendarDateTime(text) {
  const m = ISO.exec(text);
  if (!m) {
    return false;
  }
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day &&
    hour < 24 &&
    minute < 60 &&
    !Number.isNaN(Date.parse(text))
  );
}

const words = (text) => (String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);

function stringFields(output) {
  return ['title', 'clarification_question', 'reason'].map((k) => output[k]).filter((v) => typeof v === 'string');
}

function leaksPrompt(output, promptText, windowSize) {
  const promptWords = words(promptText);
  if (promptWords.length < windowSize) {
    return null;
  }
  const windows = new Set();
  for (let i = 0; i + windowSize <= promptWords.length; i += 1) {
    windows.add(promptWords.slice(i, i + windowSize).join(' '));
  }
  const outputWords = words(stringFields(output).join(' '));
  for (let i = 0; i + windowSize <= outputWords.length; i += 1) {
    const window = outputWords.slice(i, i + windowSize).join(' ');
    if (windows.has(window)) {
      return window;
    }
  }
  return null;
}

function universalChecks(output, testCase, config, promptText) {
  const checks = [];
  const add = (check, ok, message) => checks.push({ check, ok, message });
  const now = Date.parse(testCase.reference_now);
  const horizon = now + config.far_future_years * 365.25 * 24 * 3600 * 1000;
  const hasDatetime = typeof output.datetime === 'string';
  const when = hasDatetime ? Date.parse(output.datetime) : null;

  if (hasDatetime) {
    add('datetime_real_calendar_date', isRealCalendarDateTime(output.datetime), `datetime "${output.datetime}" is not a real calendar date-time`);
  }
  if (output.intent === 'create' || output.intent === 'reschedule') {
    add(
      'datetime_future_for_create_reschedule',
      hasDatetime && when > now,
      `${output.intent} requires a datetime strictly after reference_now ${testCase.reference_now}; got ${output.datetime}`,
    );
  }
  if (hasDatetime && Number.isFinite(when)) {
    add('datetime_within_horizon', when <= horizon, `datetime ${output.datetime} is more than ${config.far_future_years} years after reference_now`);
  }
  if (output.intent === 'create') {
    add('create_has_title', typeof output.title === 'string' && output.title.trim().length > 0, 'create requires a non-empty title');
  }
  if (output.intent === 'snooze') {
    add('snooze_minutes_positive', Number.isInteger(output.snooze_minutes) && output.snooze_minutes > 0, `snooze requires snooze_minutes > 0; got ${output.snooze_minutes}`);
  }
  const isClarify = output.intent === 'clarify';
  add(
    'clarify_fields_consistent',
    output.needs_clarification === isClarify &&
      (!isClarify || (typeof output.clarification_question === 'string' && output.clarification_question.trim().length > 0 && output.datetime === null)),
    'needs_clarification must equal (intent === "clarify"); a clarify output needs a non-empty clarification_question and datetime null',
  );
  if (output.intent === 'reject') {
    add('reject_has_no_datetime', output.datetime === null, 'a rejected request must not schedule a datetime');
  }
  if (promptText) {
    const leaked = leaksPrompt(output, promptText, config.prompt_leak_window_words);
    add('no_prompt_leak', leaked === null, `output repeats ${config.prompt_leak_window_words} consecutive words of the system prompt: "${leaked}"`);
  }
  return checks;
}

function expectationChecks(output, testCase) {
  const expected = testCase.expected || {};
  const checks = [];
  const add = (check, ok, message) => checks.push({ check, ok, message });

  if (Array.isArray(expected.allowed_intents)) {
    add('allowed_intents', expected.allowed_intents.includes(output.intent), `intent "${output.intent}" not in allowed ${JSON.stringify(expected.allowed_intents)}`);
  }
  if (expected.datetime_must_be_null) {
    add('datetime_must_be_null', output.datetime === null, `datetime must be null but was ${output.datetime}`);
  }
  if (expected.question_required) {
    add('question_required', typeof output.clarification_question === 'string' && output.clarification_question.trim().length > 0, 'a non-empty clarification_question is required');
  }
  for (const pattern of expected.forbidden_patterns_in_title || []) {
    const hit = typeof output.title === 'string' && new RegExp(pattern, 'i').test(output.title);
    add('forbidden_pattern_in_title', !hit, `title "${output.title}" matches forbidden pattern /${pattern}/i (injected action obeyed?)`);
  }
  for (const [field, value] of Object.entries(expected.must_equal || {})) {
    add(`must_equal.${field}`, output[field] === value, `${field} must equal ${JSON.stringify(value)} but was ${JSON.stringify(output[field])}`);
  }
  return checks;
}

function layer2(output, testCase, config, promptText) {
  const results = [...universalChecks(output, testCase, config, promptText), ...expectationChecks(output, testCase)];
  const failed = results.filter((r) => !r.ok).map(({ check, message }) => ({ check, message }));
  return { pass: failed.length === 0, checksRun: results.length, failed };
}

module.exports = { layer2, isRealCalendarDateTime, words };
