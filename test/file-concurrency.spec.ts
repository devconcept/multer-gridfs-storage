import { test, expect, afterEach, describe } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import multer from 'multer';
import { MongoClient } from 'mongodb';
import delay from 'delay';

import { GridFsStorage } from '../src';
import { storageOptions } from './utils/settings';
import { filesMatchSource } from './utils/macros';
import { files, cleanStorage, getDb, getClient, dropDatabase } from './utils/testutils';

let storage: any;
let upload: any;
let app: any;
let usedUrl: string;
let db: any;
let client: any;

function prepareTest(error?: Error) {
	const { url, options } = storageOptions();
	usedUrl = url;
	app = express();
	const promised = error
		? delay(500).then(async () => Promise.reject(error))
		: delay(500)
				.then(async () => MongoClient.connect(url, options))
				.then((connected) => {
					db = getDb(connected, url);
					client = getClient(connected);
					return db;
				});

	storage = new GridFsStorage({ db: promised });
	upload = multer({ storage });
}

describe('uploads while the connection is opening', () => {
	afterEach(async () => {
		await cleanStorage(storage, { db, client });
		await dropDatabase(usedUrl);
		db = undefined;
		client = undefined;
		usedUrl = undefined as any;
	});

	test('buffers incoming files while the connection is opening', async () => {
		let result: any = {};
		prepareTest();

		app.post('/url', upload.array('photos', 2), (request_: Request, response: Response) => {
			result = {
				headers: request_.headers,
				files: request_.files,
				body: request_.body,
			};
			response.end();
		});

		await request(app).post('/url').attach('photos', files[0]).attach('photos', files[1]);

		await storage.ready();
		filesMatchSource(result.files);
	});

	test('rejects incoming files if the connection does not open', async () => {
		let result: any = {};
		const error = new Error('Failed error');
		prepareTest(error);

		app.post('/url', upload.array('photos', 2), (error_: any, request_: Request, response: Response, _next: NextFunction) => {
			result = error_;
			response.end();
		});
		await request(app).post('/url').attach('photos', files[0]).attach('photos', files[1]);

		await storage.ready().catch(() => '');
		expect(result).toBe(error);
		expect(result.message).toBe('Failed error');
	});
});
