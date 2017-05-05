'use strict';

const express = require('express');
const chai = require('chai');
const expect = chai.expect;
const GridFsStorage = require('../index');
const setting = require('./utils/settings');
const uploads = require('./utils/uploads');
const request = require('supertest');
const multer = require('multer');
const testutils = require('./utils/testutils');
const version = testutils.getNodeVersion();
const Promise = require('bluebird');

describe('ES6 generators', function () {
  let app;
  
  before(function () {
    app = express();
  });
  
  describe('all options with generators', function () {
    let db, storage, result;
    before(function (done) {
      if (version.major < 6) {
        return this.skip();
      }
      /*eslint-disable no-constant-condition */
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        filename: function*() {
          let counter = 0;
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
          let counter = 0;
          while (true) {
            counter++;
            yield counter;
          }
        },
        chunkSize: function*() {
          const sizes = [102400, 204800];
          let counter = 0;
          while (true) {
            yield sizes[counter];
            counter++;
          }
        },
        root: function*() {
          const names = ['plants', 'animals'];
          let counter = 0;
          while (true) {
            yield names[counter];
            counter++;
          }
        }
      });
      /*eslint-enable no-constant-condition */
      
      const upload = multer({ storage: storage });
      
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
    let db, storage;
    let parameters;
    before(function (done) {
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
          let counter = 0;
          parameters.filename.push({req: req, file: file});
          while (true) {
            counter++;
            [req, file] = yield 'file' + counter;
            parameters.filename.push({req: req, file: file});
          }
        },
        metadata: function*(req, file) {
          parameters.metadata.push({req: req, file: file});
          while (true) {
            [req, file] = yield { data: Math.random() };
            parameters.metadata.push({req: req, file: file});
          }
        },
        identifier: function*(req, file) {
          let counter = 0;
          parameters.identifier.push({req: req, file: file});
          while (true) {
            counter++;
            [req, file] = yield counter;
            parameters.identifier.push({req: req, file: file});
          }
        },
        chunkSize: function*(req, file) {
          const sizes = [102400, 204800];
          let counter = 0;
          parameters.chunkSize.push({req: req, file: file});
          while (true) {
            [req, file] = yield sizes[counter];
            counter++;
            parameters.chunkSize.push({req: req, file: file});
          }
        },
        root: function*(req, file) {
          const names = ['plants', 'animals'];
          let counter = 0;
          parameters.root.push({req: req, file: file});
          while (true) {
            [req, file] = yield names[counter];
            counter++;
            parameters.root.push({req: req, file: file});
          }
        }
      });
      /*eslint-enable no-constant-condition */
      
      const upload = multer({ storage: storage });
      
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
    let db, storage, result;
    before(function (done) {
      if (version.major < 6) {
        return this.skip();
      }
      /*eslint-disable no-constant-condition */
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        filename: function*() {
          let counter = 0;
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
          let counter = 0;
          while (true) {
            counter++;
            yield Promise.resolve(counter);
          }
        },
        chunkSize: function*() {
          const sizes = [102400, 204800];
          let counter = 0;
          while (true) {
            yield Promise.resolve(sizes[counter]);
            counter++;
          }
        },
        root: function*() {
          const names = ['plants', 'animals'];
          let counter = 0;
          while (true) {
            yield Promise.resolve(names[counter]);
            counter++;
          }
        }
      });
      /*eslint-enable no-constant-condition */
      
      const upload = multer({ storage: storage });
      
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
