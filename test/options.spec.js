'use strict';

const express = require('express');
const chai = require('chai');
const expect = chai.expect;
const GridFsStorage = require('../index');
const setting = require('./utils/settings');
const { files, cleanDb } = require('./utils/testutils');
const request = require('supertest');
const multer = require('multer');
const md5File = require('md5-file');
const path = require('path');
const crypto = require('crypto');
const mute = require('mute');
const sinon = require('sinon');

chai.use(require('chai-interface'));
chai.use(require('sinon-chai'));

describe('module usage', function () {
  this.timeout(4000);
  let result, app, storage, spy, logSpy;
  
  before(() => {
    spy = sinon.spy();
    logSpy = sinon.spy();
    app = express();
  });
  
  describe('all configuration options', function () {
    const messages = [];
    before((done) => {
      let counter = 0;
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        filename: (req, file, cb) => {
          crypto.randomBytes(16, (err, raw) => {
            cb(err, err ? undefined : raw.toString('hex') + path.extname(file.originalname));
          });
        },
        metadata: (req, file, cb) => {
          cb(null, req.body);
        },
        identifier: (req, file, cb) => {
          cb(null, Math.floor(Math.random() * 1000000));
        },
        chunkSize: (req, file, cb) => {
          cb(null, Math.floor(Math.random() * 20000) + 10000);
        },
        root: (req, file, cb) => {
          const roots = ['myfiles', 'otherfiles'];
          counter++;
          cb(null, counter === 1 ? roots[0] : roots[1]);
        },
        log: (err, log) => {
          logSpy(err, log);
          if (err) {
            return messages.push({ type: 'error', data: err });
          }
          messages.push({ type: 'log', data: [log.message, log.extra || ''] });
        },
        logLevel: 'all'
      });
      
      storage.on('file', spy);
      
      const upload = multer({ storage });
      
      app.post('/opts', upload.array('photos', 2), (req, res) => {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.once('connection', () => {
        request(app)
          .post('/opts')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .field('field', 'field')
          .end((err, res) => {
            result = res.body;
            done();
          });
      });
      
      
    });
    
    it('should use a 16 bytes hexadecimal name with an extension', function (done) {
      result.files.forEach((file) => {
        expect(file).to.have.property('filename').that.matches(/^[a-f0-9]{32}\.jpg$/);
      });
      done();
    });
    
    it('should have a metadata property with the value {field: "field"}', function (done) {
      result.files.forEach((file) => {
        expect(file).to.have.property('metadata').that.is.eql({ field: 'field' });
      });
      done();
    });
    
    it('should have a id property that matches an ObjectId format', function (done) {
      result.files.forEach((file) => {
        expect(file).to.have.property('id').that.is.a('string');
        expect(file).to.have.property('id').that.matches(/^[a-f0-9]{24}$/);
      });
      done();
    });
    
    it('should have a id property that matches an ObjectId format', function (done) {
      result.files.forEach((file) => {
        expect(file).to.have.property('id').that.is.a('string');
        expect(file).to.have.property('id').that.matches(/^[a-f0-9]{24}$/);
      });
      done();
    });
    
    it('should have a grid property with the stored file info', function (done) {
      result.files.forEach((file) => {
        expect(file).to.have.property('grid').that.have.interface({
          chunkSize: Number,
          contentType: String,
          filename: String,
          length: Number,
          md5: String,
          uploadDate: String,
          _id: String
        });
      });
      done();
    });
    
    it('should have the same MD5 signature than the upload', function (done) {
      result.files.forEach((file, index) => {
        expect(file.grid.md5).to.be.equal(md5File(files[index]));
      });
      done();
    });
    
    it('should emit the file event for every uploaded file', function () {
      expect(spy).to.be.have.callCount(2);
    });
    
    it('should execute the log function 3 times', function () {
      expect(logSpy).to.have.callCount(3);
      expect(messages).to.have.lengthOf(3);
    });
    
    it('should have a different chunkSize between 10000 and 30000', function (done) {
      result.files.forEach((file) => {
        expect(file.grid.chunkSize).to.be.within(10000, 30000);
      });
      done();
    });
    
    it('should be stored under a different root', function (done) {
      const db = storage.gfs.db;
      db.collections().then((collections) => {
        expect(collections).to.have.length(5);
        collections.forEach((col) => {
          expect(['system.indexes', 'myfiles.files', 'myfiles.chunks', 'otherfiles.files', 'otherfiles.chunks']).to.include(col.collectionName);
        });
        done();
      });
    });
    
    after(() => cleanDb(storage));
    
  });
  
  describe('fixed value configuration options', function () {
    let unmute;
    
    before((done) => {
      unmute = mute();
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        chunkSize: 131072,
        root: 'myfiles',
        log: true
      });
      
      const upload = multer({ storage });
      
      app.post('/fixed', upload.array('photos', 2), (req, res) => {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.once('connection', () => {
        request(app)
          .post('/fixed')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .field('field', 'field')
          .end((err, res) => {
            result = res.body;
            unmute();
            done();
          });
      });
    });
    
    it('should have a different fixed chunkSize with the value 131072', function (done) {
      result.files.forEach((file) => {
        expect(file.grid.chunkSize).to.be.equal(131072);
      });
      done();
    });
    
    it('should be stored under a different root with the value myfiles', function (done) {
      const db = storage.gfs.db;
      db.collection('myfiles.files', { strict: true }, (err) => {
        expect(err).to.be.equal(null);
        db.collection('myfiles.chunks', { strict: true }, (err) => {
          expect(err).to.be.equal(null);
          db.collection('fs.files', { strict: true }, (err) => {
            expect(err).not.to.be.equal(null);
            db.collection('fs.chunks', { strict: true }, (err) => {
              expect(err).not.to.be.equal(null);
              done();
            });
          });
        });
      });
    });
  
    after(() => cleanDb(storage));
    
  });
  
  describe('failed request', function () {
    let unmute;
    before((done) => {
      unmute = mute();
      storage = GridFsStorage({
        url: setting.mongoUrl()
      });
      
      const upload = multer({ storage });
      
      app.post('/fail', upload.array('photos', 1), (req, res) => {
        res.send({ headers: req.headers, file: req.file, body: req.body });
      });
      
      storage.once('connection', () => {
        request(app)
          .post('/fail')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .field('field', 'field')
          .end((err, res) => {
            result = res.body;
            unmute();
            done();
          });
      });
    });
    
    it('should fail with an error', function (done) {
      const gfs = storage.gfs;
      gfs.files.count({}, (err, count) => {
        expect(count).to.equal(0);
        done(err);
      });
    });
    
    after(() => cleanDb(storage));
    
  });
  
});
