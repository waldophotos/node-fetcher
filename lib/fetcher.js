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

const cip = require('cip');
const Promise = require('bluebird');
const kafkaLib = require('@waldo/node-kafka');
const sqsLib = require('@waldo/sqs');
const KafkaToSqs = require('@waldo/kafka-to-sqs');

const JobProcess = require('./job-process');
const kafkaLocal = require('../../kafka/');
const workerHelpers = require('../worker-helpers');
const log = require('../../util/logger');
const config = require('../../util/config');

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
 * @constructor
 */
fetcher.Fetcher = cip.extend(function(opts) {
  /** @type {Object} User options. */
  this.opts = opts;

  /** @type {?waldo/sqs} sqs service instance. */
  this.sqs = null;

  /** @type {?waldo/kafka-to-sqs} Kafka to SQS service instance. */
  this.kafkaToSqs = null;
});

/**
 * Initializes the job fetching mechanism.
 *
 * @return {Promise} A Promise.
 */
fetcher.Fetcher.prototype.init = Promise.method(function () {
  if (this.opts.useSqs) {
    return this._initSqs();
  } else {
    return this._initKafka();
  }
});

/**
 * Initialize the fetcher in SQS mode, consuming Kafka messages and pushing them
 * to SQS, then fetching the SQS jobs.
 *
 * @return {Promise} A Promise.
 */
fetcher.Fetcher.prototype._initSqs = Promise.method(function () {

  // Prepare Kafka-to-SQS for creating SQS Jobs from kafka.
  this.kafkaToSqs = new KafkaToSqs();
  const kafkaToSqsOpts = {
    topic: this.opts.topic,
    consumerGroup: this.opts.consumerGroup,
    log: this.opts.log,
    sqsUrl: this.opts.sqsUrl,
  };

  // Prepare SQS lib for consuming SQS Jobs.
  this.sqs = sqsLib({
    sqsUrl: config.SQS_URL_SYNC_DOWNLOAD,
    concurrentOpsLimit: config.CONCURRENT_SQS_JOBS_SYNC_DOWNLOAD,
    logger: log,
  });

  // Boot both
  return Promise.all([
    this.kafkaToSqs.init(kafkaToSqsOpts),
    this.sqs.init()
      .then(() => {
        this.sqs.startFetch(this._processMessage.bind(this));
      }),
  ]);
});

/**
 * Master handler for incoming SQS job items.
 *
 * @param {Object} message Job item message as transported from kafka.
 * @return {Promise} A Promise.
 * @private
 */
fetcher.Fetcher.prototype._processMessage = Promise.method(function (message) {
  let jobProcess = new JobProcess();

  let uid = workerHelpers.parseUserId(message);
  if (!uid) {
    let err = new Error('UserId could not be extracted from message');
    err.code = 104;
    return this._handleError(err);
  }

  log.info('workers.syncDownload.JobFetch._processMessage() :: Starting',
    'download operation for user:', uid, 'Filepath:', message['path_display']);

  const context = {
    message: message,
    uid: uid,
    self: this,
  };

  return jobProcess.start(uid, message)
    .bind(context)
    .then(this._produceKafkaMessage)
    .catch(this._handleError);
});

/**
 * Produce the kafka message on topic InputDropboxSyncJob.
 *
 * @param {Object} res Results from tree search worker.
 * @return {Promise}
 * @private
 * @this {custom} Custom context.
 */
fetcher.Fetcher.prototype._produceKafkaMessage = Promise.method(function (res) {
  let newMessage = {
    viewer: res.message.viewer,
    albumId: res.message.albumId,
    jobId: res.message.jobId,
    source: 'client',
    dropboxId: res.message.dropboxId,
    s3Url: res.s3Url,
    photoId: res.photoId,
  };

  const producer = new kafkaLib.Producer({
    topic: kafkaLocal.Topic.SYNC_DOWNLOAD_FINISHED,
    schema: kafkaLocal.Schema.SYNC_DOWNLOAD_FINISHED,
    keySchema: { type: 'string' },
    log: log,
  });

  return producer.produce({
    key: res.message.dropboxId,
    value: newMessage,
  })
    .then(() => {
      log.trace('workers.syncDownload.JobFetch._produceKafkaMessage() Download',
        'Finished produced.');
    })
    .catch(function(err) {
      log.error('workers.syncDownload.JobFetch._produceKafkaMessage() :: Error:',
        err);
      // Kafka down, force SQS to re-run this operation
      throw err;
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
