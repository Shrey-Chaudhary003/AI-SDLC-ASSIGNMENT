'use strict';

function createClock() {
  return () => new Date();
}

module.exports = { createClock };
