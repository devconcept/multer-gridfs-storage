'use strict';

let GridFSStorage;
const storage = GridFSStorage = require('../index');
const Grid = require('gridfs-stream');
const chai = require('chai');
const expect = chai.expect;
const settings = require('./utils/settings');
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const { EventEmitter } = require('events');

const sinon = require('sinon');
const sinonChai = require('sinon-chai');
chai.use(sinonChai);

describe('module default options', function () {
  this.timeout(4000);
  this.slow(8000);
  let instance;
  
  it('should have the EventEmitter signature', function () {
    instance = storage({
      url: settings.mongoUrl()
    });
    expect(instance).to.respondTo('once');
    expect(instance).to.respondTo('on');
    expect(instance).to.be.a.instanceOf(EventEmitter);
  });
  
  it('should implement Multer plugin definition', function () {
    instance = storage({
      url: settings.mongoUrl()
    });
    expect(instance).to.respondTo('_handleFile');
    expect(instance).to.respondTo('_removeFile');
  });
  
  it('should allow to create the instance with the new operator', function () {
    instance = new GridFSStorage({
      url: settings.mongoUrl()
    });
    expect(instance).to.be.a.instanceOf(EventEmitter);
    expect(instance).to.respondTo('_handleFile');
    expect(instance).to.respondTo('_removeFile');
  });
  
  it('should emit a connection event when using the url parameter', function (done) {
    const connectionSpy = sinon.spy();
    instance = storage({
      url: settings.mongoUrl()
    });
    instance.once('connection', connectionSpy);
    setTimeout(() => {
      expect(connectionSpy).to.have.callCount(1);
      done();
    }, 3000);
  });
  
  it('should create a mongodb connection when using the url parameter', function (done) {
    instance = storage({
      url: settings.mongoUrl()
    });
    
    setTimeout(() => {
      expect(instance.gfs).to.be.an.instanceof(Grid);
      done();
    }, 3000);
  });
  
  it('should use an existing GridFS connection when using the gfs parameter', function (done) {
    MongoClient.connect(settings.mongoUrl(), function (err, db) {
      const gfs = Grid(db, mongo);
      instance = storage({
        gfs: gfs
      });
      expect(instance.gfs).to.be.an.instanceof(Grid);
      expect(instance.gfs).to.be.equal(gfs);
      done();
    });
  });
  
  it('should set the default filename to a 16 bytes hexadecimal string', function () {
    instance = storage({
      url: settings.mongoUrl()
    });
    instance._getFilename(null, null, (err, filename) => {
      expect(filename).to.match(/^[0-9a-f]{32}$/);
    });
  });
  
  it('should set the default metadata to null', function () {
    instance = storage({
      url: settings.mongoUrl()
    });
    instance._getMetadata(null, null, (err, metadata) => {
      expect(metadata).to.equal(null);
    });
  });
  
  it('should disable logging by default', function () {
    instance = storage({
      url: settings.mongoUrl()
    });
    expect(instance._log).to.equal(false);
  });
  
  it('should set the logLevel to file by default', function () {
    instance = storage({
      url: settings.mongoUrl()
    });
    expect(instance._logLevel).to.equal('file');
  });
  
  it('should set the default chunkSize to 261120', function () {
    instance = storage({
      url: settings.mongoUrl()
    });
    instance._getChunkSize(null, null, (err, chunkSize) => {
      expect(chunkSize).to.equal(261120);
    });
  });
  
  it('should set the default root to null', function () {
    instance = storage({
      url: settings.mongoUrl()
    });
    instance._getRoot(null, null, (err, root) => {
      expect(root).to.equal(null);
    });
  });
  
  it('should change the default naming function', function () {
    const namingFn = function (req, file, cb) {
      cb(null, 'foo' + Date.now());
    };
    instance = storage({
      url: settings.mongoUrl(),
      filename: namingFn
    });
    expect(instance._getFilename).to.be.a('function');
    expect(instance._getFilename).to.equal(namingFn);
  });
  
  it('should change the default metadata function', function () {
    const metadataFn = function (req, file, cb) {
      cb(null, 'foo' + Date.now());
    };
    instance = storage({
      url: settings.mongoUrl(),
      metadata: metadataFn
    });
    expect(instance._getMetadata).to.be.a('function');
    expect(instance._getMetadata).to.equal(metadataFn);
  });
  
  it('should change the default identifier function', function () {
    const identifierFn = function (req, file, cb) {
      cb(null, 'foo');
    };
    instance = storage({
      url: settings.mongoUrl(),
      identifier: identifierFn
    });
    expect(instance._getIdentifier).to.be.a('function');
    expect(instance._getIdentifier).to.equal(identifierFn);
  });
  
  it('should change the default chunkSize function', function () {
    const chunkSizeFn = function (req, file, cb) {
      cb(null, 4567);
    };
    instance = storage({
      url: settings.mongoUrl(),
      chunkSize: chunkSizeFn
    });
    expect(instance._getChunkSize).to.be.a('function');
    expect(instance._getChunkSize).to.equal(chunkSizeFn);
  });
  
  it('should change the default root function', function () {
    const rootFn = function (req, file, cb) {
      cb(null, 4567);
    };
    instance = storage({
      url: settings.mongoUrl(),
      root: rootFn
    });
    expect(instance._getRoot).to.be.a('function');
    expect(instance._getRoot).to.equal(rootFn);
  });
  
  it('should allow to set the logging to a function', function () {
    const logFn = function (err, log) {
      console.log(err, log);
    };
    instance = storage({
      url: settings.mongoUrl(),
      log: logFn
    });
    expect(instance._log).to.be.a('function');
    expect(instance._log).to.equal(logFn);
  });
  
  it('should allow to change the log level', function () {
    instance = storage({
      url: settings.mongoUrl(),
      logLevel: 'all'
    });
    expect(instance._logLevel).to.equal('all');
  });
  
  afterEach(() => {
    function drop(db) {
      return db.dropDatabase()
        .then(() => db.close(true));
    }
    
    instance.removeAllListeners('connection');
    if (instance.gfs) {
      const db = instance.gfs.db;
      return drop(db);
    } else {
      instance.once('connection', (gfs, db) => drop(db));
    }
  });
  
});




