/**
 * @fileOverview Kafka messages to produce.
 */
const uuid = require('uuid');
const jwt = require('jsonwebtoken');

const testLib = require('../lib/test.lib');

const dataFix = module.exports = {};

const ALBUM_ID = testLib.ALBUM_ID;

dataFix.uid = uuid();

dataFix.jwtToken = jwt.sign({
  'account_id': dataFix.uid,
}, 'wont matter');

dataFix.consumer = () => ({
  viewer: {
    credentials: {
      'waldo.v1.event.Jwt': {
        'base64': dataFix.jwtToken
      }
    }
  },
  albumId: ALBUM_ID,
  jobId: uuid.v4({}, new Buffer(16)).toString('binary'),
});
