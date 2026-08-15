import { test, expect, afterEach } from 'vitest';
import multer from 'multer';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { MongoClient } from 'mongodb';
import { spy, restore } from 'sinon';

import { GridFsStorage } from '../src';
import { storageOptions } from './utils/settings';
import { files, cleanStorage, getDb, getClient, dropDatabase, ErrorReadableStream, ErrorWritableStream } from './utils/testutils';

let storage: any;
let usedUrl: string;

afterEach(async () => {
	restore();
	await cleanStorage(storage);
	await dropDatabase(usedUrl);
	storage = undefined;
	usedUrl = undefined as any;
});

test('invalid configurations', () => {
	// @ts-expect-error intentionally invalid configuration
	const errorFn = () => new GridFsStorage({});
	// @ts-expect-error intentionally invalid configuration
	const errorFn2 = () => new GridFsStorage();

	expect(errorFn).toThrow('Error creating storage engine. At least one of url or db option must be provided.');
	expect(errorFn2).toThrow('Error creating storage engine. At least one of url or db option must be provided.');
});

test('invalid types as file configurations', async () => {
	let error: any = {};
	const app = express();
	storage = new GridFsStorage({
		...storageOptions(),
		file: () => true,
	});
	const upload = multer({ storage });
	app.post('/url', upload.single('photo'), (error_: any, request_: Request, response: Response, next: NextFunction) => {
		error = error_;
		next();
	});

	await storage.ready();
	await request(app).post('/url').attach('photo', files[0]);

	expect(error instanceof Error).toBe(true);
	expect(error.message).toBe('Invalid type for file settings, got boolean');
});

test('fails gracefully if an error is thrown inside the configuration function', async () => {
	let error: any = {};
	const app = express();
	storage = new GridFsStorage({
		...storageOptions(),
		file: () => {
			throw new Error('Error thrown');
		},
	});

	const upload = multer({ storage });

	app.post('/url', upload.single('photo'), (error_: any, request_: Request, response: Response, next: NextFunction) => {
		error = error_;
		next();
	});

	await storage.ready();
	await request(app).post('/url').attach('photo', files[0]);

	expect(error instanceof Error).toBe(true);
	expect(error.message).toBe('Error thrown');
});

test('fails gracefully if an error is thrown inside a generator function', async () => {
	let error: any = {};
	const app = express();
	storage = new GridFsStorage({
		...storageOptions(),
		/* eslint-disable-next-line require-yield */
		*file() {
			throw new Error('File error');
		},
	});

	const upload = multer({ storage });

	app.post('/url', upload.single('photo'), (error_: any, request_: Request, response: Response, next: NextFunction) => {
		error = error_;
		next();
	});

	await storage.ready();
	await request(app).post('/url').attach('photo', files[0]);

	expect(error instanceof Error).toBe(true);
	expect(error.message).toBe('File error');
});

test('connection promise fails to connect', async () => {
	const error = new Error('Failed promise');
	const app = express();
	const errorSpy = spy();

	const promise: Promise<any> = new Promise((resolve, reject) => {
		setTimeout(() => {
			reject(error);
		}, 200);
	});

	// Local (not the module var): this storage never connects, so it is not tracked for cleanup.
	const storage = new GridFsStorage({ db: promise });

	const upload = multer({ storage });

	app.post('/url', upload.single('photo'), (error_: any, request_: Request, response: Response, _next: NextFunction) => {
		response.end();
	});

	storage.on('connectionFailed', errorSpy);

	await request(app).post('/url').attach('photo', files[0]);

	expect(errorSpy.callCount).toBe(1);
	expect(errorSpy.calledWith(error)).toBe(true);
	expect(storage.db).toBe(null);
});

test('connection is not opened', async () => {
	const { url, options } = storageOptions();
	usedUrl = url;
	let error: any = {};
	const app = express();
	const _db = await MongoClient.connect(url, options);
	const db = getDb(_db, url);
	const client = getClient(_db);
	await (client ? client.close(true) : (db as any).close());

	// Local (not the module var): the client is deliberately closed, so this storage must not be
	// handed to cleanStorage (its dropDatabase would throw against the closed client).
	const storage = new GridFsStorage({ db });
	const upload = multer({ storage });

	app.post('/url', upload.array('photos', 2), (error_: any, request_: Request, response: Response, next: NextFunction) => {
		error = error_;
		next();
	});

	await request(app).post('/url').attach('photos', files[0]).attach('photos', files[0]);

	expect(error instanceof Error).toBe(true);
	// The driver throws on operations against a closed client
	expect(error.message).toBe('Client must be connected before running operations');
});

test('event is emitted when there is an error in the database', async () => {
	const { url, options } = storageOptions();
	usedUrl = url;
	const error = new Error('Database error');
	const errorSpy = spy();
	const client = await MongoClient.connect(url, options);
	const db = getDb(client, url);

	storage = new GridFsStorage({ db });
	storage.on('dbError', errorSpy);
	const evtSource = client;
	evtSource.emit('error', error);
	(evtSource as unknown as NodeJS.EventEmitter).emit('error');

	expect(errorSpy.callCount).toBe(2);
	expect(errorSpy.getCall(0).args[0]).toBe(error);
	expect(errorSpy.getCall(1).args[0] instanceof Error).toBe(true);
});

test('error event is emitted when there is an error in the readable stream using fromStream', async () => {
	const { url, options } = storageOptions();
	usedUrl = url;
	const _db = await MongoClient.connect(url, options);
	const db = getDb(_db, url);

	const stream = new ErrorReadableStream();

	storage = new GridFsStorage({ db });

	await expect(storage.fromStream(stream, {} as any, {} as any)).rejects.toThrow();
});

test('error event is emitted when there is an error in the writable stream', async () => {
	class StorageStub extends GridFsStorage {
		protected createStream(_options: any): any {
			return new ErrorWritableStream();
		}
	}

	const { url, options } = storageOptions();
	usedUrl = url;
	const _db = await MongoClient.connect(url, options);
	const db = getDb(_db, url);
	storage = new StorageStub({ db });
	const errorSpy = spy();
	const upload = multer({ storage });
	const app = express();

	storage.on('streamError', errorSpy);
	app.post('/url', upload.single('photo'), (error_: any, request_: Request, response: Response, next: NextFunction) => {
		next();
	});

	await request(app).post('/url').attach('photo', files[0]);

	expect(errorSpy.callCount).toBe(1);
});
