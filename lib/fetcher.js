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
const kafkaLib = require('@waldo/node-kafka');
const middlewarify = require('middlewarify');
const jwt = require('jsonwebtoken');

const kafkaLocal = require('../../kafka/');

const Validate = require('./validate');
const InitFetcher = require('./init-fetcher');

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
 *
 * @param {Object} opts Options to setup the instance.
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
 * Master handler for incoming SQS job items.
 *
 * @param {Object} message Job item message as transported from kafka.
 * @return {Promise} A Promise.
 * @private
 */
fetcher.Fetcher.prototype._processMessage = Promise.method(function (message) {

  this.emit('messageReceived', message);

  let uid = null;

  const context = {
    message: message,
    uid: uid,
    self: this,
  };

  if (this.opts.hasUser) {
    uid = context.uid = this.parseUserId(message, this.opts.credentialsKey);
    if (!uid) {
      let err = new Error('UserId could not be extracted from message');
      err.code = 104;
      return this._handleError.call(context, err);
    }
  }

  return this._process(uid, message)
    .bind(context)
    .then(this._produceKafkaMessage)
    .catch(this._handleError);
});

/**
 * Safely extract the user id from a kafka message, expecting it to be
 * in the 'viewer' namespace.
 *
 * @param {Object} message The value of the kafka message.
 * @param {string} credentialsKey The key where we expect the credentials to reside
 *   this is a root key of the kafka value.
 * @return {string|null} The uuid or null if not found.
 */
fetcher.Fetcher.prototype.parseUserId = function (message, credentialsKey) {
  if (!message ||
    !message[credentialsKey] ||
    !message[credentialsKey].credentials ||
    !message[credentialsKey].credentials['waldo.v1.event.Jwt'] ||
    !message[credentialsKey].credentials['waldo.v1.event.Jwt'].base64) {

    this.opts.log.warn('Fetcher.parseUserId() :: Bogus viewer provided for topic:',
      this.opts.topic, 'Message raw:', message);

    return null;
  }

  let jwtToken = message[credentialsKey].credentials['waldo.v1.event.Jwt'].base64;

  let userData = jwt.decode(jwtToken);

  if (!userData || !userData['account_id']) {
    this.opts.log.warn('Fetcher.parseUserId() :: Bogus JWT token provided for',
      'topic:', this.opts.topic, 'jwtToken:', jwtToken, 'parsed:', userData);
    return null;
  }

  return userData['account_id'];
};

/**
 * Produce the kafka message on topic InputDropboxSyncJob.
 *
 * @param {Object} message The message to dispath to kafka.
 * @return {Promise}
 * @private
 * @this {custom} Custom context.
 */
fetcher.Fetcher.prototype._produceKafkaMessage = Promise.method(function (message) {
  if (!this.self.opts.produceKafka) {
    // nothing to do here, move on...
    return;
  }

  const producer = new kafkaLib.Producer({
    topic: this.self.opts.topic,
    schema: this.self.opts.schema,
    keySchema: { type: 'string' },
    log: this.self.opts.log,
  });

  const key = message[this.self.opts.keyAttribute];

  return producer.produce({
    key: key,
    value: message,
  })
    .then(() => {

    })
    .catch((err) => {
      this.self.opts.log.error('Fetcher._produceKafkaMessage() :: Error on topic:',
        this.self.opts.topic, 'Error:', err);

      this.self.emit('produceError', err);

    });
});

/**
 * Produce kafka error message for Tree Search.
 *
 * @param {Error} error The error that occured.
 * @return {Promise} A Promise.
 * @private
 * @this {custom} Custom context.
 */
fetcher.Fetcher.prototype._produceKafkaErrorMessage = Promise.method(function (error) {
  let newMessage = {
    viewer: this.message.viewer,
    jobId: this.message.jobId,
    source: this.message.source,
    dropboxId: this.message.dropboxId,
    name: this.message.name,
    'path_display': this.message['path_display'],
    errorMessage: error.message,
    errorCode: error.code,
  };

  const producer = new kafkaLib.Producer({
    topic: kafkaLocal.Topic.SYNC_DOWNLOAD_ERROR,
    schema: kafkaLocal.Schema.SYNC_DOWNLOAD_ERROR,
    keySchema: { type: 'string' },
    log: log,
  });

  return producer.produce({
    key: this.message.dropboxId,
    value: newMessage,
  })
    .then(() => {
      log.info('workers.syncDownload.JobFetch._produceKafkaErrorMessage() Error',
        'message produced. Code:', error.code, 'Message:', error.message);
    })
    .catch(function(err) {
      log.error('workers.syncDownload.JobFetch._produceKafkaErrorMessage() ::',
        ' Error:', err);

      // Kafka down, force SQS to re-run this operation
      throw err;
    });
});

/**
 * Master error handler, will dispatch new error type kafka message or fail
 * the SQS job.
 *
 * @param {Error} error The thrown error.
 * @return {Promise} A Promise.
 * @private
 * @this {custom} Custom context.
 */
fetcher.Fetcher.prototype._handleError = Promise.method(function (error) {
  if (error.code) {
    // Unresolvable error, produce kafka message on the error topic.
    return this.self._produceKafkaErrorMessage.call(this, error);
  }
  log.warn('workers.syncDownload.JobFetch._handleError() :: Recoverable error',
    'occured, will fail SQS job to retry. Error:', error);

  throw error;
});
