'use strict';

const mongo = require('mongodb');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const chai = require('chai');
const GridFsStorage = require('../index');
const Cache = require('../lib/cache');
const settings = require('./utils/settings');
const testUtils = require('./utils/testutils');
const cleanStorage = testUtils.cleanStorage;
const storageReady = testUtils.storageReady;

const expect = chai.expect;
const cache = GridFsStorage.cache;
const MongoClient = mongo.MongoClient;
chai.use(sinonChai);

describe('Caching', () => {

  describe('Cache class', () => {
    const url = settings.mongoUrl;
    const url2 = 'mongodb://mongoserver.com:27017/testdatabase';
    let testCache;

    beforeEach(() => {
      testCache = new Cache();
    });

    describe('Initialization', () => {

      function cachesShouldBeDifferent(firstUrl, secondUrl) {
        testCache.initialize({url: firstUrl, cacheName: 'a'});
        testCache.initialize({url: secondUrl, cacheName: 'a'});
        expect(testCache._connections['a']).not.to.equal(undefined);
        expect(testCache._connections['a'][firstUrl]).not.to.equal(undefined);
        expect(testCache._connections['a'][firstUrl]['0']).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache._connections['a'][firstUrl]['1']).to.equal(undefined);
        expect(testCache._connections['a'][secondUrl]).not.to.equal(undefined);
        expect(testCache._connections['a'][secondUrl]['0']).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache.connections()).to.equal(2);
      }

      function cachesShouldBeEqual(firstUrl, secondUrl) {
        testCache.initialize({url: firstUrl, cacheName: 'a'});
        testCache.initialize({url: secondUrl, cacheName: 'a'});
        expect(testCache._connections['a']).not.to.equal(undefined);
        expect(testCache._connections['a'][firstUrl]).not.to.equal(undefined);
        expect(testCache._connections['a'][firstUrl]['0']).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache._connections['a'][firstUrl]['1']).to.equal(undefined);
        if (firstUrl !== secondUrl) {
          expect(testCache._connections['a'][secondUrl]).to.equal(undefined);
        }
        expect(testCache.connections()).to.equal(1);
      }

      it('should initialize the cache with a url and a cache name and no connection options', () => {
        testCache.initialize({url, cacheName: 'b'});
        expect(testCache._connections['b']).not.to.equal(undefined);
        expect(testCache._connections['b'][url]).not.to.equal(undefined);
        expect(testCache._connections['b'][url]['0']).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache.connections()).to.equal(1);
      });

      it('should reuse the cache if the same url is used in the same cache', () => {
        cachesShouldBeEqual(url, url);
      });

      it('should create a new the cache if a different url is used', () => {
        cachesShouldBeDifferent(url, url2);
      });

      it('should reuse the cache if the same url and option is used in the same cache', () => {
        testCache.initialize({url, cacheName: 'b', init: {}});
        testCache.initialize({url, cacheName: 'b', init: null});
        expect(testCache._connections['b']).not.to.equal(undefined);
        expect(testCache._connections['b'][url]).not.to.equal(undefined);
        expect(testCache._connections['b'][url]['0']).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache.connections()).to.equal(1);
      });

      it('should create a new the cache if the same url and different options are used', () => {
        testCache.initialize({url, cacheName: 'b', init: {}});
        testCache.initialize({url, cacheName: 'b', init: {db: 1}});
        expect(testCache._connections['b']).not.to.equal(undefined);
        expect(testCache._connections['b'][url]).not.to.equal(undefined);
        expect(testCache._connections['b'][url]['0']).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache._connections['b'][url]['1']).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: {db: 1},
        });
        expect(testCache.connections()).to.equal(2);
      });

      it('should reuse the cache if a similar url is used', () => {
        cachesShouldBeEqual(
          'mongodb://host1:1234,host2:5678/database',
          'mongodb://host2:5678,host1:1234/database'
        );
      });

      it('should create a new cache if an url with more hosts is used', () => {
        cachesShouldBeDifferent(
          'mongodb://host1:1234/database',
          'mongodb://host1:1234,host2:5678/database'
        );
      });

      it('should create a new cache if urls with different hosts are used', () => {
        cachesShouldBeDifferent(
          'mongodb://host1:1234/database',
          'mongodb://host2:5678/database'
        );
      });

      it('should reuse the cache if similar options are used in the url', () => {
        cachesShouldBeEqual(
          'mongodb://host1:1234/database?authSource=admin&connectTimeoutMS=300000',
          'mongodb://host1:1234/database?connectTimeoutMS=300000&authSource=admin'
        );
      });

      it('should create a new cache if urls with different options are used', () => {
        cachesShouldBeDifferent(
          'mongodb://host1:1234/database?authSource=admin',
          'mongodb://host1:1234/database?connectTimeoutMS=300000&authSource=admin'
        );
      });
    });

    describe('Methods', () => {
      it('should return if a given cache exists', () => {
        const index = testCache.initialize({url, cacheName: 'b'});
        expect(testCache.has(index)).to.equal(true);
        expect(testCache.has({url, name: 'b', index: 2})).to.equal(false);
        expect(testCache.connections()).to.equal(1);
      });

      it('should allow to get a cache by its index', () => {
        const index = testCache.initialize({url, cacheName: 'a'});
        expect(testCache.get(index)).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache.get({url, name: 'a', index: 1})).to.equal(null);
        expect(testCache.get({url, name: 'b', index: 0})).to.equal(null);
        expect(testCache.get({url: url2, name: 'a', index: 0})).to.equal(null);
        expect(testCache.connections()).to.equal(1);
      });

      it('should allow to set a cache by its index', () => {
        const index = testCache.initialize({url, cacheName: 'b'});
        const data = {};
        expect(testCache.has(index)).to.equal(true);
        testCache.set(index, data);
        expect(testCache.get(index)).to.equal(data);
        expect(testCache.connections()).to.equal(1);
      });

      it('should allow to remove a cache by its index', () => {
        const spy = sinon.stub(testCache._emitter, 'emit').callThrough();
        const index = testCache.initialize({url, cacheName: 'b'});
        expect(testCache.has(index)).to.equal(true);
        testCache.remove(index);
        expect(spy).to.have.callCount(1);
        const call = spy.getCall(0);
        expect(call.args[0]).to.equal('reject');
        expect(call.args[1]).to.equal(index);
        expect(call.args[2]).to.be.an('error');
        expect(testCache.has(index)).to.equal(false);
        expect(testCache.connections()).to.equal(0);
      });

      it('should not reject the cache if is not pending', () => {
        const spy = sinon.stub(testCache._emitter, 'emit').callThrough();
        const index = testCache.initialize({url, cacheName: 'b'});
        const entry = testCache.get(index);
        entry.pending = false;
        expect(testCache.has(index)).to.equal(true);
        testCache.remove(index);
        expect(spy).to.have.callCount(0);
        expect(testCache.has(index)).to.equal(false);
        expect(testCache.connections()).to.equal(0);
      });

      it('should not remove other caches than the one specified', () => {
        const index = testCache.initialize({url, cacheName: 'a'});
        testCache.initialize({url: url2, cacheName: 'a'});
        expect(testCache.connections()).to.equal(2);
        expect(testCache.has(index)).to.equal(true);
        testCache.remove(index);
        expect(testCache.has(index)).to.equal(false);
        expect(testCache.connections()).to.equal(1);
      });

      it('should not remove all caches when there are different options', () => {
        const index = testCache.initialize({url, cacheName: 'a'});
        testCache.initialize({url: url2, cacheName: 'a', init: {db: 1}});
        expect(testCache.connections()).to.equal(2);
        expect(testCache.has(index)).to.equal(true);
        testCache.remove(index);
        expect(testCache.has(index)).to.equal(false);
        expect(testCache.connections()).to.equal(1);
      });

      it('should not remove any caches when there are no matches', () => {
        const index = {url, name: 'c'};
        testCache.initialize({url, cacheName: 'a'});
        testCache.initialize({url, cacheName: 'b'});
        expect(testCache.connections()).to.equal(2);
        expect(testCache.has(index)).to.equal(false);
        testCache.remove(index);
        expect(testCache.connections()).to.equal(2);
      });
    });
  });

  describe('Cached connections', () => {
    const url = settings.mongoUrl;

    describe('Cache handling', () => {
      let storage1, storage2, eventSpy, mongoSpy;

      beforeEach(() => {
        cache.clear();
        mongoSpy = sinon.stub(MongoClient, 'connect').callThrough();
      });

      it('should only create one connection when several cached modules are invoked', (done) => {
        eventSpy = sinon.spy();
        storage1 = new GridFsStorage({url, cache: true});
        storage2 = new GridFsStorage({url, cache: true});

        storage2.on('connection', eventSpy);

        storage1.on('connection', () => {
          setTimeout(() => {
            expect(storage1.db).to.equal(storage2.db);
            expect(eventSpy).to.have.been.calledOnceWith(storage1.db);
            expect(mongoSpy).to.have.callCount(1);
            expect(cache.connections()).to.equal(1);
            storage2 = null;
            done();
          });
        });
      });

      it('should only create one connection when several named cached modules are invoked', (done) => {
        eventSpy = sinon.spy();
        storage1 = new GridFsStorage({url, cache: '1'});
        storage2 = new GridFsStorage({url, cache: '1'});

        storage2.on('connection', eventSpy);

        storage1.on('connection', () => {
          setTimeout(() => {
            expect(storage1.db).to.equal(storage2.db);
            expect(eventSpy).to.have.been.calledOnceWith(storage1.db);
            expect(mongoSpy).to.have.callCount(1);
            expect(cache.connections()).to.equal(1);
            storage2 = null;
            done();
          });
        });
      });

      it('should reuse the connection when a cache with the same name is already created', (done) => {
        eventSpy = sinon.spy();
        storage1 = new GridFsStorage({url, cache: true});

        storage1.on('connection', () => {
          storage2 = new GridFsStorage({url, cache: true});
          storage2.once('connection', eventSpy);

          storage2.once('connection', () => {
            expect(storage1.db).to.equal(storage2.db);
            expect(eventSpy).to.have.been.calledOnceWith(storage1.db);
            expect(mongoSpy).to.have.callCount(1);
            expect(cache.connections()).to.equal(1);
            storage2 = null;
            done();
          });
        });
      });

      it('should create different connections for different caches', () => {
        eventSpy = sinon.spy();
        const eventSpy2 = sinon.spy();
        storage1 = new GridFsStorage({url, cache: '1'});
        storage2 = new GridFsStorage({url, cache: '2'});

        storage1.once('connection', eventSpy);
        storage2.once('connection', eventSpy2);

        return Promise
          .all(storageReady(storage1, storage2))
          .then(() => {
            expect(storage1.db).not.to.equal(storage2.db);
            expect(eventSpy).to.have.been.calledOnceWith(storage1.db);
            expect(eventSpy2).to.have.been.calledOnceWith(storage2.db);
            expect(cache.connections()).to.equal(2);
          });
      });

      afterEach(() => {
        sinon.restore();
        return Promise.all([
          cleanStorage(storage1),
          cleanStorage(storage2),
        ]);
      });
    });

    describe('Failed connections', () => {
      let storage1, storage2, mongoSpy;
      const err = new Error();

      beforeEach(() => storage2 = null);

      it('should only reject connections associated to the same cache', (done) => {
        const conSpy = sinon.spy();
        const rejectSpy = sinon.spy();

        storage1 = new GridFsStorage({url, cache: '1'});

        setTimeout(() => {
          mongoSpy = sinon.stub(MongoClient, 'connect').callsFake(function (url, opts, cb) {
            setTimeout(() => cb(err));
          });
          storage2 = new GridFsStorage({url, cache: '2'});
          const storage3 = new GridFsStorage({url, cache: '1'});
          const storage4 = new GridFsStorage({url, cache: '2'});
          expect(mongoSpy).to.have.callCount(1);

          storage2.on('connectionFailed', conSpy);
          storage1.on('connectionFailed', rejectSpy);

          storage1.on('connection', () => {
            expect(storage1.db).to.be.instanceOf(mongo.Db);
            expect(storage2.db).to.equal(null);
            expect(storage3.db).to.be.instanceOf(mongo.Db);
            expect(storage4.db).to.equal(null);
            expect(conSpy).to.have.callCount(1);
            expect(rejectSpy).to.have.callCount(0);
            expect(cache.connections()).to.equal(1);
            done();
          });
        });
      });

      afterEach(() => {
        sinon.restore();
        return Promise.all([
          cleanStorage(storage1),
          cleanStorage(storage2),
        ]);
      });
    });
  });

  afterEach(() => cache.clear());
});
