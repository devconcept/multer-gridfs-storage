import { test, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import multer from 'multer';

import { GridFsStorage } from '../src';
import { files, cleanStorage } from './utils/testutils';
import { storageOptions } from './utils/settings';

let storage: any;
let result: any;

beforeAll(async () => {
	const app = express();
	storage = new GridFsStorage(storageOptions());
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
});

afterAll(async () => {
	await cleanStorage(storage);
});

test('files don’t have an md5 hash', () => {
	// md5 support was removed from GridFS in the mongodb driver 4.0.0, so stored
	// files never carry an md5 property.
	expect('md5' in result.files[0]).toBe(false);
	expect('md5' in result.files[1]).toBe(false);
});
