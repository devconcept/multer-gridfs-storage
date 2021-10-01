import anyTest, {TestInterface} from 'ava';
import {restore, stub} from 'sinon';

import {Cache} from '../src';
import {storageOptions} from './utils/settings';
import {CacheClassContext} from './types/cache-class-context';

const test = anyTest as TestInterface<CacheClassContext>;
const {url} = storageOptions();
const url2 = 'mongodb://mongoserver.com:27017/testdatabase';

test.beforeEach((t) => {
	t.context.cache = new Cache();
});

test.afterEach.always(() => {
	restore();
});

test('cache initializes with a url and a cache name and no connection options', (t) => {
	const {cache} = t.context;
	const cacheName = 'b';
	cache.initialize({url, cacheName});
	t.not(cache.store.get(cacheName), undefined);
	t.not(cache.store.get(cacheName).get(url), undefined);
	t.deepEqual(cache.store.get(cacheName).get(url).get(0), {
		db: null,
		client: null,
		pending: true,
		opening: false,
		init: null,
	});
	t.is(cache.connections(), 1);
});

test('cache is reused if the same url and option is used in the same cache', (t) => {
	const {cache} = t.context;
	const cacheName = 'b';
	cache.initialize({url, cacheName, init: {}});
	cache.initialize({url, cacheName, init: null});
	t.not(cache.store.get(cacheName), undefined);
	t.not(cache.store.get(cacheName).get(url), undefined);
	t.deepEqual(cache.store.get(cacheName).get(url).get(0), {
		db: null,
		client: null,
		pending: true,
		opening: false,
		init: null,
	});
	t.is(cache.connections(), 1);
});

test('new cache is created if the same url and different options are used', (t) => {
	const {cache} = t.context;
	const cacheName = 'b';
	cache.initialize({url, cacheName, init: {}});
	cache.initialize({url, cacheName, init: {db: 1}});
	t.not(cache.store.get(cacheName), undefined);
	t.not(cache.store.get(cacheName).get(url), undefined);
	t.deepEqual(cache.store.get(cacheName).get(url).get(0), {
		db: null,
		client: null,
		pending: true,
		opening: false,
		init: null,
	});
	t.deepEqual(cache.store.get(cacheName).get(url).get(1), {
		db: null,
		client: null,
		pending: true,
		opening: false,
		init: {db: 1},
	});
	t.is(cache.connections(), 2);
});

test('cache is reused if the same url is used in the same cache', (t) => {
	cachesShouldBeEqual(t, url, url);
});

test('new cache is created if a different url is used', (t) => {
	cachesShouldBeDifferent(t, url, url2);
});

test('cache is reused if a similar url is used', (t) => {
	cachesShouldBeEqual(
		t,
		'mongodb://host1:1234,host2:5678/database',
		'mongodb://host2:5678,host1:1234/database',
	);
});

test('new cache is created if an url with more hosts is used', (t) => {
	cachesShouldBeDifferent(
		t,
		'mongodb://host1:1234/database',
		'mongodb://host1:1234,host2:5678/database',
	);
});

test('new cache is created if urls with different hosts are used', (t) => {
	cachesShouldBeDifferent(
		t,
		'mongodb://host1:1234/database',
		'mongodb://host2:5678/database',
	);
});

test('cache is reused if similar options are used in the url', (t) => {
	const firstUrl =
		'mongodb://host1:1234/database?authSource=admin&connectTimeoutMS=300000';
	const secondUrl =
		'mongodb://host1:1234/database?connectTimeoutMS=300000&authSource=admin';
	cachesShouldBeEqual(t, firstUrl, secondUrl);
});

test('new cache is created if urls with different options are used', (t) => {
	const firstUrl = 'mongodb://host1:1234/database?authSource=admin';
	const secondUrl =
		'mongodb://host1:1234/database?connectTimeoutMS=300000&authSource=admin';
	cachesShouldBeDifferent(t, firstUrl, secondUrl);
});

function cachesShouldBeDifferent(t, firstUrl, secondUrl) {
	const {cache} = t.context;
	const cacheName = 'a';
	cache.initialize({url: firstUrl, cacheName});
	cache.initialize({url: secondUrl, cacheName});
	t.not(cache.store.get(cacheName), undefined);
	t.not(cache.store.get(cacheName).get(firstUrl), undefined);
	t.deepEqual(cache.store.get(cacheName).get(firstUrl).get(0), {
		db: null,
		client: null,
		pending: true,
		opening: false,
		init: null,
	});
	t.is(cache.store.get(cacheName).get(firstUrl).get(1), undefined);
	t.not(cache.store.get(cacheName).get(secondUrl), undefined);
	t.deepEqual(cache.store.get(cacheName).get(secondUrl).get(0), {
		db: null,
		client: null,
		pending: true,
		opening: false,
		init: null,
	});
	t.is(cache.connections(), 2);
}

