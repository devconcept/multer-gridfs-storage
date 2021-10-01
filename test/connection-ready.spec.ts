import anyTest, {TestInterface} from 'ava';
import {MongoClient} from 'mongodb';
import {spy, restore, stub} from 'sinon';

import {GridFsStorage} from '../src';
import {cleanStorage, fakeConnectCb} from './utils/testutils';
import {storageOptions} from './utils/settings';
import {ConnectionReadyContext} from './types/connection-ready-context';

const test = anyTest as TestInterface<ConnectionReadyContext>;

test.afterEach.always('cleanup', async (t) => {
	const {storage} = t.context;
	restore();
	await cleanStorage(storage);
});

function createStorage(t) {
	t.context.storage = new GridFsStorage(storageOptions());
}

function forceFailure(t) {
	t.context.error = new Error('Fake error');
	stub(MongoClient, 'connect').callsFake(fakeConnectCb(t.context.error));
	createStorage(t);
}

test.serial(
	'returns a promise that rejects when the connection fails',
	async (t) => {
		forceFailure(t);
		const {storage} = t.context;
		const resolveSpy = spy();
		const rejectSpy = spy();
		storage.once('connection', resolveSpy);
		storage.once('connectionFailed', rejectSpy);

		const result = storage.ready();
		/* eslint-disable-next-line promise/prefer-await-to-then */
		t.is(typeof result.then, 'function');
		const error = await t.throwsAsync(async () => {
			await result;
			t.is(resolveSpy.callCount, 0);
			t.is(rejectSpy, 1);
		});
		t.is(error, rejectSpy.getCall(0).args[0]);
		t.is(error, t.context.error);
	},
);

test.serial.cb(
	'returns a promise that rejects if the module already failed connecting',
	(t) => {
		forceFailure(t);
		const {storage} = t.context;
		storage.once('connectionFailed', (evtError) => {
			const result = storage.ready();
			/* eslint-disable-next-line promise/prefer-await-to-then */
			t.is(typeof result.then, 'function');
			result.catch((error) => {
				t.is(error, evtError);
				t.is(error, t.context.error);
				t.end();
			});
		});
	},
);

test('returns a promise that resolves when the connection is created', async (t) => {
	createStorage(t);
	const {storage} = t.context;
	const resolveSpy = spy();
	const rejectSpy = spy();
	storage.once('connection', resolveSpy);
	storage.once('connectionFailed', rejectSpy);
	const result = storage.ready();
	const {db, client} = await result;
	/* eslint-disable-next-line promise/prefer-await-to-then */
	t.is(typeof result.then, 'function');
	t.is(resolveSpy.callCount, 1);
	t.is(rejectSpy.callCount, 0);
	t.is(db, storage.db);
	t.is(client, storage.client);
	t.not(db, null);
});

test.cb(
	'returns a promise that resolves if the connection is already created',
	(t) => {
		createStorage(t);
		const {storage} = t.context;
		storage.once('connection', () => {
			const result = storage.ready();
			/* eslint-disable-next-line promise/prefer-await-to-then */
			t.is(typeof result.then, 'function');

			result
				/* eslint-disable-next-line promise/prefer-await-to-then */
				.then((result) => {
					t.truthy(result);
					t.is(result.db, storage.db);
					t.is(result.client, storage.client);
					t.end();
				})
				.catch(t.end);
		});
	},
);
