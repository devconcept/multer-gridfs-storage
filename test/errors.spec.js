var GridFsStorage = require('../index');
var chai = require('chai');
var multer = require('multer');
var expect = chai.expect;
var request = require('supertest');
var express = require('express');
var settings = require('./utils/settings');
var uploads = require('./utils/uploads');

var app = express();

describe('error handling', function () {

    it('should throw an error if the identifier function is invoked with an error callback', function (done) {
        var storage = GridFsStorage({
            url: settings.mongoUrl(),
            identifier: function (req, file, cb) {
                cb(new Error('Identifier error'));
            }
        });

        var upload = multer({
            storage: storage
        });

        app.post('/identifier', upload.single('photo'), function (req, res) {
            res.send({headers: req.headers, files: req.files, body: req.body});
        });

        storage.on('connection', function () {
            request(app)
                .post('/identifier')
                .attach('photo', uploads.files[0])
                .end(function (err, res) {
                    expect(res.serverError).to.equal(true);
                    expect(res.error).to.be.an('error');
                    expect(res.error.text).to.match(/^Error: Identifier error/);
                    done();
                });
        });
    });

    it('should throw an error if the filename function is invoked with an error callback', function (done) {
        var storage = GridFsStorage({
            url: settings.mongoUrl(),
            filename: function (req, file, cb) {
                cb(new Error('Filename error'));
            }
        });

        var upload = multer({
            storage: storage
        });

        app.post('/filename', upload.single('photo'), function (req, res) {
            res.send({headers: req.headers, files: req.files, body: req.body});
        });

        storage.on('connection', function () {
            request(app)
                .post('/filename')
                .attach('photo', uploads.files[0])
                .end(function (err, res) {
                    expect(res.serverError).to.equal(true);
                    expect(res.error).to.be.an('error');
                    expect(res.error.text).to.match(/^Error: Filename error/);
                    done();
                });
        });
    });

    it('should throw an error if the metadata is invoked with an error callback', function (done) {
        var storage = GridFsStorage({
            url: settings.mongoUrl(),
            metadata: function (req, file, cb) {
                cb(new Error('Metadata error'));
            }
        });

        var upload = multer({
            storage: storage
        });

        app.post('/metadata', upload.single('photo'), function (req, res) {
            res.send({headers: req.headers, files: req.files, body: req.body});
        });

        storage.on('connection', function () {
            request(app)
                .post('/metadata')
                .attach('photo', uploads.files[0])
                .end(function (err, res) {
                    expect(res.serverError).to.equal(true);
                    expect(res.error).to.be.an('error');
                    expect(res.error.text).to.match(/^Error: Metadata error/);
                    done();
                });
        });
    });

    /*it('should throw an error if the metadata is invoked with an error callback', function (done) {
        expect(function () {
            var storage = GridFsStorage({
                url: 'mongodb://foo.address/dummydb'
            });
        }).to.throw();
    });*/

});
