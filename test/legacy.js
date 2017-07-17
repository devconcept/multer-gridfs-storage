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
  let result, app, storage, GridFSBucket, db, size;

  before((done) => {
    app = express();
    GridFSBucket = mongo.GridFSBucket;
    mongo.GridFSBucket = undefined;
    fs.readFile(files[0], (err, f) => {
      size = f.length;
      done(err);
    });
  });

  describe('Using gridfs-stream to store files', function () {
    before((done) => {
      db = MongoClient.connect(setting.mongoUrl());
      storage = new GridFsStorage({db});

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

  describe('Using gridfs-stream to delete files', function () {
    let error;

    before((done) => {
      db = MongoClient.connect(setting.mongoUrl());
      storage = new GridFsStorage({db});

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

  after(() => {
    mongo.GridFSBucket = GridFSBucket;
  });

});
