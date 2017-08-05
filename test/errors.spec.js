'use strict';

const GridFsStorage = require('../index');

const multer = require('multer');
const crypto = require('crypto');
const chai = require('chai');
const expect = chai.expect;
const request = require('supertest');
const express = require('express');
const settings = require('./utils/settings');
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const {files, cleanDb, version} = require('./utils/testutils');
const Promise = require('bluebird');

const sinon = require('sinon');
const sinonChai = require('sinon-chai');
chai.use(sinonChai);

describe('Error handling', function () {
  let storage, app;

  before(() => app = express());

  describe('Catching errors', function () {

    it('should fail gracefully if an error is thrown inside the configuration function', function (done) {
      this.slow(200);
      let error;
      storage = GridFsStorage({
        url: settings.mongoUrl(),
        file: () => {
          throw new Error('Error thrown');
        }
      });

      const upload = multer({storage});

      app.post('/fail', upload.single('photo'), (err, req, res, next) => {
        error = err;
        next();
      });

      storage.on('connection', () => {
        request(app)
          .post('/fail')
          .attach('photo', files[0])
          .end(() => {
            expect(error).to.be.an('error');
            expect(error.message).to.equal('Error thrown');
            done();
          });
      });
    });

    it('should fail gracefully if an error is thrown inside a generator function', function (done) {
      let error;
      if (version.major < 4) {
        this.skip();
      }

      storage = GridFsStorage({
        url: settings.mongoUrl(),
        file: function*() { // eslint-disable-line require-yield
          throw new Error('File error');
        }
      });

      const upload = multer({storage});

      app.post('/failgen', upload.single('photo'), (err, req, res, next) => {
        error = err;
        next();
      });

      storage.on('connection', () => {
        request(app)
          .post('/failgen')
          .attach('photo', files[0])
          .end(() => {
            expect(error).to.be.an('error');
            expect(error.message).to.equal('File error');
            done();
          });
      });
    });

    it('should emit an error event when the file streaming fails', function (done) {
      this.slow(500);
      let db, fs;
      const errorSpy = sinon.spy();
      const deprecated = sinon.spy();

      MongoClient
        .connect(settings.mongoUrl())
        .then((_db) => db = _db)
        .then(() => fs = db.collection('fs.files'))
        .then(() => fs.createIndex('md5', {unique: true}))
        .then(() => {

          storage = GridFsStorage({url: settings.mongoUrl()});

          const upload = multer({storage});

          app.post('/emit', upload.array('photos', 2), (err, req, res, next) => {
            next();
          });

          storage.on('error', deprecated);
          storage.on('streamError', errorSpy);

          request(app)
            .post('/emit')
            // Send the same file twice so the checksum is the same
            .attach('photos', files[0])
            .attach('photos', files[0])
            .end(() => {
              expect(errorSpy).to.be.calledOnce;
              expect(deprecated).not.to.be.called;
              const call = errorSpy.getCall(0);
              expect(call.args[0]).to.be.an.instanceOf(Error);
              expect(call.args[1]).to.have.all.keys('chunkSize', 'contentType', 'filename', 'metadata', 'bucketName', 'id');
              done();
            });
        });


      after(() => cleanDb(storage));
    });
  });

  describe('MongoDb connection', function () {

    describe('Connection promise fails to connect', function () {
      this.slow(800);
      let error;
      const errorSpy = sinon.spy();

      before((done) => {
        error = new Error('Failed promise');

        const promise = mongo.MongoClient.connect(settings.mongoUrl())
          .then(() => {
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                reject(error);
              });
            }, 300);
          });

        storage = GridFsStorage({
          db: promise
        });

        storage.on('connectionFailed', errorSpy);

        const upload = multer({storage});

        app.post('/promiseconnection', upload.array('photos', 2), (err, req, res, next) => {
          error = err;
          next();
        });

        request(app)
          .post('/promiseconnection')
          .attach('photos', files[0])
          .attach('photos', files[0])
          .end(() => {
            setTimeout(done, 500);
          });
      });

      it('should emit an error if the connection fails to open', function () {
        expect(errorSpy).to.be.calledOnce;
      });

      it('should emit the promise error', function () {
        const call = errorSpy.getCall(0);
        expect(call.args[0]).to.equal(error);
      });

      it('should set the database instance to null', function () {
        expect(storage.db).to.equal(null);
      });

      after(() => cleanDb(storage));
    });

    describe('Connection is not opened', function () {
      let error;

      before((done) => {
        const promise = mongo.MongoClient.connect(settings.mongoUrl())
          .then((db) => {
            return db.close().then(() => db);
          });

        setTimeout(() => {
          storage = GridFsStorage({
            db: promise
          });
          const upload = multer({storage});

          app.post('/close', upload.array('photos', 2), (err, req, res, next) => {
            error = err;
            next();
          });

          request(app)
            .post('/close')
            .attach('photos', files[0])
            .attach('photos', files[0])
            .end(done);
        }, 500);
      });

      it('should throw an error if database connection is not opened', function () {
        expect(error).to.be.an('error');
        expect(error.message).to.equal('The database connection must be open to store files');
      });
    });

    describe('Connection function fails to connect', function () {
      this.slow(100);
      let err, connectRef;

      before(() => {
        connectRef = mongo.MongoClient.connect;
        err = new Error();

        mongo.MongoClient.connect = function (url, options, cb) {
          // Connection is always asynchronous and the connectionFailed event is emitted after all the attempts fail
          setTimeout(() => {
            cb(err);
          }, 100);
        };
      });

      it('should throw an error if the mongodb connection fails', function (done) {
        this.slow(300);
        const connectionSpy = sinon.spy();

        storage = GridFsStorage({
          url: settings.mongoUrl()
        });

        storage.once('connectionFailed', connectionSpy);

        setTimeout(() => {
          expect(connectionSpy).to.be.calledOnce;
          done();
        }, 100);
      });

      after(() => mongo.MongoClient.connect = connectRef);
    });

  });

  describe('Crypto module', function () {
    let error, generatedError, randomBytesRef;

    before((done) => {
      randomBytesRef = version.major === 0 ? crypto.pseudoRandomBytes : crypto.randomBytes;
      generatedError = new Error('Random bytes error');

      function random(size, cb) {
        if (cb) {
          return cb(generatedError);
        }
        throw generatedError;
      }

      if (version.major === 0) {
        crypto.pseudoRandomBytes = random;
      } else {
        crypto.randomBytes = random;
      }

      storage = GridFsStorage({
        url: settings.mongoUrl()
      });

      const upload = multer({storage});

      app.post('/randombytes', upload.single('photo'), (err, req, res, next) => {
        error = err;
        next();
      });

      storage.on('connection', () => {
        request(app)
          .post('/randombytes')
          .attach('photo', files[0])
          .end(done);
      });
    });

    it('should result in an error if the randomBytes function fails', function () {
      expect(error).to.equal(generatedError);
      expect(error.message).to.equal('Random bytes error');
    });

    after(() => {
      if (version.major === 0) {
        crypto.pseudoRandomBytes = randomBytesRef;
      } else {
        crypto.randomBytes = randomBytesRef;
      }
    });
  });

});
