var express = require('express');
var chai = require('chai');
var expect = chai.expect;
var GridFsStorage = require('../index');
var setting = require('./utils/settings');
var uploads = require('./utils/uploads');
var request = require('supertest');
var multer = require('multer');
var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;
var Grid = require('gridfs-stream');
var md5File = require('md5-file');
var fs = require('fs');
var Promise = require('bluebird');

chai.use(require('chai-interface'));

describe('GridFS storage', function () {
  var result, app;
  this.timeout(4000);
  
  before(function () {
    app = express();
  });
  
  describe('url created instance', function () {
    var db;
    before(function (done) {
      var storage = GridFsStorage({ url: setting.mongoUrl() });
      
      var upload = multer({ storage: storage });
      
      app.post('/url', upload.array('photos', 2), function (req, res) {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', function (gridfs, database) {
        db = database;
        request(app)
          .post('/url')
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
    
    after(function (done) {
      db.collection('fs.files').deleteMany({})
        .then(function () {
          return db.collection('fs.chunks').deleteMany({});
        })
        .then(function () {
          db.close(true, done);
        })
        .catch(function (err) {
          done(err);
        });
    });
    
  });
  
  describe('gfs created instance', function () {
    var db, gfs;
    before(function (done) {
      MongoClient.connect(setting.mongoUrl(), function (err, database) {
        if (err) {
          return done(err);
        }
        
        db = database;
        gfs = Grid(db, mongo);
        
        var storage = GridFsStorage({ gfs: gfs });
        
        var upload = multer({ storage: storage });
        
        app.post('/gfs', upload.array('photos', 2), function (req, res) {
          res.send({ headers: req.headers, files: req.files, body: req.body });
        });
        
        request(app)
          .post('/gfs')
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
    
    after(function (done) {
      db.dropDatabase(function () {
        db.close(true, done);
      });
    });
  });
  
  describe('gfs promise based instance', function () {
    var db, gfs;
    before(function (done) {
      var promised = new Promise(function (resolve, reject) {
        MongoClient.connect(setting.mongoUrl(), function (err, database) {
          var grid;
          if (err) {
            return reject(err);
          }
          grid = Grid(database, mongo);
          resolve(grid);
        });
      });
      
      var storage = GridFsStorage({ gfs: promised });
      var upload = multer({ storage: storage });
      
      
      app.post('/promise', upload.array('photos', 2), function (req, res) {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.on('connection', function (grid, database) {
        gfs = grid;
        db = database;
        
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
    
    it('should emit the event with a gfs instance, not a promise', function () {
      expect(gfs).to.be.an.instanceof(Grid);
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
    
    it('should log an error if the connection promise is rejected and rethrow the error', function (done) {
      var promise = Promise.reject('reason');
      GridFsStorage({
        gfs: promise,
        log: function (err) {
          expect(err).to.equal('reason');
          promise.catch(function (err) {
            expect(err).to.equal('reason');
            done();
          });
        }
      });
    });
    
    after(function (done) {
      db.dropDatabase(function () {
        db.close(true, done);
      });
    });
  });
  
  describe('default uploaded file spec', function () {
    var db, size;
    before(function (done) {
      var storage = GridFsStorage({ url: setting.mongoUrl() });
      var upload = multer({ storage: storage });
      
      
      app.post('/spec', upload.single('photo'), function (req, res) {
        res.send({ headers: req.headers, file: req.file, body: req.body });
      });
      
      storage.on('connection', function (grid, database) {
        db = database;
        request(app)
          .post('/spec')
          .attach('photo', uploads.files[0])
          .end(function (err, res) {
            result = res.body;
            fs.readFile(uploads.files[0], function (err, f) {
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
    
    after(function (done) {
      db.dropDatabase(function () {
        db.close(true, done);
      });
    });
  });
  
});




