import anyTest, {TestInterface} from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';

import {GridFsStorage} from '../src';
import {files, cleanStorage, mongoVersion} from './utils/testutils';
import {storageOptions} from './utils/settings';
import {Md5HashContext} from './types/md5-hash-context';

const test = anyTest as TestInterface<Md5HashContext>;

test.before(async (t) => {
	const app = express();
	const storage = new GridFsStorage({
		...storageOptions(),
		file: () => ({disableMD5: true}),
	});
	t.context.storage = storage;
	const upload = multer({storage});

	app.post('/url', upload.array('photo', 2), (request_, response) => {
		t.context.result = {
			headers: request_.headers,
			files: request_.files,
			body: request_.body,
		};
		response.end();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photo', files[0])
		.attach('photo', files[0]);
});

test.after.always('cleanup', async (t) => {
	await cleanStorage(t.context.storage);
});

test('files don’t have a computed MD5 hash', (t) => {
	const [major, minor] = mongoVersion;
	if (major < 3 || (major === 3 && minor < 1)) {
		t.pass('Md5 hash is not supported in this mongo version');
		return;
	}

	const {result} = t.context;
	t.is(result.files[0].md5, undefined);
	t.is(result.files[1].md5, undefined);
});
