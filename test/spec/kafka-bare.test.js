/**
 * @fileOverview Test operation with only Kafka messages, no SQS.
 */

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const Promise = require('bluebird');

const testLib = require('../lib/tester.lib');
const schemaFix = require('../fixtures/schema.fix');
const kafkaLib = require('../lib/kafka.lib');

const fetcher = require('../..');

describe('Kafka only', function() {
  testLib.init();

  beforeEach(function() {
    this.processMock = sinon.mock(function(message) {
      return Promise.resolve(message);
    });
  });
  beforeEach(function() {
    this.optsFix = {
      log: testLib.log,
      topic: 'test-topic',
      consumerGroup: 'consumer-group',
      schema: schemaFix,
      process: this.processMock.invokeMethod,
      // produce related messages
      produceKafka: true,
      topicProduce: 'test-produce-topic',
      schemaProduce: schemaFix,
      keyAttribute: 'albumId',
    };
  });

  beforeEach(function() {
    this.fetcher = fetcher(this.optsFix);
  });

  beforeEach(function() {
    return this.fetcher.init();
  });

  describe.only('Nominal behaviors', function() {
    it('should consume and produce a kafka message', function(done) {
      kafkaLib.produce(this.testData, 'test-topic', schemaFix);
      setTimeout(() => {
        expect(this.processMock.callCount).to.equal(1);
        done();
      }, 500);
    });
  });
});
