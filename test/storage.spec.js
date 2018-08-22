'use strict';

const express = require('express');
const chai = require('chai');
const expect = chai.expect;
const GridFsStorage = require('../index');
const setting = require('./utils/settings');
const {files, cleanStorage, getDb, getClient} = require('./utils/testutils');
const request = require('supertest');
const multer = require('multer');
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const md5File = require('md5-file');
const fs = require('fs');
const cache = GridFsStorage.cache;

describe('Storage', () => {
  let result, app, storage;

  before(() => app = express());

  beforeEach(() => cache.clear());

  describe('url created instance', () => {
    before((done) => {
      storage = new GridFsStorage({url: setting.mongoUrl});

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

    it('should store the files on upload', () => {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });

    it('should have each stored file the same MD5 signature than the uploaded file', function (done) {
      result.files.forEach((file, index) => {
        expect(file.md5).to.be.equal(md5File(files[index]));
      });
      done();
    });

    after(() => cleanStorage(storage));

  });

  describe('db created instance', () => {
    before(() => {
      const promise = MongoClient.connect(setting.mongoUrl);
      return promise.then(_db => {
        const db = getDb(_db);
        storage = GridFsStorage({db});
        storage.client = getClient(_db);

        const upload = multer({storage});

        app.post('/db', upload.array('photos', 2), (req, res) => {
          result = {headers: req.headers, files: req.files, body: req.body};
          res.end();
        });

        return new Promise((resolve) => {
          request(app)
            .post('/db')
            .attach('photos', files[0])
            .attach('photos', files[1])
            .end(() => resolve());
        });
      });
    });

    it('should store the files on upload', () => {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });

    it('should have each stored file the same MD5 signature than the uploaded file', function (done) {
      result.files.forEach((file, index) => {
        expect(file.md5).to.be.equal(md5File(files[index]));
      });
      done();
    });

    after(() => cleanStorage(storage));

  });

  describe('db promise based instance', () => {
    let db, client;
    before((done) => {

      const promised = MongoClient
        .connect(setting.mongoUrl).then(_db => {
          db = getDb(_db);
          client = getClient(_db);
          return db;
        });

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

    it('should store the files on upload', () => {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });

    it('should have each stored file the same MD5 signature than the uploaded file', () => {
      result.files.forEach((file, index) => {
        expect(file.md5).to.be.equal(md5File(files[index]));
      });
    });

    after(() => cleanStorage(storage, db, client));
  });

  describe('handle incoming files while connecting', () => {
    let db, client;
    before((done) => {
      const promised = MongoClient
        .connect(setting.mongoUrl).then((_db) => {
          db = getDb(_db);
          client = getClient(_db);
          return new Promise((resolve) => {
            setTimeout(() => resolve(getDb(_db)), 1000);
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

    it('should store the files on upload', () => {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });

    it('should have each stored file the same MD5 signature than the uploaded file', () => {
      result.files.forEach((file, index) => {
        expect(file.md5).to.be.equal(md5File(files[index]));
      });
    });

    after(() => cleanStorage(storage, db, client));

  });

  describe('default uploaded file spec', () => {
    let size;
    before((done) => {
      storage = GridFsStorage({url: setting.mongoUrl});
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

  describe('file function usage', () => {
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

  describe('Missing properties in file naming function', () => {
    before((done) => {
      storage = GridFsStorage({
        url: setting.mongoUrl,
        file: () => {
          return {
            metadata: {foo: 'bar'},
            id: 1234,
          };
        },
      });
      const upload = multer({storage});

      app.post('/missing', upload.single('photo'), (req, res) => {
        result = {headers: req.headers, file: req.file, body: req.body};
        res.end();
      });

      storage.on('connection', () => {
        request(app)
          .post('/missing')
          .attach('photo', files[0])
          .end(done);
      });
    });

    it('should have a filename property', () => {
      expect(result.file).to.have.a.property('filename');
      expect(result.file.filename).to.be.a('string');
      expect(result.file.filename).to.match(/^[0-9a-f]{32}$/);
    });

    it('should have a metadata property', () => {
      expect(result.file).to.have.a.property('metadata');
      expect(result.file.metadata).to.have.a.property('foo');
      expect(result.file.metadata.foo).to.equal('bar');
    });

    it('should have a id property', () => {
      expect(result.file).to.have.a.property('id');
      expect(result.file.id).to.equal(1234);
    });

    it('should have the default bucket name pointing to the fs collection', () => {
      expect(result.file).to.have.a.property('bucketName');
      expect(result.file.bucketName).to.equal('fs');
    });

    it('should have the date of the upload', () => {
      it('should have the default bucket name pointing to the fs collection', () => {
        expect(result.file).to.have.a.property('uploadDate');
      });
    });

    after(() => cleanStorage(storage));
  });

  describe('Using empty values as return values', () => {
    before((done) => {
      const values = [null, undefined, {}];
      let counter = -1;

      storage = GridFsStorage({
        url: setting.mongoUrl,
        file: () => {
          counter++;
          return values[counter];
        },
      });
      const upload = multer({storage});

      app.post('/empty', upload.array('photo', 3), (req, res) => {
        result = {headers: req.headers, files: req.files, body: req.body};
        res.end();
      });

      storage.on('connection', () => {
        request(app)
          .post('/empty')
          .attach('photo', files[0])
          .attach('photo', files[0])
          .attach('photo', files[0])
          .end(done);
      });
    });

    it('should have the default filename', () => {
      result.files.forEach((file) => {
        expect(file.filename).to.match(/^[0-9a-f]{32}$/);
      });
    });

    it('should have the default metadata', () => {
      result.files.forEach((file) => {
        expect(file.metadata).to.equal(null);
      });
    });

    it('should have the default bucket name', () => {
      result.files.forEach((file) => {
        expect(file.bucketName).to.equal('fs');
      });
    });

    it('should have the default chunkSize', () => {
      result.files.forEach((file) => {
        expect(file.chunkSize).to.equal(261120);
      });
    });

    after(() => cleanStorage(storage));
  });

  describe('Using strings or numbers as return values', () => {
    before((done) => {
      const values = ['name', 10];
      let counter = -1;

      storage = GridFsStorage({
        url: setting.mongoUrl,
        file: () => {
          counter++;
          return values[counter];
        },
      });
      const upload = multer({storage});

      app.post('/values', upload.array('photo', 2), (req, res) => {
        result = {headers: req.headers, files: req.files, body: req.body};
        res.end();
      });

      storage.on('connection', () => {
        request(app)
          .post('/values')
          .attach('photo', files[0])
          .attach('photo', files[0])
          .end(done);
      });
    });

    it('should have given filename', () => {
      expect(result.files[0].filename).to.equal('name');
      expect(result.files[1].filename).to.equal('10');
    });

    it('should have the default metadata', () => {
      result.files.forEach((file) => {
        expect(file.metadata).to.equal(null);
      });
    });

    it('should have the default bucket name', () => {
      result.files.forEach((file) => {
        expect(file.bucketName).to.equal('fs');
      });
    });

    it('should have the default chunkSize', () => {
      result.files.forEach((file) => {
        expect(file.chunkSize).to.equal(261120);
      });
    });

    after(() => cleanStorage(storage));
  });

});




