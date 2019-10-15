import test from 'ava';
import {MongoClient} from 'mongodb';
import {spy, restore, stub} from 'sinon';

import {cleanStorage, fakeConnectCb} from './utils/testutils';
import {storageOpts} from './utils/settings';
import GridFsStorage from '..';

function createStorage(t) {
	t.context.storage = new GridFsStorage(storageOpts());
}

function forceFailure(t) {
	t.context.error = new Error('Fake error');
	stub(MongoClient, 'connect').callsFake(fakeConnectCb(t.context.error));
	createStorage(t);
}

test.afterEach.always('cleanup', t => {
	const {storage} = t.context;
	restore();
	return cleanStorage(storage);
});

test.serial(
	'returns a promise that rejects when the connection fails',
	async t => {
		forceFailure(t);
		const {storage} = t.context;
		const resolveSpy = spy();
		const rejectSpy = spy();
		storage.once('connection', resolveSpy);
		storage.once('connectionFailed', rejectSpy);

		const result = storage.ready();
		t.is(typeof result.then, 'function');
		const err = await t.throwsAsync(async () => {
			await result;
			t.is(resolveSpy.callCount, 0);
			t.is(rejectSpy, 1);
		});
		t.is(err, rejectSpy.getCall(0).args[0]);
		t.is(err, t.context.error);
	}
);

test.serial.cb(
	'returns a promise that rejects if the module already failed connecting',
	t => {
		forceFailure(t);
		const {storage} = t.context;
		storage.once('connectionFailed', evtErr => {
			const result = storage.ready();
			t.is(typeof result.then, 'function');
			result.catch(error => {
				t.is(error, evtErr);
				t.is(error, t.context.error);
				t.end();
			});
		});
	}
);

test('returns a promise that resolves when the connection is created', async t => {
	createStorage(t);
	const {storage} = t.context;
	const resolveSpy = spy();
	const rejectSpy = spy();
	storage.once('connection', resolveSpy);
	storage.once('connectionFailed', rejectSpy);
	const result = storage.ready();
	const db = await result;
	t.is(typeof result.then, 'function');
	t.is(resolveSpy.callCount, 1);
	t.is(rejectSpy.callCount, 0);
	t.is(db, storage.db);
	t.not(db, null);
});

test.cb(
	'returns a promise that resolves if the connection is already created',
	t => {
		createStorage(t);
		const {storage} = t.context;
		storage.once('connection', () => {
			const result = storage.ready();
			t.is(typeof result.then, 'function');
			result
				.then(db => {
					t.is(db, storage.db);
					t.not(db, null);
					t.end();
				})
				.catch(t.end);
		});
	}
);
