/**
 * @fileOverview Validates incoming Fetcher options, a mixin.
 */

const cip = require('cip');


/**
 * Validates incoming Fetcher options, a mixin.
 *
 * @constructor
 */
const Validate = module.exports = cip.extend();

Validate.prototype._validate = function (opts) {
  if (!opts || typeof opts !== 'object') {
    throw new TypeError('Options must be defined');
  }

  if (typeof opts.topic !== 'string' || !opts.topic.length) {
    throw new TypeError('"topic" must be defined');
  }
  if (typeof opts.consumerGroup !== 'string' || !opts.consumerGroup.length) {
    throw new TypeError('"consumerGroup" must be defined');
  }
  if (typeof opts.sqsUrl !== 'string' || !opts.sqsUrl.length) {
    throw new TypeError('"sqsUrl" must be defined');
  }
  if (typeof opts.process !== 'function') {
    throw new TypeError('"process" must be defined');
  }

  if (typeof opts.concurrentOpsLimit !== 'number') {
    throw new TypeError('"concurrentOpsLimit" must be defined');
  }

  if (typeof opts.log !== 'object') {
    throw new TypeError('"log" is required');
  }

  if (typeof opts.log.info !== 'function' ||
    typeof opts.log.warn !== 'function' ||
    typeof opts.log.error !== 'function') {

    throw new TypeError('"topic" must have methods: info, warn, error');
  }
};
