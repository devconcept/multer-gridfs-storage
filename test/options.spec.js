var express = require('express');
var chai = require('chai');
var expect = chai.expect;
var GridFsStorage = require('../index');
var setting = require('./utils/settings');
var uploads = require('./utils/uploads');
var request = require('supertest');
var multer = require('multer');

var app = express();


describe('all configuration options', function () {
    var result,
        db;

    before(function (done) {
        var storage = GridFsStorage({
            url: setting.mongoUrl(),
            metadata: function (req, file, cb) {
                cb(null, req.body);
            },
            log: true,
            logLevel: 'all'
        });

        var upload = multer({
            storage: storage
        });

        app.post('/conf', upload.array('photos', 2), function (req, res) {
            res.send({headers: req.headers, files: req.files, body: req.body});
        });

        storage.once('connection', function (gridfs, database) {
            db = database;

            request(app)
                .post('/conf')
                .attach('photos', uploads.files[0])
                .attach('photos', uploads.files[1])
                .field('field', 'field')
                .end(function (err, res) {
                    result = res.body;
                    done();
                });
        });
    });

    it('should store the files on upload', function () {
        expect(result.files).to.have.length(2);
    });

    it('should use a 16 bytes long in hexadecimal format naming by default', function () {
        expect(result).to.have.deep.property('files[0].filename').that.matches(/[a-f0-9]{32}/);
        expect(result).to.have.deep.property('files[1].filename').that.matches(/[a-f0-9]{32}/);
    });

    it('should have a metadata property with the value null', function () {
        expect(result).to.have.deep.property('files[0].metadata').that.have.keys('field');
        expect(result).to.have.deep.property('files[1].metadata').that.have.keys('field');
    });

    it('should have a id property with the stored file id', function () {
        expect(result).to.have.deep.property('files[0].id').that.is.a('string');
        expect(result).to.have.deep.property('files[1].id').that.is.a('string');
    });

    it('should have a grid property with the stored file info', function () {
        expect(result).to.have.deep.property('files[0].grid')
            .that.have.keys(['chunkSize', 'contentType', 'filename', 'length', 'md5', 'uploadDate', 'metadata', '_id']);
        expect(result).to.have.deep.property('files[1].grid')
            .that.have.keys(['chunkSize', 'contentType', 'filename', 'length', 'md5', 'uploadDate', 'metadata', '_id']);
    });

    after(function (done) {
        db.dropDatabase(done);
    });

});
