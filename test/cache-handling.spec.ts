import { test, expect, beforeEach, afterEach, describe } from 'vitest';
import { MongoClient } from 'mongodb';
import delay from 'delay';
import { spy, stub, restore } from 'sinon';

import { Cache, GridFsStorage, UrlStorageOptions } from '../src';
import { storageOptions } from './utils/settings';
import { cleanStorage } from './utils/testutils';

const { url, options } = storageOptions();

let oldCache: Cache;
let cache: Cache;
let mongoSpy: any;
// Only storages with their own connection are tracked for cleanup here. Cached storages that
// share a connection are cleaned transitively when the storage that owns the connection is cleaned.
let storage1: any;
let storage2: any;

function createStorage(settings: Partial<UrlStorageOptions>) {
	return new GridFsStorage({ url, options, ...settings });
}

describe('cached url connections', () => {
	beforeEach(() => {
		oldCache = GridFsStorage.cache;
		cache = new Cache();
		GridFsStorage.cache = cache;
		mongoSpy = stub(MongoClient, 'connect').callThrough();
	});

	afterEach(async () => {
		GridFsStorage.cache = oldCache;
		restore();
		await Promise.all([cleanStorage(storage1), cleanStorage(storage2)]);
		storage1 = undefined;
		storage2 = undefined;
	});

	test('creates one connection when several cached modules are invoked', async () => {
		storage1 = createStorage({ cache: true });
		const storage2 = createStorage({ cache: true });

		const eventSpy = spy();
		storage2.on('connection', eventSpy);

		await storage1.ready();
		await delay(100);
		expect(storage1.db).toBe(storage2.db);
		expect(eventSpy.callCount).toBe(1);
		const call = eventSpy.getCall(0);
		expect(call.args[0].db).toBe(storage1.db);
		expect(mongoSpy.callCount).toBe(1);
		expect(cache.connections()).toBe(1);
	});

	test('creates only one connection when several named cached modules are invoked', async () => {
		storage1 = createStorage({ cache: '1' });
		const storage2 = createStorage({ cache: '1' });

		const eventSpy = spy();
		storage2.on('connection', eventSpy);

		await storage1.ready();
		await delay(100);
		expect(storage1.db).toBe(storage2.db);
		expect(eventSpy.callCount).toBe(1);
		const call = eventSpy.getCall(0);
		expect(call.args[0].db).toBe(storage1.db);
		expect(mongoSpy.callCount).toBe(1);
		expect(cache.connections()).toBe(1);
	});

	test('reuses the connection when a cache with the same name is already created', async () => {
		const eventSpy = spy();
		storage1 = createStorage({ cache: true });

		await storage1.ready();
		const storage2 = createStorage({ cache: true });
		storage2.once('connection', eventSpy);

		await storage2.ready();
		expect(storage1.db).toBe(storage2.db);
		expect(eventSpy.callCount).toBe(1);
		const call = eventSpy.getCall(0);
		expect(call.args[0].db).toBe(storage1.db);
		expect(mongoSpy.callCount).toBe(1);
		expect(cache.connections()).toBe(1);
	});

	test('fails when a cached connection resolves without a database', async () => {
		// Keep every real connection attempt pending so the cache entry never resolves on its own and
		// the second storage registers as a waiter on it.
		mongoSpy.callsFake(async () => new Promise(() => {}));

		storage1 = createStorage({ cache: true });
		// Local (not tracked): this storage fails to connect, so it owns no connection to clean up.
		const waiting = createStorage({ cache: true });
		const failSpy = spy();
		waiting.once('connectionFailed', failSpy);

		// Let the waiting storage attach to the shared cache entry before it resolves.
		await delay(10);

		// Resolve the shared entry with a null database — the defensive state this guard protects against.
		cache.resolve((waiting as any).cacheIndex, null as any);
		await delay(10);

		expect(failSpy.callCount).toBe(1);
		const error = failSpy.getCall(0).args[0];
		expect(error).toBeInstanceOf(Error);
		expect(error.message).toBe('The cached connection was resolved without a database');
	});

	test('creates different connections for different caches', async () => {
		const eventSpy = spy();
		const eventSpy2 = spy();
		storage1 = createStorage({ cache: '1' });
		storage2 = createStorage({ cache: '2' });

		storage1.once('connection', eventSpy);
		storage2.once('connection', eventSpy2);

		await Promise.all([storage1.ready(), storage2.ready()]);
		expect(storage1.db).not.toBe(storage2.db);
		expect(mongoSpy.callCount).toBe(2);
		expect(eventSpy.callCount).toBe(1);
		const call = eventSpy.getCall(0);
		expect(call.args[0].db).toBe(storage1.db);
		expect(eventSpy2.callCount).toBe(1);
		const call2 = eventSpy2.getCall(0);
		expect(call2.args[0].db).toBe(storage2.db);
		expect(cache.connections()).toBe(2);
	});
});
