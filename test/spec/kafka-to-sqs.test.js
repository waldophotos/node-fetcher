/**
 * @fileOverview Test Kafka-to-sqs operation.
 */

const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const Promise = require('bluebird');
const sqsLib = require('@waldo/sqs');

const testLib = require('../lib/tester.lib');
const schemaFix = require('../fixtures/schema.fix');
const messagesFix = require('../fixtures/messages.fix');
const kafkaLib = require('../lib/kafka.lib');

const Fetcher = require('../..');

const SQS_URL = 'https://sqs.us-east-1.amazonaws.com/409236574440/ci_test-node-fetcher';

// Skip because we cannot cleanly close SQS requests sent through long-polling
// there is no cancel method...
// Stub or deprecate SQS alltogether...
//
// Tests work individually.
describe.skip('Kafka to SQS', function() {
  testLib.init();

  beforeEach(function() {
    this.processMock = function(uid, message) {
      return Promise.resolve(message);
    };

    this.processMockSpy = sinon.spy(this, 'processMock');
  });
  beforeEach(function() {
    this.optsFix = {
      log: testLib.log,
      topic: 'test-topic',
      consumerGroup: 'consumer-group',
      schema: schemaFix,

      hasSqs: true,
      sqsUrl: SQS_URL,
      concurrentOpsLimit: 1,

      process: this.processMock,
      hasUser: true,
      credentialsKey: 'viewer',

      // produce related messages
      produceKafka: true,
      topicProduce: 'test-produce-topic',
      schemaProduce: schemaFix,
      keyAttribute: 'albumId',
    };
  });

  beforeEach(function() {
    // hack kafka-stub
    testLib.kafkaStub.consumerTopics = {};
  });

  beforeEach(function() {
    this.sqs = sqsLib({
      sqsUrl: SQS_URL,
      concurrentOpsLimit: 1,
      logger: testLib.log,
    });

    return this.sqs.init();
  });
  beforeEach(function() {
    return this.sqs.purge();
  });

  beforeEach(function() {
    this.fetcher = new Fetcher(this.optsFix);
  });

  beforeEach(function() {
    return this.fetcher.init();
  });

  beforeEach(function() {
    this.testData = messagesFix.consumer();
  });
  afterEach(function() {
    return this.fetcher.dispose();
  });
  afterEach(function() {
    this.processMockSpy.restore();
  });

  describe('Nominal behaviors', function() {
    beforeEach(function() {
      return kafkaLib.produce(this.testData, 'test-topic', schemaFix);
    });
    beforeEach(function(done) {
      setTimeout(done, 1000);
    });

    it('should consume a kafka message', function() {
      expect(this.processMockSpy.callCount).to.equal(1);
    });
    it('should produce a kafka message', function() {
      expect(testLib.kafkaStub.produceStub.callCount).to.equal(2);
      const msg1 = testLib.kafkaStub.produceStub.getCall(1).args[0];
      expect(msg1.value).to.deep.equal(this.testData);
    });
    it('should produce using the albumId as kafka partioning key', function() {
      const msg1 = testLib.kafkaStub.produceStub.getCall(1).args[0];
      expect(msg1.key).to.equal(this.testData.albumId);
    });
    it('should provide uid on processing method', function() {
      expect(this.processMockSpy.getCall(0).args[0]).to.equal(messagesFix.uid);
    });
  });
});
