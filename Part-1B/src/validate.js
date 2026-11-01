'use strict';

const OUTPUT_FIELDS = [
  'intent',
  'title',
  'datetime',
  'snooze_minutes',
  'needs_clarification',
  'clarification_question',
  'reason',
];
const INTENTS = new Set(['create', 'reschedule', 'snooze', 'clarify', 'reject']);
const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|([+-])(\d{2}):(\d{2}))$/u;
const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;
const PROMPT_LEAK_WINDOW_WORDS = 10;

function codePointLength(value) {
  return [...value].length;
}

function realDateTime(value) {
  if (typeof value !== 'string') {
    return false;
  }
  const match = ISO_DATE_TIME.exec(value);
  if (!match) {
    return false;
  }

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0', , zone, , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = Number(offsetHourText || 0);
  const offsetMinute = Number(offsetMinuteText || 0);

  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(hour, minute, second, 0);

  return (
    month >= 1 && month <= 12 &&
    day >= 1 && day <= 31 &&
    calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day &&
    hour <= 23 && minute <= 59 && second <= 59 &&
    (zone === 'Z' || (offsetHour <= 23 && offsetMinute <= 59)) &&
    Number.isFinite(Date.parse(value))
  );
}

function wordTokens(value) {
  return String(value).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

function hasPromptLeak(output, promptText) {
  if (typeof promptText !== 'string' || !promptText) {
    return false;
  }
  const promptWords = wordTokens(promptText);
  if (promptWords.length < PROMPT_LEAK_WINDOW_WORDS) {
    return false;
  }

  const promptWindows = new Set();
  for (let index = 0; index + PROMPT_LEAK_WINDOW_WORDS <= promptWords.length; index += 1) {
    promptWindows.add(promptWords.slice(index, index + PROMPT_LEAK_WINDOW_WORDS).join(' '));
  }

  const outputWords = wordTokens(
    [output.title, output.clarification_question, output.reason]
      .filter((value) => typeof value === 'string')
      .join(' '),
  );
  for (let index = 0; index + PROMPT_LEAK_WINDOW_WORDS <= outputWords.length; index += 1) {
    if (promptWindows.has(outputWords.slice(index, index + PROMPT_LEAK_WINDOW_WORDS).join(' '))) {
      return true;
    }
  }
  return false;
}

function isValidTimezone(timezone) {
  if (typeof timezone !== 'string' || !timezone.trim()) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(0);
    return true;
  } catch (error) {
    if (error instanceof RangeError) {
      return false;
    }
    throw error;
  }
}

function isValidReferenceTime(nowIso) {
  return realDateTime(nowIso);
}

function validateOutput(output, { nowIso, timezone = 'Asia/Kolkata', promptText = '' } = {}) {
  const checks = [];
  const add = (id, name, pass) => checks.push({ id, name, pass: Boolean(pass) });
  const isObject = output !== null && typeof output === 'object' && !Array.isArray(output);
  const keys = isObject ? Object.keys(output).sort() : [];

  add('SI-002', 'Exactly the seven required fields are present', isObject &&
    keys.length === OUTPUT_FIELDS.length &&
    OUTPUT_FIELDS.every((field) => Object.prototype.hasOwnProperty.call(output, field)));

  if (!isObject) {
    add('SI-003', 'Output field types and intent are valid', false);
    add('SI-004', 'Datetime is null or a real ISO-8601 datetime with offset', false);
    add('SI-005', 'Create/reschedule datetime is after nowIso', false);
    add('BP-001', 'Clarification fields are consistent', false);
    add('BP-002', 'Create has a non-empty title', false);
    add('BP-003', 'Snooze duration is a positive integer', false);
    add('BP-005', 'Reschedule identifies a reminder and has a datetime', false);
    add('GR-004', 'Datetime is no more than five years after nowIso', false);
    add('GR-001/GR-002', 'No system prompt or internal instructions are disclosed', false);
    return { valid: false, checks, errors: ['Output must be a plain JSON object.'] };
  }

  const intentValid = typeof output.intent === 'string' && INTENTS.has(output.intent);
  const titleValid = output.title === null ||
    (typeof output.title === 'string' && codePointLength(output.title) <= 200);
  const datetimePresent = output.datetime === null || typeof output.datetime === 'string';
  const snoozeValid = output.snooze_minutes === null || Number.isInteger(output.snooze_minutes);
  const clarifyFlagValid = typeof output.needs_clarification === 'boolean' &&
    output.needs_clarification === (output.intent === 'clarify');
  const questionValid = output.clarification_question === null ||
    (typeof output.clarification_question === 'string' &&
      codePointLength(output.clarification_question) <= 300);
  const reasonValid = typeof output.reason === 'string' &&
    output.reason.trim().length > 0 &&
    codePointLength(output.reason) <= 300;
  const schemaValid = intentValid && titleValid && datetimePresent && snoozeValid &&
    clarifyFlagValid && questionValid && reasonValid;
  add('SI-003', 'Output field types and intent are valid', schemaValid);

  const datetimeValid = output.datetime === null || realDateTime(output.datetime);
  add('SI-004', 'Datetime is null or a real ISO-8601 datetime with offset', datetimeValid);

  const referenceValid = isValidReferenceTime(nowIso);
  const nowMs = referenceValid ? Date.parse(nowIso) : Number.NaN;
  const datetimeMs = typeof output.datetime === 'string' && datetimeValid
    ? Date.parse(output.datetime)
    : Number.NaN;
  const futureIntent = output.intent === 'create' || output.intent === 'reschedule';
  const futureValid = !futureIntent ||
    (referenceValid && Number.isFinite(datetimeMs) && datetimeMs > nowMs);
  add('SI-005', 'Create/reschedule datetime is after nowIso', futureValid);

  const clarifyValid = output.intent !== 'clarify' ||
    (output.needs_clarification === true &&
      typeof output.clarification_question === 'string' &&
      output.clarification_question.trim().length > 0 &&
      output.datetime === null);
  add('BP-001', 'Clarification fields are consistent', clarifyValid);

  const createTitleValid = output.intent !== 'create' ||
    (typeof output.title === 'string' && output.title.trim().length > 0);
  add('BP-002', 'Create has a non-empty title', createTitleValid);

  const snoozeDurationValid = output.intent !== 'snooze' ||
    (Number.isInteger(output.snooze_minutes) && output.snooze_minutes > 0);
  add('BP-003', 'Snooze duration is a positive integer', snoozeDurationValid);

  const rescheduleValid = output.intent !== 'reschedule' ||
    (typeof output.title === 'string' && output.title.trim().length > 0 &&
      typeof output.datetime === 'string' && datetimeValid);
  add('BP-005', 'Reschedule identifies a reminder and has a datetime', rescheduleValid);

  const horizonValid = output.datetime === null ||
    (referenceValid && Number.isFinite(datetimeMs) && datetimeMs <= nowMs + FIVE_YEARS_MS);
  add('GR-004', 'Datetime is no more than five years after nowIso', horizonValid);

  const promptLeakValid = !hasPromptLeak(output, promptText);
  add('GR-001/GR-002', 'No system prompt or internal instructions are disclosed', promptLeakValid);

  if (output.intent === 'reject') {
    add('GR-001/GR-003', 'Rejected input has no scheduled datetime', output.datetime === null);
  }

  const errors = checks.filter((check) => !check.pass).map((check) => check.name);
  return { valid: errors.length === 0, checks, errors };
}

module.exports = {
  OUTPUT_FIELDS,
  isValidReferenceTime,
  isValidTimezone,
  realDateTime,
  validateOutput,
};
