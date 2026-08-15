import { test, expect, beforeEach, afterEach } from 'vitest';
import { restore, stub } from 'sinon';

import { Cache } from '../src';
import { storageOptions } from './utils/settings';

const { url } = storageOptions();
const url2 = 'mongodb://mongoserver.com:27017/testdatabase';

let cache: Cache;

// These tests inspect Cache's private `store` map directly (white-box testing).
const cacheStore = (): any => (cache as any).store;

beforeEach(() => {
	cache = new Cache();
});

afterEach(() => {
	restore();
});

test('cache initializes with a url and a cache name and no connection options', () => {
	const cacheName = 'b';
	cache.initialize({ url, cacheName });
	expect(cacheStore().get(cacheName)).not.toBe(undefined);
	expect(cacheStore().get(cacheName).get(url)).not.toBe(undefined);
	expect(cacheStore().get(cacheName).get(url).get(0)).toEqual({
		db: null,
		pending: true,
		opening: false,
		init: null,
	});
	expect(cache.connections()).toBe(1);
});

test('cache is reused if the same url and option is used in the same cache', () => {
	const cacheName = 'b';
	cache.initialize({ url, cacheName, init: {} });
	cache.initialize({ url, cacheName, init: null });
	expect(cacheStore().get(cacheName)).not.toBe(undefined);
	expect(cacheStore().get(cacheName).get(url)).not.toBe(undefined);
	expect(cacheStore().get(cacheName).get(url).get(0)).toEqual({
		db: null,
		pending: true,
		opening: false,
		init: null,
	});
	expect(cache.connections()).toBe(1);
});

test('new cache is created if the same url and different options are used', () => {
	const cacheName = 'b';
	cache.initialize({ url, cacheName, init: {} });
	cache.initialize({ url, cacheName, init: { db: 1 } });
	expect(cacheStore().get(cacheName)).not.toBe(undefined);
	expect(cacheStore().get(cacheName).get(url)).not.toBe(undefined);
	expect(cacheStore().get(cacheName).get(url).get(0)).toEqual({
		db: null,
		pending: true,
		opening: false,
		init: null,
	});
	expect(cacheStore().get(cacheName).get(url).get(1)).toEqual({
		db: null,
		pending: true,
		opening: false,
		init: { db: 1 },
	});
	expect(cache.connections()).toBe(2);
});

test('cache is reused if the same url is used in the same cache', () => {
	cachesShouldBeEqual(url, url);
});

test('new cache is created if a different url is used', () => {
	cachesShouldBeDifferent(url, url2);
});

test('cache is reused if a similar url is used', () => {
	cachesShouldBeEqual('mongodb://host1:1234,host2:5678/database', 'mongodb://host2:5678,host1:1234/database');
});

test('new cache is created if an url with more hosts is used', () => {
	cachesShouldBeDifferent('mongodb://host1:1234/database', 'mongodb://host1:1234,host2:5678/database');
});

test('new cache is created if urls with different hosts are used', () => {
	cachesShouldBeDifferent('mongodb://host1:1234/database', 'mongodb://host2:5678/database');
});

test('cache is reused if similar options are used in the url', () => {
	const firstUrl = 'mongodb://host1:1234/database?authSource=admin&connectTimeoutMS=300000';
	const secondUrl = 'mongodb://host1:1234/database?connectTimeoutMS=300000&authSource=admin';
	cachesShouldBeEqual(firstUrl, secondUrl);
});

test('new cache is created if urls with different options are used', () => {
	const firstUrl = 'mongodb://host1:1234/database?authSource=admin';
	const secondUrl = 'mongodb://host1:1234/database?connectTimeoutMS=300000&authSource=admin';
	cachesShouldBeDifferent(firstUrl, secondUrl);
});

function cachesShouldBeDifferent(firstUrl: string, secondUrl: string) {
	const cacheName = 'a';
	cache.initialize({ url: firstUrl, cacheName });
	cache.initialize({ url: secondUrl, cacheName });
	expect(cacheStore().get(cacheName)).not.toBe(undefined);
	expect(cacheStore().get(cacheName).get(firstUrl)).not.toBe(undefined);
	expect(cacheStore().get(cacheName).get(firstUrl).get(0)).toEqual({
		db: null,
		pending: true,
		opening: false,
		init: null,
	});
	expect(cacheStore().get(cacheName).get(firstUrl).get(1)).toBe(undefined);
	expect(cacheStore().get(cacheName).get(secondUrl)).not.toBe(undefined);
	expect(cacheStore().get(cacheName).get(secondUrl).get(0)).toEqual({
		db: null,
		pending: true,
		opening: false,
		init: null,
	});
	expect(cache.connections()).toBe(2);
}

function cachesShouldBeEqual(firstUrl: string, secondUrl: string) {
	const cacheName = 'a';
	cache.initialize({ url: firstUrl, cacheName });
	cache.initialize({ url: secondUrl, cacheName });
	expect(cacheStore().get(cacheName)).not.toBe(undefined);
	expect(cacheStore().get(cacheName).get(firstUrl)).not.toBe(undefined);
	expect(cacheStore().get(cacheName).get(firstUrl).get(0)).toEqual({
		db: null,
		pending: true,
		opening: false,
		init: null,
	});
	expect(cacheStore().get(cacheName).get(firstUrl).get(1)).toBe(undefined);
	if (firstUrl !== secondUrl) {
		expect(cacheStore().get(cacheName).get(secondUrl)).toBe(undefined);
	}

	expect(cache.connections()).toBe(1);
}

