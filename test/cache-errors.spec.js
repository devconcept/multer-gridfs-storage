import test from 'ava';
import {MongoClient, Db} from 'mongodb';
import {spy, stub, restore} from 'sinon';

import GridFsStorage from '../index';
import {generateUrl} from './utils/settings';
import {cleanStorage} from './utils/testutils';
import Cache from "../lib/cache";

const url = generateUrl();

test.serial.before(t => {
  t.context.oldCache = GridFsStorage.cache;
  const cache = new Cache();
  GridFsStorage.cache = cache;
  t.context.cache = cache;
  t.context.error = new Error('reason');
  t.context.mongoSpy = stub(MongoClient, 'connect')
    .callThrough()
    .onSecondCall()
    .callsFake(function (url, opts, cb) {
      setTimeout(() => cb(t.context.error));
    });
  createStorage({cache: '1'}, {t, key: 'storage1'});
  createStorage({cache: '2'}, {t, key: 'storage2'});
  createStorage({cache: '1'}, {t, key: 'storage3'});
  createStorage({cache: '2'}, {t, key: 'storage4'});
});

function createStorage(settings, {t, key} = {}) {
  const storage = new GridFsStorage({url, ...settings});
  if (t && key) {
    t.context[key] = storage;
  }
  return storage;
}

test.serial.cb('should only reject connections associated to the same cache', t => {
  const {storage1, storage2, storage3, storage4, mongoSpy, cache} = t.context;
  const conSpy = spy();
  const rejectSpy = spy();
  t.is(mongoSpy.callCount, 2);

  storage2.on('connectionFailed', conSpy);
  storage1.on('connectionFailed', rejectSpy);

  storage1.on('connection', () => {
    t.true(storage1.db instanceof Db);
    t.is(storage2.db, null);
    t.true(storage3.db instanceof Db);
    t.is(storage4.db, null);
    t.is(conSpy.callCount, 1);
    t.is(rejectSpy.callCount, 0);
    t.is(cache.connections(), 1);
    t.end();
  });
});

test.serial.afterEach.always(t => {
  const {storage1, storage2, oldCache} = t.context;
  GridFsStorage.cache = oldCache;
  restore();
  return Promise.all([
    cleanStorage(storage1),
    cleanStorage(storage2),
  ]);
});
