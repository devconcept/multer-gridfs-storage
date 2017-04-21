var express = require('express');
var chai = require('chai');
var expect = chai.expect;
var GridFsStorage = require('../index');
var setting = require('./utils/settings');
var uploads = require('./utils/uploads');
var request = require('supertest');
var multer = require('multer');
var md5File = require('md5-file');
var path = require('path');
var crypto = require('crypto');
var mute = require('mute');

chai.use(require('chai-interface'));
chai.use(require('chai-spies'));

describe('module usage', function () {
  this.timeout(4000);
  var result, app,
    db, gfs, spy, logSpy;
  
  before(function () {
    spy = chai.spy();
    logSpy = chai.spy();
    app = express();
  });
  
  describe('all configuration options', function () {
    var messages = [];
    before(function (done) {
      var counter = 0;
      var storage = GridFsStorage({
        url: setting.mongoUrl(),
        filename: function (req, file, cb) {
          crypto.randomBytes(16, function (err, raw) {
            cb(err, err ? undefined : raw.toString('hex') + path.extname(file.originalname));
          });
        },
        metadata: function (req, file, cb) {
          cb(null, req.body);
        },
        identifier: function (req, file, cb) {
          cb(null, Math.floor(Math.random() * 1000000));
        },
        chunkSize: function (req, file, cb) {
          cb(null, Math.floor(Math.random() * 20000) + 10000);
        },
        root: function (req, file, cb) {
          var roots = ['myfiles', 'otherfiles'];
          counter++;
          cb(null, counter === 1 ? roots[0] : roots[1]);
        },
        log: function (err, log) {
          logSpy(err, log);
          if (err) {
            return messages.push({type: 'error', data: err});
          }
          messages.push({type: 'log', data: [log.message, log.extra || '']});
        },
        logLevel: 'all'
      });
      
      storage.on('file', spy);
      
      var upload = multer({
        storage: storage
      });
      
      app.post('/opts', upload.array('photos', 2), function (req, res) {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.once('connection', function (grid, database) {
        gfs = grid;
        db = database;
        
        request(app)
          .post('/opts')
          .attach('photos', uploads.files[0])
          .attach('photos', uploads.files[1])
          .field('field', 'field')
          .end(function (err, res) {
            result = res.body;
            done();
          });
      });
      
      
    });
    
    it('should use a 16 bytes hexadecimal name with an extension', function (done) {
      result.files.forEach(function (file) {
        expect(file).to.have.property('filename').that.matches(/^[a-f0-9]{32}\.jpg$/);
      });
      done();
    });
    
    it('should have a metadata property with the value {field: "field"}', function (done) {
      result.files.forEach(function (file) {
        expect(file).to.have.property('metadata').that.is.eql({ field: 'field' });
      });
      done();
    });
    
    it('should have a id property that matches an ObjectId format', function (done) {
      result.files.forEach(function (file) {
        expect(file).to.have.property('id').that.is.a('string');
        expect(file).to.have.property('id').that.matches(/^[a-f0-9]{24}$/);
      });
      done();
    });
    
    it('should have a id property that matches an ObjectId format', function (done) {
      result.files.forEach(function (file) {
        expect(file).to.have.property('id').that.is.a('string');
        expect(file).to.have.property('id').that.matches(/^[a-f0-9]{24}$/);
      });
      done();
    });
    
    it('should have a grid property with the stored file info', function (done) {
      result.files.forEach(function (file) {
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
      result.files.forEach(function (file, index) {
        expect(file.grid.md5).to.be.equal(md5File(uploads.files[index]));
      });
      done();
    });
    
    it('should emit the file event for every uploaded file', function () {
      expect(spy).to.be.called.exactly(2);
    });
    
    it('should execute the log function 3 times', function () {
      expect(logSpy).to.be.called.exactly(3);
      expect(messages).to.have.lengthOf(3);
    });
    
    it('should have a different chunkSize between 10000 and 30000', function (done) {
      result.files.forEach(function (file) {
        expect(file.grid.chunkSize).to.be.within(10000, 30000);
      });
      done();
    });
    
    it('should be stored under a different root', function (done) {
      db.collections().then(function (collections) {
        expect(collections).to.have.length(5);
        collections.forEach(function (col) {
          expect(['system.indexes', 'myfiles.files', 'myfiles.chunks', 'otherfiles.files', 'otherfiles.chunks']).to.include(col.collectionName);
        });
        done();
      });
    });
    
    after(function (done) {
      db.collection('myfiles.chunks').drop()
        .then(function () {
          return db.collection('myfiles.files').drop();
        })
        .then(function () {
          return db.collection('otherfiles.chunks').drop();
        })
        .then(function () {
          return db.collection('otherfiles.files').drop();
        })
        .then(function () {
          done();
        })
        .catch(function (err) {
          done(err);
        });
    });
  });
  
  describe('fixed value configuration options', function () {
    var unmute;
    
    before(function (done) {
      unmute = mute();
      var storage = GridFsStorage({
        url: setting.mongoUrl(),
        chunkSize: 131072,
        root: 'myfiles',
        log: true
      });
      
      var upload = multer({
        storage: storage
      });
      
      app.post('/fixed', upload.array('photos', 2), function (req, res) {
        res.send({ headers: req.headers, files: req.files, body: req.body });
      });
      
      storage.once('connection', function (grid, database) {
        gfs = grid;
        db = database;
        
        request(app)
          .post('/fixed')
          .attach('photos', uploads.files[0])
          .attach('photos', uploads.files[1])
          .field('field', 'field')
          .end(function (err, res) {
            result = res.body;
            unmute();
            done();
          });
      });
    });
    
    it('should have a different fixed chunkSize with the value 131072', function (done) {
      result.files.forEach(function (file) {
        expect(file.grid.chunkSize).to.be.equal(131072);
      });
      done();
    });
    
    it('should be stored under a different root with the value myfiles', function (done) {
      db.collection('myfiles.files', { strict: true }, function (err) {
        expect(err).to.be.equal(null);
        db.collection('myfiles.chunks', { strict: true }, function (err) {
          expect(err).to.be.equal(null);
          db.collection('fs.files', { strict: true }, function (err) {
            expect(err).not.to.be.equal(null);
            db.collection('fs.chunks', { strict: true }, function (err) {
              expect(err).not.to.be.equal(null);
              done();
            });
          });
        });
      });
    });
    
    after(function (done) {
      db.collection('myfiles.chunks').drop()
        .then(function () {
          return db.collection('myfiles.files').drop();
        })
        .then(function () {
          done();
        })
        .catch(function (err) {
          done(err);
        });
    });
  });
  
  describe('failed request', function () {
    var unmute;
    before(function (done) {
      unmute = mute();
      var storage = GridFsStorage({
        url: setting.mongoUrl()
      });
      
      var upload = multer({
        storage: storage
      });
      
      app.post('/fail', upload.array('photos', 1), function (req, res) {
        res.send({ headers: req.headers, file: req.file, body: req.body });
      });
      
      storage.once('connection', function () {
        request(app)
          .post('/fail')
          .attach('photos', uploads.files[0])
          .attach('photos', uploads.files[1])
          .field('field', 'field')
          .end(function (err, res) {
            result = res.body;
            unmute();
            done();
          });
      });
    });
    
    it('should fail with an error', function (done) {
      gfs.files.count({}, function (err, count) {
        expect(count).to.equal(0);
        done(err);
      });
    });
  });
  
  after(function (done) {
    db.dropDatabase(function () {
      db.close(true, done);
    });
  });
  
});
