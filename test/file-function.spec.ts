import anyTest, {TestInterface} from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import {ObjectId} from 'mongodb';

import {GridFsStorage} from '../src';
import {files, cleanStorage} from './utils/testutils';
import {storageOptions} from './utils/settings';
import {FileFunctionContext} from './types/file-function-context';

const test = anyTest as TestInterface<FileFunctionContext>;

test.before(async (t) => {
	const app = express();
	let counter = 0;
	t.context.filenamePrefix = 'file';
	t.context.ids = [new ObjectId(), new ObjectId()];
	t.context.metadatas = ['foo', 'bar'];
	t.context.sizes = [102_400, 204_800];
	t.context.bucketNames = ['plants', 'animals'];
	t.context.contentTypes = ['text/plain', 'image/jpeg'];
	const storage = new GridFsStorage({
		...storageOptions(),
		file: () => {
			counter++;
			return {
				filename: `${t.context.filenamePrefix}${counter}`,
				metadata: t.context.metadatas[counter - 1],
				id: t.context.ids[counter - 1],
				chunkSize: t.context.sizes[counter - 1],
				bucketName: t.context.bucketNames[counter - 1],
				contentType: t.context.contentTypes[counter - 1],
			};
		},
	});

	t.context.storage = storage;
	const upload = multer({storage});

	app.post('/url', upload.array('photos', 2), (request_, response) => {
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
		.attach('photos', files[0])
		.attach('photos', files[1]);
});

test.after.always('cleanup', async (t) => {
	await cleanStorage(t.context.storage);
});

test('request contains the two uploaded files', (t) => {
	const {result} = t.context;
	t.truthy(result.files);
	t.true(Array.isArray(result.files));
	t.is(result.files.length, 2);
});

test('files are named with the provided value', (t) => {
	const {result} = t.context;
	for (const [idx, f] of result.files.entries())
		t.is(f.filename, t.context.filenamePrefix + (idx + 1));
});

test('files contain a metadata object with the provided object', (t) => {
	const {result} = t.context;
	for (const [idx, f] of result.files.entries())
		t.is(f.metadata, t.context.metadatas[idx]);
});

test('files are stored with the provided chunkSize value', (t) => {
	const {result} = t.context;
	for (const [idx, f] of result.files.entries())
		t.is(f.chunkSize, t.context.sizes[idx]);
});

test('files have the provided id value', (t) => {
	const {result} = t.context;
	for (const [idx, f] of result.files.entries()) t.is(f.id, t.context.ids[idx]);
});

test('files are stored under a collection with the provided name', async (t) => {
	const {storage} = t.context;
	const {db} = storage;
	const collections = await db
		.listCollections({name: {$in: ['plants.files', 'animals.files']}})
		.toArray();
	t.is(collections.length, 2);
});

test('files are stored with the provided content-type value', (t) => {
	const {result} = t.context;
	for (const [idx, f] of result.files.entries())
		t.is(f.contentType, t.context.contentTypes[idx]);
});
