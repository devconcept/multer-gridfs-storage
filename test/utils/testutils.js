import path from 'path';
import {MongoClient} from 'mongodb';
import {connection} from './settings';

export {version as mongoVersion} from 'mongodb/package';

export const files = ['sample1.jpg', 'sample2.jpg']
  .map((file) => path.normalize(__dirname + '/../attachments/' + file));

export async function cleanStorage(storage, {client, db} = {}) {
  if (storage) {
    storage.removeAllListeners();
    if (!db && !client) {
      db = storage.db;
      client = storage.client;
    }
    if (db) {
      await db.dropDatabase();
      if (client) {
        if (client.hasOwnProperty('isConnected') && client.isConnected()) {
          client.close();
        }
        if (client.hasOwnProperty('readyState') && client.readyState === 1) {
          client.close();
        }
      } else {
        db.close();
      }
    }
  }
}

export function getDb(client) {
  if (client instanceof MongoClient) {
    return client.db(connection.database);
  }

  return client;
}

export function getClient(client) {
  return (client instanceof MongoClient) ? client : null;
}

export function createBuffer(arr) {
  return Buffer.from ? Buffer.from(arr) : new Buffer(arr);
}

export function delay(delay = 0) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, delay);
  });
}

export function fakeConnectCb(err = null) {
  return (url, options, cb) => {
    setTimeout(() => {
      cb(err);
    });
  }
}

