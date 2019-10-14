import test from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import {MongoClient} from 'mongodb';
import pify from 'pify';
import md5FileCb from 'md5-file';

import {files, cleanStorage, getDb, getClient, delay} from './utils/testutils';
import {generateUrl} from './utils/settings';
import GridFsStorage from '../index';

const md5File = pify(md5FileCb);

function prepareTest(t, error) {
  const url = generateUrl();
  const app = express();
  const promised = error
    ? delay(1000).then(() => Promise.reject(error))
    : delay(1000)
      .then(() => MongoClient.connect(url, {useNewUrlParser: true}))
      .then((db) => {
        t.context.db = getDb(db);
        t.context.client = getClient(db);
        return t.context.db;
      });

  const storage = new GridFsStorage({db: promised});
  const upload = multer({storage});
  t.context.storage = storage;
  t.context.upload = upload;
  t.context.app = app;
}

test('buffers incoming files while the connection is opening', async t => {
  let result = {};
  prepareTest(t);
  const {storage, app, upload} = t.context;

  app.post('/url', upload.array('photos', 2), (req, res) => {
    result = {headers: req.headers, files: req.files, body: req.body};
    res.end();
  });

  await request(app).post('/url')
    .attach('photos', files[0])
    .attach('photos', files[1]);

  await storage.ready();
  t.truthy(result.files);
  t.true(result.files instanceof Array);
  t.is(result.files.length, 2);
  for (let i = 0; i < result.files.length; i++) {
    const file = result.files[i];
    t.is(file.md5, await md5File(files[i]));
  }
});

test('rejects incoming files if the connection does not open', async t => {
  let result = {};
  const error = new Error('Failed error');
  prepareTest(t, error);
  const {storage, app, upload} = t.context;
  app.post('/url', upload.array('photos', 2), (err, req, res, next) => {
    result = err;
    res.end();
  });
  await request(app).post('/url')
    .attach('photos', files[0])
    .attach('photos', files[1]);

  await storage.ready().catch(() => {});
  t.is(result, error);
  t.is(result.message, 'Failed error');
});

test.afterEach.always('cleanup', t => {
  const {db, client, storage} = t.context;
  return cleanStorage(storage, {db, client});
});
