import test from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import {MongoClient} from 'mongodb';
import pify from 'pify';
import md5FileCb from 'md5-file';

import {
	files,
	cleanStorage,
	getDb,
	getClient,
	delay,
	dropDatabase
} from './utils/testutils';
import {storageOpts} from './utils/settings';
import GridFsStorage from '..';

const md5File = pify(md5FileCb);

function prepareTest(t, error) {
	const {url} = storageOpts();
	t.context.url = url;
	const app = express();
	const promised = error
		? delay(1000).then(() => Promise.reject(error))
		: delay(1000)
				.then(() => MongoClient.connect(url, {useNewUrlParser: true}))
				.then(db => {
					t.context.db = getDb(db, url);
					t.context.client = getClient(db);
					return t.context.db;
				});

	const storage = new GridFsStorage({db: promised});
	const upload = multer({storage});
	t.context.storage = storage;
	t.context.upload = upload;
	t.context.app = app;
}

test.afterEach.always('cleanup', async t => {
	const {db, client, storage, url} = t.context;
	await cleanStorage(storage, {db, client});
	return dropDatabase(url);
});

test('buffers incoming files while the connection is opening', async t => {
	let result = {};
	prepareTest(t);
	const {storage, app, upload} = t.context;

	app.post('/url', upload.array('photos', 2), (req, res) => {
		result = {headers: req.headers, files: req.files, body: req.body};
		res.end();
	});

	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	await storage.ready();
	t.truthy(result.files);
	t.true(Array.isArray(result.files));
	t.is(result.files.length, 2);
	const md5 = await Promise.all(
		result.files.map(async (f, idx) => {
			const computed = await md5File(files[idx]);
			return {md5: f.md5, computed};
		})
	);
	t.true(md5.every(f => f.md5 === f.computed));
});

test('rejects incoming files if the connection does not open', async t => {
	let result = {};
	const error = new Error('Failed error');
	prepareTest(t, error);
	const {storage, app, upload} = t.context;
	/* eslint-disable-next-line no-unused-vars */
	app.post('/url', upload.array('photos', 2), (err, req, res, next) => {
		result = err;
		res.end();
	});
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	await storage.ready().catch(() => {});
	t.is(result, error);
	t.is(result.message, 'Failed error');
});
