'use strict';

const mongo = require('mongodb');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const chai = require('chai');
const GridFsStorage = require('../index');
const Cache = require('../lib/cache');
const settings = require('./utils/settings');
const {cleanStorage} = require('./utils/testutils');

const expect = chai.expect;
const cache = GridFsStorage.cache;
const MongoClient = mongo.MongoClient;
chai.use(sinonChai);

describe('Caching', () => {

  describe('Cache class', () => {
    let testCache;

    beforeEach(() => {
      testCache = new Cache();
    });

    describe('Initialization', () => {
      it('should initialize the cache with a url and a cache name and no connection options', () => {
        testCache.initialize({url: 'a', cacheName: 'b'});
        expect(testCache._connections['b']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']['0']).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache.connections()).to.equal(1);
      });

      it('should reuse the cache if the same url is used in the same cache', () => {
        testCache.initialize({url: 'a', cacheName: 'b'});
        testCache.initialize({url: 'a', cacheName: 'b'});
        expect(testCache._connections['b']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']['0']).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache.connections()).to.equal(1);
      });

      it('should create a new the cache if a different url is used', () => {
        testCache.initialize({url: 'a', cacheName: 'b'});
        testCache.initialize({url: 'b', cacheName: 'b'});
        expect(testCache._connections['b']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']).not.to.equal(undefined);
        expect(testCache._connections['b']['b']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']['0']).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache._connections['b']['b']['0']).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache.connections()).to.equal(2);
      });

      it('should reuse the cache if the same url and option is used in the same cache', () => {
        testCache.initialize({url: 'a', cacheName: 'b', init: {}});
        testCache.initialize({url: 'a', cacheName: 'b', init: null});
        expect(testCache._connections['b']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']['0']).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache.connections()).to.equal(1);
      });

      it('should create a new the cache if the same url and different options are used', () => {
        testCache.initialize({url: 'a', cacheName: 'b', init: {}});
        testCache.initialize({url: 'a', cacheName: 'b', init: {db: 1}});
        expect(testCache._connections['b']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']['0']).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache._connections['b']['a']['1']).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: {db: 1},
        });
        expect(testCache.connections()).to.equal(2);
      });
    });


    describe('Methods', () => {
      it('should return if a given cache exists', () => {
        const index = testCache.initialize({url: 'a', cacheName: 'b'});
        expect(testCache.has(index)).to.equal(true);
        expect(testCache.has({url: 'a', name: 'b', index: 2})).to.equal(false);
        expect(testCache.connections()).to.equal(1);
      });

      it('should allow to get a cache by its index', () => {
        const index = testCache.initialize({url: 'a', cacheName: 'b'});
        expect(testCache.get(index)).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache.get({url: 'a', name: 'b', index: 2})).to.equal(null);
        expect(testCache.get({url: 'b', name: 'b', index: 0})).to.equal(null);
        expect(testCache.get({url: 'b', name: 'c', index: 1})).to.equal(null);
        expect(testCache.connections()).to.equal(1);
      });

      it('should allow to set a cache by its index', () => {
        const index = testCache.initialize({url: 'a', cacheName: 'b'});
        const data = {};
        expect(testCache.has(index)).to.equal(true);
        testCache.set(index, data);
        expect(testCache.get(index)).to.equal(data);
        expect(testCache.connections()).to.equal(1);
      });

      it('should allow to remove a cache by its index', () => {
        const index = testCache.initialize({url: 'a', cacheName: 'b'});
        expect(testCache.has(index)).to.equal(true);
        testCache.remove(index);
        expect(testCache.has(index)).to.equal(false);
        expect(testCache.connections()).to.equal(0);
      });

      it('should not remove other caches than the one specified', () => {
        const index = testCache.initialize({url: 'a', cacheName: 'a'});
        testCache.initialize({url: 'b', cacheName: 'a'});
        expect(testCache.connections()).to.equal(2);
        expect(testCache.has(index)).to.equal(true);
        testCache.remove(index);
        expect(testCache.has(index)).to.equal(false);
        expect(testCache.connections()).to.equal(1);
      });

      it('should not remove all caches when there are different options', () => {
        const index = testCache.initialize({url: 'a', cacheName: 'a'});
        testCache.initialize({url: 'a', cacheName: 'a', init: {db: 1}});
        expect(testCache.connections()).to.equal(2);
        expect(testCache.has(index)).to.equal(true);
        testCache.remove(index);
        expect(testCache.has(index)).to.equal(false);
        expect(testCache.connections()).to.equal(1);
      });

      it('should not remove any caches when there are no matches', () => {
        const index = {url: 'a', name: 'c'};
        testCache.initialize({url: 'a', cacheName: 'a'});
        testCache.initialize({url: 'a', cacheName: 'b'});
        expect(testCache.connections()).to.equal(2);
        expect(testCache.has(index)).to.equal(false);
        testCache.remove(index);
        expect(testCache.connections()).to.equal(2);
      });
    });
  });

  describe('Cached connections', () => {

    describe('Cache handling', () => {
      let storage1, storage2, eventSpy, mongoSpy;

      beforeEach(() => {
        cache.clear();
        mongoSpy = sinon.stub(MongoClient, 'connect').callThrough();
      });

      it('should only create one connection when several cached modules are invoked', (done) => {
        eventSpy = sinon.spy();
        storage1 = new GridFsStorage({url: settings.mongoUrl, cache: true});
        storage2 = new GridFsStorage({url: settings.mongoUrl, cache: true});

        storage2.on('connection', eventSpy);

        storage1.on('connection', () => {
          setTimeout(() => {
            expect(storage1.db).to.equal(storage2.db);
            expect(eventSpy).to.have.been.calledOnceWith(storage1.db);
            expect(mongoSpy).to.have.been.calledOnce;
            expect(cache.connections()).to.equal(1);
            storage2 = null;
            done();
          });
        });
      });

      it('should only create one connection when several named cached modules are invoked', (done) => {
        eventSpy = sinon.spy();
        storage1 = new GridFsStorage({url: settings.mongoUrl, cache: '1'});
        storage2 = new GridFsStorage({url: settings.mongoUrl, cache: '1'});

        storage2.on('connection', eventSpy);

        storage1.on('connection', () => {
          setTimeout(() => {
            expect(storage1.db).to.equal(storage2.db);
            expect(eventSpy).to.have.been.calledOnceWith(storage1.db);
            expect(mongoSpy).to.have.been.calledOnce;
            expect(cache.connections()).to.equal(1);
            storage2 = null;
            done();
          });
        });
      });

      it('should reuse the connection when a cache with the same name is already created', (done) => {
        eventSpy = sinon.spy();
        storage1 = new GridFsStorage({url: settings.mongoUrl, cache: true});

        storage1.on('connection', () => {
          storage2 = new GridFsStorage({url: settings.mongoUrl, cache: true});
          storage2.on('connection', eventSpy);

          setTimeout(() => {
            expect(storage1.db).to.equal(storage2.db);
            expect(eventSpy).to.have.been.calledOnceWith(storage1.db);
            expect(mongoSpy).to.have.been.calledOnce;
            expect(cache.connections()).to.equal(1);
            storage2 = null;
            done();
          });
        });
      });

      it('should create different connections for different caches', (done) => {
        eventSpy = sinon.spy();
        const eventSpy2 = sinon.spy();
        storage1 = new GridFsStorage({url: settings.mongoUrl, cache: '1'});
        storage2 = new GridFsStorage({url: settings.mongoUrl, cache: '2'});

        storage1.on('connection', eventSpy);
        storage2.on('connection', eventSpy2);
        setTimeout(() => {
          expect(storage1.db).not.to.equal(storage2.db);
          expect(eventSpy).to.have.been.calledOnceWith(storage1.db);
          expect(eventSpy2).to.have.been.calledOnceWith(storage2.db);
          expect(cache.connections()).to.equal(2);
          done();
        }, 500);
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

      it('should only reject connections associated to the same cache', (done) => {
        const conSpy = sinon.spy();
        const rejectSpy = sinon.spy();

        storage1 = new GridFsStorage({url: settings.mongoUrl, cache: '1'});
        mongoSpy = sinon.stub(MongoClient, 'connect');
        mongoSpy.callsFake(function () {
          setTimeout(() => arguments[2](err));
        });
        storage2 = new GridFsStorage({url: settings.mongoUrl, cache: '2'});
        const storage3 = new GridFsStorage({url: settings.mongoUrl, cache: '1'});
        const storage4 = new GridFsStorage({url: settings.mongoUrl, cache: '2'});
        expect(mongoSpy).to.have.been.calledOnce;

        storage2.on('connectionFailed', conSpy);

        storage1.on('connection', () => {
          expect(storage1.db).to.be.instanceOf(mongo.Db);
          expect(storage2.db).to.equal(null);
          expect(storage3.db).to.be.instanceOf(mongo.Db);
          expect(storage4.db).to.equal(null);
          expect(conSpy).to.have.been.calledOnce;
          expect(rejectSpy).not.to.have.been.called;
          expect(cache.connections()).to.equal(1);
          storage2 = null;
          done();
        });

        storage1.on('connectionFailed', rejectSpy);
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
