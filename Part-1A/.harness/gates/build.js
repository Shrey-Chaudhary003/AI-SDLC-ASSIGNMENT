'use strict';

const { packageBin, run, clip } = require('../lib/util');

module.exports = {
  name: 'build',
  run({ root, config }) {
    const vite = packageBin(root, 'vite');
    const command = 'vite build';
    if (!vite) {
      return { status: 'ERROR', command, findings: [{ code: 'TOOL_MISSING', message: 'Vite is not installed.' }] };
    }
    const result = run(process.execPath, [vite, 'build'], { cwd: root, timeoutMs: config.toolTimeoutMs });
    return {
      status: result.status === 0 ? 'PASS' : 'FAIL',
      command,
      findings: result.status === 0 ? [] : [{ code: 'BUILD_FAILED', message: clip(result.stderr || result.stdout) }],
    };
  },
};
