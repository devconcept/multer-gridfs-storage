import anyTest, {TestInterface} from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';

import {GridFsStorage} from '../src';
import {files, cleanStorage} from './utils/testutils';
import {storageOptions} from './utils/settings';
import {HandlingNamesContext} from './types/handling-names-context';

const test = anyTest as TestInterface<HandlingNamesContext>;

test.afterEach.always('cleanup', async (t) => {
	await cleanStorage(t.context.storage);
});

test('handling empty name values', async (t) => {
	const app = express();
	const values = [null, undefined, {}];
	let counter = -1;
	let result: any = {};

	const storage = new GridFsStorage({
		...storageOptions(),
		file: () => {
			counter++;
			return values[counter];
		},
	});
	t.context.storage = storage;
	const upload = multer({storage});

	app.post('/url', upload.array('photo', 3), (request_, response) => {
		result = {
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
		.attach('photo', files[0])
		.attach('photo', files[0]);

	for (const file of result.files) t.regex(file.filename, /^[\da-f]{32}$/);
	for (const file of result.files) t.is(file.metadata, null);
	for (const file of result.files) t.is(file.bucketName, 'fs');
	for (const file of result.files) t.is(file.chunkSize, 261_120);
});

test('handling primitive values as names', async (t) => {
	const app = express();
	const values = ['name', 10];
	let counter = -1;
	let result: any = {};

	const storage = new GridFsStorage({
		...storageOptions(),
		file: () => {
			counter++;
			return values[counter];
		},
	});
	t.context.storage = storage;
	const upload = multer({storage});

	app.post('/url', upload.array('photo', 2), (request_, response) => {
		result = {
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

	for (const [idx, f] of result.files.entries())
		t.is(f.filename, values[idx].toString());
	for (const file of result.files) t.is(file.metadata, null);
	for (const file of result.files) t.is(file.bucketName, 'fs');
	for (const file of result.files) t.is(file.chunkSize, 261_120);
});
