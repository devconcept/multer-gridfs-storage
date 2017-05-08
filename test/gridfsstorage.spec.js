'use strict';

const express = require('express');
const chai = require('chai');
const expect = chai.expect;
const GridFsStorage = require('../index');
const setting = require('./utils/settings');
const { files, cleanDb } = require('./utils/testutils');
const request = require('supertest');
const multer = require('multer');
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const Grid = require('gridfs-stream');
const md5File = require('md5-file');
const fs = require('fs');
const Promise = require('bluebird');

Promise.onPossiblyUnhandledRejection(function () {
  // This blocks swallows the unhandled promise rejection warning in tests
  // When providing a connection as a promise the user is responsible for handling the error with a catch clause
  // If this module does not rethrow the error then whatever recovery or logging mechanism being used in user code will not fire
});

chai.use(require('chai-interface'));

describe('GridFS storage', function () {
  let result, app, storage;
  this.timeout(4000);
  
  before(() => app = express());
  
  describe('url created instance', function () {
    before((done) => {
      storage = GridFsStorage({ url: setting.mongoUrl() });
      
      const upload = multer({ storage });
      
      app.post('/url', upload.array('photos', 2), (req, res) => {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', () => {
        request(app)
          .post('/url')
          .attach('photos', files[0])
          .attach('photos', files[1])
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
        expect(file.grid.md5).to.be.equal(md5File(files[index]));
      });
      done();
    });
    
    after(() => cleanDb(storage));
    
  });
  
  describe('gfs created instance', function () {
    let gfs;
    before((done) => {
      MongoClient.connect(setting.mongoUrl(), (err, database) => {
        if (err) {
          return done(err);
        }
        
        gfs = Grid(database, mongo);
        
        storage = GridFsStorage({ gfs });
        
        const upload = multer({ storage });
        
        app.post('/gfs', upload.array('photos', 2), (req, res) => {
          res.send({ headers: req.headers, files: req.files, body: req.body });
        });
        
        request(app)
          .post('/gfs')
          .attach('photos', files[0])
          .attach('photos', files[1])
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
        expect(file.grid.md5).to.be.equal(md5File(files[index]));
      });
      done();
    });
    
    after(() => cleanDb(storage));
    
  });
  
  describe('gfs promise based instance', function () {
    let gfs, db;
    before((done) => {
      const promised = MongoClient
        .connect(setting.mongoUrl())
        .then((database) => Grid(database, mongo));
      
      storage = GridFsStorage({ gfs: promised });
      const upload = multer({ storage });
      
      
      app.post('/promise', upload.array('photos', 2), (req, res) => {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', (grid, database) => {
        gfs = grid;
        db = database;
        
        request(app)
          .post('/promise')
          .attach('photos', files[0])
          .attach('photos', files[1])
          .end((err, res) => {
            result = res.body;
            done();
          });
      });
    });
    
    it('should emit the event with a gfs instance, not a promise', function () {
      expect(gfs).to.be.an.instanceof(Grid);
      expect(db).to.be.an.instanceof(mongo.Db);
    });
    
    it('should store the files on upload', function () {
      expect(result.files).to.be.an('array');
      expect(result.files).to.have.length(2);
    });
    
    it('should have each stored file the same MD5 signature than the uploaded file', function (done) {
      result.files.forEach((file, index) => {
        expect(file.grid.md5).to.be.equal(md5File(files[index]));
      });
      done();
    });
    
    it('should log an error if the connection promise is rejected and rethrow the error', function (done) {
      const promise = Promise.reject('reason');
      GridFsStorage({
        gfs: promise,
        log: (err) => {
          expect(err).to.equal('reason');
          promise.catch((err) => {
            expect(err).to.equal('reason');
            done();
          });
        }
      });
    });
  
    after(() => cleanDb(storage));
    
  });
  
  describe('default uploaded file spec', function () {
    let size;
    before((done) => {
      storage = GridFsStorage({ url: setting.mongoUrl() });
      const upload = multer({ storage });
      
      
      app.post('/spec', upload.single('photo'), (req, res) => {
        res.send({ headers: req.headers, file: req.file, body: req.body });
      });
      
      storage.on('connection', () => {
        request(app)
          .post('/spec')
          .attach('photo', files[0])
          .end((err, res) => {
            result = res.body;
            fs.readFile(files[0], (err, f) => {
              size = f.length;
              done();
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
    
    it('should have a grid property that matches the gridfs spec', function () {
      expect(result.file).to.have.a.property('grid');
      expect(result.file.grid).to.have.all.keys(['chunkSize', 'contentType', 'filename', 'length', 'md5', 'uploadDate', '_id']);
    });
    
    it('should have a size property with the length of the file', function () {
      expect(result.file).to.have.a.property('size');
      expect(result.file.size).to.equal(size);
    });
    
    after(() => cleanDb(storage));
    
  });
  
});




