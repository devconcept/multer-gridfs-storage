'use strict';

const path = require('path');
const MongoClient = require('mongodb').MongoClient;
const settings = require('./settings');

const mongoVersion = require('mongodb/package').version;

const files = ['sample1.jpg', 'sample2.jpg']
  .map((file) => path.normalize(__dirname + '/../attachments/' + file));

function cleanStorage(storage, db, client) {
  if (storage) {
    storage.removeAllListeners();
    if (!db && !client) {
      db = storage.db;
      client = storage.client;
    }
    if (db) {
      return db
        .dropDatabase()
        .then(() => client
          ? client.close()
          : db.close());
    } else {
      return Promise.resolve();
    }
  } else {
    return Promise.resolve();
  }
}

function getDb(client) {
  if (client instanceof MongoClient) {
    return client.db(settings.connection.database);
  }

  return client;
}

function getClient(client) {
  return (client instanceof MongoClient) ? client : null;
}

function createBuffer(arr) {
  return Buffer.from ? Buffer.from(arr) : new Buffer(arr);
}

function storageReady(args) { // eslint-disable-line no-unused-vars
  const storage = [];
  for (let i = 0; i < arguments.length; i++) {
    storage.push(arguments[i]);
  }
  return storage.map(s => {
    return new Promise((resolve, reject) => {
      s.once('connection', resolve);
      s.once('connectionFailed', reject);
    });
  });
}

module.exports = {
  files,
  getDb,
  getClient,
  cleanStorage,
  createBuffer,
  storageReady,
  mongoVersion,
};

