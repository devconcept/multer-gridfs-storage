import test from 'ava';
import {readFile as readFileCb} from 'fs';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import pify from 'pify';

import {files, cleanStorage} from './utils/testutils';
import {generateUrl} from './utils/settings';
import GridFsStorage from '../index';

const readFile = pify(readFileCb);

test.before(async t => {
  const url = generateUrl();
  const app = express();
  const storage = new GridFsStorage({url});
  const upload = multer({storage});
  t.context.storage = storage;

  app.post('/url', upload.single('photo'), (req, res) => {
    t.context.result = {headers: req.headers, file: req.file, body: req.body};
    res.end();
  });

  await storage.ready()
    .then(() => request(app)
      .post('/url')
      .attach('photo', files[0]));

  const f = await readFile(files[0]);
  t.context.size = f.length;
});

test('uploaded file have a filename property', t => {
  const {result} = t.context;
  t.true(result.file.hasOwnProperty('filename'));
  t.is(typeof result.file.filename, 'string');
  t.regex(result.file.filename, /^[0-9a-f]{32}$/);
});

test('uploaded file have a metadata property', t => {
  const {result} = t.context;
  t.true(result.file.hasOwnProperty('metadata'));
  t.is(result.file.metadata, null);
});

test('uploaded file have a id property', t => {
  const {result} = t.context;
  t.true(result.file.hasOwnProperty('id'));
  t.regex(result.file.id.toHexString(), /^[0-9a-f]{24}$/);
});

test('uploaded file have a size property with the length of the file', t => {
  const {result, size} = t.context;
  t.true(result.file.hasOwnProperty('size'));
  t.is(result.file.size, size);
});

test('uploaded file have the default bucket name pointing to the fs collection', t => {
  const {result} = t.context;
  t.true(result.file.hasOwnProperty('bucketName'));
  t.is(result.file.bucketName, 'fs');
});

test('uploaded file have the date of the upload', t => {
  const {result} = t.context;
  t.true(result.file.hasOwnProperty('uploadDate'));
  t.true(result.file.uploadDate instanceof Date)
});

test.after.always('cleanup', t => cleanStorage(t.context.storage));
