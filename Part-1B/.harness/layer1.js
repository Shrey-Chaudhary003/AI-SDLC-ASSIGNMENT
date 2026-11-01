'use strict';

// LAYER 1 - structural validation: the output must be a JSON object that satisfies schema.json
// (required fields, types, enumerations, datetime shape, no extra fields). Hard gate.
const { validate } = require('./lib/schema-validate');

function layer1(output, schema) {
  if (output === null || typeof output !== 'object' || Array.isArray(output)) {
    return { pass: false, errors: ['$: output is not a single JSON object'] };
  }
  const errors = validate(output, schema);
  return { pass: errors.length === 0, errors };
}

module.exports = { layer1 };
