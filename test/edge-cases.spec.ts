import { Writable } from 'stream';
import { test, expect, afterEach, describe } from 'vitest';
import multer from 'multer';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import delay from 'delay';
import { spy, stub, restore } from 'sinon';

import { GridFsStorage } from '../src';
import { storageOptions } from './utils/settings';
import { files, cleanStorage } from './utils/testutils';

// Per-test state is kept in a module-scoped variable. Vitest runs the tests within a file
// sequentially, so a single shared variable is safe (no concurrent overwrite).
let storage: any;

describe('edge cases', () => {
	test('connection function fails to connect', async () => {
		const error = new Error('Failed connection');
		const openSpy = stub(GridFsStorage.prototype as any, '_openConnection').rejects(error);

		const connectionSpy = spy();
		// Not tracked for cleanup (the connection fails), matching the original test.
		const failed = new GridFsStorage(storageOptions());

		failed.once('connectionFailed', connectionSpy);

		await delay(50);
		expect(connectionSpy.callCount).toBe(1);
		expect(openSpy.callCount).toBe(1);
	});

	test('errors generating random bytes', async () => {
		const app = express();
		const generatedError = new Error('Random bytes error');
		let error: any = {};

		storage = new GridFsStorage(storageOptions());
		// Stub the promisified byte generator attached to the storage class rather than the global
		// crypto.randomBytes, so unrelated consumers (e.g. form-data's multipart boundary) are untouched.
		const randomBytesSpy = stub(GridFsStorage as any, '_randomBytes').rejects(generatedError);
		const upload = multer({ storage });

		app.post('/url', upload.single('photo'), (error_: any, request_: Request, response: Response, next: NextFunction) => {
			error = error_;
			next();
		});

		await storage.ready();
		await request(app).post('/url').attach('photo', files[0]);

		expect(error).toBe(generatedError);
		expect(error.message).toBe('Random bytes error');
		expect(randomBytesSpy.calledOnce).toBe(true);
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
});
