'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('./api');
const { createClock } = require('./clock');
const { loadConfig } = require('./config');

function runServer() {
  const config = loadConfig();
  const deps = {
    storagePath: config.storagePath,
    clock: createClock(),
    idFactory: crypto.randomUUID,
  };
  const app = createProductionApp(config, deps);
  return app.listen(config.port, '127.0.0.1', () => {
    process.stdout.write(`Smart Todo API listening on port ${config.port}\n`);
  });
}

function createProductionApp(config, deps) {
  const app = createApp(deps);
  serveFrontend(app, config.staticPath);
  return app;
}

function serveFrontend(app, staticPath) {
  const indexPath = path.join(staticPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return;
  }
  const express = require('express');
  app.use(express.static(staticPath));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(indexPath));
}

module.exports = { createProductionApp, runServer };

if (require.main === module) {
  runServer();
}
