# fetcher

> Your Job or Message fetching paradise, with sugar on top.

## Install

Install the module using NPM:

```
npm install @waldo/fetcher --save
```

## Documentation

Fetcher is wraps around the [node-kafka](https://github.com/waldophotos/waldo-node-kafka), [kafka-to-sqs][] and [sqs](https://github.com/waldophotos/node-sqs) Waldo NPM libraries and provides a uniform and robust interface to consume and produce messages on Kafka.

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

### Fetched Configuration

When creating a new Fetcher instance you need to provide a very elaborate configuration object. All the options bellow are keys to the Object you need to pass as argument when instantiating Fetcher.


#### Required Config

* `topic` **string** The topic to consume kafka messages on.
* `consumerGroup` **string** The group of the consumer.
* `schema` **Object** The kafka schema of the consumer.
* `process` **Function** The master processing method, must return a promise.
* `log` **Object** An object containing the methods: info, warn, error.

#### Credentials and Users

* `hasUser` **boolean=** If the consumer message has credentials with the userid encoded inside.
* `credentialsKey` **string=** The root attribute on which the credentials are stored, required if `hasUser` is enabled.

#### SQS configuration

* `hasSqs` **boolean=** Set to true if you want to activate [kafka-to-sqs][].
* `sqsUrl` **string=** SQS Url, required if `hasSqs` is enabled.
* `concurrentOpsLimit` **number=** SQS concurrent operations, required if `hasSqs` is enabled.


## Releasing

1. Update the changelog bellow.
1. Ensure you are on master.
1. Type: `grunt release`
    * `grunt release:minor` for minor number jump.
    * `grunt release:major` for major number jump.

## Release History

- **v0.0.1**, *TBD*
    - Big Bang

## License

Copyright Waldo, Inc. All rights reserved.

[kafka-to-sqs]: https://github.com/waldophotos/node-kafka-to-sqs
