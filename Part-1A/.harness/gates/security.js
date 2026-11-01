'use strict';

// GATE 5 - security / SAST (eslint-plugin-security rules, run over src/ only).
const { runEslint } = require('./lint');

module.exports = {
  name: 'security',
  run(ctx) {
    return runEslint({ ...ctx, name: 'security', configFile: 'eslint.security.config.js', targets: ['src', 'web'] });
  },
};
