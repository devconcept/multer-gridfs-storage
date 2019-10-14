import test from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import {MongoClient} from 'mongodb';
import {sync as md5File} from 'md5-file';

import {files, cleanStorage, getDb, getClient} from './utils/testutils';
import {generateUrl} from './utils/settings';
import GridFsStorage from '../index';

test.before(async t => {
  const url = generateUrl();
  const app = express();
  const promised = MongoClient.connect(url, {useNewUrlParser: true}).then(_db => {
    t.context.db = getDb(_db);
    t.context.client = getClient(_db);
    return t.context.db;
  });

  const storage = new GridFsStorage({db: promised});
  const upload = multer({storage});
  t.context.storage = storage;


  app.post('/url', upload.array('photos', 2), (req, res) => {
    t.context.result = {headers: req.headers, files: req.files, body: req.body};
    res.end();
  });

  await storage.ready();
  await request(app).post('/url')
    .attach('photos', files[0])
    .attach('photos', files[1]);
});

test('store the files on upload', t => {
  const {result} = t.context;
  t.true(result.files instanceof Array);
  t.is(result.files.length, 2);
});

test('each stored file the same MD5 signature than the uploaded file', t => {
  const {result} = t.context;
  for (let i = 0; i < result.files.length; i++) {
    const file = result.files[i];
    t.is(file.md5, md5File(files[i]));
  }
});

test.after.always('cleanup', t => {
  const {db, client, storage} = t.context;
  return cleanStorage(storage, {db, client});
});
