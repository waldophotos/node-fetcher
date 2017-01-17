/**
 * @fileOverview Constructor responsible for processing a message.
 */

const cip = require('cip');
const Promise = require('bluebird');
const jwt = require('jsonwebtoken');
const kafkaLib = require('@waldo/node-kafka');

/**
 * Constructor responsible for processing a message.
 *
 * @constructor
 */
const MessageProcess = module.exports = cip.extend(function(fetcher) {
  /** @type {Fetcher} Fetcher instance */
  this.fetcher = fetcher;

  /** @type {?Object} The message */
  this.message = null;

  /** @type {?string} The user id if defined */
  this.uid = null;

});

/**
 * Processes incoming messages.
 *
 * @param {Object} message Job item message as transported from kafka.
 * @return {Promise} A Promise.
 */
MessageProcess.prototype.process = Promise.method(function (message) {

  this.fetcher.emit('messageReceived', message);

  this.message = message;

  if (this.fetcher.opts.hasUser) {
    this.uid = this.parseUserId(message, this.fetcher.opts.credentialsKey);
    if (!this.uid) {
      let err = new Error('UserId could not be extracted from message');
      err.code = 104;
      return this._handleError(err);
    }
  }

  return this.fetcher._process(this.uid, message)
    .bind(this)
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
MessageProcess.prototype.parseUserId = function (message, credentialsKey) {
  if (!message ||
    !message[credentialsKey] ||
    !message[credentialsKey].credentials ||
    !message[credentialsKey].credentials['waldo.v1.event.Jwt'] ||
    !message[credentialsKey].credentials['waldo.v1.event.Jwt'].base64) {

    this.fetcher.opts.log.warn('Fetcher.MessageProcess.parseUserId() :: Bogus',
      'viewer provided for topic:', this.fetcher.opts.topic,
      'Message raw:', message);

    return null;
  }

  let jwtToken = message[credentialsKey].credentials['waldo.v1.event.Jwt'].base64;

  let userData = jwt.decode(jwtToken);

  if (!userData || !userData['account_id']) {
    this.fetcher.opts.log.warn('Fetcher.MessageProcess.parseUserId() :: Bogus JWT',
      'token provided for topic:', this.fetcher.opts.topic,
      'jwtToken:', jwtToken, 'parsed:', userData);
    return null;
  }

  return userData['account_id'];
};

/**
 * Produce the kafka message on topic InputDropboxSyncJob.
 *
 * @param {Object} response The processing response and message to dispath to kafka.
 * @return {Promise}
 * @private
 */
MessageProcess.prototype._produceKafkaMessage = Promise.method(function (response) {
  this.fetcher.emit('processed', response);

  if (!this.fetcher.opts.produceKafka) {
    // nothing to do here, move on...
    return;
  }

  const producerOpts = {
    topic: this.fetcher.opts.topicProduce,
    schema: this.fetcher.opts.schemaProduce,
    log: this.fetcher.opts.log,
  };

  let produceMessage;

  if (response && response[this.fetcher.opts.keyAttribute]) {
    const key = response[this.fetcher.opts.keyAttribute];
    producerOpts.keySchema = { type: 'string' };

    produceMessage = {
      key: key,
      value: response,
    };
  } else {
    if (this.fetcher.opts.keyAttribute) {
      this.fetcher.opts.log.warn('Fetcher.MessageProcess._produceKafkaMessage() ::',
        '"keyAttribute" was defined but processor response did not contain it.',
        'Will not produce message with key for partionioning on topic:',
        this.fetcher.opts.topicProduce, 'Response keys:', response);
    }
    produceMessage = response;
  }

  const producer = new kafkaLib.Producer(producerOpts);

  return producer.produce(produceMessage)
    .then(() => {
      this.fetcher.emit('produce', produceMessage);
    })
    .catch((err) => {
      this.fetcher.opts.log.error('Fetcher.MessageProcess._produceKafkaMessage() ::',
        'Error on topic:', this.fetcher.opts.topicProduce, 'Error:', err);

      this.fetcher.emit('produceError', err);
    });
});

/**
 * Produce kafka error message for Tree Search.
 *
 * @param {Error} error The error that occured.
 * @return {Promise} A Promise.
 * @private
 */
MessageProcess.prototype._produceKafkaErrorMessage = Promise.method(function (error) {
  if (!this.fetcher.opts.produceErrorMessage) {
    return;
  }

  const producer = new kafkaLib.Producer({
    topic: this.fetcher.opts.topicProduceError,
    schema: this.fetcher.opts.schemaProduceError,
    keySchema: { type: 'string' },
    log: this.fetcher.opts.log,
  });

  const newMessage = this.fetcher.opts.generateErrorMessage(error, this.message);
  const key = this.message[this.fetcher.opts.keyAttributeError];

  const produceMessage = {
    key: key,
    value: newMessage,
  };

  return producer.produce(produceMessage)
    .then(() => {
      this.fetcher.opts.log.info('Fetch.MessageProcess._produceKafkaErrorMessage()',
        'Processing failed on topic:', this.fetcher.opts.topicProduceError,
        'with code:', error.code, 'Message:', error.message);

      this.fetcher.emit('errorProduced', produceMessage);
    })
    .catch(function(err) {
      this.fetcher.opts.log.error('Fetch.MessageProcess._produceKafkaErrorMessage() ::',
        ' Error on producing error message on topic:',
        this.fetcher.opts.topicProduceError, 'Error:', err);

      this.fetcher.emit('errorProduceError', err);
    });
});

/**
 * Master error handler, will dispatch new error type kafka message or fail
 * the SQS job.
 *
 * @param {Error} error The thrown error.
 * @return {Promise} A Promise.
 * @private
 */
MessageProcess.prototype._handleError = Promise.method(function (error) {
  if (error.code) {
    // Unresolvable error, produce kafka message on the error topic.
    return this._produceKafkaErrorMessage(error);
  }

  this.fetcher.opts.log.error('Fetcher.MessageProcess._handleError() :: Error',
    'occured:', error, error.stack);

  throw error;
});
