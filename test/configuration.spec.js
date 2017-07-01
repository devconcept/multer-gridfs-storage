'use strict';

const GridFSStorage = require('../index');
const Grid = require('gridfs-stream');
const chai = require('chai');
const expect = chai.expect;
const settings = require('./utils/settings');
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const { cleanDb } = require('./utils/testutils');
const { EventEmitter } = require('events');

const sinon = require('sinon');
const sinonChai = require('sinon-chai');
chai.use(sinonChai);

describe('module basic configuration', function () {
  this.timeout(4000);
  this.slow(5000);
  let storage;

  it('should use an existing GridFS connection when using the gfs parameter', function (done) {
    MongoClient.connect(settings.mongoUrl(), function (err, db) {
      const gfs = Grid(db, mongo);
      storage = GridFSStorage({
        gfs: gfs
      });
      expect(storage.gfs).to.be.an.instanceof(Grid);
      expect(storage.gfs).to.be.equal(gfs);
      done();
    });
  });

  it('should allow to create the instance with the new operator', function () {
    storage = new GridFSStorage({
      url: settings.mongoUrl()
    });
    expect(storage).to.be.a.instanceOf(EventEmitter);
    expect(storage).to.respondTo('_handleFile');
    expect(storage).to.respondTo('_removeFile');
  });

  it('should emit a connection event when using the url parameter', function (done) {
    const connectionSpy = sinon.spy();
    storage = new GridFSStorage({
      url: settings.mongoUrl()
    });
    storage.once('connection', connectionSpy);
    setTimeout(() => {
      expect(connectionSpy).to.have.callCount(1);
      done();
    }, 3000);
  });

  it('should change the default naming function', function () {
    const namingFn = function (req, file, cb) {
      cb(null, 'foo' + Date.now());
    };
    storage = GridFSStorage({
      url: settings.mongoUrl(),
      filename: namingFn
    });
    expect(storage._getFilename).to.be.a('function');
    expect(storage._getFilename).to.equal(namingFn);
  });

  it('should change the default metadata function', function () {
    const metadataFn = function (req, file, cb) {
      cb(null, 'foo' + Date.now());
    };
    storage = GridFSStorage({
      url: settings.mongoUrl(),
      metadata: metadataFn
    });
    expect(storage._getMetadata).to.be.a('function');
    expect(storage._getMetadata).to.equal(metadataFn);
  });

  it('should change the default identifier function', function () {
    const identifierFn = function (req, file, cb) {
      cb(null, 'foo');
    };
    storage = GridFSStorage({
      url: settings.mongoUrl(),
      identifier: identifierFn
    });
    expect(storage._getIdentifier).to.be.a('function');
    expect(storage._getIdentifier).to.equal(identifierFn);
  });

  it('should change the default chunkSize function', function () {
    const chunkSizeFn = function (req, file, cb) {
      cb(null, 4567);
    };
    storage = GridFSStorage({
      url: settings.mongoUrl(),
      chunkSize: chunkSizeFn
    });
    expect(storage._getChunkSize).to.be.a('function');
    expect(storage._getChunkSize).to.equal(chunkSizeFn);
  });

  it('should change the default root function', function () {
    const rootFn = function (req, file, cb) {
      cb(null, 4567);
    };
    storage = GridFSStorage({
      url: settings.mongoUrl(),
      root: rootFn
    });
    expect(storage._getRoot).to.be.a('function');
    expect(storage._getRoot).to.equal(rootFn);
  });

  it('should allow to set the logging to a function', function () {
    const logFn = function (err, log) {
      console.log(err, log);
    };
    storage = GridFSStorage({
      url: settings.mongoUrl(),
      log: logFn
    });
    expect(storage._log).to.be.a('function');
    expect(storage._log).to.equal(logFn);
  });

  it('should allow to change the log level', function () {
    storage = GridFSStorage({
      url: settings.mongoUrl(),
      logLevel: 'all'
    });
    expect(storage._logLevel).to.equal('all');
  });

  after(() => cleanDb(storage));

});
