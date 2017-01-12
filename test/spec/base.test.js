/**
 * @fileOverview Base API Surface tests.
 */
const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const Promise = require('bluebird');

const testLib = require('../lib/tester.lib');
const schemaFix = require('../fixtures/schema.fix');

const fetcher = require('../..');

describe('Base API Surface', function() {
  beforeEach(function() {
    this.processMock = sinon.mock(function(message) {
      return Promise.resolve(message);
    });
  });
  beforeEach(function() {
    this.optsFix = {
      topic: 'test-topic',
      consumerGroup: 'consumer-group',
      schema: schemaFix,
      process: this.processMock,
    };
  });
  describe('Nominal behaviors', function() {
    it('should expose expected methods', function() {
      expect(fetcher).to.be.a('function');
    });

    it('should return an instance when instanciated properly', function() {
      const fetcherInst = fetcher(this.optsFix);

      expect(fetcherInst.init).to.be.a('function');
    });
  });

  describe('Erroneous behaviors', function() {
    it('should throw when no args defined', function() {
      expect(fetcher).to.throw(TypeError);
    });
    it('should throw when no options defined', function() {
      const fn = fetcher.bind(null, {});
      expect(fn).to.throw(TypeError);
    });
    it('should throw when no sqsUrl defined', function() {
      const fn = fetcher.bind(null, {
        sqsUrl: testLib.SQS_URL,
      });
      expect(fn).to.throw(TypeError, '"concurrentOpsLimit" option required and must be a number.');
    });

  });
});
