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
  if (typeof opts.schema !== 'object') {
    throw new TypeError('"schema" must be defined');
  }
  if (typeof opts.process !== 'function') {
    throw new TypeError('"process" must be defined');
  }

  // Check logger is proper
  if (typeof opts.log !== 'object') {
    throw new TypeError('"log" is required');
  }

  if (typeof opts.log.info !== 'function' ||
    typeof opts.log.warn !== 'function' ||
    typeof opts.log.error !== 'function') {

    throw new TypeError('"topic" must have methods: info, warn, error');
  }


  // Check if user credentials enabled
  if (opts.hasUser) {
    if (typeof opts.credentialsKey !== 'string' || !opts.credentialsKey.length) {
      throw new TypeError('"credentialsKey" must be defined');
    }
  }

  // Check for SQS
  if (opts.hasSqs) {
    if (typeof opts.sqsUrl !== 'string' || !opts.sqsUrl.length) {
      throw new TypeError('"sqsUrl" must be defined');
    }
    if (typeof opts.concurrentOpsLimit !== 'number') {
      throw new TypeError('"concurrentOpsLimit" must be defined');
    }
  }

  if (opts.produceKafka) {
    if (typeof opts.topicProduce !== 'string' || !opts.topicProduce.length) {
      throw new TypeError('"topicProduce" must be defined');
    }
    if (typeof opts.schemaProduce !== 'object') {
      throw new TypeError('"schemaProduce" must be defined');
    }
    if (typeof opts.keyAttribute !== 'string' || !opts.keyAttribute.length) {
      throw new TypeError('"keyAttribute" must be defined');
    }
  }

  if (opts.produceErrorMessage) {
    if (typeof opts.topicProduceError !== 'string' || !opts.topicProduceError.length) {
      throw new TypeError('"topicProduceError" must be defined');
    }
    if (typeof opts.schemaProduceError !== 'object') {
      throw new TypeError('"schemaProduceError" must be defined');
    }
    if (typeof opts.keyAttributeError !== 'string' || !opts.keyAttributeError.length) {
      throw new TypeError('"keyAttributeError" must be defined');
    }
    if (typeof opts.generateErrorMessage !== 'function') {
      throw new TypeError('"generateErrorMessage" must be defined');
    }
  }
};
