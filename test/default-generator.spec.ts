import anyTest, {TestInterface} from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import {ObjectId} from 'mongodb';
import hasOwn from 'has-own-prop';

import {GridFsStorage} from '../src';
import {files, cleanStorage} from './utils/testutils';
import {storageOptions} from './utils/settings';
import {DefaultGeneratorContext} from './types/default-generator-context';

const test = anyTest as TestInterface<DefaultGeneratorContext>;

test.before(async (t) => {
	const app = express();
	t.context.filePrefix = 'file';
	t.context.metadatas = ['foo', 'bar'];
	t.context.ids = [new ObjectId(), new ObjectId()];
	t.context.sizes = [102_400, 204_800];
	t.context.collections = ['plants', 'animals'];
	t.context.contentTypes = ['text/plain', 'image/jpeg'];
	const storage = new GridFsStorage({
		...storageOptions(),
		*file(request_, file) {
			let counter = 0;
			t.context.params = [{req: request_, file}];
			for (;;) {
				const response = yield {
					filename: t.context.filePrefix + (counter + 1).toString(),
					metadata: t.context.metadatas[counter],
					id: t.context.ids[counter],
					chunkSize: t.context.sizes[counter],
					bucketName: t.context.collections[counter],
					contentType: t.context.contentTypes[counter],
				};
				t.context.params.push({req: response[0], file: response[1]});
				counter++;
			}
		},
	});
	t.context.storage = storage;

	const upload = multer({storage});

	app.post('/url', upload.array('photos', 2), (request_, response) => {
		t.context.req = request_;
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

test('the request contains the two uploaded files', (t) => {
	const {result} = t.context;
	t.true(Array.isArray(result.files));
	t.is(result.files.length, 2);
});

test('files are named with the yielded value', (t) => {
	const {result} = t.context;
	for (const [idx, f] of result.files.entries())
		t.is(f.filename, t.context.filePrefix + (idx + 1).toString());
});

test('files contain a metadata object with the yielded object', (t) => {
	const {result} = t.context;
	for (const [idx, f] of result.files.entries())
		t.is(f.metadata, t.context.metadatas[idx]);
});

test('should be stored with the yielded chunkSize value', (t) => {
	const {result} = t.context;
	for (const [idx, f] of result.files.entries())
		t.is(f.chunkSize, t.context.sizes[idx]);
});

test('should change the id with the yielded value', (t) => {
	const {result} = t.context;
	for (const [idx, f] of result.files.entries()) t.is(f.id, t.context.ids[idx]);
});

test('files are stored under a collection with the yielded name', async (t) => {
	const {storage} = t.context;
	const {db} = storage;
	const collections = await db
		.listCollections({name: {$in: ['plants.files', 'animals.files']}})
		.toArray();
	t.is(collections.length, 2);
});

test('files are stored with the yielded content-type value', (t) => {
	const {result} = t.context;
	for (const [idx, f] of result.files.entries())
		t.is(f.contentType, t.context.contentTypes[idx]);
});

test('should the parameters be a request and a file objects', (t) => {
	const {req: appRequest, params} = t.context;
	for (const p of params) {
		const {req, file} = p;
		t.is(req, appRequest);
		for (const k of ['body', 'query', 'params', 'files']) {
			t.true(hasOwn(req, k));
		}

		for (const k of ['fieldname', 'originalname', 'encoding', 'mimetype']) {
			t.true(hasOwn(file, k));
		}
	}
});
