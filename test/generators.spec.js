'use strict';

const express = require('express');
const chai = require('chai');
const expect = chai.expect;
const GridFsStorage = require('../index');
const setting = require('./utils/settings');
const request = require('supertest');
const multer = require('multer');
const { version, files, cleanDb } = require('./utils/testutils');
const Promise = require('bluebird');
const mute = require('mute');

describe('ES6 generators', function () {
  let app, storage;
  
  before(() => app = express());
  
  describe('all options with generators', function () {
    let result;
    before((done) => {
      if (version.major < 6) {
        return this.skip();
      }
      
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        filename: function*() {
          let counter = 0;
          for(;;) {
            counter++;
            yield 'file' + counter;
          }
        },
        metadata: function*() {
          for(;;) {
            yield { data: Math.random() };
          }
        },
        identifier: function*() {
          let counter = 0;
          for(;;) {
            counter++;
            yield counter;
          }
        },
        chunkSize: function*() {
          const sizes = [102400, 204800];
          let counter = 0;
          for(;;) {
            yield sizes[counter];
            counter++;
          }
        },
        root: function*() {
          const names = ['plants', 'animals'];
          let counter = 0;
          for(;;) {
            yield names[counter];
            counter++;
          }
        }
      });
      
      const upload = multer({ storage: storage });
      
      app.post('/options', upload.array('photos', 2), (req, res) => {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', () => {
        request(app)
          .post('/options')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end((err, res) => {
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
      const db = storage.gfs.db;
      db.collection('plants.files', { strict: true }, function (err) {
        expect(err).to.be.equal(null);
        db.collection('animals.files', { strict: true }, function (err) {
          expect(err).to.be.equal(null);
          done();
        });
      });
    });
    
    after(() => cleanDb(storage));
    
  });
  
  describe('generator parameters', function () {
    let parameters;
    before((done) => {
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
      
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        filename: function*(req, file) {
          let counter = 0;
          parameters.filename.push({ req: req, file: file });
          for(;;) {
            counter++;
            [req, file] = yield 'file' + counter;
            parameters.filename.push({ req: req, file: file });
          }
        },
        metadata: function*(req, file) {
          parameters.metadata.push({ req: req, file: file });
          for(;;) {
            [req, file] = yield { data: Math.random() };
            parameters.metadata.push({ req: req, file: file });
          }
        },
        identifier: function*(req, file) {
          let counter = 0;
          parameters.identifier.push({ req: req, file: file });
          for(;;) {
            counter++;
            [req, file] = yield counter;
            parameters.identifier.push({ req: req, file: file });
          }
        },
        chunkSize: function*(req, file) {
          const sizes = [102400, 204800];
          let counter = 0;
          parameters.chunkSize.push({ req: req, file: file });
          for(;;) {
            [req, file] = yield sizes[counter];
            counter++;
            parameters.chunkSize.push({ req: req, file: file });
          }
        },
        root: function*(req, file) {
          const names = ['plants', 'animals'];
          let counter = 0;
          parameters.root.push({ req: req, file: file });
          for(;;) {
            [req, file] = yield names[counter];
            counter++;
            parameters.root.push({ req: req, file: file });
          }
        }
      });
      
      const upload = multer({ storage: storage });
      
      app.post('/parameters', upload.array('photos', 2), (req, res) => {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', () => {
        request(app)
          .post('/parameters')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end(done);
      });
    });
    
    it('should the filename parameters be a request and a file objects', function () {
      parameters.filename.forEach((param) => {
        expect(param.req).to.have.any.keys('body', 'query', 'params', 'files');
        expect(param.file).to.have.all.keys('fieldname', 'originalname', 'encoding', 'mimetype');
      });
    });
    
    it('should the metadata parameters be a request and a file objects', function () {
      parameters.metadata.forEach((param) => {
        expect(param.req).to.have.any.keys('body', 'query', 'params', 'files');
        expect(param.file).to.have.all.keys('fieldname', 'originalname', 'encoding', 'mimetype');
      });
    });
    
    it('should the identifier parameters be a request and a file objects', function () {
      parameters.identifier.forEach((param) => {
        expect(param.req).to.have.any.keys('body', 'query', 'params', 'files');
        expect(param.file).to.have.all.keys('fieldname', 'originalname', 'encoding', 'mimetype');
      });
    });
    
    it('should the chunkSize parameters be a request and a file objects', function () {
      parameters.chunkSize.forEach((param) => {
        expect(param.req).to.have.any.keys('body', 'query', 'params', 'files');
        expect(param.file).to.have.all.keys('fieldname', 'originalname', 'encoding', 'mimetype');
      });
    });
    
    it('should the root parameters be a request and a file objects', function () {
      parameters.root.forEach((param) => {
        expect(param.req).to.have.any.keys('body', 'query', 'params', 'files');
        expect(param.file).to.have.all.keys('fieldname', 'originalname', 'encoding', 'mimetype');
      });
    });
    
    after(() => cleanDb(storage));
    
  });
  
  describe('promises and generators', function () {
    let result;
    before((done) => {
      if (version.major < 6) {
        return this.skip();
      }
      
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        filename: function*() {
          let counter = 0;
          for(;;) {
            counter++;
            yield Promise.resolve('file' + counter);
          }
        },
        metadata: function*() {
          for(;;) {
            yield Promise.resolve({ data: Math.random() });
          }
        },
        identifier: function*() {
          let counter = 0;
          for(;;) {
            counter++;
            yield Promise.resolve(counter);
          }
        },
        chunkSize: function*() {
          const sizes = [102400, 204800];
          let counter = 0;
          for(;;) {
            yield Promise.resolve(sizes[counter]);
            counter++;
          }
        },
        root: function*() {
          const names = ['plants', 'animals'];
          let counter = 0;
          for(;;) {
            yield Promise.resolve(names[counter]);
            counter++;
          }
        }
      });
      
      const upload = multer({ storage });
      
      app.post('/promises', upload.array('photos', 2), (req, res) => {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', () => {
        request(app)
          .post('/promises')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end((err, res) => {
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
      const db = storage.gfs.db;
      db.collection('plants.files', { strict: true }, function (err) {
        expect(err).to.be.equal(null);
        db.collection('animals.files', { strict: true }, function (err) {
          expect(err).to.be.equal(null);
          done();
        });
      });
    });
    
    after(() => cleanDb(storage));
  });
  
  describe('finite generators', function () {
    let result, error, isError, unmute;
    before((done) => {
      if (version.major < 6) {
        return this.skip();
      }
      unmute = mute(process.stderr);
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        filename: function*() {
          yield 'name';
        }
      });
      
      const upload = multer({ storage });
      
      app.post('/finite', upload.array('photos', 2), (req, res) => {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', () => {
        request(app)
          .post('/finite')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end((err, res) => {
            isError = res.serverError;
            error = res.error;
            result = res.body;
            done();
          });
      });
    });
    
    it('should be a failed request', function () {
      expect(result.files).not.to.be.an.instanceOf(Array);
      expect(isError).to.equal(true);
    });
    
    it('should not upload any file', function (done) {
      const gfs = storage.gfs;
      gfs.files.count({}, (err, count) => {
        expect(count).to.equal(0);
        done(err);
      });
    });
  
    it('should throw an error about the ended generator', function () {
      expect(error.text).to.match(/Generator ended unexpectedly/);
    });
    
    after(() => {
      unmute();
      return cleanDb(storage);
    });
  });
  
  describe('rejected promise', function () {
    let result, error, isError, unmute;
    before((done) => {
      if (version.major < 6) {
        return this.skip();
      }
      unmute = mute(process.stderr);
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        filename: function*() {
          yield Promise.reject('reason');
        }
      });
      
      const upload = multer({ storage });
      
      app.post('/rejected', upload.array('photos', 2), (req, res) => {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', () => {
        request(app)
          .post('/rejected')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end((err, res) => {
            isError = res.serverError;
            error = res.error;
            result = res.body;
            done();
          });
      });
    });
    
    it('should be a failed request', function () {
      expect(result.files).not.to.be.an.instanceOf(Array);
      expect(isError).to.equal(true);
    });
    
    it('should not upload any file', function (done) {
      const gfs = storage.gfs;
      gfs.files.count({}, (err, count) => {
        expect(count).to.equal(0);
        done(err);
      });
    });
    
    it('should be failed with an error "reason"', function () {
      expect(error.text).to.match(/reason/m);
    });
    
    after(() => {
      unmute();
      return cleanDb(storage);
    });
  });
  
});
