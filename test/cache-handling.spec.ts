import anyTest, {TestInterface} from 'ava';
import {MongoClient} from 'mongodb';
import delay from 'delay';
import {spy, stub, restore} from 'sinon';

import {Cache, GridFsStorage} from '../src';
import {storageOptions} from './utils/settings';
import {cleanStorage} from './utils/testutils';
import {CacheHandlingContext} from './types/cache-handling-context';

const test = anyTest as TestInterface<CacheHandlingContext>;
const {url, options} = storageOptions();

test.serial.beforeEach((t) => {
	t.context.oldCache = GridFsStorage.cache;
	const cache = new Cache();
	GridFsStorage.cache = cache;
	t.context.cache = cache;
	t.context.mongoSpy = stub(MongoClient, 'connect').callThrough();
});

test.serial.afterEach.always(async (t) => {
	const {storage1, storage2, oldCache} = t.context;
	GridFsStorage.cache = oldCache;
	restore();
	await Promise.all([cleanStorage(storage1), cleanStorage(storage2)]);
});

function createStorage(settings, {t = null, key = ''} = {}) {
	const storage = new GridFsStorage({url, options, ...settings});
	if (t && key) {
		t.context[key] = storage;
	}

	return storage;
}

test.serial(
	'creates one connection when several cached modules are invoked',
	async (t) => {
		const storage1 = createStorage({cache: true}, {t, key: 'storage1'});
		const storage2 = createStorage({cache: true});
		const {mongoSpy, cache} = t.context;

		const eventSpy = spy();
		storage2.on('connection', eventSpy);

		await storage1.ready();
		await delay(100);
		t.is(storage1.db, storage2.db);
		t.is(eventSpy.callCount, 1);
		const call = eventSpy.getCall(0);
		t.is(call.args[0].db, storage1.db);
		t.is(mongoSpy.callCount, 1);
		t.is(cache.connections(), 1);
	},
);

test.serial(
	'creates only one connection when several named cached modules are invoked',
	async (t) => {
		const storage1 = createStorage({cache: '1'}, {t, key: 'storage1'});
		const storage2 = createStorage({cache: '1'});
		const {mongoSpy, cache} = t.context;

		const eventSpy = spy();
		storage2.on('connection', eventSpy);

		await storage1.ready();
		await delay(100);
		t.is(storage1.db, storage2.db);
		t.is(eventSpy.callCount, 1);
		const call = eventSpy.getCall(0);
		t.is(call.args[0].db, storage1.db);
		t.is(mongoSpy.callCount, 1);
		t.is(cache.connections(), 1);
	},
);

test.serial(
	'reuses the connection when a cache with the same name is already created',
	async (t) => {
		const eventSpy = spy();
		const storage1 = createStorage({cache: true}, {t, key: 'storage1'});
		const {mongoSpy, cache} = t.context;

		await storage1.ready();
		const storage2 = createStorage({cache: true});
		storage2.once('connection', eventSpy);

		await storage2.ready();
		t.is(storage1.db, storage2.db);
		t.is(eventSpy.callCount, 1);
		const call = eventSpy.getCall(0);
		t.is(call.args[0].db, storage1.db);
		t.is(mongoSpy.callCount, 1);
		t.is(cache.connections(), 1);
	},
);

test.serial('creates different connections for different caches', async (t) => {
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
	const call = eventSpy.getCall(0);
	t.is(call.args[0].db, storage1.db);
	t.is(eventSpy2.callCount, 1);
	const call2 = eventSpy2.getCall(0);
	t.is(call2.args[0].db, storage2.db);
	t.is(cache.connections(), 2);
});
