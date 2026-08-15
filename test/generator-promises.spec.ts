import { test, expect, afterEach } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import multer from 'multer';

import { GridFsStorage } from '../src';
import { files, cleanStorage } from './utils/testutils';
import { storageOptions } from './utils/settings';

let storage: any;
let result: any;
let error: any;
let filePrefix: string;
let rejectedError: Error;

async function successfulPromiseSetup() {
	const app = express();
	filePrefix = 'file';
	storage = new GridFsStorage({
		...storageOptions(),
		*file() {
			let counter = 0;
			for (;;) {
				yield Promise.resolve({
					filename: filePrefix + (counter + 1).toString(),
				});
				counter++;
			}
		},
	});

	const upload = multer({ storage });

	app.post('/url', upload.array('photos', 2), (request_: Request, response: Response) => {
		result = {
			headers: request_.headers,
			files: request_.files,
			body: request_.body,
		};
		response.end();
	});

	await storage.ready();
	await request(app).post('/url').attach('photos', files[0]).attach('photos', files[1]);
}

afterEach(async () => {
	await cleanStorage(storage);
});

test('yielding a promise is resolved as file configuration', async () => {
	await successfulPromiseSetup();
	expect(Array.isArray(result.files)).toBe(true);
	expect(result.files.length).toBe(2);
	for (const [idx, f] of result.files.entries()) expect(f.filename).toBe(filePrefix + (idx + 1));
});

async function failedPromiseSetup() {
	const app = express();
	rejectedError = new Error('reason');
	storage = new GridFsStorage({
		...storageOptions(),
		*file() {
			yield Promise.reject(rejectedError);
		},
	});
	const upload = multer({ storage });

	app.post('/url', upload.array('photos', 2), (error_: any, request_: Request, response: Response, next: NextFunction) => {
		error = error_;
		next();
	});

	await storage.ready();
	await request(app).post('/url').attach('photos', files[0]);
}

test('yielding a promise rejection is handled properly', async () => {
	await failedPromiseSetup();
	const { db } = storage;
	expect(error instanceof Error).toBe(true);
	expect(error).toBe(rejectedError);
	const collection = db.collection('fs.files');
	const count = await (collection.estimatedDocumentCount ? collection.estimatedDocumentCount() : collection.count());
	expect(count).toBe(0);
});
