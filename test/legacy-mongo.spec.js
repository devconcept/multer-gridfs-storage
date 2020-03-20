import {readFile as readFileCb} from 'fs';
import test from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import {ObjectID, GridStore} from 'mongodb';
import md5FileCb from 'md5-file';
import pify from 'pify';

import {storageOptions} from './utils/settings';
import {cleanStorage, files} from './utils/testutils';
import GridFsStorage from '..';

const readFile = pify(readFileCb);
const md5File = pify(md5FileCb);

function createStorageAndUpload(t, options = {}) {
	const {url} = storageOptions();
	const storage = new GridFsStorage({url, ...options});
	t.context.storage = storage;
	storage._legacy = true;
	t.context.upload = multer({storage});
}

test.beforeEach(t => {
	t.context.app = express();
});

test.afterEach.always(t => {
	return cleanStorage(t.context.storage);
});

test('legacy GridStore streams are supported', async t => {
	let result = {};
	createStorageAndUpload(t);
	const {app, upload, storage} = t.context;
	const f = await readFile(files[0]);
	const size = f.length;

	app.post('/url', upload.single('photos'), (request_, response) => {
		result = {
			headers: request_.headers,
			file: request_.file,
			body: request_.body
		};
		response.end();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photos', files[0]);

	t.is(typeof result.file, 'object');
	t.is(result.file.md5, await md5File(files[0]));
	t.regex(result.file.filename, /^[\da-f]{32}$/);
	t.is(result.file.metadata, null);
	t.regex(result.file.id.toString(), /^[\da-f]{24}$/);
	t.is(result.file.size, size);
	t.is(result.file.bucketName, 'fs');
	t.true(result.file.uploadDate instanceof Date);
});

test('legacy streams support changing file configuration', async t => {
	let result = {};
	let counter = 0;
	const filePrefix = 'file';
	const ids = [new ObjectID(), new ObjectID()];
	const data = ['foo', 'bar'];
	const sizes = [102400, 204800];
	const names = ['plants', 'animals'];
	const contentTypes = ['text/plain', 'image/jpeg'];
	createStorageAndUpload(t, {
		file: () => {
			counter++;
			return {
				filename: filePrefix + counter,
				metadata: data[counter - 1],
				id: ids[counter - 1],
				chunkSize: sizes[counter - 1],
				bucketName: names[counter - 1],
				contentType: contentTypes[counter - 1]
			};
		}
	});
	const {app, storage, upload} = t.context;

	app.post('/url', upload.array('photos', 2), (request_, response) => {
		result = {
			headers: request_.headers,
			files: request_.files,
			body: request_.body
		};
		response.end();
	});

	await storage.ready();
	const {db} = storage;
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	t.true(Array.isArray(result.files));
	t.is(result.files.length, 2);
	result.files.forEach((f, idx) => t.is(f.filename, filePrefix + (idx + 1)));
	result.files.forEach((f, idx) => t.is(f.metadata, data[idx]));
	result.files.forEach((f, idx) => t.is(f.chunkSize, sizes[idx]));
	result.files.forEach((f, idx) => t.is(f.id, ids[idx]));
	result.files.forEach((f, idx) => t.is(f.contentType, contentTypes[idx]));
	const collections = await db
		.listCollections({name: {$in: ['plants.files', 'animals.files']}})
		.toArray();
	t.is(collections.length, 2);
});

test('legacy streams delete files correctly', async t => {
	let result = null;
	let error = {};
	createStorageAndUpload(t);
	const {app, upload, storage} = t.context;

	app.post(
		'/url',
		upload.array('photos', 1),
		(err, request_, response, next) => {
			result = {
				headers: request_.headers,
				body: request_.body,
				files: request_.files
			};
			error = err;
			next();
		}
	);

	await storage.ready();
	const {db} = storage;
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	t.true(Array.isArray(result.files));
	t.is(result.files.length, 1);
	t.is(error.storageErrors.length, 0);

	const storedFiles = await GridStore.list(db);
	t.is(storedFiles.length, 0);
});
