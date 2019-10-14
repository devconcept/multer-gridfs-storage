import test from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';

import {files, cleanStorage} from './utils/testutils';
import {generateUrl} from './utils/settings';
import GridFsStorage from '../index';

async function successfulPromiseSetup(t) {
  const url = generateUrl();
  const app = express();
  t.context.filePrefix = 'file';
  const storage = new GridFsStorage({
    url,
    file: function* () {
      let counter = 0;
      for (; ;) {
        yield Promise.resolve({filename: t.context.filePrefix + (counter + 1)});
        counter++;
      }
    },
  });
  t.context.storage = storage;

  const upload = multer({storage});

  app.post('/url', upload.array('photos', 2), (req, res) => {
    t.context.result = {headers: req.headers, files: req.files, body: req.body};
    res.end();
  });

  await storage.ready();
  await request(app).post('/url')
    .attach('photos', files[0])
    .attach('photos', files[1]);
}

test('yielding a promise is resolved as file configuration', async t => {
  await successfulPromiseSetup(t);
  const {result} = t.context;
  t.true(result.files instanceof Array);
  t.is(result.files.length, 2);
  result.files.forEach((f, idx) => t.is(f.filename, t.context.filePrefix + (idx + 1)));
});

async function failedPromiseSetup(t) {
  const url = generateUrl();
  const app = express();
  t.context.rejectedError = new Error('reason');
  const storage = new GridFsStorage({
    url,
    file: function* () {
      yield Promise.reject(t.context.rejectedError);
    },
  });
  t.context.storage = storage;
  const upload = multer({storage});

  app.post('/url', upload.array('photos', 2), (err, req, res, next) => {
    t.context.error = err;
    next();
  });

  await storage.ready();
  await request(app).post('/url')
    .attach('photos', files[0]);
}

test('yielding a promise rejection is handled properly', async t => {
  await failedPromiseSetup(t);
  const {error, storage} = t.context;
  const {db} = storage;
  t.true(error instanceof Error);
  t.is(error, t.context.rejectedError);
  const count = await db.collection('fs.files').estimatedDocumentCount();
  t.is(count, 0);
});

test.afterEach.always('cleanup', t => cleanStorage(t.context.storage));
