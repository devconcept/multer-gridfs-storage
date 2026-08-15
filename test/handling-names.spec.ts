import { test, expect, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import multer from 'multer';

import { GridFsStorage } from '../src';
import { files, cleanStorage } from './utils/testutils';
import { storageOptions } from './utils/settings';

let storage: any;

afterEach(async () => {
	await cleanStorage(storage);
});

test('handling empty name values', async () => {
	const app = express();
	const values = [null, undefined, {}];
	let counter = -1;
	let result: any = {};

	storage = new GridFsStorage({
		...storageOptions(),
		file: () => {
			counter++;
			return values[counter];
		},
	});
	const upload = multer({ storage });

	app.post('/url', upload.array('photo', 3), (request_, response) => {
		result = {
			headers: request_.headers,
			files: request_.files,
			body: request_.body,
		};
		response.end();
	});

	await storage.ready();
	await request(app).post('/url').attach('photo', files[0]).attach('photo', files[0]).attach('photo', files[0]);

	for (const file of result.files) expect(file.filename).toMatch(/^[\da-f]{32}$/);
	for (const file of result.files) expect(file.metadata).toBe(null);
	for (const file of result.files) expect(file.bucketName).toBe('fs');
	for (const file of result.files) expect(file.chunkSize).toBe(261_120);
});

test('handling primitive values as names', async () => {
	const app = express();
	const values = ['name', 10];
	let counter = -1;
	let result: any = {};

	storage = new GridFsStorage({
		...storageOptions(),
		file: () => {
			counter++;
			return values[counter];
		},
	});
	const upload = multer({ storage });

	app.post('/url', upload.array('photo', 2), (request_, response) => {
		result = {
			headers: request_.headers,
			files: request_.files,
			body: request_.body,
		};
		response.end();
	});

	await storage.ready();
	await request(app).post('/url').attach('photo', files[0]).attach('photo', files[0]);

	for (const [idx, f] of result.files.entries()) expect(f.filename).toBe(values[idx].toString());
	for (const file of result.files) expect(file.metadata).toBe(null);
	for (const file of result.files) expect(file.bucketName).toBe('fs');
	for (const file of result.files) expect(file.chunkSize).toBe(261_120);
});
