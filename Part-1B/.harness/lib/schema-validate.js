'use strict';

// Small JSON Schema (draft-07 subset) validator so the harness needs no npm install.
// Supported keywords: type (string or array), enum, required, properties,
// additionalProperties:false, pattern, minLength, maxLength, minimum, maximum.
// If you prefer a full validator you may swap this for ajv; the schema.json file stays the same.

function typeOf(value) {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  return typeof value;
}

function matchesType(value, expected) {
  const actual = typeOf(value);
  return actual === expected || (expected === 'number' && actual === 'integer');
}

function validate(value, schema, at = '$') {
  const errors = [];
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowed.some((t) => matchesType(value, t))) {
      errors.push(`${at}: expected type ${allowed.join(' | ')} but got ${typeOf(value)}`);
      return errors;
    }
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${at}: value ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${at}: shorter than minLength ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${at}: longer than maxLength ${schema.maxLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${at}: does not match pattern ${schema.pattern}`);
    }
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${at}: below minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${at}: above maximum ${schema.maximum}`);
    }
  }
  if (typeOf(value) === 'object') {
    for (const key of schema.required || []) {
      if (!(key in value)) {
        errors.push(`${at}: missing required property "${key}"`);
      }
    }
    const properties = schema.properties || {};
    for (const [key, sub] of Object.entries(properties)) {
      if (key in value) {
        errors.push(...validate(value[key], sub, `${at}.${key}`));
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          errors.push(`${at}: unexpected property "${key}"`);
        }
      }
    }
  }
  return errors;
}

module.exports = { validate };
