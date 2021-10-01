import anyTest, {TestInterface} from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import {MongoClient} from 'mongodb';
import delay from 'delay';

import {GridFsStorage} from '../src';
import {storageOptions} from './utils/settings';
import {fileMatchMd5Hash} from './utils/macros';
import {
	files,
	cleanStorage,
	getDb,
	getClient,
	dropDatabase,
} from './utils/testutils';
import {FileConcurrencyContext} from './types/file-concurrency-context';

const test = anyTest as TestInterface<FileConcurrencyContext>;

function prepareTest(t, error?) {
	const {url, options} = storageOptions();
	t.context.url = url;
	const app = express();
	const promised =
		error /* eslint-disable-next-line promise/prefer-await-to-then */
			? delay(500).then(async () => Promise.reject(error))
			: delay(500)
					/* eslint-disable-next-line promise/prefer-await-to-then */
					.then(async () => MongoClient.connect(url, options))
					/* eslint-disable-next-line promise/prefer-await-to-then */
					.then((db) => {
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

test.afterEach.always('cleanup', async (t) => {
	const {db, client, storage, url} = t.context;
	await cleanStorage(storage, {db, client});
	return dropDatabase(url);
});

test('buffers incoming files while the connection is opening', async (t) => {
	let result: any = {};
	prepareTest(t);
	const {storage, app, upload} = t.context;

	app.post('/url', upload.array('photos', 2), (request_, response) => {
		result = {
			headers: request_.headers,
			files: request_.files,
			body: request_.body,
		};
		response.end();
	});

	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	await storage.ready();
	return fileMatchMd5Hash(t, result.files);
});

test('rejects incoming files if the connection does not open', async (t) => {
	let result: any = {};
	const error = new Error('Failed error');
	prepareTest(t, error);
	const {storage, app, upload} = t.context;

	app.post(
		'/url',
		upload.array('photos', 2),
		(error_, request_, response, _next) => {
			result = error_;
			response.end();
		},
	);
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	await storage.ready().catch(() => '');
	t.is(result, error);
	t.is(result.message, 'Failed error');
});
