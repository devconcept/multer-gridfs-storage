import anyTest, { TestFn, ExecutionContext } from 'ava';
import express, { Request, Response } from 'express';
import request from 'supertest';
import multer from 'multer';
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import { GridFsStorage, UrlStorageOptions, DbStorageOptions, DbTypes } from '../src';
import { files, cleanStorage, getDb, getClient, dropDatabase } from './utils/testutils';
import { storageOptions } from './utils/settings';
import { filesMatchSource } from './utils/macros';
import { StorageConstructorContext } from './types/storage-constructor-context';

const test = anyTest as TestFn<StorageConstructorContext>;

function prepareTest(t: ExecutionContext<StorageConstructorContext>, options: UrlStorageOptions | DbStorageOptions) {
	const app = express();
	const storage = new GridFsStorage(options);
	const upload = multer({ storage });
	t.context.storage = storage;
	t.context.upload = upload;
	t.context.app = app;
}

test.afterEach.always('cleanup', async (t) => {
	const { storage, url } = t.context;
	await cleanStorage(storage);
	return dropDatabase(url);
});

test('create storage from url parameter', async (t) => {
	let result: any = {};
	prepareTest(t, storageOptions());
	const { app, storage, upload } = t.context;

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

	return filesMatchSource(t, result.files);
});

test('create storage from db parameter', async (t) => {
	const { url, options } = storageOptions();
	t.context.url = url;
	let result: any = {};
	const _db = await MongoClient.connect(url, options);
	const db = getDb(_db, url);
	prepareTest(t, { db });
	const { app, storage, upload } = t.context;

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

	return filesMatchSource(t, result.files);
});

test('connects to a mongoose instance', async (t) => {
	const { url, options } = storageOptions();
	t.context.url = url;
	let result: any = {};
	const promise = mongoose.connect(url, options);
	prepareTest(t, { db: promise as unknown as Promise<DbTypes> });
	const { app, storage, upload } = t.context;

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

	t.true(db instanceof mongoose.mongo.Db);
	await filesMatchSource(t, result.files);
});

test('creates an instance without the new keyword', async (t) => {
	let result: any = {};
	const app = express();
	// @ts-expect-error calling constructor without new is intentional
	const storage = GridFsStorage(storageOptions());

	const upload = multer({ storage });
	t.context.storage = storage;

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

	return filesMatchSource(t, result.files);
});

test('client is derived from the db', async (t) => {
	const { url, options } = storageOptions();
	t.context.url = url;
	let result: any = {};
	const _db = await MongoClient.connect(url, options);
	const db = getDb(_db, url);
	const client = getClient(_db);
	prepareTest(t, { db });
	const { app, storage, upload } = t.context;
	t.is(storage.db.client, client);

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

	return filesMatchSource(t, result.files);
});
