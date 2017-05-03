var express = require('express');
var chai = require('chai');
var expect = chai.expect;
var GridFsStorage = require('../index');
var setting = require('./utils/settings');
var uploads = require('./utils/uploads');
var request = require('supertest');
var multer = require('multer');
var md5File = require('md5-file');
var fs = require('fs');
var path = require('path');

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
      var storage = GridFsStorage({
        url: setting.mongoUrl(),
        filename: function*() {
          var counter = 0;
          while (true) {
            counter++;
            yield 'file' + counter;
          }
        }
      });
      
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
  
    it('should be named in sequence', function () {
      expect(result.files[0].filename).to.equal('file1');
      expect(result.files[1].filename).to.equal('file2');
    });
    
    after(function (done) {
      db.dropDatabase(done);
    });
    
  });
});
