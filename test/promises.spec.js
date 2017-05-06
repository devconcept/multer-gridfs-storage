'use strict';

const express = require('express');
const chai = require('chai');
const expect = chai.expect;
const GridFsStorage = require('../index');
const setting = require('./utils/settings');
const uploads = require('./utils/uploads');
const request = require('supertest');
const multer = require('multer');
const md5File = require('md5-file');
const Promise = require('bluebird');
const mute = require('mute');

describe('Promises', function () {
  let result, app, storage;
  this.timeout(4000);
  
  before(() => {
    app = express();
  });
  
  describe('return promises from configuration options', function () {
    let counter = 0;
    const roots = ['plants', 'animals'];
    const sizes = [102400, 204800];
    before(function (done) {
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        filename: (req, file) => Promise.resolve(file.originalname),
        metadata: () => Promise.resolve({ data: 'sample' }),
        identifier: () => {
          counter++;
          return Promise.resolve(counter);
        },
        chunkSize: () => Promise.resolve(sizes[counter - 1]),
        root: () => Promise.resolve(roots[counter - 1])
      });
      
      const upload = multer({ storage });
      
      app.post('/promise', upload.array('photos', 2), (req, res) => {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', () => {
        request(app)
          .post('/promise')
          .attach('photos', uploads.files[0])
          .attach('photos', uploads.files[1])
          .end((err, res) => {
            result = res.body;
            done();
          });
      });
    });
    
    it('should store the files on upload', function () {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });
    
    it('should have each stored file the same MD5 signature than the uploaded file', function (done) {
      result.files.forEach((file, index) => {
        expect(file.grid.md5).to.be.equal(md5File(uploads.files[index]));
      });
      done();
    });
    
  });
  
  describe('promise rejection', function () {
    let status, unmute;
    
    before((done) => {
      unmute = mute();
      storage = GridFsStorage({
        url: setting.mongoUrl(),
        filename: (req, file) => Promise.reject(file.originalname)
      });
      
      const upload = multer({ storage });
      
      app.post('/rejection', upload.array('photos', 2), (req, res) => {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', () => {
        request(app)
          .post('/rejection')
          .attach('photos', uploads.files[0])
          .attach('photos', uploads.files[1])
          .end((err, res) => {
            status = res.statusCode;
            result = res.body;
            done();
          });
      });
    });
    
    it('should not store the files on upload', function () {
      expect(result.files).to.be.undefined;
    });
    
    it('should be a failed request', function () {
      expect(status).to.equal(500);
    });
    
    after(() => unmute());
    
  });
  
  afterEach((done) => {
    
    function drop(db) {
      return db.dropDatabase()
        .then(() => db.close(true))
        .then(done);
    }
    
    if (storage.gfs) {
      const db = storage.gfs.db;
      drop(db);
    } else {
      storage.once('connection', (gfs, db) => drop(db));
    }
  });
});
