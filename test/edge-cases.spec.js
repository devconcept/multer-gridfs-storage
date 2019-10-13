import test from 'ava';
import multer from 'multer';
import crypto from 'crypto';
import request from 'supertest';
import express from 'express';
import {MongoClient} from 'mongodb';
import {spy, stub, restore} from 'sinon';

import GridFsStorage from '../index';
import {generateUrl} from './utils/settings';
import {files, cleanStorage} from './utils/testutils';

test.serial.cb('connection function fails to connect', t => {
  const url = generateUrl();
  const err = new Error();
  let mongoSpy = stub(MongoClient, 'connect').callsFake((url, options, cb) => {
    setTimeout(() => {
      cb(err);
    });
  });

  const connectionSpy = spy();
  const storage = new GridFsStorage({url});

  storage.once('connectionFailed', connectionSpy);

  setTimeout(() => {
    t.is(connectionSpy.callCount, 1);
    t.is(mongoSpy.callCount, 1);
    t.end();
  }, 50);
});

test.serial('errors generating random bytes', async t => {
  const url = generateUrl();
  const app = express();
  const generatedError = new Error('Random bytes error');
  let error = {};
  const randomBytesSpy = stub(crypto, 'randomBytes').callsFake((size, cb) => {
    if (cb) {
      return cb(generatedError);
    }
    throw generatedError;
  });

  const storage = new GridFsStorage({url});
  t.context.storage = storage;
  const upload = multer({storage});

  app.post('/randombytes', upload.single('photo'), (err, req, res, next) => {
    error = err;
    next();
  });

  await storage.ready();
  await request(app).post('/randombytes')
    .attach('photo', files[0]);

  t.is(error, generatedError);
  t.is(error.message, 'Random bytes error');
  t.is(randomBytesSpy.callCount, 1);
});

test.serial.afterEach.always(t => {
  restore();
  return cleanStorage(t.context.storage);
});
