import test from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import mongo, {MongoClient, Db, Server} from 'mongodb';
import {spy, stub, restore} from 'sinon';

import GridFsStorage from '../index';
import {mongoUrl, connection, generateUrl} from './utils/settings';
import {cleanStorage, files} from './utils/testutils';

const {host, port, database} = connection;

test.serial('handle GridStore open error', async t => {
  const url = generateUrl();
  const app = express();
  const errorSpy = spy();
  const fileSpy = spy();
  const err = new Error();

  stub(mongo, 'GridStore').returns({
    stream: stub().returns({
      on: stub(),
      gs: {
        open: stub().callsFake(cb => cb(err)),
      },
    }),
  });
  const storage = new GridFsStorage({url});
  t.context.storage = storage;
  storage._legacy = true;
  storage.on('streamError', errorSpy);
  storage.on('file', fileSpy);

  const upload = multer({storage});

  app.post('/storeopen', upload.single('photo'), (err, req, res, next) => { // eslint-disable-line no-unused-vars
    res.end();
  });

  await request(app)
    .post('/storeopen')
    .attach('photo', files[0]);

  t.is(errorSpy.callCount, 1);
  t.is(fileSpy.callCount, 0);
  const call = errorSpy.getCall(0);
  t.is(call.args[0], err);
});

test.serial('handle GridStore close error', async t => {
  const url = generateUrl();
  let emitterStub;
  const app = express();
  const errorSpy = spy();
  const fileSpy = spy();
  const err = new Error();

  emitterStub = stub().callsFake((evt, cb) => {
    if (evt === 'end') {
      return cb();
    }
  });
  stub(mongo, 'GridStore').returns({
    stream: stub().returns({
      on: emitterStub,
      gs: {
        open: stub().callsFake(cb => cb()),
        close: stub().callsFake(cb => cb(err)),
      },
    }),
  });
  const storage = new GridFsStorage({url});
  storage._legacy = true;
  t.context.storage = storage;
  storage.on('streamError', errorSpy);
  storage.on('file', fileSpy);

  const upload = multer({storage});

  app.post('/storeclose', upload.single('photo'), (err, req, res, next) => { // eslint-disable-line no-unused-vars
    res.end();
  });

  await request(app)
    .post('/storeclose')
    .attach('photo', files[0]);

  t.is(errorSpy.callCount, 1);
  t.is(fileSpy.callCount, 0);
  const call = errorSpy.getCall(0);
  t.is(call.args[0], err);
});

test.serial('handles MongoClient and Db objects', async t => {
  const url = generateUrl();
  const server = new Server(host, port);
  const db = new Db(database, server);

  const mongoSpy = stub(MongoClient, 'connect').callsFake((...args) => {
    const callback = args.length > 2 ? args[2] : null;
    if (callback) {
      return callback(null, db);
    }
    return Promise.resolve(db);
  });
  const storage = new GridFsStorage({url});

  await storage.ready();
  t.is(mongoSpy.callCount, 1);
  t.true(storage.db instanceof Db);
  t.is(storage.client, null);
});

test.serial('handles the client instance returned in mongo 3', async t => {
  const url = generateUrl();
  const server = new Server(host, port);
  const db = new Db(database, server);
  const client = new MongoClient(server);
  stub(client, 'db').callsFake(() => db);
  const mongoSpy = stub(MongoClient, 'connect').callsFake((...args) => {
    const callback = args.length > 2 ? args[2] : null;
    if (callback) {
      return callback(null, client);
    }
    return Promise.resolve(client);
  });
  const storage = new GridFsStorage({url});
  await storage.ready();
  t.is(mongoSpy.callCount, 1);
  t.true(db instanceof Db);
  t.true(client instanceof MongoClient);
});

test.serial.afterEach.always(t => {
  restore();
  return cleanStorage(t.context.storage);
});
