import crypto from 'crypto';
import { Writable } from 'stream';
import anyTest, { TestFn } from 'ava';
import multer from 'multer';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { MongoClient } from 'mongodb';
import delay from 'delay';
import { spy, stub, restore } from 'sinon';

import { GridFsStorage } from '../src';
import { storageOptions } from './utils/settings';
import { files, cleanStorage, fakeConnectCb } from './utils/testutils';
import { EdgeCasesContext } from './types/edge-cases-context';

const test = anyTest as TestFn<EdgeCasesContext>;

test.serial('connection function fails to connect', async (t) => {
	const error = new Error('Failed connection');
	const mongoSpy = stub(MongoClient, 'connect').callsFake(fakeConnectCb(error) as any);

	const connectionSpy = spy();
	const storage = new GridFsStorage(storageOptions());

	storage.once('connectionFailed', connectionSpy);

	await delay(50);
	t.is(connectionSpy.callCount, 1);
	t.is(mongoSpy.callCount, 1);
});

test.serial('errors generating random bytes', async (t) => {
	const app = express();
	const generatedError = new Error('Random bytes error');
	let error: any = {};

	const storage = new GridFsStorage(storageOptions());
	const originalRandomBytes = crypto.randomBytes;
	const randomBytesSpy = stub(crypto, 'randomBytes').callsFake((size, cb) => {
		// The storage engine calls randomBytes with a callback; fail only that path.
		if (typeof cb === 'function') {
			cb(generatedError, Buffer.alloc(0));
			return;
		}

		// Other consumers (e.g. form-data generating the multipart boundary) use the
		// synchronous form and must keep working, so delegate to the real implementation.
		return (originalRandomBytes as any)(size);
	});
	t.context.storage = storage;
	const upload = multer({ storage });

	app.post('/url', upload.single('photo'), (error_: any, request_: Request, response: Response, next: NextFunction) => {
		error = error_;
		next();
	});

	await storage.ready();
	await request(app).post('/url').attach('photo', files[0]);

	t.is(error, generatedError);
	t.is(error.message, 'Random bytes error');
	// Assert on the callback-style invocation the library makes; form-data may also call
	// randomBytes synchronously for its boundary, which should not count here.
	const callbackCalls = randomBytesSpy.getCalls().filter((call) => typeof call.args[1] === 'function');
	t.is(callbackCalls.length, 1);
});

test.serial('errors when the write stream finishes without storing a file', async (t) => {
	const app = express();
	let error: any = null;

	const storage = new GridFsStorage(storageOptions());
	t.context.storage = storage;
	await storage.ready();

	// Return a writable sink that discards data and exposes no `gridFSFile`, simulating a `finish`
	// event without a stored document. Without the else branch this would leave the request hanging.
	const sink = new Writable({
		write(chunk, encoding, callback) {
			callback();
		},
	});
	stub(storage as any, 'createStream').returns(sink);

	const streamErrorSpy = spy();
	storage.on('streamError', streamErrorSpy);

	const upload = multer({ storage });
	app.post('/url', upload.single('photo'), (error_: any, request_: Request, response: Response, next: NextFunction) => {
		error = error_;
		next();
	});

	await request(app).post('/url').attach('photo', files[0]);

	t.true(error instanceof Error);
	t.is(error.message, 'GridFS write stream finished without storing a file');
	t.is(streamErrorSpy.callCount, 1);
});

test.serial.afterEach.always(async (t) => {
	restore();
	await cleanStorage(t.context.storage);
});
