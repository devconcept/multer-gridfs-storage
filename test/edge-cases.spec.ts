import crypto from 'crypto';
import { Writable } from 'stream';
import { test, expect, afterEach } from 'vitest';
import multer from 'multer';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { MongoClient } from 'mongodb';
import delay from 'delay';
import { spy, stub, restore } from 'sinon';

import { GridFsStorage } from '../src';
import { storageOptions } from './utils/settings';
import { files, cleanStorage, fakeConnectCb } from './utils/testutils';

// Per-test state is kept in a module-scoped variable. Vitest runs the tests within a file
// sequentially, so a single shared variable is safe (no concurrent overwrite).
let storage: any;

test('connection function fails to connect', async () => {
	const error = new Error('Failed connection');
	const mongoSpy = stub(MongoClient, 'connect').callsFake(fakeConnectCb(error) as any);

	const connectionSpy = spy();
	// Not tracked for cleanup (the connection fails), matching the original test.
	const failed = new GridFsStorage(storageOptions());

	failed.once('connectionFailed', connectionSpy);

	await delay(50);
	expect(connectionSpy.callCount).toBe(1);
	expect(mongoSpy.callCount).toBe(1);
});

test('errors generating random bytes', async () => {
	const app = express();
	const generatedError = new Error('Random bytes error');
	let error: any = {};

	storage = new GridFsStorage(storageOptions());
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
	const upload = multer({ storage });

	app.post('/url', upload.single('photo'), (error_: any, request_: Request, response: Response, next: NextFunction) => {
		error = error_;
		next();
	});

	await storage.ready();
	await request(app).post('/url').attach('photo', files[0]);

	expect(error).toBe(generatedError);
	expect(error.message).toBe('Random bytes error');
	// Assert on the callback-style invocation the library makes; form-data may also call
	// randomBytes synchronously for its boundary, which should not count here.
	const callbackCalls = randomBytesSpy.getCalls().filter((call) => typeof call.args[1] === 'function');
	expect(callbackCalls.length).toBe(1);
});

test('errors when the write stream finishes without storing a file', async () => {
	const app = express();
	let error: any = null;

	storage = new GridFsStorage(storageOptions());
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

	expect(error).toBeInstanceOf(Error);
	expect(error.message).toBe('GridFS write stream finished without storing a file');
	expect(streamErrorSpy.callCount).toBe(1);
});

afterEach(async () => {
	restore();
	await cleanStorage(storage);
	storage = undefined;
});
