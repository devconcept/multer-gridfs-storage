import fs from 'fs';
import anyTest, {TestInterface} from 'ava';
import hasOwn from 'has-own-prop';
import multer from 'multer';
import express from 'express';
import request from 'supertest';
import path from 'path';
import util from 'util';

import {GridFsStorage} from '../src';
import {cleanStorage, defer, files} from './utils/testutils';
import {storageOptions} from './utils/settings';
import {UtilityMethodsContext} from './types/utility-methods-context';

const test = anyTest as TestInterface<UtilityMethodsContext>;
const unlink = util.promisify(fs.unlink);

test.afterEach.always('cleanup', async (t) => {
	const testFile = path.join(__dirname, 'attachments', 'test_disk.jpg');
	if (fs.existsSync(testFile)) {
		await unlink(testFile);
	}

	return cleanStorage(t.context.storage);
});

test('generate 16 byte hex string', async (t) => {
	const {generateBytes} = GridFsStorage;
	const result: any = await generateBytes();
	t.true(hasOwn(result, 'filename'));
	t.regex(result.filename, /^[a-f\d]{32}$/);
});

test('upload a file using the fromFile method', async (t) => {
	t.context.storage = new GridFsStorage({
		...storageOptions(),
		file: () => 'test.jpg',
	});
	const {storage} = t.context;
	await storage.ready();
	const file = {stream: fs.createReadStream(files[0]), mimetype: 'image/jpeg'};
	t.context.result = await storage.fromFile(null, file);
	const {result} = t.context;
	t.true(hasOwn(result, 'filename'));
	t.is(result.filename, 'test.jpg');
	t.is(result.contentType, 'image/jpeg');
});

test('upload a file using the fromStream method', async (t) => {
	t.context.storage = new GridFsStorage({
		...storageOptions(),
		file: () => 'test.jpg',
	});
	const {storage} = t.context;
	await storage.ready();
	const stream = fs.createReadStream(files[0]);
	t.context.result = await storage.fromStream(stream);
	const {result} = t.context;
	t.true(hasOwn(result, 'filename'));
	t.is(result.filename, 'test.jpg');
	t.is(result.contentType, undefined);
});

test('upload a file using the fromStream method after another upload', async (t) => {
	const diskStorage = multer.diskStorage({
		destination: path.join(__dirname, 'attachments'),
		filename: (request_, file, cb) => {
			cb(null, 'test_disk.jpg');
		},
	});
	const upload = multer({storage: diskStorage});
	const app = express();
	const route = defer();
	app.post('/url', upload.single('photos'), (request, response) => {
		const storage = new GridFsStorage({
			...storageOptions(),
			file: () => 'test.jpg',
		});
		t.context.storage = storage;
		const {file} = request;
		const stream = fs.createReadStream(file.path);
		storage
			.fromStream(stream, request, file)
			/* eslint-disable-next-line promise/prefer-await-to-then */
			.then((file) => route.resolve(file))
			.catch((error) => route.reject(error));
		response.end();
	});

	await request(app).post('/url').attach('photos', files[0]);
	const result = await route.promise;
	t.true(hasOwn(result, 'filename'));
	t.is(result.filename, 'test.jpg');
	t.is(result.contentType, 'image/jpeg');
});
