'use strict';

const express = require('express');
const chai = require('chai');
const expect = chai.expect;
const GridFsStorage = require('../index');
const setting = require('./utils/settings');
const request = require('supertest');
const multer = require('multer');
const testUtils = require('./utils/testutils');
const files = testUtils.files;
const cleanStorage = testUtils.cleanStorage;

describe('ES6 generators', () => {
  let app, storage;

  before(() => app = express());

  describe('all options with generators', () => {
    let result;
    before((done) => {

      storage = GridFsStorage({
        url: setting.mongoUrl,
        file: function* () {
          let counter = 0;
          const data = ['foo', 'bar'];
          const sizes = [102400, 204800];
          const names = ['plants', 'animals'];
          const contentTypes = ['text/plain', 'image/jpeg'];
          for (; ;) {
            yield {
              filename: 'file' + (counter + 1),
              metadata: data[counter],
              id: counter + 1,
              chunkSize: sizes[counter],
              bucketName: names[counter],
              contentType: contentTypes[counter],
            };
            counter++;
          }
        },

      });

      const upload = multer({storage});

      app.post('/options', upload.array('photos', 2), (req, res) => {
        result = {headers: req.headers, files: req.files, body: req.body};
        res.end();
      });

      storage.on('connection', () => {
        request(app)
          .post('/options')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end(done);
      });
    });

    it('should the request contain the two uploaded files', () => {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });

    it('should be named with the yielded value', () => {
      expect(result.files[0].filename).to.equal('file1');
      expect(result.files[1].filename).to.equal('file2');
    });

    it('should contain a metadata object with the yielded object', () => {
      expect(result.files[0].metadata).to.equal('foo');
      expect(result.files[1].metadata).to.equal('bar');
    });

    it('should be stored with the yielded chunkSize value', () => {
      expect(result.files[0].chunkSize).to.equal(102400);
      expect(result.files[1].chunkSize).to.equal(204800);
    });

    it('should change the id with the yielded value', () => {
      expect(result.files[0].id).to.equal(1);
      expect(result.files[1].id).to.equal(2);
    });

    it('should be stored under in a collection with the yielded value', function (done) {
      const db = storage.db;
      db.collection('plants.files', {strict: true}, function (err) {
        expect(err).to.be.equal(null);
        db.collection('animals.files', {strict: true}, function (err) {
          expect(err).to.be.equal(null);
          done();
        });
      });
    });

    it('should change the content type with the provided value', () => {
      expect(result.files[0].contentType).to.equal('text/plain');
      expect(result.files[1].contentType).to.equal('image/jpeg');
    });

    after(() => cleanStorage(storage));

  });

  describe('generator parameters', () => {
    let parameters;
    before((done) => {
      parameters = [];

      storage = GridFsStorage({
        url: setting.mongoUrl,
        file: function* (req, file) {
          let counter = 0;
          const data = ['foo', 'bar'];
          const sizes = [102400, 204800];
          const names = ['plants', 'animals'];
          parameters.push({req, file});
          for (; ;) {
            const result = yield {
              filename: 'file' + (counter + 1),
              metadata: data[counter],
              id: counter + 1,
              chunkSize: sizes[counter],
              bucketName: names[counter],
            };
            counter++;
            parameters.push({req: result[0], file: result[1]});
          }
        },

      });

      const upload = multer({storage});

      app.post('/parameters', upload.array('photos', 2), (req, res) => {
        res.end();
      });

      storage.on('connection', () => {
        request(app)
          .post('/parameters')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end(done);
      });
    });

    it('should the parameters be a request and a file objects', () => {
      parameters.forEach((param) => {
        expect(param.req).to.have.any.keys('body', 'query', 'params', 'files');
        expect(param.file).to.have.all.keys('fieldname', 'originalname', 'encoding', 'mimetype');
      });
    });

    after(() => cleanStorage(storage));

  });

  describe('promises and generators', () => {
    let result;
    before((done) => {
      storage = GridFsStorage({
        url: setting.mongoUrl,
        file: function* () {
          let counter = 0;
          const data = ['foo', 'bar'];
          const sizes = [102400, 204800];
          const names = ['plants', 'animals'];
          for (; ;) {
            yield Promise.resolve({
              filename: 'file' + (counter + 1),
              metadata: data[counter],
              id: counter + 1,
              chunkSize: sizes[counter],
              bucketName: names[counter],
            });
            counter++;
          }
        },

      });

      const upload = multer({storage});

      app.post('/promises', upload.array('photos', 2), (req, res) => {
        result = {headers: req.headers, files: req.files, body: req.body};
        res.end();
      });

      storage.on('connection', () => {
        request(app)
          .post('/promises')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end(done);
      });
    });

    it('should the request contain the two uploaded files', () => {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });

    it('should be named with the yielded value', () => {
      expect(result.files[0].filename).to.equal('file1');
      expect(result.files[1].filename).to.equal('file2');
    });

    it('should contain a metadata object with the yielded object', () => {
      expect(result.files[0].metadata).to.equal('foo');
      expect(result.files[1].metadata).to.equal('bar');
    });

    it('should be stored with the yielded chunkSize value', () => {
      expect(result.files[0].chunkSize).to.equal(102400);
      expect(result.files[1].chunkSize).to.equal(204800);
    });

    it('should change the id with the yielded value', () => {
      expect(result.files[0].id).to.equal(1);
      expect(result.files[1].id).to.equal(2);
    });

    it('should be stored under in a collection with the yielded value', function (done) {
      const db = storage.db;
      db.collection('plants.files', {strict: true}, function (err) {
        expect(err).to.be.equal(null);
        db.collection('animals.files', {strict: true}, function (err) {
          expect(err).to.be.equal(null);
          done();
        });
      });
    });

    after(() => cleanStorage(storage));
  });

  describe('finite generators', () => {
    let error;
    before((done) => {
      storage = GridFsStorage({
        url: setting.mongoUrl,
        file: function* () {
          yield {
            filename: 'name',
          };
        },

      });

      const upload = multer({storage});

      app.post('/finite', upload.array('photos', 2), (err, req, res, next) => {
        error = err;
        next();
      });

      storage.on('connection', () => {
        request(app)
          .post('/finite')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end(done);
      });
    });

    it('should be a failed request', () => {
      expect(error).to.be.an('error');
      expect(error.storageErrors).to.have.lengthOf(0);
    });

    it('should not upload any file', function (done) {
      const db = storage.db;
      db.collection('fs.files').count({}, (err, count) => {
        expect(count).to.equal(0);
        done(err);
      });
    });

    it('should throw an error about the ended generator', () => {
      expect(error.message).to.match(/Generator ended unexpectedly/);
    });

    after(() => cleanStorage(storage));
  });

  describe('rejected promise', () => {
    let error;
    before((done) => {
      storage = GridFsStorage({
        url: setting.mongoUrl,
        file: function* () {
          yield Promise.reject('reason');
        },
      });

      const upload = multer({storage});

      app.post('/rejected', upload.array('photos', 2), (err, req, res, next) => {
        error = err;
        next();
      });

      storage.on('connection', () => {
        request(app)
          .post('/rejected')
          .attach('photos', files[0])
          .end(done);
      });
    });

    it('should be a failed request', () => {
      expect(error).to.be.an('string');
      expect(error).to.equal('reason');
    });

    it('should not upload any file', function (done) {
      const db = storage.db;
      db.collection('fs.files').count({}, (err, count) => {
        expect(count).to.equal(0);
        done(err);
      });
    });

    after(() => cleanStorage(storage));
  });

});
