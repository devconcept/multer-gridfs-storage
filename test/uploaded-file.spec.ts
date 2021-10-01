import {readFile as readFileCb} from 'fs';
import anyTest, {TestInterface} from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import pify from 'pify';
import hasOwn from 'has-own-prop';

import {GridFsStorage} from '../src';
import {files, cleanStorage} from './utils/testutils';
import {storageOptions} from './utils/settings';
import {UploadedFileContext} from './types/uploaded-file-context';

const test = anyTest as TestInterface<UploadedFileContext>;
const readFile = pify(readFileCb);

test.before(async (t) => {
	const app = express();
	const storage = new GridFsStorage(storageOptions());
	const upload = multer({storage});
	t.context.storage = storage;

	app.post('/url', upload.single('photo'), (request_, response) => {
		t.context.result = {
			headers: request_.headers,
			file: request_.file,
			body: request_.body,
		};
		response.end();
	});

	await storage.ready();
	await request(app).post('/url').attach('photo', files[0]);

	const f = await readFile(files[0]);
	t.context.size = f.length;
});

test.after.always('cleanup', async (t) => {
	await cleanStorage(t.context.storage);
});

test('uploaded file have a filename property', (t) => {
	const {result} = t.context;
	t.true(hasOwn(result.file, 'filename'));
	t.is(typeof result.file.filename, 'string');
	t.regex(result.file.filename, /^[\da-f]{32}$/);
});

test('uploaded file have a metadata property', (t) => {
	const {result} = t.context;
	t.true(hasOwn(result.file, 'metadata'));
	t.is(result.file.metadata, null);
});

test('uploaded file have a id property', (t) => {
	const {result} = t.context;
	t.true(hasOwn(result.file, 'id'));
	t.regex(result.file.id.toHexString(), /^[\da-f]{24}$/);
});

test('uploaded file have a size property with the length of the file', (t) => {
	const {result, size} = t.context;
	t.true(hasOwn(result.file, 'size'));
	t.is(result.file.size, size);
});

test('uploaded file have the default bucket name pointing to the fs collection', (t) => {
	const {result} = t.context;
	t.true(hasOwn(result.file, 'bucketName'));
	t.is(result.file.bucketName, 'fs');
});

test('uploaded file have the date of the upload', (t) => {
	const {result} = t.context;
	t.true(hasOwn(result.file, 'uploadDate'));
	t.true(result.file.uploadDate instanceof Date);
});
