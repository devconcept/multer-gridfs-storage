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

chai.use(require('chai-interface'));

describe('Backwards compatibility', function () {
  let result, app, storage, db, size;

  before((done) => {
    app = express();
    fs.readFile(files[0], (err, f) => {
      size = f.length;
      done(err);
    });
  });

  describe('Using GridStore streams to save files', function () {
    before((done) => {
      db = MongoClient.connect(setting.mongoUrl());
      storage = new GridFsStorage({db});
      storage._legacy = true;

      const upload = multer({storage});

      app.post('/store', upload.single('photos'), (req, res) => {
        result = {headers: req.headers, file: req.file, body: req.body};
        res.end();
      });

      storage.on('connection', () => {
        request(app)
          .post('/store')
          .attach('photos', files[0])
          .end(done);
      });
    });

    it('should store the files on upload', function () {
      expect(result.file).to.be.a('object');
    });

    it('should have each stored file the same MD5 signature than the uploaded file', function () {
      expect(result.file.md5).to.be.equal(md5File(files[0]));
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

  describe('Changing file configuration', function () {
    before((done) => {
      let counter = 0;
      const data = ['foo', 'bar'];
      const sizes = [102400, 204800];
      const names = ['plants', 'animals'];
      const contentTypes = ['text/plain', 'image/jpeg'];
      storage = new GridFsStorage({
        url: setting.mongoUrl(),
        file: function () {
          counter++;
          return {
            filename: 'file' + counter,
            metadata: data[counter - 1],
            id: counter,
            chunkSize: sizes[counter - 1],
            bucketName: names[counter - 1],
            contentType: contentTypes[counter - 1]
          };
        }
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

    it('should the request contain the two uploaded files', function () {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });

    it('should be named with the provided value', function () {
      expect(result.files[0].filename).to.equal('file1');
      expect(result.files[1].filename).to.equal('file2');
    });

    it('should contain a metadata object with the provided object', function () {
      expect(result.files[0].metadata).to.equal('foo');
      expect(result.files[1].metadata).to.equal('bar');
    });

    it('should be stored with the provided chunkSize value', function () {
      expect(result.files[0].chunkSize).to.equal(102400);
      expect(result.files[1].chunkSize).to.equal(204800);
    });

    it('should change the id with the provided value', function () {
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

    it('should change the content type with the provided value', function () {
      expect(result.files[0].contentType).to.equal('text/plain');
      expect(result.files[1].contentType).to.equal('image/jpeg');
    });

    after(() => cleanDb(storage));

  });

  describe('Using GridStore to delete files', function () {
    let error;

    before((done) => {
      db = MongoClient.connect(setting.mongoUrl());
      storage = new GridFsStorage({db});
      storage._legacy = true;

      const upload = multer({storage});

      app.post('/delete', upload.array('photos', 1), (err, req, res, next) => {
        result = {headers: req.headers, body: req.body, files: req.files};
        error = err;
        next();
      });

      storage.on('connection', () => {
        request(app)
          .post('/delete')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end(done);
      });
    });

    it('should remove the files on upload', function () {
      expect(error.storageErrors).to.have.lengthOf(0);
    });

    it('should not have any files stored in the database', function () {
      return db
        .then((database) => mongo.GridStore.list(database))
        .then((files) => {
          expect(files).to.have.lengthOf(0);
        });
    });

    after(() => cleanDb(storage));
  });

  describe('Missing properties in file naming function', function () {
    const assignRef = Object.assign;
    before((done) => {
      Object.assign = undefined;
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        file: function () {
          return {
            metadata: {foo: 'bar'},
            id: 1234
          };
        }
      });
      const upload = multer({storage});

      app.post('/missinglegacy', upload.single('photo'), (req, res) => {
        result = {headers: req.headers, file: req.file, body: req.body};
        res.end();
      });

      storage.on('connection', () => {
        request(app)
          .post('/missinglegacy')
          .attach('photo', files[0])
          .end(done);
      });
    });

    it('should have a filename property', function () {
      expect(result.file).to.have.a.property('filename');
      expect(result.file.filename).to.be.a('string');
      expect(result.file.filename).to.match(/^[0-9a-f]{32}$/);
    });

    it('should have a metadata property', function () {
      expect(result.file).to.have.a.property('metadata');
      expect(result.file.metadata).to.have.a.property('foo');
      expect(result.file.metadata.foo).to.equal('bar');
    });

    it('should have a id property', function () {
      expect(result.file).to.have.a.property('id');
      expect(result.file.id).to.equal(1234);
    });

    it('should have the default bucket name pointing to the fs collection', function () {
      expect(result.file).to.have.a.property('bucketName');
      expect(result.file.bucketName).to.equal('fs');
    });

    it('should have the date of the upload', function () {
      it('should have the default bucket name pointing to the fs collection', function () {
        expect(result.file).to.have.a.property('uploadDate');
      });
    });

    after(() => {
      Object.assign = assignRef;
      return cleanDb(storage);
    });
  });
});
