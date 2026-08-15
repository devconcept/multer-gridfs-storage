import { test, expect, beforeAll, afterEach } from 'vitest';
import { MongoClient, Db } from 'mongodb';
import { spy, stub, restore } from 'sinon';

import { Cache, GridFsStorage, UrlStorageOptions } from '../src';
import { storageOptions } from './utils/settings';
import { cleanStorage, fakeConnectCb } from './utils/testutils';

const { url, options } = storageOptions();

let oldCache: Cache;
let cache: Cache;
let error: Error;
let mongoSpy: any;
let storage1: any;
let storage2: any;
let storage3: any;
let storage4: any;

function createStorage(settings: Partial<UrlStorageOptions>) {
	return new GridFsStorage({ url, options, ...settings });
}

beforeAll(() => {
	oldCache = GridFsStorage.cache;
	cache = new Cache();
	GridFsStorage.cache = cache;
	error = new Error('reason');
	mongoSpy = stub(MongoClient, 'connect')
		.callThrough()
		.onSecondCall()
		.callsFake(fakeConnectCb(error) as any);
	storage1 = createStorage({ cache: '1' });
	storage2 = createStorage({ cache: '2' });
	storage3 = createStorage({ cache: '1' });
	storage4 = createStorage({ cache: '2' });
});

test('rejects only connections associated to the same cache', async () => {
	const conSpy = spy();
	const rejectSpy = spy();
	expect(mongoSpy.callCount).toBe(2);

	storage2.on('connectionFailed', conSpy);
	storage1.on('connectionFailed', rejectSpy);

	await storage1.ready();
	expect(storage1.db instanceof Db).toBe(true);
	expect(storage2.db).toBe(null);
	expect(storage3.db instanceof Db).toBe(true);
	expect(storage4.db).toBe(null);
	expect(conSpy.callCount).toBe(1);
	expect(rejectSpy.callCount).toBe(0);
	expect(cache.connections()).toBe(1);
});

afterEach(async () => {
	GridFsStorage.cache = oldCache;
	restore();
	await Promise.all([cleanStorage(storage1), cleanStorage(storage2)]);
});