test('returns an existing cache', () => {
	const index = cache.initialize({ url, cacheName: 'b' });
	expect(cache.has(index)).toBe(true);
	expect(cache.has({ url, name: 'b', index: 2 })).toBe(false);
	expect(cache.connections()).toBe(1);
});

test('returns a cache by its index', () => {
	const index = cache.initialize({ url, cacheName: 'a' });
	expect(cache.get(index)).toEqual({
		db: null,
		pending: true,
		opening: false,
		init: null,
	});
	expect(cache.get({ url, name: 'a', index: 1 })).toBe(null);
	expect(cache.get({ url, name: 'b', index: 0 })).toBe(null);
	expect(cache.get({ url: url2, name: 'a', index: 0 })).toBe(null);
	expect(cache.connections()).toBe(1);
});

test('sets a cache by its index', () => {
	const index = cache.initialize({ url, cacheName: 'b' });
	const data = {} as any;
	expect(cache.has(index)).toBe(true);
	cache.set(index, data);
	expect(cache.get(index)).toBe(data);
	expect(cache.connections()).toBe(1);
});

test('removes a cache by its index', () => {
	const spy = stub((cache as any).emitter, 'emit').callThrough();
	const index = cache.initialize({ url, cacheName: 'b' });
	expect(cache.has(index)).toBe(true);
	cache.remove(index);
	expect(spy.callCount).toBe(1);
	const call = spy.getCall(0);
	expect(call.args[0]).toBe('reject');
	expect(call.args[1]).toBe(index);
	expect(call.args[2] instanceof Error).toBe(true);
	expect(cache.has(index)).toBe(false);
	expect(cache.connections()).toBe(0);
});

test('does not reject the cache if is not pending', () => {
	const spy = stub((cache as any).emitter, 'emit').callThrough();
	const index = cache.initialize({ url, cacheName: 'b' });
	const entry = cache.get(index)!;
	entry.pending = false;
	expect(cache.has(index)).toBe(true);
	cache.remove(index);
	expect(spy.callCount).toBe(0);
	expect(cache.has(index)).toBe(false);
	expect(cache.connections()).toBe(0);
});

test('does not remove other caches than the specified', () => {
	const index = cache.initialize({ url, cacheName: 'a' });
	cache.initialize({ url: url2, cacheName: 'a' });
	expect(cache.connections()).toBe(2);
	expect(cache.has(index)).toBe(true);
	cache.remove(index);
	expect(cache.has(index)).toBe(false);
	expect(cache.connections()).toBe(1);
});

test('does not remove all caches when there are different options', () => {
	const index = cache.initialize({ url, cacheName: 'a' });
	cache.initialize({ url: url2, cacheName: 'a', init: { db: 1 } });
	expect(cache.connections()).toBe(2);
	expect(cache.has(index)).toBe(true);
	cache.remove(index);
	expect(cache.has(index)).toBe(false);
	expect(cache.connections()).toBe(1);
});

test('should not remove any caches when there are no matches', () => {
	const index = { url, name: 'c' } as any;
	cache.initialize({ url, cacheName: 'a' });
	cache.initialize({ url, cacheName: 'b' });
	expect(cache.connections()).toBe(2);
	expect(cache.has(index)).toBe(false);
	cache.remove(index);
	expect(cache.connections()).toBe(2);
});

test('should remove all entries from the cache', () => {
	cache.initialize({ url, cacheName: 'a' });
	expect(cache.connections()).toBe(1);
	cache.clear();
	expect(cache.connections()).toBe(0);
});

test('removing the last entry cleans up the empty url and name maps', () => {
	const index = cache.initialize({ url, cacheName: 'a' });
	expect(cacheStore().has('a')).toBe(true);

	cache.remove(index);

	// The now-empty containers are dropped instead of lingering in the store.
	expect(cacheStore().has('a')).toBe(false);
	expect(cache.connections()).toBe(0);
});

test('assigns a fresh index after an earlier entry is removed', () => {
	// Two entries for the same url with different options land at indices 0 and 1.
	const index0 = cache.initialize({ url, cacheName: 'a', init: {} });
	const index1 = cache.initialize({ url, cacheName: 'a', init: { db: 1 } });
	expect(index0.index).toBe(0);
	expect(index1.index).toBe(1);
	expect(cache.connections()).toBe(2);

	// Remove the first entry; the url map now holds a single entry at key 1 (but size 1).
	cache.remove(index0);
	expect(cache.connections()).toBe(1);

	// A third, differently-configured entry must take a fresh index (one past the highest existing
	// key) instead of reusing size-1 (=0), which would overwrite the entry at index 1.
	const index2 = cache.initialize({ url, cacheName: 'a', init: { db: 2 } });
	expect(index2.index).toBe(2);
	expect(cache.connections()).toBe(2);
	expect(cache.get(index1)).not.toBe(null);
	expect(cache.get(index2)).not.toBe(null);
	expect(cache.get(index1)).not.toBe(cache.get(index2));
});
