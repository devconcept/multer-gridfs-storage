'use strict';

var express = require('express');
var chai = require('chai');
var expect = chai.expect;
var GridFsStorage = require('../index');
var setting = require('./utils/settings');
var uploads = require('./utils/uploads');
var request = require('supertest');
var multer = require('multer');
var md5File = require('md5-file');
var Promise = require('bluebird');
var mute = require('mute');

describe('Promises', function () {
  var result, app, storage;
  this.timeout(4000);
  
  before(function () {
    app = express();
  });
  
  describe('return promises from configuration options', function () {
    var counter = 0;
    var roots = ['plants', 'animals'];
    var sizes = [102400, 204800];
    before(function (done) {
      storage = GridFsStorage({
        url: setting.mongoUrl() ,
        filename: function (req, file) {
          return Promise.resolve(file.originalname);
        },
        metadata: function () {
          return Promise.resolve({data: 'sample'});
        },
        identifier: function () {
          counter++;
          return Promise.resolve(counter);
        },
        chunkSize: function () {
          return Promise.resolve(sizes[counter - 1]);
        },
        root: function () {
          return Promise.resolve(roots[counter - 1]);
        }
      });
      
      var upload = multer({ storage: storage });
      
      app.post('/promise', upload.array('photos', 2), function (req, res) {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', function () {
        request(app)
          .post('/promise')
          .attach('photos', uploads.files[0])
          .attach('photos', uploads.files[1])
          .end(function (err, res) {
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
      result.files.forEach(function (file, index) {
        expect(file.grid.md5).to.be.equal(md5File(uploads.files[index]));
      });
      done();
    });
  
    after(function () {
      function drop(db) {
        return db.dropDatabase()
          .then(function () {
            return db.close(true);
          });
      }
    
      storage.removeAllListeners('connection');
      if (storage.gfs) {
        var db = storage.gfs.db;
        return drop(db);
      } else {
        storage.once('connection', function (gfs, db) {
          return drop(db);
        });
      }
    });
    
  });
  
  describe('promise rejection', function () {
    var status, unmute;
    
    before(function (done) {
      unmute = mute(process.stderr);
      
      storage = GridFsStorage({
        url: setting.mongoUrl() ,
        filename: function (req, file) {
          return Promise.reject(file.originalname);
        }
      });
      
      var upload = multer({ storage: storage });
      
      app.post('/rejection', upload.array('photos', 2), function (req, res) {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', function () {
        request(app)
          .post('/rejection')
          .attach('photos', uploads.files[0])
          .attach('photos', uploads.files[1])
          .end(function (err, res) {
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
    
    after(function () {
      unmute();
      function drop(db) {
        return db.dropDatabase()
          .then(function () {
            return db.close(true);
          });
      }
    
      storage.removeAllListeners('connection');
      if (storage.gfs) {
        var db = storage.gfs.db;
        return drop(db);
      } else {
        storage.once('connection', function (gfs, db) {
          return drop(db);
        });
      }
    });
    
  });
});
