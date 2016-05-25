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
var mongo = require('mongodb');
var MongoClient = mongo.MongoClient;
var Grid = require('gridfs-stream');

chai.use(require('chai-interface'));

var app = express();

describe('module usage', function () {
    var result,
        db, gfs;

    before(function (done) {
         MongoClient.connect(setting.mongoUrl(), function (err, database) {
            if (err) {
                return done(err);
            }

            db = database;
            gfs = Grid(db, mongo);

            var storage = GridFsStorage({
                gfs: gfs,
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
                log: true
            });

            var upload = multer({
                storage: storage
            });

            app.post('/opts', upload.array('photos', 2), function (req, res) {
                res.send({headers: req.headers, files: req.files, body: req.body});
            });

            app.post('/fail', upload.array('photos', 1), function (req, res) {
                res.send({headers: req.headers, file: req.file, body: req.body});
            });

            done();
        });
    });

    describe('all configuration options', function () {
        before(function (done) {
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

        it('should use a 16 bytes hexadecimal name with an extension', function (done) {
            result.files.forEach(function (file) {
                expect(file).to.have.property('filename').that.matches(/^[a-f0-9]{32}\.jpg$/);
            });
            done();
        });

        it('should have a metadata property with the value {field: "field"}', function (done) {
            result.files.forEach(function (file) {
                expect(file).to.have.property('metadata').that.is.eql({field: 'field'});
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
            done()
        });

        after(function (done) {
            db.collection('fs.files').deleteMany({})
                .then(function () {
                    return db.collection('fs.chunks').deleteMany({});
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
        before(function (done) {
            request(app)
                .post('/fail')
                .attach('photos', uploads.files[0])
                .attach('photos', uploads.files[1])
                .field('field', 'field')
                .end(function (err, res) {
                    result = res.body;
                    done();
                });
        });

        it('should fail with an error', function (done) {
            gfs.files.count({}, function (err, count) {
                expect(count).to.equal(0);
                done(err);
            });
        });

        after(function (done) {
            db.collection('fs.files').deleteMany({})
                .then(function () {
                    return db.collection('fs.chunks').deleteMany({});
                })
                .then(function () {
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        });
    });


    after(function (done) {
        db.dropDatabase(done);
    });

});
