import anyTest, { TestFn } from 'ava';
import multer from 'multer';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { MongoClient } from 'mongodb';
import { spy, restore } from 'sinon';

import { GridFsStorage } from '../src';
import { storageOptions } from './utils/settings';
import { files, cleanStorage, getDb, getClient, dropDatabase, ErrorReadableStream, ErrorWritableStream } from './utils/testutils';
import { ErrorHandlingContext } from './types/error-handling-context';

const test = anyTest as TestFn<ErrorHandlingContext>;

test.afterEach.always(async (t) => {
	restore();
	await cleanStorage(t.context.storage);
	return dropDatabase(t.context.url);
});

test('invalid configurations', (t) => {
	// @ts-expect-error intentionally invalid configuration
	const errorFn = () => new GridFsStorage({});
	// @ts-expect-error intentionally invalid configuration
	const errorFn2 = () => new GridFsStorage();

	t.throws(errorFn, {
		message: 'Error creating storage engine. At least one of url or db option must be provided.',
	});
	t.throws(errorFn2, {
		message: 'Error creating storage engine. At least one of url or db option must be provided.',
	});
});

test('invalid types as file configurations', async (t) => {
	let error: any = {};
	const app = express();
	const storage = new GridFsStorage({
		...storageOptions(),
		file: () => true,
	});
	t.context.storage = storage;
	const upload = multer({ storage });
	app.post('/url', upload.single('photo'), (error_: any, request_: Request, response: Response, next: NextFunction) => {
		error = error_;
		next();
	});

	await storage.ready();
	await request(app).post('/url').attach('photo', files[0]);

	t.true(error instanceof Error);
	t.is(error.message, 'Invalid type for file settings, got boolean');
});

test('fails gracefully if an error is thrown inside the configuration function', async (t) => {
	let error: any = {};
	const app = express();
	const storage = new GridFsStorage({
		...storageOptions(),
		file: () => {
			throw new Error('Error thrown');
		},
	});
	t.context.storage = storage;

	const upload = multer({ storage });

	app.post('/url', upload.single('photo'), (error_: any, request_: Request, response: Response, next: NextFunction) => {
		error = error_;
		next();
	});

	await storage.ready();
	await request(app).post('/url').attach('photo', files[0]);

	t.true(error instanceof Error);
	t.is(error.message, 'Error thrown');
});

test('fails gracefully if an error is thrown inside a generator function', async (t) => {
	let error: any = {};
	const app = express();
	const storage = new GridFsStorage({
		...storageOptions(),
		/* eslint-disable-next-line require-yield */
		*file() {
			throw new Error('File error');
		},
	});
	t.context.storage = storage;

	const upload = multer({ storage });

	app.post('/url', upload.single('photo'), (error_: any, request_: Request, response: Response, next: NextFunction) => {
		error = error_;
		next();
	});

	await storage.ready();
	await request(app).post('/url').attach('photo', files[0]);

	t.true(error instanceof Error);
	t.is(error.message, 'File error');
});

test('connection promise fails to connect', async (t) => {
	const error = new Error('Failed promise');
	const app = express();
	const errorSpy = spy();

	const promise: Promise<any> = new Promise((resolve, reject) => {
		setTimeout(() => {
			reject(error);
		}, 200);
	});

	const storage = new GridFsStorage({ db: promise });

	const upload = multer({ storage });

	app.post('/url', upload.single('photo'), (error_: any, request_: Request, response: Response, _next: NextFunction) => {
		response.end();
	});

	storage.on('connectionFailed', errorSpy);

	await request(app).post('/url').attach('photo', files[0]);

	t.is(errorSpy.callCount, 1);
	t.true(errorSpy.calledWith(error));
	t.is(storage.db, null);
});

test('connection is not opened', async (t) => {
	const { url, options } = storageOptions();
	t.context.url = url;
	let error: any = {};
	const app = express();
	const _db = await MongoClient.connect(url, options);
	const db = getDb(_db, url);
	const client = getClient(_db);
	await (client ? client.close(true) : (db as any).close());

	const storage = new GridFsStorage({ db });
	const upload = multer({ storage });

	app.post('/url', upload.array('photos', 2), (error_: any, request_: Request, response: Response, next: NextFunction) => {
		error = error_;
		next();
	});

	await request(app).post('/url').attach('photos', files[0]).attach('photos', files[0]);

	t.true(error instanceof Error);
	// The driver throws on operations against a closed client
	t.is(error.message, 'Client must be connected before running operations');
});

test('event is emitted when there is an error in the database', async (t) => {
	const { url, options } = storageOptions();
	t.context.url = url;
	const error = new Error('Database error');
	const errorSpy = spy();
	const client = await MongoClient.connect(url, options);
	const db = getDb(client, url);

	const storage = new GridFsStorage({ db });
	t.context.storage = storage;
	storage.on('dbError', errorSpy);
	const evtSource = client;
	evtSource.emit('error', error);
	(evtSource as unknown as NodeJS.EventEmitter).emit('error');

	t.is(errorSpy.callCount, 2);
	t.is(errorSpy.getCall(0).args[0], error);
	t.true(errorSpy.getCall(1).args[0] instanceof Error);
});

test('error event is emitted when there is an error in the readable stream using fromStream', async (t) => {
	const { url, options } = storageOptions();
	t.context.url = url;
	const _db = await MongoClient.connect(url, options);
	const db = getDb(_db, url);

	const stream = new ErrorReadableStream();

	const storage = new GridFsStorage({ db });
	t.context.storage = storage;

	await t.throwsAsync(async () => storage.fromStream(stream, {} as any, {} as any));
});

test('error event is emitted when there is an error in the writable stream', async (t) => {
	class StorageStub extends GridFsStorage {
		protected createStream(_options: any): any {
			return new ErrorWritableStream();
		}
	}

	const { url, options } = storageOptions();
	t.context.url = url;
	const _db = await MongoClient.connect(url, options);
	const db = getDb(_db, url);
	const storage = new StorageStub({ db });
	t.context.storage = storage;
	const errorSpy = spy();
	const upload = multer({ storage });
	const app = express();

	storage.on('streamError', errorSpy);
	app.post('/url', upload.single('photo'), (error_: any, request_: Request, response: Response, next: NextFunction) => {
		next();
	});

	await request(app).post('/url').attach('photo', files[0]);

	t.is(errorSpy.callCount, 1);
});
