'use strict';

// LAYER 3 - semantic / quality score in [0, 1]. Formula and threshold come from eval-config.json,
// which must equal the "Evaluation Threshold" section of the specification.
//   score = w.datetime_match * datetime_match
//         + w.title_similarity * title_similarity
//         + w.intent_correct  * intent_correct
const { words } = require('./layer2');

function tokens(text, stopwords) {
  return new Set(words(text).filter((w) => !stopwords.has(w)));
}

function tokenF1(actual, expected) {
  if (actual.size === 0 && expected.size === 0) {
    return 1;
  }
  const overlap = [...actual].filter((t) => expected.has(t)).length;
  if (overlap === 0) {
    return 0;
  }
  const precision = overlap / actual.size;
  const recall = overlap / expected.size;
  return (2 * precision * recall) / (precision + recall);
}

function datetimeMatch(output, expected, config) {
  const has = typeof output.datetime === 'string';
  if (typeof expected.datetime === 'string') {
    const diffMinutes = has ? Math.abs(Date.parse(output.datetime) - Date.parse(expected.datetime)) / 60000 : Infinity;
    return diffMinutes <= config.datetime_tolerance_minutes ? 1 : 0;
  }
  if (expected.datetime_optional) {
    return 1;
  }
  return output.datetime === null ? 1 : 0;
}

function titleSimilarity(output, expected, config) {
  const stopwords = new Set(config.title_stopwords);
  const hasTitle = typeof output.title === 'string' && output.title.trim().length > 0;
  if (typeof expected.title === 'string') {
    if (!hasTitle) {
      return 0;
    }
    const actual = tokens(output.title, stopwords);
    if (Array.isArray(expected.title_keywords) && expected.title_keywords.length > 0) {
      const covered = expected.title_keywords.every((k) => actual.has(String(k).toLowerCase()));
      if (covered) {
        return 1;
      }
    }
    return tokenF1(actual, tokens(expected.title, stopwords));
  }
  if (expected.title_optional) {
    return 1;
  }
  return hasTitle ? 0 : 1;
}

function intentCorrect(output, expected) {
  if (Array.isArray(expected.allowed_intents)) {
    return expected.allowed_intents.includes(output.intent) ? 1 : 0;
  }
  return output.intent === expected.intent ? 1 : 0;
}

function layer3(output, testCase, config) {
  const expected = testCase.expected;
  const components = {
    datetime_match: datetimeMatch(output, expected, config),
    title_similarity: Number(titleSimilarity(output, expected, config).toFixed(4)),
    intent_correct: intentCorrect(output, expected),
  };
  const w = config.weights;
  const score = w.datetime_match * components.datetime_match + w.title_similarity * components.title_similarity + w.intent_correct * components.intent_correct;
  return { score: Number(score.toFixed(4)), components };
}

module.exports = { layer3, tokenF1 };
