'use strict';

var storage = require('../index');
var Grid = require('gridfs-stream');
var mongo = require('mongodb');
var chai = require('chai');
var expect = chai.expect;
var settings = require('./utils/settings');
var MongoClient = mongo.MongoClient;
var EventEmitter = require('events').EventEmitter;

chai.use(require('chai-spies'));

describe('module default options', function () {
  this.timeout(4000);
  this.slow(8000);
  var instance;
  
  it('should have the EventEmitter signature', function () {
    instance = storage({
      url: settings.mongoUrl()
    });
    expect(instance).to.respondTo('once');
    expect(instance).to.respondTo('on');
    expect(instance).to.be.instanceof(EventEmitter);
  });
  
  it('should emit a connection event when using the url parameter', function (done) {
    var connectionSpy = chai.spy();
    instance = storage({
      url: settings.mongoUrl()
    });
    instance.once('connection', connectionSpy);
    setTimeout(function () {
      expect(connectionSpy).to.have.been.called.exactly(1);
      done();
    }, 3000);
  });
  
  it('should create a mongodb connection when using the url parameter', function (done) {
    instance = storage({
      url: settings.mongoUrl()
    });
    
    setTimeout(function () {
      expect(instance.gfs).to.be.an.instanceof(Grid);
      done();
    }, 3000);
  });
  
  it('should use an existing GridFS connection when using the gfs parameter', function (done) {
    MongoClient.connect(settings.mongoUrl(), function (err, db) {
      var gfs = Grid(db, mongo);
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
    instance._getFilename(null, null, function (err, filename) {
      expect(filename).to.match(/^[0-9a-f]{32}$/);
    });
  });
  
  it('should set the default metadata to null', function () {
    instance = storage({
      url: settings.mongoUrl()
    });
    instance._getMetadata(null, null, function (err, metadata) {
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
    instance._getChunkSize(null, null, function (err, chunkSize) {
      expect(chunkSize).to.equal(261120);
    });
  });
  
  it('should set the default root to null', function () {
    instance = storage({
      url: settings.mongoUrl()
    });
    instance._getRoot(null, null, function (err, root) {
      expect(root).to.equal(null);
    });
  });
  
  it('should change the default naming function', function () {
    var namingFn = function (req, file, cb) {
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
    var metadataFn = function (req, file, cb) {
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
    var identifierFn = function (req, file, cb) {
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
    var chunkSizeFn = function (req, file, cb) {
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
    var rootFn = function (req, file, cb) {
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
    var logFn = function (err, log) {
      console.log(err, log);
    };
    instance = storage({
      url: settings.mongoUrl(),
      log: logFn
    });
    expect(instance._log).to.be.a('function');
    expect(instance._log).to.equal(logFn);
  });
  
  afterEach(function (done) {
    instance.removeAllListeners('connection');
    if (instance.gfs) {
      instance.gfs.db.close(false, done);
    } else {
      instance.once('connection', function (gfs, db) {
        db.close(false, done);
      });
    }
  });
  
});




