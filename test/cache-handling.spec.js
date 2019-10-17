import test from 'ava';
import {MongoClient} from 'mongodb';
import {spy, stub, restore} from 'sinon';

import Cache from '../lib/cache';
import {mongoUrl as url} from './utils/settings';
import {delay, cleanStorage} from './utils/testutils';
import GridFsStorage from '..';

test.serial.beforeEach(t => {
	t.context.oldCache = GridFsStorage.cache;
	const cache = new Cache();
	GridFsStorage.cache = cache;
	t.context.cache = cache;
	t.context.mongoSpy = stub(MongoClient, 'connect').callThrough();
});

test.serial.afterEach.always(t => {
	const {storage1, storage2, oldCache} = t.context;
	GridFsStorage.cache = oldCache;
	restore();
	return Promise.all([cleanStorage(storage1), cleanStorage(storage2)]);
});

function createStorage(settings, {t, key} = {}) {
	const storage = new GridFsStorage({url, ...settings});
	if (t && key) {
		t.context[key] = storage;
	}

	return storage;
}

test.serial(
	'creates one connection when several cached modules are invoked',
	async t => {
		const storage1 = createStorage({cache: true}, {t, key: 'storage1'});
		const storage2 = createStorage({cache: true});
		const {mongoSpy, cache} = t.context;

		const eventSpy = spy();
		storage2.on('connection', eventSpy);

		await storage1.ready();
		await delay();
		t.is(storage1.db, storage2.db);
		t.is(eventSpy.callCount, 1);
		t.true(eventSpy.calledWith(storage1.db));
		t.is(mongoSpy.callCount, 1);
		t.is(cache.connections(), 1);
	}
);

test.serial(
	'creates only one connection when several named cached modules are invoked',
	async t => {
		const storage1 = createStorage({cache: '1'}, {t, key: 'storage1'});
		const storage2 = createStorage({cache: '1'});
		const {mongoSpy, cache} = t.context;

		const eventSpy = spy();
		storage2.on('connection', eventSpy);

		await storage1.ready();
		await delay();
		t.is(storage1.db, storage2.db);
		t.is(eventSpy.callCount, 1);
		t.true(eventSpy.calledWith(storage1.db));
		t.is(mongoSpy.callCount, 1);
		t.is(cache.connections(), 1);
	}
);

test.serial(
	'reuses the connection when a cache with the same name is already created',
	async t => {
		const eventSpy = spy();
		const storage1 = createStorage({cache: true}, {t, key: 'storage1'});
		const {mongoSpy, cache} = t.context;

		await storage1.ready();
		const storage2 = createStorage({cache: true});
		storage2.once('connection', eventSpy);

		await storage2.ready();
		t.is(storage1.db, storage2.db);
		t.is(eventSpy.callCount, 1);
		t.true(eventSpy.calledWith(storage1.db));
		t.is(mongoSpy.callCount, 1);
		t.is(cache.connections(), 1);
	}
);

test.serial('creates different connections for different caches', async t => {
	const {mongoSpy, cache} = t.context;
	const eventSpy = spy();
	const eventSpy2 = spy();
	const storage1 = createStorage({cache: '1'}, {t, key: 'storage1'});
	const storage2 = createStorage({cache: '2'}, {t, key: 'storage2'});

	storage1.once('connection', eventSpy);
	storage2.once('connection', eventSpy2);

	await Promise.all([storage1.ready(), storage2.ready()]);
	t.not(storage1.db, storage2.db);
	t.is(mongoSpy.callCount, 2);
	t.is(eventSpy.callCount, 1);
	t.true(eventSpy.calledWith(storage1.db));
	t.is(eventSpy2.callCount, 1);
	t.true(eventSpy2.calledWith(storage2.db));
	t.is(cache.connections(), 2);
});
