'use strict';

const Promise = require('bluebird');
const util = require('util');
const path = require('path');

function getNodeVersion() {
  const [major, minor, patch] = process.versions.node.split('.').map(Number);
  return { major, minor, patch };
}

const version = getNodeVersion();

const files = ['sample1.jpg', 'sample2.jpg']
  .map((file) => path.normalize(__dirname + '/../attachments/' + file));

function cleanDb(storage) {
  if (storage) {
    storage.removeAllListeners();
    if (storage.db) {
      const db = storage.db;
      return db
        .dropDatabase()
        .then(() => db.close(true));
    }
    return Promise.resolve();
  }
  return Promise.resolve();
}

module.exports = {
  version,
  files,
  cleanDb
};

