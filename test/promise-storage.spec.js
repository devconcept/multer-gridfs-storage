import test from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import {MongoClient} from 'mongodb';

import {
	files,
	cleanStorage,
	getDb,
	getClient,
	dropDatabase
} from './utils/testutils';
import {storageOpts} from './utils/settings';
import {fileMatchMd5Hash} from './utils/macros';
import GridFsStorage from '..';

test.before(async t => {
	const {url} = storageOpts();
	t.context.url = url;
	const app = express();
	const promised = MongoClient.connect(url, {useNewUrlParser: true}).then(
		_db => {
			t.context.db = getDb(_db, url);
			t.context.client = getClient(_db);
			return t.context.db;
		}
	);

	const storage = new GridFsStorage({db: promised});
	const upload = multer({storage});
	t.context.storage = storage;

	app.post('/url', upload.array('photos', 2), (req, res) => {
		t.context.result = {headers: req.headers, files: req.files, body: req.body};
		res.end();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);
});

test.after.always('cleanup', async t => {
	const {db, client, storage, url} = t.context;
	await cleanStorage(storage, {db, client});
	return dropDatabase(url);
});

test('store the files on upload', t => {
	const {result} = t.context;
	t.true(Array.isArray(result.files));
	t.is(result.files.length, 2);
});

test('each stored file the same MD5 signature than the uploaded file', t => {
	const {result} = t.context;
	return fileMatchMd5Hash(t, result.files);
});
