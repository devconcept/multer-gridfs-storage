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

  it('should fail gracefully if an error is thrown inside the configuration function', function (done) {
    storage = GridFsStorage({
      url: settings.mongoUrl(),
      file: () => {
        throw new Error('Error thrown');
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
          expect(res.error.text).to.match(/Error: Error thrown/);
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
      .then(() => fs.createIndex('md5', {unique: true}))
      .then(() => {

        storage = GridFsStorage({url: settings.mongoUrl()});

        const upload = multer({storage});

        app.post('/emit', upload.array('photos', 2), (req, res) => {
          res.send({headers: req.headers, files: req.files, body: req.body});
        });

        storage.on('streamError', errorSpy);

        request(app)
          .post('/emit')
          // Send the same file twice so the checksum is the same
          .attach('photos', files[0])
          .attach('photos', files[0])
          .end((err, body) => {
            expect(body.status).to.equal(500);
            expect(errorSpy).to.be.calledOnce;
            const call = errorSpy.getCall(0);
            expect(call.args[0]).to.be.an.instanceof(Error);
            expect(call.args[1]).to.have.all.keys('chunkSize', 'contentType', 'filename', 'metadata', 'bucketName', 'id');
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
      file: function*() {
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
    storage.remove = removeRef;
    return cleanDb(storage);
  });

});
