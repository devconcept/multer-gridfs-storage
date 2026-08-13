import anyTest, { TestInterface } from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';

import { GridFsStorage } from '../src';
import { files, cleanStorage } from './utils/testutils';
import { storageOptions } from './utils/settings';
import { Md5HashContext } from './types/md5-hash-context';

const test = anyTest as TestInterface<Md5HashContext>;

test.before(async (t) => {
	const app = express();
	const storage = new GridFsStorage(storageOptions());
	t.context.storage = storage;
	const upload = multer({ storage });

	app.post('/url', upload.array('photo', 2), (request_, response) => {
		t.context.result = {
			headers: request_.headers,
			files: request_.files,
			body: request_.body,
		};
		response.end();
	});

	await storage.ready();
	await request(app).post('/url').attach('photo', files[0]).attach('photo', files[0]);
});

test.after.always('cleanup', async (t) => {
	await cleanStorage(t.context.storage);
});

test('files don’t have an md5 hash', (t) => {
	const { result } = t.context;
	// md5 support was removed from GridFS in the mongodb driver 4.0.0, so stored
	// files never carry an md5 property.
	t.false('md5' in result.files[0]);
	t.false('md5' in result.files[1]);
});
