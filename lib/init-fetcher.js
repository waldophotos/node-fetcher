/**
 * @fileOverview Fetcher initialization methods, a mixin.
 */

const cip = require('cip');
const Promise = require('bluebird');
const sqsLib = require('@waldo/sqs');
const KafkaToSqs = require('@waldo/kafka-to-sqs');
const kafkaLib = require('@waldo/node-kafka');

/**
 * Fetcher initialization methods, a mixin.
 *
 * @constructor
 */
const FetcherInit = module.exports = cip.extend();

/**
 * Initializes the job fetching mechanism.
 *
 * @return {Promise} A Promise.
 */
FetcherInit.prototype.init = Promise.method(function () {
  let promise;
  if (this.opts.hasSqs) {
    promise = this._initSqs();
  } else {
    promise = this._initKafka();
  }

  return promise
    .return(this);
});

/**
 * Initialize the fetcher in SQS mode, consuming Kafka messages and pushing them
 * to SQS, then fetching the SQS jobs.
 *
 * @return {Promise} A Promise.
 */
FetcherInit.prototype._initSqs = Promise.method(function () {

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
    sqsUrl: this.opts.sqsUrl,
    concurrentOpsLimit: this.opts.concurrentOpsLimit,
    logger: this.opts.log,
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
 * Initialize the fetcher in Kafka mode, consuming and processing Kafka messages.
 *
 * @return {Promise} A Promise.
 */
FetcherInit.prototype._initKafka = Promise.method(function () {
  this.consumer = new kafkaLib.Consumer({
    topic: this.opts.topic,
    log: this.opts.log,
  });

  const connectOpts = {
    consumerGroup: this.opts.consumerGroup,
    onMessage: (message) => {
      this._processMessage(message.value)
        .catch((err) => {
          this.opts.log.error('Fetcher.Init._initKafka() :: Processing error for',
            'topic:', this.opts.topic, 'Will suppress. Error:', err, err.stack);
        });
    },
    onError: (error) => {
      this.opts.log.error('Fetcher.Init._initKafka() :: Streaming error for topic:',
        this.opts.topic, 'Suppressing. Error:', error);
    },
  };

  return this.consumer.connect(connectOpts)
    .then(() => {
      this.opts.log.info('Fetcher.Init._initKafka() :: Connected to topic:',
        this.opts.topic);
    });
});
