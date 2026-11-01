'use strict';

async function main(args = process.argv.slice(2)) {
  const [text, nowIso, timezone] = args;
  if (typeof text !== 'string' || typeof nowIso !== 'string' || typeof timezone !== 'string') {
    process.stderr.write('Usage: node src/cli.js "<text>" "<nowIso-with-offset>" "<IANA-timezone>"\n');
    process.exitCode = 2;
    return;
  }

  try {
    const { parseReminder } = require('./agent');
    const result = await parseReminder(text, nowIso, timezone);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error.code || 'ERROR'}: ${error.code === 'INVALID_MODEL_JSON'
      ? 'The model returned invalid JSON.'
      : error.code === 'INVALID_MODEL_OUTPUT'
        ? 'The model output failed validation.'
        : error.code === 'SERVICE_ERROR'
          ? 'The model service is unavailable.'
          : error.code === 'CONFIG_ERROR'
            ? 'The application is not configured.'
            : 'The request could not be completed.'}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
