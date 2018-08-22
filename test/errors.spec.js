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
const {files, cleanStorage, version, getDb, getClient} = require('./utils/testutils');

const sinon = require('sinon');
const sinonChai = require('sinon-chai');
chai.use(sinonChai);

describe('Error handling', () => {
  let storage, app;

  before(() => app = express());

  describe('Using invalid types as file configurations', () => {
    let error;
    before((done) => {
      storage = new GridFsStorage({
        url: settings.mongoUrl,
        file: () => true,
      });
      const upload = multer({storage});

      app.post('/types', upload.single('photo'), (err, req, res, next) => {
        error = err;
        next();
      });

      storage.on('connection', () => {
        request(app)
          .post('/types')
          .attach('photo', files[0])
          .end(done);
      });
    });

    it('should have given filename', () => {
      expect(error).to.be.an('error');
      expect(error.message).to.equal('Invalid type for file settings, got boolean');
    });

    after(() => cleanStorage(storage));
  });

  describe('Catching errors', () => {
    let db, client;

    it('should fail gracefully if an error is thrown inside the configuration function', function (done) {
      this.slow(200);
      let error;
      storage = GridFsStorage({
        url: settings.mongoUrl,
        file: () => {
          throw new Error('Error thrown');
        },
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
        url: settings.mongoUrl,
        file: function* () { // eslint-disable-line require-yield
          throw new Error('File error');
        },
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

    xit('should emit an error event when the file streaming fails', function (done) {
      this.slow(500);
      const errorSpy = sinon.spy();
      const deprecated = sinon.spy();

      MongoClient.connect(settings.mongoUrl, function (err, _db) {
        if (err) {
          done(err);
        }
        db = getDb(_db);
        client = getClient(_db);
        db.collection('fs.files')
          .createIndex('md5', {unique: true})
          .then(() => {
            storage = GridFsStorage({db});
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
          })
          .catch(done);
      });
    });

    afterEach(() => cleanStorage(storage, db, client));
  });

  describe('MongoDb connection', () => {

    describe('Connection promise fails to connect', () => {
      let error, db, client;
      const errorSpy = sinon.spy();

      before((done) => {
        error = new Error('Failed promise');

        const promise = MongoClient.connect(settings.mongoUrl)
          .then(_db => {
            db = getDb(_db);
            client = getClient(_db);
            return db;
          })
          .then(() => {
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                reject(error);
              });
            }, 300);
          });

        storage = GridFsStorage({
          db: promise,
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

      it('should emit an error if the connection fails to open', () => {
        expect(errorSpy).to.be.calledOnce;
      });

      it('should emit the promise error', () => {
        const call = errorSpy.getCall(0);
        expect(call.args[0]).to.equal(error);
      });

      it('should set the database instance to null', () => {
        expect(storage.db).to.equal(null);
      });

      after(() => {
        sinon.restore();
        return cleanStorage(storage, db, client);
      });
    });

    describe('Connection is not opened', () => {
      let error;

      before((done) => {
        mongo.MongoClient.connect(settings.mongoUrl)
          .then((_db) => {
            const db = getDb(_db);
            const client = getClient(_db);
            if (client) {
              return client.close().then(() => db);
            }
            return db.close().then(() => db);
          })
          .then(db => {
            storage = GridFsStorage({db});
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
          })
          .catch(done);
      });

      it('should throw an error if database connection is not opened', () => {
        expect(error).to.be.an('error');
        expect(error.message).to.equal('The database connection must be open to store files');
      });
    });

    describe('Connection function fails to connect', () => {
      const err = new Error();
      let mongoSpy;

      before(() => {
        mongoSpy = sinon
          .stub(MongoClient, 'connect')
          .callsFake(function (url, options, cb) {
            setTimeout(() => {
              cb(err);
            });
          });
      });

      it('should throw an error if the mongodb connection fails', function (done) {
        const connectionSpy = sinon.spy();

        storage = GridFsStorage({
          url: settings.mongoUrl,
        });

        storage.once('connectionFailed', connectionSpy);

        setTimeout(() => {
          expect(connectionSpy).to.have.been.calledOnce;
          expect(mongoSpy).to.have.been.calledOnce;
          done();
        }, 50);
      });

      after(() => sinon.restore());
    });

  });

  describe('Crypto module', () => {
    let error, randomBytesSpy;
    const generatedError = new Error('Random bytes error');

    before((done) => {
      randomBytesSpy = sinon
        .stub(crypto, version.major === 0 ? 'pseudoRandomBytes' : 'randomBytes')
        .callsFake(function random(size, cb) {
          if (cb) {
            return cb(generatedError);
          }
          throw generatedError;
        });

      storage = GridFsStorage({
        url: settings.mongoUrl,
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

    it('should result in an error if the randomBytes function fails', () => {
      expect(error).to.equal(generatedError);
      expect(error.message).to.equal('Random bytes error');
      expect(randomBytesSpy).to.have.been.calledOnce;
    });

    after(() => sinon.restore());
  });

})
;
