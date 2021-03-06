import test from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import {ObjectID} from 'mongodb';
import hasOwn from 'has-own-prop';

import {files, cleanStorage} from './utils/testutils';
import {storageOptions} from './utils/settings';
import GridFsStorage from '..';

test.before(async (t) => {
	const app = express();
	t.context.filePrefix = 'file';
	t.context.metadatas = ['foo', 'bar'];
	t.context.ids = [new ObjectID(), new ObjectID()];
	t.context.sizes = [102400, 204800];
	t.context.collections = ['plants', 'animals'];
	t.context.contentTypes = ['text/plain', 'image/jpeg'];
	const storage = new GridFsStorage({
		...storageOptions(),
		*file(request_, file) {
			let counter = 0;
			t.context.params = [{req: request_, file}];
			for (;;) {
				const response = yield {
					filename: t.context.filePrefix + (counter + 1),
					metadata: t.context.metadatas[counter],
					id: t.context.ids[counter],
					chunkSize: t.context.sizes[counter],
					bucketName: t.context.collections[counter],
					contentType: t.context.contentTypes[counter]
				};
				t.context.params.push({req: response[0], file: response[1]});
				counter++;
			}
		}
	});
	t.context.storage = storage;

	const upload = multer({storage});

	app.post('/url', upload.array('photos', 2), (request_, response) => {
		t.context.req = request_;
		t.context.result = {
			headers: request_.headers,
			files: request_.files,
			body: request_.body
		};
		response.end();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);
});

test.after.always('cleanup', (t) => {
	return cleanStorage(t.context.storage);
});

test('the request contains the two uploaded files', (t) => {
	const {result} = t.context;
	t.true(Array.isArray(result.files));
	t.is(result.files.length, 2);
});

test('files are named with the yielded value', (t) => {
	const {result} = t.context;
	result.files.forEach((f, idx) =>
		t.is(f.filename, t.context.filePrefix + (idx + 1))
	);
});

test('files contain a metadata object with the yielded object', (t) => {
	const {result} = t.context;
	result.files.forEach((f, idx) => t.is(f.metadata, t.context.metadatas[idx]));
});

test('should be stored with the yielded chunkSize value', (t) => {
	const {result} = t.context;
	result.files.forEach((f, idx) => t.is(f.chunkSize, t.context.sizes[idx]));
});

test('should change the id with the yielded value', (t) => {
	const {result} = t.context;
	result.files.forEach((f, idx) => t.is(f.id, t.context.ids[idx]));
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
	result.files.forEach((f, idx) =>
		t.is(f.contentType, t.context.contentTypes[idx])
	);
});

test('should the parameters be a request and a file objects', (t) => {
	const {req: appRequest, params} = t.context;
	params.forEach((p) => {
		const {req, file} = p;
		t.is(req, appRequest);
		['body', 'query', 'params', 'files'].every((k) => t.true(hasOwn(req, k)));
		['fieldname', 'originalname', 'encoding', 'mimetype'].every((k) =>
			t.true(hasOwn(file, k))
		);
	});
});