function cachesShouldBeEqual(t, firstUrl, secondUrl) {
	const {cache} = t.context;
	const cacheName = 'a';
	cache.initialize({url: firstUrl, cacheName});
	cache.initialize({url: secondUrl, cacheName});
	t.not(cache.store.get(cacheName), undefined);
	t.not(cache.store.get(cacheName).get(firstUrl), undefined);
	t.deepEqual(cache.store.get(cacheName).get(firstUrl).get(0), {
		db: null,
		client: null,
		pending: true,
		opening: false,
		init: null,
	});
	t.is(cache.store.get(cacheName).get(firstUrl).get(1), undefined);
	if (firstUrl !== secondUrl) {
		t.is(cache.store.get(cacheName).get(secondUrl), undefined);
	}

	t.is(cache.connections(), 1);
}

test('returns an existing cache', (t) => {
	const {cache} = t.context;
	const index = cache.initialize({url, cacheName: 'b'});
	t.true(cache.has(index));
	t.false(cache.has({url, name: 'b', index: 2}));
	t.is(cache.connections(), 1);
});

test('returns a cache by its index', (t) => {
	const {cache} = t.context;
	const index = cache.initialize({url, cacheName: 'a'});
	t.deepEqual(cache.get(index), {
		db: null,
		client: null,
		pending: true,
		opening: false,
		init: null,
	});
	t.is(cache.get({url, name: 'a', index: 1}), null);
	t.is(cache.get({url, name: 'b', index: 0}), null);
	t.is(cache.get({url: url2, name: 'a', index: 0}), null);
	t.is(cache.connections(), 1);
});

test('sets a cache by its index', (t) => {
	const {cache} = t.context;
	const index = cache.initialize({url, cacheName: 'b'});
	const data = {};
	t.true(cache.has(index));
	cache.set(index, data);
	t.is(cache.get(index), data);
	t.is(cache.connections(), 1);
});

test('removes a cache by its index', (t) => {
	const {cache} = t.context;
	const spy = stub(cache.emitter, 'emit').callThrough();
	const index = cache.initialize({url, cacheName: 'b'});
	t.true(cache.has(index));
	cache.remove(index);
	t.is(spy.callCount, 1);
	const call = spy.getCall(0);
	t.is(call.args[0], 'reject');
	t.is(call.args[1], index);
	t.true(call.args[2] instanceof Error);
	t.false(cache.has(index));
	t.is(cache.connections(), 0);
});

test('does not reject the cache if is not pending', (t) => {
	const {cache} = t.context;
	const spy = stub(cache.emitter, 'emit').callThrough();
	const index = cache.initialize({url, cacheName: 'b'});
	const entry = cache.get(index);
	entry.pending = false;
	t.true(cache.has(index));
	cache.remove(index);
	t.is(spy.callCount, 0);
	t.false(cache.has(index));
	t.is(cache.connections(), 0);
});

test('does not remove other caches than the specified', (t) => {
	const {cache} = t.context;
	const index = cache.initialize({url, cacheName: 'a'});
	cache.initialize({url: url2, cacheName: 'a'});
	t.is(cache.connections(), 2);
	t.true(cache.has(index));
	cache.remove(index);
	t.false(cache.has(index));
	t.is(cache.connections(), 1);
});

test('does not remove all caches when there are different options', (t) => {
	const {cache} = t.context;
	const index = cache.initialize({url, cacheName: 'a'});
	cache.initialize({url: url2, cacheName: 'a', init: {db: 1}});
	t.is(cache.connections(), 2);
	t.true(cache.has(index));
	cache.remove(index);
	t.false(cache.has(index));
	t.is(cache.connections(), 1);
});

test('should not remove any caches when there are no matches', (t) => {
	const {cache} = t.context;
	const index = {url, name: 'c'};
	cache.initialize({url, cacheName: 'a'});
	cache.initialize({url, cacheName: 'b'});
	t.is(cache.connections(), 2);
	t.false(cache.has(index));
	cache.remove(index);
	t.is(cache.connections(), 2);
});

test('should remove all entries from the cache', (t) => {
	const {cache} = t.context;
	cache.initialize({url, cacheName: 'a'});
	t.is(cache.connections(), 1);
	cache.clear();
	t.is(cache.connections(), 0);
});
