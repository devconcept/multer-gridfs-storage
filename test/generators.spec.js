'use strict';

var express = require('express');
var chai = require('chai');
var expect = chai.expect;
var GridFsStorage = require('../index');
var setting = require('./utils/settings');
var uploads = require('./utils/uploads');
var request = require('supertest');
var multer = require('multer');
var getNodeVersion = require('./utils/testutils').getNodeVersion;
var Promise = require('bluebird');

describe('ES6 generators', function () {
  var app;
  
  before(function () {
    app = express();
  });
  
  describe('all options with generators', function () {
    var db, storage, result;
    before(function (done) {
      var version = getNodeVersion();
      if (version.major < 6) {
        return this.skip();
      }
      /*eslint-disable no-constant-condition */
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        filename: function*() {
          var counter = 0;
          while (true) {
            counter++;
            yield 'file' + counter;
          }
        },
        metadata: function*() {
          while (true) {
            yield { data: Math.random() };
          }
        },
        identifier: function*() {
          var counter = 0;
          while (true) {
            counter++;
            yield counter;
          }
        },
        chunkSize: function*() {
          var sizes = [102400, 204800];
          var counter = 0;
          while (true) {
            yield sizes[counter];
            counter++;
          }
        },
        root: function*() {
          var names = ['plants', 'animals'];
          var counter = 0;
          while (true) {
            yield names[counter];
            counter++;
          }
        }
      });
      /*eslint-enable no-constant-condition */
      
      var upload = multer({ storage: storage });
      
      app.post('/gen1', upload.array('photos', 2), function (req, res) {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', function (gridfs, database) {
        db = database;
        request(app)
          .post('/gen1')
          .attach('photos', uploads.files[0])
          .attach('photos', uploads.files[1])
          .end(function (err, res) {
            result = res.body;
            done();
          });
      });
    });
    
    it('should the request contain the two uploaded files', function () {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });
    
    it('should be named with the yielded value', function () {
      expect(result.files[0].filename).to.equal('file1');
      expect(result.files[1].filename).to.equal('file2');
    });
    
    it('should contain a metadata object with the yielded object', function () {
      expect(result.files[0].metadata).to.have.property('data').and.to.be.a('number');
      expect(result.files[1].metadata).to.have.property('data').and.to.be.a('number');
    });
    
    it('should be stored with the yielded chunkSize value', function () {
      expect(result.files[0].grid.chunkSize).to.equal(102400);
      expect(result.files[1].grid.chunkSize).to.equal(204800);
    });
    
    it('should change the id with the yielded value', function () {
      expect(result.files[0].id).to.match(/^00000001/);
      expect(result.files[1].id).to.match(/^00000002/);
    });
    
    it('should be stored under in a collection with the yielded value', function (done) {
      db.collection('plants.files', { strict: true }, function (err) {
        expect(err).to.be.equal(null);
        db.collection('animals.files', { strict: true }, function (err) {
          expect(err).to.be.equal(null);
          done();
        });
      });
    });
    
    after(function () {
      if (storage) {
        storage.removeAllListeners();
      }
      if (db) {
        return db
          .dropDatabase()
          .then(function () {
            return db.close(true);
          });
      }
    });
  });
  
  describe('generator parameters', function () {
    var db, storage;
    var parameters;
    before(function (done) {
      var version = getNodeVersion();
      if (version.major < 6) {
        return this.skip();
      }
      
      parameters = {
        filename: [],
        metadata: [],
        identifier: [],
        chunkSize: [],
        root: []
      };
      
      /*eslint-disable no-constant-condition */
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        filename: function*(req, file) {
          var counter = 0;
          var result;
          parameters.filename.push({req: req, file: file});
          while (true) {
            counter++;
            result = yield 'file' + counter;
            parameters.filename.push({req: result.req, file: result.file});
          }
        },
        metadata: function*(req, file) {
          var result;
          parameters.metadata.push({req: req, file: file});
          while (true) {
            result = yield { data: Math.random() };
            parameters.metadata.push({req: result.req, file: result.file});
          }
        },
        identifier: function*(req, file) {
          var counter = 0;
          var result;
          parameters.identifier.push({req: req, file: file});
          while (true) {
            counter++;
            result = yield counter;
            parameters.identifier.push({req: result.req, file: result.file});
          }
        },
        chunkSize: function*(req, file) {
          var sizes = [102400, 204800];
          var counter = 0;
          var result;
          parameters.chunkSize.push({req: req, file: file});
          while (true) {
            result = yield sizes[counter];
            counter++;
            parameters.chunkSize.push({req: result.req, file: result.file});
          }
        },
        root: function*(req, file) {
          var names = ['plants', 'animals'];
          var counter = 0;
          var result;
          parameters.root.push({req: req, file: file});
          while (true) {
            result = yield names[counter];
            counter++;
            parameters.root.push({req: result.req, file: result.file});
          }
        }
      });
      /*eslint-enable no-constant-condition */
      
      var upload = multer({ storage: storage });
      
      app.post('/gen2', upload.array('photos', 2), function (req, res) {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', function (gridfs, database) {
        db = database;
        request(app)
          .post('/gen2')
          .attach('photos', uploads.files[0])
          .attach('photos', uploads.files[1])
          .end(done);
      });
    });
    
    it('should the filename parameters be a request and a file objects', function () {
      parameters.filename.forEach(function (param) {
        expect(param.req).to.have.any.keys('body', 'query', 'params', 'files');
        expect(param.file).to.have.all.keys('fieldname', 'originalname', 'encoding', 'mimetype');
      });
    });
  
    it('should the metadata parameters be a request and a file objects', function () {
      parameters.metadata.forEach(function (param) {
        expect(param.req).to.have.any.keys('body', 'query', 'params', 'files');
        expect(param.file).to.have.all.keys('fieldname', 'originalname', 'encoding', 'mimetype');
      });
    });
  
    it('should the identifier parameters be a request and a file objects', function () {
      parameters.identifier.forEach(function (param) {
        expect(param.req).to.have.any.keys('body', 'query', 'params', 'files');
        expect(param.file).to.have.all.keys('fieldname', 'originalname', 'encoding', 'mimetype');
      });
    });
  
    it('should the chunkSize parameters be a request and a file objects', function () {
      parameters.chunkSize.forEach(function (param) {
        expect(param.req).to.have.any.keys('body', 'query', 'params', 'files');
        expect(param.file).to.have.all.keys('fieldname', 'originalname', 'encoding', 'mimetype');
      });
    });
  
    it('should the root parameters be a request and a file objects', function () {
      parameters.root.forEach(function (param) {
        expect(param.req).to.have.any.keys('body', 'query', 'params', 'files');
        expect(param.file).to.have.all.keys('fieldname', 'originalname', 'encoding', 'mimetype');
      });
    });
    
    after(function () {
      if (storage) {
        storage.removeAllListeners();
      }
      if (db) {
        return db
          .dropDatabase()
          .then(function () {
            return db.close(true);
          });
      }
    });
    
  });
  
  describe('promises and generators', function () {
    var db, storage, result;
    before(function (done) {
      var version = getNodeVersion();
      if (version.major < 6) {
        return this.skip();
      }
      /*eslint-disable no-constant-condition */
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        filename: function*() {
          var counter = 0;
          while (true) {
            counter++;
            yield Promise.resolve('file' + counter);
          }
        },
        metadata: function*() {
          while (true) {
            yield Promise.resolve({ data: Math.random() });
          }
        },
        identifier: function*() {
          var counter = 0;
          while (true) {
            counter++;
            yield Promise.resolve(counter);
          }
        },
        chunkSize: function*() {
          var sizes = [102400, 204800];
          var counter = 0;
          while (true) {
            yield Promise.resolve(sizes[counter]);
            counter++;
          }
        },
        root: function*() {
          var names = ['plants', 'animals'];
          var counter = 0;
          while (true) {
            yield Promise.resolve(names[counter]);
            counter++;
          }
        }
      });
      /*eslint-enable no-constant-condition */
      
      var upload = multer({ storage: storage });
      
      app.post('/gen3', upload.array('photos', 2), function (req, res) {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', function (gridfs, database) {
        db = database;
        request(app)
          .post('/gen3')
          .attach('photos', uploads.files[0])
          .attach('photos', uploads.files[1])
          .end(function (err, res) {
            result = res.body;
            done();
          });
      });
    });
    
    it('should the request contain the two uploaded files', function () {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });
    
    it('should be named with the yielded value', function () {
      expect(result.files[0].filename).to.equal('file1');
      expect(result.files[1].filename).to.equal('file2');
    });
    
    it('should contain a metadata object with the yielded object', function () {
      expect(result.files[0].metadata).to.have.property('data').and.to.be.a('number');
      expect(result.files[1].metadata).to.have.property('data').and.to.be.a('number');
    });
    
    it('should be stored with the yielded chunkSize value', function () {
      expect(result.files[0].grid.chunkSize).to.equal(102400);
      expect(result.files[1].grid.chunkSize).to.equal(204800);
    });
    
    it('should change the id with the yielded value', function () {
      expect(result.files[0].id).to.match(/^00000001/);
      expect(result.files[1].id).to.match(/^00000002/);
    });
    
    it('should be stored under in a collection with the yielded value', function (done) {
      db.collection('plants.files', { strict: true }, function (err) {
        expect(err).to.be.equal(null);
        db.collection('animals.files', { strict: true }, function (err) {
          expect(err).to.be.equal(null);
          done();
        });
      });
    });
    
    after(function () {
      if (storage) {
        storage.removeAllListeners();
      }
      if (db) {
        return db
          .dropDatabase()
          .then(function () {
            return db.close(true);
          });
      }
    });
  });
});
