'use strict';

const express = require('express');
const chai = require('chai');
const request = require('supertest');
const multer = require('multer');
const mongo = require('mongodb');
const md5File = require('md5-file');
const fs = require('fs');
const sinon = require('sinon');
const crypto = require('crypto');
const utils = require('../lib/utils');
const GridFsStorage = require('../index');
const setting = require('./utils/settings');
const testUtils = require('./utils/testutils');
const files = testUtils.files;
const cleanStorage = testUtils.cleanStorage;
const getDb = testUtils.getDb;
const getClient = testUtils.getClient;

const MongoClient = mongo.MongoClient;
const expect = chai.expect;

describe('Backwards compatibility', () => {
  let result, app, storage, size;

  before((done) => {
    app = express();
    fs.readFile(files[0], (err, f) => {
      size = f.length;
      done(err);
    });
  });

  describe('Using GridStore streams to save files', () => {
    before((done) => {
      storage = new GridFsStorage({url: setting.mongoUrl});
      storage._legacy = true;

      const upload = multer({storage});

      app.post('/store', upload.single('photos'), (req, res) => {
        result = {headers: req.headers, file: req.file, body: req.body};
        res.end();
      }, (err, req, res, next) => {
        console.log(err);
        next();
      });

      storage.on('connection', () => {
        request(app)
          .post('/store')
          .attach('photos', files[0])
          .end(done);
      });
    });

    it('should store the files on upload', () => {
      expect(result.file).to.be.a('object');
    });

    it('should have each stored file the same MD5 signature than the uploaded file', () => {
      expect(result.file.md5).to.be.equal(md5File(files[0]));
    });

    it('should have a filename property', () => {
      expect(result.file).to.have.a.property('filename');
      expect(result.file.filename).to.be.a('string');
      expect(result.file.filename).to.match(/^[0-9a-f]{32}$/);
    });

    it('should have a metadata property', () => {
      expect(result.file).to.have.a.property('metadata');
      expect(result.file.metadata).to.equal(null);
    });

    it('should have a id property', () => {
      expect(result.file).to.have.a.property('id');
      expect(result.file.id).to.match(/^[0-9a-f]{24}$/);
    });

    it('should have a size property with the length of the file', () => {
      expect(result.file).to.have.a.property('size');
      expect(result.file.size).to.equal(size);
    });

    it('should have the default bucket name pointing to the fs collection', () => {
      expect(result.file).to.have.a.property('bucketName');
      expect(result.file.bucketName).to.equal('fs');
    });

    it('should have the date of the upload', () => {
      expect(result.file).to.have.a.property('uploadDate');
    });

    after(() => cleanStorage(storage));

  });

  describe('Changing file configuration', () => {
    before((done) => {
      let counter = 0;
      const data = ['foo', 'bar'];
      const sizes = [102400, 204800];
      const names = ['plants', 'animals'];
      const contentTypes = ['text/plain', 'image/jpeg'];
      storage = new GridFsStorage({
        url: setting.mongoUrl,
        file: () => {
          counter++;
          return {
            filename: 'file' + counter,
            metadata: data[counter - 1],
            id: counter,
            chunkSize: sizes[counter - 1],
            bucketName: names[counter - 1],
            contentType: contentTypes[counter - 1],
          };
        },
      });
      // Set to use GridStore
      storage._legacy = true;

      const upload = multer({storage});

      app.post('/config', upload.array('photos', 2), (req, res) => {
        result = {headers: req.headers, files: req.files, body: req.body};
        res.end();
      });

      storage.on('connection', () => {
        request(app)
          .post('/config')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end(done);
      });
    });

    it('should the request contain the two uploaded files', () => {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });

    it('should be named with the provided value', () => {
      expect(result.files[0].filename).to.equal('file1');
      expect(result.files[1].filename).to.equal('file2');
    });

    it('should contain a metadata object with the provided object', () => {
      expect(result.files[0].metadata).to.equal('foo');
      expect(result.files[1].metadata).to.equal('bar');
    });

    it('should be stored with the provided chunkSize value', () => {
      expect(result.files[0].chunkSize).to.equal(102400);
      expect(result.files[1].chunkSize).to.equal(204800);
    });

    it('should change the id with the provided value', () => {
      expect(result.files[0].id).to.equal(1);
      expect(result.files[1].id).to.equal(2);
    });

    it('should be stored under in a collection with the provided value', function (done) {
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

  describe('Using GridStore to delete files', () => {
    let error, db, client;

    before(() => {
      return MongoClient.connect(setting.mongoUrl).then(_db => {
        db = getDb(_db);
        client = getClient(_db);
        storage = new GridFsStorage({db});
        storage._legacy = true;

        const upload = multer({storage});

        app.post('/delete', upload.array('photos', 1), (err, req, res, next) => {
          result = {headers: req.headers, body: req.body, files: req.files};
          error = err;
          next();
        });

        return new Promise((resolve) => {
          storage.on('connection', () => {
            request(app)
              .post('/delete')
              .attach('photos', files[0])
              .attach('photos', files[1])
              .end(() => resolve());
          });
        });
      });
    });

    it('should remove the files on upload', () => {
      expect(error.storageErrors).to.have.lengthOf(0);
    });

    it('should not have any files stored in the database', () => {
      mongo.GridStore.list(db).then((files) => {
        expect(files).to.have.lengthOf(0);
      });
    });

    after(() => cleanStorage(storage, db, client));
  });

  describe('GridStore open error', () => {
    const errorSpy = sinon.spy();
    const fileSpy = sinon.spy();
    const err = new Error();

    before((done) => {
      sinon.stub(mongo, 'GridStore').returns({
        stream: sinon.stub().returns({
          on: sinon.stub(),
          gs: {
            open: sinon.stub().callsFake(cb => cb(err)),
          },
        }),
      });
      storage = GridFsStorage({url: setting.mongoUrl});
      storage._legacy = true;
      storage.on('streamError', errorSpy);
      storage.on('file', fileSpy);

      const upload = multer({storage});

      app.post('/storeopen', upload.single('photo'), (err, req, res, next) => { // eslint-disable-line no-unused-vars
        res.end();
      });

      request(app)
        .post('/storeopen')
        .attach('photo', files[0])
        .end(done);
    });

    it('should emit an error event when the store fails to open', () => {
      expect(errorSpy).to.be.calledOnce;
      expect(fileSpy).not.to.be.called;
      const call = errorSpy.getCall(0);
      expect(call.args[0]).to.equal(err);
    });

    after(() => {
      sinon.restore();
      cleanStorage(storage);
    });
  });

  describe('GridStore close error', () => {
    let emitterStub;
    const errorSpy = sinon.spy();
    const fileSpy = sinon.spy();
    const err = new Error();

    before((done) => {
      emitterStub = sinon.stub().callsFake((evt, cb) => {
        if (evt === 'end') {
          cb();
        }
      });
      sinon.stub(mongo, 'GridStore').returns({
        stream: sinon.stub().returns({
          on: emitterStub,
          gs: {
            open: sinon.stub().callsFake(cb => cb()),
            close: sinon.stub().callsFake(cb => cb(err)),
          },
        }),
      });
      storage = GridFsStorage({url: setting.mongoUrl});
      storage._legacy = true;
      storage.on('streamError', errorSpy);
      storage.on('file', fileSpy);

      const upload = multer({storage});

      app.post('/storeclose', upload.single('photo'), (err, req, res, next) => { // eslint-disable-line no-unused-vars
        res.end();
      });

      request(app)
        .post('/storeclose')
        .attach('photo', files[0])
        .end(done);
    });

    it('should emit an error event when the store fails to open', () => {
      expect(errorSpy).to.be.calledOnce;
      expect(fileSpy).not.to.be.called;
      const call = errorSpy.getCall(0);
      expect(call.args[0]).to.equal(err);
    });

    after(() => {
      sinon.restore();
      cleanStorage(storage);
    });
  });

  describe('MongoClient and Db handling', () => {
    let client, db, server, mongoSpy;
    const {host, port, database} = setting.connection;

    beforeEach(() => {
      server = new mongo.Server(host, port);
      db = new mongo.Db(database, server);
      client = new MongoClient(server);
    });

    it('should handle the database instance returned in mongo 2', () => {
      mongoSpy = sinon.stub(MongoClient, 'connect').callsFake(function () {
        const callback = arguments.length > 2 ? arguments[2] : null;
        if (callback) {
          return callback(null, db);
        }
        return Promise.resolve(db);
      });
      storage = GridFsStorage({url: setting.mongoUrl});

      storage.on('connection', (db, client) => {
        expect(db).to.be.an.instanceOf(mongo.Db);
        expect(client).to.equal(null);
      });
    });

    it('should handle the client instance returned in mongo 3', () => {
      if (!client.db) {
        client.db = () => {
        };
      } else {
        sinon.stub(client, 'db').callsFake(() => db);
      }
      mongoSpy = sinon.stub(MongoClient, 'connect').callsFake(function () {
        const callback = arguments.length > 2 ? arguments[2] : null;
        if (callback) {
          return callback(null, client);
        }
        return Promise.resolve(client);
      });
      storage = GridFsStorage({url: setting.mongoUrl});

      storage.on('connection', (db, client) => {
        expect(mongoSpy).to.have.been.calledOnce;
        expect(db).to.be.an.instanceOf(mongo.Db);
        expect(client).to.be.an.instanceOf(MongoClient);
      });
    });

    describe('Legacy functions', () => {
      it('should use pseudoRandomBytes if node is in the 0.x range', (done) => {
        const isOldNode = sinon
          .stub(utils, 'isOldNode')
          .onFirstCall().callThrough()
          .onSecondCall().callsFake(() => true);

        const randomBytesSpy = sinon.stub(crypto, 'randomBytes').callThrough();
        const psRandomBytesSpy = sinon.stub(crypto, 'pseudoRandomBytes').callThrough();
        storage = new GridFsStorage({url: setting.mongoUrl});

        const upload = multer({storage});

        app.post('/rb', upload.array('photos'), (req, res) => {
          res.end();
        });

        storage.on('connection', () => {
          request(app)
            .post('/rb')
            .attach('photos', files[0])
            .attach('photos', files[1])
            .end(() => {
              expect(isOldNode).to.have.been.calledTwice;
              expect(randomBytesSpy).to.have.been.calledOnce;
              expect(psRandomBytesSpy).to.have.been.calledOnce;
              expect(randomBytesSpy).to.have.been.calledBefore(psRandomBytesSpy);
              done();
            });
        });
      });

      afterEach(() => cleanStorage(storage));
    });

    afterEach(() => sinon.restore());
  });
});
