import fs from 'fs';
import { test, expect, afterEach } from 'vitest';
import hasOwn from 'has-own-prop';
import multer from 'multer';
import express from 'express';
import request from 'supertest';
import path from 'path';
import { fileURLToPath } from 'node:url';

import { GridFsStorage } from '../src';
import { cleanStorage, defer, files } from './utils/testutils';
import { storageOptions } from './utils/settings';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let storage: any;
let result: any;

afterEach(async () => {
	const testFile = path.join(__dirname, 'attachments', 'test_disk.jpg');
	// `force: true` removes the file if present and is a no-op when it is already
	// gone, avoiding a race between concurrent cleanups on this shared file.
	await fs.promises.rm(testFile, { force: true });
	await cleanStorage(storage);
});

test('generate 16 byte hex string', async () => {
	const { generateBytes } = GridFsStorage;
	const generated: any = await generateBytes();
	expect(hasOwn(generated, 'filename')).toBe(true);
	expect(generated.filename).toMatch(/^[a-f\d]{32}$/);
});

test('upload a file using the fromFile method', async () => {
	storage = new GridFsStorage({
		...storageOptions(),
		file: () => 'test.jpg',
	});
	await storage.ready();
	const file = { stream: fs.createReadStream(files[0]), mimetype: 'image/jpeg' };
	result = await storage.fromFile(null, file);
	expect(hasOwn(result, 'filename')).toBe(true);
	expect(result.filename).toBe('test.jpg');
	expect(result.contentType).toBe('image/jpeg');
});

test('upload a file using the fromStream method', async () => {
	storage = new GridFsStorage({
		...storageOptions(),
		file: () => 'test.jpg',
	});
	await storage.ready();
	const stream = fs.createReadStream(files[0]);
	result = await storage.fromStream(stream);
	expect(hasOwn(result, 'filename')).toBe(true);
	expect(result.filename).toBe('test.jpg');
	expect(result.contentType).toBe(undefined);
});

test('upload a file using the fromStream method after another upload', async () => {
	const diskStorage = multer.diskStorage({
		destination: path.join(__dirname, 'attachments'),
		filename: (request_, file, cb) => {
			cb(null, 'test_disk.jpg');
		},
	});
	const upload = multer({ storage: diskStorage });
	const app = express();
	const route = defer<any>();
	app.post('/url', upload.single('photos'), (request, response) => {
		storage = new GridFsStorage({
			...storageOptions(),
			file: () => 'test.jpg',
		});
		const file = request.file as Express.Multer.File;
		const stream = fs.createReadStream(file.path);
		storage
			.fromStream(stream, request, file)
			.then((file: any) => route.resolve(file))
			.catch((error: any) => route.reject(error));
		response.end();
	});

	await request(app).post('/url').attach('photos', files[0]);
	result = await route.promise;
	expect(hasOwn(result, 'filename')).toBe(true);
	expect(result.filename).toBe('test.jpg');
	expect(result.contentType).toBe('image/jpeg');
});
