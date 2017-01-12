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
      log: testLib.log,
      topic: 'test-topic',
      consumerGroup: 'consumer-group',
      schema: schemaFix,
      process: this.processMock.invokeMethod,
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
    it('should throw when no "log" defined', function() {
      delete this.optsFix.log;
      const fn = fetcher.bind(null, this.optsFix);
      expect(fn).to.throw(TypeError);
    });
    it('should throw when no "topic" defined', function() {
      delete this.optsFix.topic;
      const fn = fetcher.bind(null, this.optsFix);
      expect(fn).to.throw(TypeError);
    });
    it('should throw when no "consumerGroup" defined', function() {
      delete this.optsFix.consumerGroup;
      const fn = fetcher.bind(null, this.optsFix);
      expect(fn).to.throw(TypeError);
    });
    it('should throw when no "schema" defined', function() {
      delete this.optsFix.schema;
      const fn = fetcher.bind(null, this.optsFix);
      expect(fn).to.throw(TypeError);
    });
    it('should throw when no "process" defined', function() {
      delete this.optsFix.process;
      const fn = fetcher.bind(null, this.optsFix);
      expect(fn).to.throw(TypeError);
    });

    describe('SQS', function() {
      it('should throw when SQS enabled and no "sqsUrl" defined', function() {
        this.optsFix.hasSqs = true;
        this.optsFix.concurrentOpsLimit = 1;
        const fn = fetcher.bind(null, this.optsFix);
        expect(fn).to.throw(TypeError);
      });
      it('should throw when SQS enabled and no "concurrentOpsLimit" defined', function() {
        this.optsFix.hasSqs = true;
        this.optsFix.sqsUrl = 'https';
        const fn = fetcher.bind(null, this.optsFix);
        expect(fn).to.throw(TypeError);
      });
    });

    describe('Produce', function() {
      beforeEach(function() {
        this.optsFix.produceKafka = true;
        this.optsFix.topicProduce = 'test-produce-topic';
        this.optsFix.schemaProduce = schemaFix;
        this.optsFix.keyAttribute = 'albumId';
      });
      it('should throw when produce enabled and no "topicProduce" defined', function() {
        delete this.optsFix.topicProduce;
        const fn = fetcher.bind(null, this.optsFix);
        expect(fn).to.throw(TypeError);
      });
      it('should throw when produce enabled and no "schemaProduce" defined', function() {
        delete this.optsFix.schemaProduce;
        const fn = fetcher.bind(null, this.optsFix);
        expect(fn).to.throw(TypeError);
      });
      it('should throw when produce enabled and no "keyAttribute" defined', function() {
        delete this.optsFix.keyAttribute;
        const fn = fetcher.bind(null, this.optsFix);
        expect(fn).to.throw(TypeError);
      });
    });

    describe('ProduceError', function() {
      beforeEach(function() {
        this.optsFix.produceErrorMessage = true;
        this.optsFix.topicProduceError = 'test-produce-topic-error';
        this.optsFix.schemaProduceError = schemaFix;
        this.optsFix.keyAttributeError = 'albumId';
        this.optsFix.generateErrorMessage = function() {};
      });
      it('should throw when produce enabled and no "topicProduceError" defined', function() {
        delete this.optsFix.topicProduceError;
        const fn = fetcher.bind(null, this.optsFix);
        expect(fn).to.throw(TypeError);
      });
      it('should throw when produce enabled and no "schemaProduceError" defined', function() {
        delete this.optsFix.schemaProduceError;
        const fn = fetcher.bind(null, this.optsFix);
        expect(fn).to.throw(TypeError);
      });
      it('should throw when produce enabled and no "keyAttributeError" defined', function() {
        delete this.optsFix.keyAttributeError;
        const fn = fetcher.bind(null, this.optsFix);
        expect(fn).to.throw(TypeError);
      });
      it('should throw when produce enabled and no "generateErrorMessage" defined', function() {
        delete this.optsFix.generateErrorMessage;
        const fn = fetcher.bind(null, this.optsFix);
        expect(fn).to.throw(TypeError);
      });
    });
  });
});
