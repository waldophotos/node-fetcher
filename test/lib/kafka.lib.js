/**
 * @fileOverview Testing lib for kafka.
 */
const kafkaLib = require('@waldo/node-kafka');

const testLib = require('./tester.lib');

const kafkaTestLib = module.exports = {};

/**
 * Generic produce function.
 *
 * @param {Object} data the message.
 * @param {string} topic The topic to produce on.
 * @param {Object} schema The avro schema to use.
 * @return {Promise} A Promise.
 */
kafkaTestLib.produce = function (data, topic, schema) {
  const producer = new kafkaLib.Producer({
    topic: topic,
    schema: schema,
    log: testLib.log,
  });

  return producer.produce(data);
};
