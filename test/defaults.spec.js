'use strict';

const GridFSStorage = require('../index');
const Grid = require('gridfs-stream');
const chai = require('chai');
const expect = chai.expect;
const settings = require('./utils/settings');
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const { EventEmitter } = require('events');
const { cleanDb, version } = require('./utils/testutils');

const sinon = require('sinon');
const sinonChai = require('sinon-chai');
chai.use(sinonChai);

describe('module default options', function () {
  this.timeout(4000);
  this.slow(8000);
  let storage;
  
  it('should have the EventEmitter signature', function () {
    storage = GridFSStorage({
      url: settings.mongoUrl()
    });
    expect(storage).to.respondTo('once');
    expect(storage).to.respondTo('on');
    expect(storage).to.be.a.instanceOf(EventEmitter);
  });
  
  it('should implement Multer plugin definition', function () {
    storage = GridFSStorage({
      url: settings.mongoUrl()
    });
    expect(storage).to.respondTo('_handleFile');
    expect(storage).to.respondTo('_removeFile');
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
    storage = GridFSStorage({
      url: settings.mongoUrl()
    });
    storage.once('connection', connectionSpy);
    setTimeout(() => {
      expect(connectionSpy).to.have.callCount(1);
      done();
    }, 3000);
  });
  
  it('should create a mongodb connection when using the url parameter', function (done) {
    storage = GridFSStorage({
      url: settings.mongoUrl()
    });
    
    setTimeout(() => {
      expect(storage.gfs).to.be.an.instanceof(Grid);
      done();
    }, 3000);
  });
  
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
  
  it('should set the default filename to a 16 bytes hexadecimal string', function () {
    storage = GridFSStorage({
      url: settings.mongoUrl()
    });
    storage._getFilename(null, null, (err, filename) => {
      expect(filename).to.match(/^[0-9a-f]{32}$/);
    });
  });
  
  it('should set the default metadata to null', function () {
    storage = GridFSStorage({
      url: settings.mongoUrl()
    });
    storage._getMetadata(null, null, (err, metadata) => {
      expect(metadata).to.equal(null);
    });
  });
  
  it('should disable logging by default', function () {
    storage = GridFSStorage({
      url: settings.mongoUrl()
    });
    expect(storage._log).to.equal(false);
  });
  
  it('should set the logLevel to file by default', function () {
    storage = GridFSStorage({
      url: settings.mongoUrl()
    });
    expect(storage._logLevel).to.equal('file');
  });
  
  it('should set the default chunkSize to 261120', function () {
    storage = GridFSStorage({
      url: settings.mongoUrl()
    });
    storage._getChunkSize(null, null, (err, chunkSize) => {
      expect(chunkSize).to.equal(261120);
    });
  });
  
  it('should set the default root to null', function () {
    storage = GridFSStorage({
      url: settings.mongoUrl()
    });
    storage._getRoot(null, null, (err, root) => {
      expect(root).to.equal(null);
    });
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




