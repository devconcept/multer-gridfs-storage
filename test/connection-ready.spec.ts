import { test, expect, afterEach, describe } from 'vitest';
import { MongoClient } from 'mongodb';
import { spy, restore, stub } from 'sinon';

import { GridFsStorage } from '../src';
import { cleanStorage, fakeConnectCb } from './utils/testutils';
import { storageOptions } from './utils/settings';

let storage: any;
let forcedError: Error;

function createStorage() {
	storage = new GridFsStorage(storageOptions());
}

function forceFailure() {
	forcedError = new Error('Fake error');
	stub(MongoClient, 'connect').callsFake(fakeConnectCb(forcedError) as any);
	createStorage();
}

describe('ready()', () => {
	afterEach(async () => {
		restore();
		await cleanStorage(storage);
	});

	test('returns a promise that rejects when the connection fails', async () => {
		forceFailure();
		const resolveSpy = spy();
		const rejectSpy = spy();
		storage.once('connection', resolveSpy);
		storage.once('connectionFailed', rejectSpy);

		const result = storage.ready();
		expect(typeof result.then).toBe('function');
		let error: any;
		try {
			await result;
		} catch (error_) {
			error = error_;
		}

		expect(resolveSpy.callCount).toBe(0);
		expect(rejectSpy.callCount).toBe(1);
		expect(error).toBe(rejectSpy.getCall(0).args[0]);
		expect(error).toBe(forcedError);
	});

	test('returns a promise that rejects if the module already failed connecting', async () => {
		forceFailure();
		const evtError: any = await new Promise((resolve) => storage.once('connectionFailed', resolve));
		const result = storage.ready();
		expect(typeof result.then).toBe('function');
		let error: any;
		try {
			await result;
		} catch (error_) {
			error = error_;
		}

		expect(error).toBe(evtError);
		expect(error).toBe(forcedError);
	});

	test('returns a promise that resolves when the connection is created', async () => {
		createStorage();
		const resolveSpy = spy();
		const rejectSpy = spy();
		storage.once('connection', resolveSpy);
		storage.once('connectionFailed', rejectSpy);
		const result = storage.ready();
		const { db } = await result;
		expect(typeof result.then).toBe('function');
		expect(resolveSpy.callCount).toBe(1);
		expect(db).not.toBe(null);
	});

	test('returns a promise that resolves if the connection is already created', async () => {
		createStorage();
		await new Promise((resolve) => storage.once('connection', resolve));
		const result = storage.ready();
		expect(typeof result.then).toBe('function');
		const resolved = await result;
		expect(resolved).toBeTruthy();
		expect(resolved.db).toBe(storage.db);
	});
});
