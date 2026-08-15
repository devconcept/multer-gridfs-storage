import { test, expect, beforeAll, afterAll } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import multer from 'multer';

import { GridFsStorage } from '../src';
import { files, cleanStorage } from './utils/testutils';
import { storageOptions } from './utils/settings';

let storage: any;
let error: any;

beforeAll(async () => {
	const app = express();
	storage = new GridFsStorage({
		...storageOptions(),
		*file() {
			yield { filename: 'name' };
		},
	});
	const upload = multer({ storage });

	app.post('/url', upload.array('photos', 2), (error_: any, request_: Request, response: Response, _next: NextFunction) => {
		error = error_;
		response.end();
	});

	await storage.ready();
	await request(app).post('/url').attach('photos', files[0]).attach('photos', files[1]);
});

afterAll(async () => {
	await cleanStorage(storage);
});

test('is a failed request', () => {
	expect(error instanceof Error).toBe(true);
	expect(error.storageErrors.length).toBe(0);
});

test('does not upload any file', async () => {
	const { db } = storage;
	const collection = await db.collection('fs.files');
	const count = await (collection.estimatedDocumentCount ? collection.estimatedDocumentCount() : collection.count());
	expect(count).toBe(0);
});

test('throws an error about the ended generator', () => {
	expect(error.message).toMatch(/Generator ended unexpectedly/);
});
