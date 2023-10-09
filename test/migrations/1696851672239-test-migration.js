'use strict'

const { callbackify } = require('util');
const { MongoClient } = require('mongodb');
const { promisify } = require('util');

const mongoUrl = `${global.__MONGO_URI__}${global.__MONGO_DB_NAME__}`;

module.exports.up = function (next) {
  callbackify(async () => {
    const sleepMs = Math.floor(Math.random() * 2000);
    await promisify(setTimeout)(sleepMs);
    let client;
    try {
      client = await MongoClient.connect(mongoUrl);
      await client.db().collection('test').insertOne({});
    } finally {
      await client?.close();
    }
  })(next);
}

module.exports.down = function (next) {
  next()
}
