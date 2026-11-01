'use strict';

const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
  test: {
    include: ['tests/web.test.jsx'],
    environment: 'jsdom',
    setupFiles: './tests/web.setup.jsx',
    coverage: {
      provider: 'v8',
      include: ['web/**/*.jsx'],
      exclude: ['web/main.jsx'],
      thresholds: { lines: 90 },
    },
  },
});
