'use strict';

const Promise = require('bluebird');
const path = require('path');
const MongoClient = require('mongodb').MongoClient;
const settings = require('./settings');

function getNodeVersion() {
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  return { major, minor, patch };
}

const version = getNodeVersion();

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
      return db.dropDatabase().then(() => {
        return client ? client.close() : db.close();
      });
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

module.exports = {
  version,
  files,
  getDb,
  getClient,
  cleanStorage
};

