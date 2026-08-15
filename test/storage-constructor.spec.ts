import { test, expect, afterEach } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import multer from 'multer';
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import { GridFsStorage, UrlStorageOptions, DbStorageOptions, DbTypes } from '../src';
import { files, cleanStorage, getDb, getClient, dropDatabase } from './utils/testutils';
import { storageOptions } from './utils/settings';
import { filesMatchSource } from './utils/macros';

let storage: any;
let upload: any;
let app: any;
let usedUrl: string;

function prepareTest(options: UrlStorageOptions | DbStorageOptions) {
	app = express();
	storage = new GridFsStorage(options);
	upload = multer({ storage });
}

afterEach(async () => {
	await cleanStorage(storage);
	await dropDatabase(usedUrl);
	usedUrl = undefined as any;
});

test('create storage from url parameter', async () => {
	let result: any = {};
	prepareTest(storageOptions());

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

	filesMatchSource(result.files);
});

test('create storage from db parameter', async () => {
	const { url, options } = storageOptions();
	usedUrl = url;
	let result: any = {};
	const _db = await MongoClient.connect(url, options);
	const db = getDb(_db, url);
	prepareTest({ db });

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

	filesMatchSource(result.files);
});

test('connects to a mongoose instance', async () => {
	const { url, options } = storageOptions();
	usedUrl = url;
	let result: any = {};
	const promise = mongoose.connect(url, options);
	prepareTest({ db: promise as unknown as Promise<DbTypes> });

	app.post('/url', upload.array('photos', 2), (request_: Request, response: Response) => {
		result = {
			headers: request_.headers,
			files: request_.files,
			body: request_.body,
		};
		response.end();
	});

	const { db } = await storage.ready();
	await request(app).post('/url').attach('photos', files[0]).attach('photos', files[1]);

	expect(db instanceof mongoose.mongo.Db).toBe(true);
	filesMatchSource(result.files);
});

test('creates an instance without the new keyword', async () => {
	let result: any = {};
	app = express();
	// @ts-expect-error calling constructor without new is intentional
	storage = GridFsStorage(storageOptions());

	upload = multer({ storage });

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

	filesMatchSource(result.files);
});

test('client is derived from the db', async () => {
	const { url, options } = storageOptions();
	usedUrl = url;
	let result: any = {};
	const _db = await MongoClient.connect(url, options);
	const db = getDb(_db, url);
	const client = getClient(_db);
	prepareTest({ db });
	expect(storage.db.client).toBe(client);

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

	filesMatchSource(result.files);
});
