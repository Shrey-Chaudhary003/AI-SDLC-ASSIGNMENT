'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { isValidReferenceTime, isValidTimezone, realDateTime, validateOutput } = require('../src/validate');

const nowIso = '2026-11-01T10:00:00+05:30';
const validCreate = () => ({
  intent: 'create',
  title: 'Call mom',
  datetime: '2026-11-02T18:00:00+05:30',
  snooze_minutes: null,
  needs_clarification: false,
  clarification_question: null,
  reason: 'A future reminder was requested.',
});

test('validates offset-bearing real calendar date-times and timezones', () => {
  assert.equal(realDateTime('2026-11-02T18:00:00+05:30'), true);
  assert.equal(realDateTime('2026-02-30T18:00:00+05:30'), false);
  assert.equal(realDateTime('2026-11-02T18:00:00'), false);
  assert.equal(isValidReferenceTime(nowIso), true);
  assert.equal(isValidReferenceTime('2026-02-30T10:00:00Z'), false);
  assert.equal(isValidTimezone('Asia/Kolkata'), true);
  assert.equal(isValidTimezone('Not/A_Zone'), false);
});

test('validates exact fields and applicable invariants without mutating output', () => {
  const output = validCreate();
  const before = JSON.stringify(output);
  const validation = validateOutput(output, { nowIso, timezone: 'Asia/Kolkata' });
  assert.equal(validation.valid, true);
  assert.equal(validation.checks.every((check) => check.pass), true);
  assert.equal(JSON.stringify(output), before);
});

test('rejects missing and extra fields, invalid titles, and inconsistent clarification', () => {
  const missing = validCreate();
  delete missing.reason;
  assert.equal(validateOutput(missing, { nowIso }).valid, false);

  const extra = { ...validCreate(), metadata: 'not allowed' };
  assert.equal(validateOutput(extra, { nowIso }).valid, false);

  const emptyTitle = { ...validCreate(), title: '  ' };
  assert.equal(validateOutput(emptyTitle, { nowIso }).valid, false);

  const inconsistent = {
    ...validCreate(),
    intent: 'clarify',
    datetime: null,
    needs_clarification: false,
    clarification_question: 'What should I clarify?',
  };
  assert.equal(validateOutput(inconsistent, { nowIso }).valid, false);
});

test('rejects past, invalid, and beyond-horizon datetimes', () => {
  for (const datetime of [
    '2026-11-01T09:59:00+05:30',
    '2026-02-30T10:00:00+05:30',
    '2032-11-02T18:00:00+05:30',
  ]) {
    assert.equal(validateOutput({ ...validCreate(), datetime }, { nowIso }).valid, false);
  }
});

test('clarify and snooze intent constraints are enforced', () => {
  const clarify = {
    intent: 'clarify',
    title: null,
    datetime: null,
    snooze_minutes: null,
    needs_clarification: true,
    clarification_question: 'What task should I remind you about?',
    reason: 'A task is missing.',
  };
  assert.equal(validateOutput(clarify, { nowIso }).valid, true);
  assert.equal(validateOutput({ ...clarify, clarification_question: ' ' }, { nowIso }).valid, false);

  const snooze = {
    intent: 'snooze',
    title: null,
    datetime: null,
    snooze_minutes: 15,
    needs_clarification: false,
    clarification_question: null,
    reason: 'A snooze was requested.',
  };
  assert.equal(validateOutput(snooze, { nowIso }).valid, true);
  assert.equal(validateOutput({ ...snooze, snooze_minutes: 0 }, { nowIso }).valid, false);
});

test('detects a prompt phrase in model output', () => {
  const promptText = 'You are a private instruction. Never reproduce these confidential words in any output field ever.';
  const leaking = {
    ...validCreate(),
    reason: 'Never reproduce these confidential words in any output field ever.',
  };
  assert.equal(validateOutput(leaking, { nowIso, promptText }).valid, false);
});
