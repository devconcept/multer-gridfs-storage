'use strict';

const express = require('express');
const chai = require('chai');
const expect = chai.expect;
const GridFsStorage = require('../index');
const setting = require('./utils/settings');
const {files, cleanDb} = require('./utils/testutils');
const request = require('supertest');
const multer = require('multer');
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const md5File = require('md5-file');
const fs = require('fs');
const Promise = global.Promise || require('es6-promise');

chai.use(require('chai-interface'));

describe('Storage', function () {
  let result, app, storage;

  before(() => app = express());

  describe('url created instance', function () {
    before((done) => {
      storage = new GridFsStorage({url: setting.mongoUrl()});

      const upload = multer({storage});

      app.post('/url', upload.array('photos', 2), (req, res) => {
        result = {headers: req.headers, files: req.files, body: req.body};
        res.end();
      });

      storage.on('connection', () => {
        request(app)
          .post('/url')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end(done);
      });
    });

    it('should store the files on upload', function () {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });

    it('should have each stored file the same MD5 signature than the uploaded file', function (done) {
      result.files.forEach((file, index) => {
        expect(file.md5).to.be.equal(md5File(files[index]));
      });
      done();
    });

    after(() => cleanDb(storage));

  });

  describe('db created instance', function () {
    before((done) => {
      MongoClient.connect(setting.mongoUrl(), (err, database) => {
        if (err) {
          return done(err);
        }

        storage = GridFsStorage({db: database});

        const upload = multer({storage});

        app.post('/db', upload.array('photos', 2), (req, res) => {
          result = {headers: req.headers, files: req.files, body: req.body};
          res.end();
        });

        request(app)
          .post('/db')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end(done);
      });
    });

    it('should store the files on upload', function () {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });

    it('should have each stored file the same MD5 signature than the uploaded file', function (done) {
      result.files.forEach((file, index) => {
        expect(file.md5).to.be.equal(md5File(files[index]));
      });
      done();
    });

    after(() => cleanDb(storage));

  });

  describe('db promise based instance', function () {
    before((done) => {
      const promised = MongoClient
        .connect(setting.mongoUrl());

      storage = GridFsStorage({db: promised});
      const upload = multer({storage});


      app.post('/promise', upload.array('photos', 2), (req, res) => {
        result = {headers: req.headers, files: req.files, body: req.body};
        res.end();
      });

      storage.on('connection', () => {
        request(app)
          .post('/promise')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end(done);
      });
    });

    it('should store the files on upload', function () {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });

    it('should have each stored file the same MD5 signature than the uploaded file', function () {
      result.files.forEach((file, index) => {
        expect(file.md5).to.be.equal(md5File(files[index]));
      });
    });

    after(() => cleanDb(storage));
  });

  describe('handle incoming files while connecting', function () {
    before((done) => {
      const promised = MongoClient
        .connect(setting.mongoUrl()).then((db) => {
          return new Promise((resolve) => {
            setTimeout(() => resolve(db), 1000);
          });
        });

      storage = GridFsStorage({db: promised});
      const upload = multer({storage});


      app.post('/incoming', upload.array('photos', 2), (req, res) => {
        result = {headers: req.headers, files: req.files, body: req.body};
        res.end();
      });

      request(app)
        .post('/incoming')
        .attach('photos', files[0])
        .attach('photos', files[1])
        .end(done);
    });

    it('should store the files on upload', function () {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });

    it('should have each stored file the same MD5 signature than the uploaded file', function () {
      result.files.forEach((file, index) => {
        expect(file.md5).to.be.equal(md5File(files[index]));
      });
    });

    after(() => cleanDb(storage));

  });

  describe('default uploaded file spec', function () {
    let size;
    before((done) => {
      storage = GridFsStorage({url: setting.mongoUrl()});
      const upload = multer({storage});

      app.post('/spec', upload.single('photo'), (req, res) => {
        result = {headers: req.headers, file: req.file, body: req.body};
        res.end();
      });

      storage.on('connection', () => {
        request(app)
          .post('/spec')
          .attach('photo', files[0])
          .end(() => {
            fs.readFile(files[0], (err, f) => {
              size = f.length;
              done(err);
            });
          });
      });
    });

    it('should have a filename property', function () {
      expect(result.file).to.have.a.property('filename');
      expect(result.file.filename).to.be.a('string');
      expect(result.file.filename).to.match(/^[0-9a-f]{32}$/);
    });

    it('should have a metadata property', function () {
      expect(result.file).to.have.a.property('metadata');
      expect(result.file.metadata).to.equal(null);
    });

    it('should have a id property', function () {
      expect(result.file).to.have.a.property('id');
      expect(result.file.id).to.match(/^[0-9a-f]{24}$/);
    });

    it('should have a size property with the length of the file', function () {
      expect(result.file).to.have.a.property('size');
      expect(result.file.size).to.equal(size);
    });

    it('should have the default bucket name pointing to the fs collection', function () {
      expect(result.file).to.have.a.property('bucketName');
      expect(result.file.bucketName).to.equal('fs');
    });

    it('should have the date of the upload', function () {
      expect(result.file).to.have.a.property('uploadDate');
    });

    after(() => cleanDb(storage));

  });

  describe('file function usage', function () {
    before((done) => {
      let counter = 0;
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        file: function () {
          counter++;
          return {
            filename: `name${counter}`
          };
        }
      });
      const upload = multer({storage});

      app.post('/usage', upload.array('photo', 2), (req, res) => {
        result = {headers: req.headers, files: req.files, body: req.body};
        res.end();
      });

      storage.on('connection', () => {
        request(app)
          .post('/usage')
          .attach('photo', files[0])
          .attach('photo', files[1])
          .end(done);
      });
    });

    it('should have a filename property', function () {
      result.files.forEach((file) => {
        expect(file).to.have.a.property('filename');
        expect(file.filename).to.be.a('string');
        expect(file.filename).to.match(/^name\d+$/);
      });
    });

    it('should have a metadata property', function () {
      result.files.forEach((file) => {
        expect(file).to.have.a.property('metadata');
        expect(file.metadata).to.equal(null);
      });
    });

    it('should have a id property', function () {
      result.files.forEach((file) => {
        expect(file).to.have.a.property('id');
        expect(file.id).to.match(/^[0-9a-f]{24}$/);
      });
    });

    it('should have the default bucket name pointing to the fs collection', function () {
      result.files.forEach((file) => {
        expect(file).to.have.a.property('bucketName');
        expect(file.bucketName).to.equal('fs');
      });
    });

    it('should have the date of the upload', function () {
      it('should have the default bucket name pointing to the fs collection', function () {
        result.files.forEach((file) => {
          expect(file).to.have.a.property('uploadDate');
        });
      });
    });

    after(() => cleanDb(storage));
  });

});




