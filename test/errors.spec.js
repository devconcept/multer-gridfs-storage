'use strict';

const GridFsStorage = require('../index');

const multer = require('multer');
const {expect} = require('chai');
const request = require('supertest');
const express = require('express');
const settings = require('./utils/settings');
const {files, cleanDb, version} = require('./utils/testutils');
const mute = require('mute');

describe('error handling', function () {
  let storage, app, unmute;

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

  it('should throw an error if the chunckSize function is invoked with an error callback', function (done) {
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

  after(() => {
    unmute();
    return cleanDb(storage);
  });

});
