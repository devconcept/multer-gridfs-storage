'use strict';

const mongo = require('mongodb');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const chai = require('chai');
const GridFsStorage = require('../index');
const Cache = require('../lib/cache');
const settings = require('./utils/settings');
const {cleanStorage} = require('./utils/testutils');

const {expect} = chai;
const {cache} = GridFsStorage;
const {MongoClient} = mongo;
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
        expect(testCache._connections['b']['a']).to.be.instanceOf(Array);
        expect(testCache._connections['b']['a']).to.have.lengthOf(1);
        expect(testCache._connections['b']['a'][0]).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
      });

      it('should reuse the cache if the same url is used in the same cache', () => {
        testCache.initialize({url: 'a', cacheName: 'b'});
        testCache.initialize({url: 'a', cacheName: 'b'});
        expect(testCache._connections['b']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']).to.be.instanceOf(Array);
        expect(testCache._connections['b']['a']).to.have.lengthOf(1);
        expect(testCache._connections['b']['a'][0]).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
      });

      it('should create a new the cache if a different url is used', () => {
        testCache.initialize({url: 'a', cacheName: 'b'});
        testCache.initialize({url: 'b', cacheName: 'b'});
        expect(testCache._connections['b']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']).not.to.equal(undefined);
        expect(testCache._connections['b']['b']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']).to.be.instanceOf(Array);
        expect(testCache._connections['b']['b']).to.be.instanceOf(Array);
        expect(testCache._connections['b']['a']).to.have.lengthOf(1);
        expect(testCache._connections['b']['b']).to.have.lengthOf(1);
        expect(testCache._connections['b']['a'][0]).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache._connections['b']['b'][0]).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
      });

      it('should reuse the cache if the same url and option is used in the same cache', () => {
        testCache.initialize({url: 'a', cacheName: 'b', init: {}});
        testCache.initialize({url: 'a', cacheName: 'b', init: null});
        expect(testCache._connections['b']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']).to.be.instanceOf(Array);
        expect(testCache._connections['b']['a']).to.have.lengthOf(1);
        expect(testCache._connections['b']['a'][0]).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
      });

      it('should create a new the cache if the same url and different options are used', () => {
        testCache.initialize({url: 'a', cacheName: 'b', init: {}});
        testCache.initialize({url: 'a', cacheName: 'b', init: {db: 1}});
        expect(testCache._connections['b']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']).not.to.equal(undefined);
        expect(testCache._connections['b']['a']).to.be.instanceOf(Array);
        expect(testCache._connections['b']['a']).to.have.lengthOf(2);
        expect(testCache._connections['b']['a'][0]).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: null,
        });
        expect(testCache._connections['b']['a'][1]).to.eql({
          db: null,
          client: null,
          pending: true,
          opening: false,
          init: {db: 1},
        });
      });
    });

    describe('Methods', () => {
      it('should return if a given cache exists', () => {
        const index = testCache.initialize({url: 'a', cacheName: 'b'});
        expect(testCache.has(index)).to.equal(true);
        expect(testCache.has({url: 'a', name: 'b', index: 2})).to.equal(false);
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
      });

      it('should allow to set a cache by its index', () => {
        const index = testCache.initialize({url: 'a', cacheName: 'b'});
        const data = {};
        expect(testCache.has(index)).to.equal(true);
        testCache.set(index, data);
        expect(testCache.get(index)).to.equal(data);
      });

      it('should allow to remove a cache by its index', () => {
        const index = testCache.initialize({url: 'a', cacheName: 'b'});
        expect(testCache.has(index)).to.equal(true);
        testCache.remove(index);
        expect(testCache.has(index)).to.equal(false);
      });
    });
  });

  describe('Cached connections', () => {

    describe('Cache handling', () => {
      let storage, eventSpy, mongoSpy;

      beforeEach(() => {
        cache.clear();
        mongoSpy = sinon.stub(MongoClient, 'connect').callThrough();
      });

      it('should only create one connection when several cached modules are invoked', (done) => {
        eventSpy = sinon.spy();
        storage = new GridFsStorage({url: settings.mongoUrl, cache: true});
        const storage1 = new GridFsStorage({url: settings.mongoUrl, cache: true});

        storage1.on('connection', eventSpy);

        storage.on('connection', () => {
          setTimeout(() => {
            expect(storage.db).to.equal(storage1.db);
            expect(eventSpy).to.have.been.calledOnceWith(storage.db);
            expect(mongoSpy).to.have.been.calledOnce;
            expect(cache.connections()).to.equal(1);
            done();
          });
        });
      });

      it('should only create one connection when several named cached modules are invoked', (done) => {
        eventSpy = sinon.spy();
        storage = new GridFsStorage({url: settings.mongoUrl, cache: '1'});
        const storage1 = new GridFsStorage({url: settings.mongoUrl, cache: '1'});

        storage1.on('connection', eventSpy);

        storage.on('connection', () => {
          setTimeout(() => {
            expect(storage.db).to.equal(storage1.db);
            expect(eventSpy).to.have.been.calledOnceWith(storage.db);
            expect(mongoSpy).to.have.been.calledOnce;
            expect(cache.connections()).to.equal(1);
            done();
          });
        });
      });

      it('should reuse the connection when a cache with the same name is already created', (done) => {
        eventSpy = sinon.spy();
        storage = new GridFsStorage({url: settings.mongoUrl, cache: true});

        storage.on('connection', () => {
          const storage1 = new GridFsStorage({url: settings.mongoUrl, cache: true});
          storage1.on('connection', eventSpy);

          setTimeout(() => {
            expect(storage.db).to.equal(storage1.db);
            expect(eventSpy).to.have.been.calledOnceWith(storage.db);
            expect(mongoSpy).to.have.been.calledOnce;
            expect(cache.connections()).to.equal(1);
            done();
          });
        });
      });

      afterEach(() => {
        sinon.restore();
        return cleanStorage(storage);
      });
    });

    describe('Failed connections', () => {
      let storage1, storage2, storage3, mongoSpy;
      const err = new Error();

      it('should only reject connections associated to the same cache', () => {
        const conSpy = sinon.spy();
        const rejectSpy = sinon.spy();
        mongoSpy = sinon.stub(MongoClient, 'connect');
        mongoSpy.onFirstCall().callThrough();
        mongoSpy.onSecondCall().callsFake(function () {
          arguments[2](err)
        });
        storage1 = new GridFsStorage({url: settings.mongoUrl, cache: '1'});
        storage3 = new GridFsStorage({url: settings.mongoUrl, cache: '1'});
        storage2 = new GridFsStorage({url: settings.mongoUrl, cache: '2'});

        storage2.on('connectionFailed', conSpy);

        storage1.on('connection', () => {
          expect(storage1.db).to.be.truthy;
          expect(storage3.db).to.equal(null);
          expect(mongoSpy).to.have.been.calledTwice;
          expect(conSpy).to.have.been.calledOnce;
          expect(rejectSpy).not.to.have.been.called;
        });

        storage1.on('connectionFailed', rejectSpy);

        storage2 = null;
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

  after(() => cache.clear());
});
