/*
 * Fetcher
 * Your Job or Message fetching paradise, with sugar on top.
 * https://github.com/waldo/node-fetcher
 *
 * Copyright © Waldo, Inc.
 * All rights reserved.
 */

/**
 * @fileOverview Fetches kafka messages or SQS jobs alike.
 */
const EventEmitter = require('events').EventEmitter;

const cip = require('cip');
const Promise = require('bluebird');
const middlewarify = require('middlewarify');

const Validate = require('./validate');
const InitFetcher = require('./init-fetcher');
const MessageProcess = require('./process');

const CeventEmitter = cip.cast(EventEmitter);

/**
 * Main exposed method, bootstraps Fetcher Ctor and initializes it.
 *
 * @param {Object} opts Options for the fetcher.
 * @return {Promise} A Promise.
 */
const fetcher = module.exports = function(opts) {
  const fetcherInst = new fetcher.Fetcher(opts);

  return fetcherInst.init();
};

/**
 * Module responsible for fetching Tree Search jobs to process.
 *
 * @event `messageReceived` Emitted the moment a message has been received and
 *   before processing starts.
 *   @param {string|null} uid The user id if set.
 *   @param {Object} message The message received.
 * @event `processed` Emitted right after the message finished processing.
 *   @param {Object} response The response as returned from the user processing.
 * @event `produce` The processing response has been produced as a kafka message.
 *   @param {Object} produceMessage The raw message as sent to the kafka produce method including
 *     the partioning key.
 * @event `produceError` An error occured in kafka produce of the outcome,
 *   to get this event you need to enable the `produceKafka` option.
 *   @param {Error} error The error that occured.
 * @event `errorProduceError` Emitted when the production of a message on an
 *   error topic fails, to get this event you need to enable
 *   the `produceErrorMessage` option.
 *   @param {Error} error The error that occured.
 * @event `errorProduced` The kafka error message has been produced.
 *   @param {Object} produceMessage The raw message as sent to the kafka produce method including
 *     the partioning key.
 *
 * @param {Object} opts Options to setup the instance.
 *   @param {string} topic The topic to consume kafka messages on.
 *   @param {string} consumerGroup The group of the consumer.
 *   @param {Object} schema The kafka schema of the consumer.
 *   @param {Function} process The master processing method, must return a
 *     promise.
 *   @param {boolean=} hasUser If the consumer message has credentials with
 *     the userid encoded inside.
 *   @param {string=} credentialsKey The root attribute on which the credentials
 *     are stored, required if `hasUser` is enabled.
 *   @param {boolean=} hasSqs Set to true if you want to activate kafka-to-sqs.
 *   @param {string=} sqsUrl SQS Url, required if `hasSqs` is enabled.
 *   @param {number=} concurrentOpsLimit SQS concurrent operations,
 *     required if `hasSqs` is enabled.
 *   @param {boolean=} produceErrorMessage Produce a kafka error message on op fail.
 *   @param {Function=} generateErrorMessage Generates the kafka error message,
 *     required if `produceErrorMessage` is true.
 *   @param {string=} errorTopic Define the error topic, required if
 *     `produceErrorMessage` is true.
 *   @param {Object=} errorSchema Define the error schema, required if
 *     `produceErrorMessage` is true.
 *   @param {string=} errorKeyAttribute An attribute from the inbound message
 *     to use as partioning key, required if `produceErrorMessage` is true.
 *   @param {boolean=} produceKafka Produce a kafka message upon completion.
 *   @param {string=} topicProduce The topic to produce kafka messages on.
 *   @param {Object=} schemaProduce The kafka schema of the producer.
 *   @param {string=} keyAttribute Define the key attribute in the response
 *     schema to use as the kafka key for partioning.
 *   @param {boolean=} produceErrorMessage Produce a kafka message in case
 *     processing fails.
 *   @param {string=} topicProduceError The topic to produce kafka messages on.
 *   @param {Object=} schemaProduceError The kafka schema of the producer.
 *   @param {string=} keyAttributeError Define the key attribute in the response
 *     schema to use as the kafka key for partioning.
 *   @param {Function=} generateErrorMessage A synchronous method that returns
 *     the correct payload to send as a kafka error message, required if
 *     `produceErrorMessage` is enabled.
 * @constructor
 * @extends {events.EventEmitter}
 */
fetcher.Fetcher = CeventEmitter.extend(function(opts) {
  this._validate(opts);

  /** @type {Object} User options. */
  this.opts = opts;

  // Create a before/after middleware wrapper around the user's process method
  // https://github.com/thanpolas/middlewarify#using-the-before--after--last-middleware-types
  middlewarify.make(this, '_process', this.opts.process, {beforeAfter: true});

  // expose the before/after methods.
  this.before = this._process.before;
  this.after = this._process.after;

  /** @type {?waldo/sqs} sqs service instance. */
  this.sqs = null;

  /** @type {?waldo/kafka-to-sqs} Kafka to SQS service instance. */
  this.kafkaToSqs = null;
});

// Add mixins
fetcher.Fetcher.mixin(Validate);
fetcher.Fetcher.mixin(InitFetcher);

/**
 * Handler for incoming messages, boots up the processor.
 *
 * @param {Object} message Job item message as transported from kafka.
 * @return {Promise} A Promise.
 * @private
 */
fetcher.Fetcher.prototype._processMessage = Promise.method(function(message) {
  const messageProcess = new MessageProcess(this);

  return messageProcess.process(message);
});
