import test from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';

import {files, cleanStorage} from './utils/testutils';
import {storageOptions} from './utils/settings';
import GridFsStorage from '..';

test.afterEach.always('cleanup', t => {
	return cleanStorage(t.context.storage);
});

test('handling empty name values', async t => {
	const app = express();
	const values = [null, undefined, {}];
	let counter = -1;
	let result = {};

	const storage = new GridFsStorage({
		...storageOptions(),
		file: () => {
			counter++;
			return values[counter];
		}
	});
	t.context.storage = storage;
	const upload = multer({storage});

	app.post('/url', upload.array('photo', 3), (request_, response) => {
		result = {
			headers: request_.headers,
			files: request_.files,
			body: request_.body
		};
		response.end();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photo', files[0])
		.attach('photo', files[0])
		.attach('photo', files[0]);

	result.files.forEach(file => t.regex(file.filename, /^[\da-f]{32}$/));
	result.files.forEach(file => t.is(file.metadata, null));
	result.files.forEach(file => t.is(file.bucketName, 'fs'));
	result.files.forEach(file => t.is(file.chunkSize, 261120));
});

test('handling primitive values as names', async t => {
	const app = express();
	const values = ['name', 10];
	let counter = -1;
	let result = {};

	const storage = new GridFsStorage({
		...storageOptions(),
		file: () => {
			counter++;
			return values[counter];
		}
	});
	t.context.storage = storage;
	const upload = multer({storage});

	app.post('/url', upload.array('photo', 2), (request_, response) => {
		result = {
			headers: request_.headers,
			files: request_.files,
			body: request_.body
		};
		response.end();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photo', files[0])
		.attach('photo', files[0]);

	result.files.forEach((f, idx) => t.is(f.filename, values[idx].toString()));
	result.files.forEach(file => t.is(file.metadata, null));
	result.files.forEach(file => t.is(file.bucketName, 'fs'));
	result.files.forEach(file => t.is(file.chunkSize, 261120));
});
