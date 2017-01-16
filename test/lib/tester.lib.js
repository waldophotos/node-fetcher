/*
 * @fileOverview Main testing helper lib.
 */

const kafkaLib = require('@waldo/node-kafka');
const kafkaStub = require('@waldo/node-kafka-stub')(kafkaLib);

let booted = false;

var testLib = module.exports = {};

testLib.ALBUM_ID = '02a2b2b5-e765-4785-8ce4-ca7233e0796b';

testLib.kafkaStub = kafkaStub;

testLib.init = function() {
  beforeEach(function() {
    if (booted) {
      return;
    }
    booted = true;

    testLib.kafkaStub.stub();
  });

  beforeEach(function() {
    testLib.kafkaStub.reset();
  });
};

/** @type {Object} simple logger */
testLib.log = {
  info: function() {
    let args = Array.prototype.splice.call(arguments, 0);
    console.log('INFO:', args.join(' '));
  },
  warn: function() {
    let args = Array.prototype.splice.call(arguments, 0);
    console.log('WARN:', args.join(' '));
  },
  error: function() {
    let args = Array.prototype.splice.call(arguments, 0);
    console.log('ERROR:', args.join(' '));
  },
};

/**
 * Have a Cooldown period between tests.
 *
 * @param {number} seconds cooldown in seconds.
 * @return {Function} use is beforeEach().
 */
testLib.cooldown = function(seconds) {
  return function(done) {
    setTimeout(done, seconds);
  };
};
