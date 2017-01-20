# Fetcher

> Your Job or Message fetching paradise, with sugar on top.

## Install

Install the module using NPM:

```
npm install @waldo/fetcher --save
```

## Documentation

Fetcher wraps around the [node-kafka](https://github.com/waldophotos/waldo-node-kafka), [kafka-to-sqs][] and [sqs](https://github.com/waldophotos/node-sqs) Waldo NPM libraries to provide a uniform and robust interface to consume and produce messages on Kafka.

The Fetcher can operate in multiple scenarios, when consuming it may consume directly from a Kafka topic or through a Kafka-to-SQS bridge if your operation is I/O or CPU intensive. On the output, you may produce a Kafka message and even choose to produce Kafka error messages in case your operation fails.

All of this is abstracted away from you, the only thing you have to provide is the initial Fetcher configuration and a Promise returning processing method.

### Quick Start

```js
const Fetcher = require(@waldo/node-fetcher);

const fetcher = new Fetcher({/* ... */});

fetcher.init()
  .then(function() {
    console.log('You are ready!');
  })
  .catch(function(err) {
    console.error('awwwOh:', err);
  });
```

### Fetcher Configuration

When creating a new Fetcher instance you need to provide a very elaborate configuration object. All the options bellow are keys to the Object you need to pass as argument when instantiating Fetcher.

#### Required Config

* `topic` **string** The topic to consume kafka messages on.
* `consumerGroup` **string** The group of the consumer.
* `schema` **Object** The kafka schema of the consumer.
* `process` **Function** The master processing method, must return a promise. It will receive two arguments when invoked:
  1. `uid` **String|null** First argument will be the userId, available only if `hasUser` is set to true, if not it will be of value `null`.
  1. `message` **Object** The actual message to consume.
* `log` **Object** An object containing the methods: info, warn, error.

#### Optional Config

* `useKeys` **boolean=** Set to true to use Kafka Partitioning Keys.

#### Credentials and Users

* `hasUser` **boolean=** If the consumer message has credentials with the userid encoded inside.
* `credentialsKey` **string=** The root attribute on which the credentials are stored, required if `hasUser` is enabled.

#### SQS configuration

* `hasSqs` **boolean=** Set to true if you want to activate [kafka-to-sqs][].
* `sqsUrl` **string=** SQS Url, required if `hasSqs` is enabled.
* `concurrentOpsLimit` **number=** SQS concurrent operations, required if `hasSqs` is enabled.

#### Produce to Kafka topic on response

* `produceKafka` **boolean=** Produce a kafka message upon completion using the return value of your processing method.
* `topicProduce` **string=** The topic to produce kafka messages on.
* `schemaProduce` **Object=** The kafka schema of the producer.
* `keyAttribute` **string=** Define the key attribute in the response schema to use as the kafka key for partioning.

#### Produce to Kafka Error topic

* `produceErrorMessage` **boolean=** Produce a kafka message in case processing fails.
* `topicProduceError` **string=** The topic to produce kafka messages on.
* `schemaProduceError` **Object=** The kafka schema of the producer.
* `keyAttributeError` **string=** Define the key attribute in the response schema to use as the kafka key for partioning.
* `generateErrorMessage` **Function=** A synchronous method that returns the correct payload to send as a kafka error message, required if `produceErrorMessage` is enabled, as arguments it will receive:
    1. `error` **Error** The error object.
    1. `message` **Object** The message that was attempted to be produced.

#### Configuration Examples

**Consume and Produce to Kafka, no SQS**

```js
const opts = {
  log: log,
  topic: 'test-topic',
  consumerGroup: 'consumer-group',
  schema: avroSchemaReference,
  process: function(uid, message) {
      return Promise.resolve();
  },
  hasUser: true,
  credentialsKey: 'viewer',
  // produce related messages
  produceKafka: true,
  topicProduce: 'test-produce-topic',
  schemaProduce: schemaFix,
  keyAttribute: 'albumId',
};

const fetcher = new Fetcher(opts);
```

### Initializing Fetcher

Once fetched is instanciated it needs to be initialized so it performs all the required connections with the services as per the configuration. The `init()` returns a Promise:

```js

fetched.init()
    .then(function() {
        console.log('done');
    })
```

## Releasing

1. Update the changelog bellow.
1. Ensure you are on master.
1. Type: `grunt release`
    * `grunt release:minor` for minor number jump.
    * `grunt release:major` for major number jump.

## Release History

- **v0.1.3**, *20 Jan 2017*
    - Upgrade kafka-to-sqs to `0.1.2`.
- **v0.1.2**, *20 Jan 2017*
    - Upgrade node-kafka to `0.1.1`.
- **v0.1.1**, *18 Jan 2017*
    - Use updated kafka-to-sqs `0.1.1`.
- **v0.1.0**, *18 Jan 2017*
    - Added the `useKeys` boolean option, now to use key-schemas this option needs to be set to true.
- **v0.0.2**, *17 Jan 2017*
    - Add message as a second argument on the `generateErrorMessage()` callback.
- **v0.0.1**, *17 Jan 2017*
    - Big Bang

## License

Copyright Waldo, Inc. All rights reserved.

[kafka-to-sqs]: https://github.com/waldophotos/node-kafka-to-sqs
