import anyTest, { TestInterface, ExecutionContext } from 'ava';
import { MongoClient } from 'mongodb';
import { spy, restore, stub } from 'sinon';

import { GridFsStorage } from '../src';
import { cleanStorage, fakeConnectCb } from './utils/testutils';
import { storageOptions } from './utils/settings';
import { ConnectionReadyContext } from './types/connection-ready-context';

const test = anyTest as TestInterface<ConnectionReadyContext>;

test.afterEach.always('cleanup', async (t) => {
	const { storage } = t.context;
	restore();
	await cleanStorage(storage);
});

function createStorage(t: ExecutionContext<ConnectionReadyContext>) {
	t.context.storage = new GridFsStorage(storageOptions());
}

function forceFailure(t: ExecutionContext<ConnectionReadyContext>) {
	t.context.error = new Error('Fake error');
	stub(MongoClient, 'connect').callsFake(fakeConnectCb(t.context.error) as any);
	createStorage(t);
}

test.serial('returns a promise that rejects when the connection fails', async (t) => {
	forceFailure(t);
	const { storage } = t.context;
	const resolveSpy = spy();
	const rejectSpy = spy();
	storage.once('connection', resolveSpy);
	storage.once('connectionFailed', rejectSpy);

	const result = storage.ready();
	t.is(typeof result.then, 'function');
	const error = await t.throwsAsync(async () => {
		await result;
		t.is(resolveSpy.callCount, 0);
		t.is(rejectSpy.callCount, 1);
	});
	t.is(error, rejectSpy.getCall(0).args[0]);
	t.is(error, t.context.error);
});

test.serial.cb('returns a promise that rejects if the module already failed connecting', (t) => {
	forceFailure(t);
	const { storage } = t.context;
	storage.once('connectionFailed', (evtError: any) => {
		const result = storage.ready();
		t.is(typeof result.then, 'function');
		result.catch((error: any) => {
			t.is(error, evtError);
			t.is(error, t.context.error);
			t.end();
		});
	});
});

test('returns a promise that resolves when the connection is created', async (t) => {
	createStorage(t);
	const { storage } = t.context;
	const resolveSpy = spy();
	const rejectSpy = spy();
	storage.once('connection', resolveSpy);
	storage.once('connectionFailed', rejectSpy);
	const result = storage.ready();
	const { db } = await result;
	t.is(typeof result.then, 'function');
	t.is(resolveSpy.callCount, 1);
	t.not(db, null);
});

test.cb('returns a promise that resolves if the connection is already created', (t) => {
	createStorage(t);
	const { storage } = t.context;
	storage.once('connection', () => {
		const result = storage.ready();
		t.is(typeof result.then, 'function');

		result
			.then((result: any) => {
				t.truthy(result);
				t.is(result.db, storage.db);
				t.end();
			})
			.catch(t.end);
	});
});
