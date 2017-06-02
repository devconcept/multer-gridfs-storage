'use strict';

const GridFsStorage = require('../index');

const multer = require('multer');
const chai = require('chai');
const expect = chai.expect;
const request = require('supertest');
const express = require('express');
const settings = require('./utils/settings');
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const Grid = require('gridfs-stream');
const {files, cleanDb, version} = require('./utils/testutils');
const mute = require('mute');

const sinon = require('sinon');
const sinonChai = require('sinon-chai');
chai.use(sinonChai);

describe('error handling', function () {
  let storage, app, unmute, connectRef, removeRef;

  before(() => {
    unmute = mute(process.stderr);
    app = express();
  });

  it('should throw an error if the identifier function is invoked with an error callback', function (done) {
    storage = GridFsStorage({
      url: settings.mongoUrl(),
      identifier: (req, file, cb) => {
        cb(new Error('Identifier error'));
      }
    });

    const upload = multer({storage});

    app.post('/identifier', upload.single('photo'), (req, res) => {
      res.send({headers: req.headers, files: req.files, body: req.body});
    });

    storage.on('connection', () => {
      request(app)
        .post('/identifier')
        .attach('photo', files[0])
        .end((err, res) => {
          expect(res.serverError).to.equal(true);
          expect(res.error).to.be.an('error');
          expect(res.error.text).to.match(/Error: Identifier error/);
          done();
        });
    });
  });

  it('should throw an error if the filename function is invoked with an error callback', function (done) {
    storage = GridFsStorage({
      url: settings.mongoUrl(),
      filename: (req, file, cb) => {
        cb(new Error('Filename error'));
      }
    });

    const upload = multer({storage});

    app.post('/filename', upload.single('photo'), (req, res) => {
      res.send({headers: req.headers, files: req.files, body: req.body});
    });

    storage.on('connection', () => {
      request(app)
        .post('/filename')
        .attach('photo', files[0])
        .end((err, res) => {
          expect(res.serverError).to.equal(true);
          expect(res.error).to.be.an('error');
          expect(res.error.text).to.match(/Error: Filename error/);
          done();
        });
    });
  });

  it('should throw an error if the metadata is invoked with an error callback', function (done) {
    storage = GridFsStorage({
      url: settings.mongoUrl(),
      metadata: (req, file, cb) => {
        cb(new Error('Metadata error'));
      }
    });

    const upload = multer({storage});

    app.post('/metadata', upload.single('photo'), (req, res) => {
      res.send({headers: req.headers, files: req.files, body: req.body});
    });

    storage.on('connection', function () {
      request(app)
        .post('/metadata')
        .attach('photo', files[0])
        .end((err, res) => {
          expect(res.serverError).to.equal(true);
          expect(res.error).to.be.an('error');
          expect(res.error.text).to.match(/Error: Metadata error/);
          done();
        });
    });
  });

  it('should throw an error if the chunkSize function is invoked with an error callback', function (done) {
    storage = GridFsStorage({
      url: settings.mongoUrl(),
      chunkSize: (req, file, cb) => {
        cb(new Error('ChunkSize error'));
      }
    });

    const upload = multer({storage});

    app.post('/chunksize', upload.single('photo'), (req, res) => {
      res.send({headers: req.headers, files: req.files, body: req.body});
    });

    storage.on('connection', () => {
      request(app)
        .post('/chunksize')
        .attach('photo', files[0])
        .end((err, res) => {
          expect(res.serverError).to.equal(true);
          expect(res.error).to.be.an('error');
          expect(res.error.text).to.match(/Error: ChunkSize error/);
          done();
        });
    });
  });

  it('should throw an error if the root function is invoked with an error callback', function (done) {

    storage = GridFsStorage({
      url: settings.mongoUrl(),
      root: (req, file, cb) => {
        cb(new Error('Root error'));
      }
    });

    const upload = multer({storage});

    app.post('/root', upload.single('photo'), (req, res) => {
      res.send({headers: req.headers, files: req.files, body: req.body});
    });

    storage.on('connection', () => {
      request(app)
        .post('/root')
        .attach('photo', files[0])
        .end((err, res) => {
          expect(res.serverError).to.equal(true);
          expect(res.error).to.be.an('error');
          expect(res.error.text).to.match(/Error: Root error/);
          done();
        });
    });
  });


  it('should emit an error event when the file streaming fails', function (done) {
    let db, fs;
    const errorSpy = sinon.spy();

    MongoClient
      .connect(settings.mongoUrl())
      .then((_db) => db = _db)
      .then(() => fs = db.collection('fs.files'))
      .then(() => fs.createIndex('name', {unique: true}))
      .then(() => {

        const gfs = new Grid(db, mongo);
        storage = GridFsStorage({
          gfs: gfs,
          filename: (req, file, cb) => {
            cb(null, 'name');
          }
        });

        const upload = multer({storage});

        app.post('/emit', upload.array('photos', 2), (req, res) => {
          res.send({headers: req.headers, files: req.files, body: req.body});
        });

        storage.on('error', errorSpy);

        request(app)
          .post('/emit')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end((err, body) => {
            expect(body.status).to.equal(500);
            expect(errorSpy).to.be.calledOnce;
            const call = errorSpy.getCall(0);
            expect(call.args[0]).to.be.an.instanceof(Error);
            expect(call.args[1]).to.have.all.keys('chunkSize', 'content_type', 'filename', 'metadata', 'root');
            done();
          });

      });

  });

  it('should fail gracefully if an error is thrown inside an option function', function (done) {

    storage = GridFsStorage({
      url: settings.mongoUrl(),
      filename: () => {
        throw new Error('Filename error');
      }
    });

    const upload = multer({storage});

    app.post('/fail', upload.single('photo'), (req, res) => {
      res.send({headers: req.headers, files: req.files, body: req.body});
    });

    storage.on('connection', () => {
      request(app)
        .post('/fail')
        .attach('photo', files[0])
        .end((err, res) => {
          expect(res.serverError).to.equal(true);
          expect(res.error).to.be.an('error');
          expect(res.error.text).to.match(/Error: Filename error/);
          done();
        });
    });
  });

  it('should fail gracefully if an error is thrown inside a generator function', function (done) {
    if (version.major < 6) {
      this.skip();
    }

    storage = GridFsStorage({
      url: settings.mongoUrl(),
      filename: function*() {
        throw new Error('Filename error');
      }
    });

    const upload = multer({storage});

    app.post('/failgen', upload.single('photo'), (req, res) => {
      res.send({headers: req.headers, files: req.files, body: req.body});
    });

    storage.on('connection', () => {
      request(app)
        .post('/failgen')
        .attach('photo', files[0])
        .end((err, res) => {
          expect(res.serverError).to.equal(true);
          expect(res.error).to.be.an('error');
          expect(res.error.text).to.match(/Error: Filename error/);
          done();
        });
    });
  });

  it('should append the storage error in case the remove function fails', function (done) {
    //const e = new Error();
    storage = GridFsStorage({
      url: settings.mongoUrl()
    });

    const upload = multer({storage});

    /* eslint-disable no-unused-vars */
    app.post('/storageerror', upload.single('photo'), (err, req, res, next) => {
      expect(e).to.equal(err);
      expect(e).to.have.property('storageErrors');
    });
    /* eslint-enable no-unused-vars */

    storage.on('connection', () => {
      removeRef = storage.gfs.remove;
      storage.gfs.remove = function (options, callback) {
        callback(new Error());
      };

      request(app)
        .post('/storageerror')
        .attach('photo', files[0])
        .attach('photo', files[1])
        .end((err, res) => {
          expect(res.serverError).to.equal(true);
          expect(res.error).to.be.an('error');
          done();
        });
    });
  });

  it('should throw an error if the mongodb connection fails', function () {
    connectRef = mongo.MongoClient.connect;
    const err = new Error();

    mongo.MongoClient.connect = function (url, cb) {
      cb(err);
    };

    const errFn = function () {
      storage = GridFsStorage({
        url: settings.mongoUrl()
      });
    };

    expect(errFn).to.throw(err);
  });

  after(() => {
    mongo.MongoClient.connect = connectRef;
    unmute();
    storage.gfs.remove = removeRef;
    return cleanDb(storage);
  });

});
