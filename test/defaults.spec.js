var storage = require('../index');
var Grid = require('gridfs-stream');
var mongo = require('mongodb');
var chai = require('chai');
var expect = chai.expect;
var settings = require('./utils/settings');
var MongoClient = mongo.MongoClient;

describe('module default options', function () {
    var instance;
    this.slow(2000);
    this.timeout(5000);

    it('should create a mongodb connection when using the url parameter', function (done) {
        instance = storage({
            url: settings.mongoUrl()
        });

        setTimeout(function () {
            expect(instance.gfs).to.be.an.instanceof(Grid);
            done();
        }, 2000);
    });

    it('should use an existing GridFS connection when using the gfs parameter', function (done) {
        MongoClient.connect(settings.mongoUrl(), function (err, db) {
            var gfs = Grid(db, mongo);
            instance = storage({
                gfs: gfs
            });
            expect(instance.gfs).to.be.an.instanceof(Grid);
            expect(instance.gfs).to.be.equal(gfs);
            done();
        });
    });

    it('should throw an error when no url and gfs parameters are passed in', function () {
        var fn = function () {
            instance = storage({});
        };
        expect(fn).to.throw(Error, /^Missing required configuration$/);
    });

    it('should disable logging by default', function () {
        instance = storage({
            url: settings.mongoUrl()
        });
        expect(instance.log).to.equal(false);
    });

    it('should set the logLevel to file by default', function () {
        instance = storage({
            url: settings.mongoUrl()
        });
        expect(instance.logLevel).to.equal('file');
    });

    it('should change the default naming function', function () {
        var namingFn = function (req, file, cb) {
            cb(null, 'foo' + Date.now());
        };
        instance = storage({
            url: settings.mongoUrl(),
            filename: namingFn
        });
        expect(instance.getFilename).to.be.a('function');
        expect(instance.getFilename).to.equal(namingFn);
    });

    it('should change the default metadata function', function () {
        var metadataFn = function (req, file, cb) {
            cb(null, 'foo' + Date.now());
        };
        instance = storage({
            url: settings.mongoUrl(),
            metadata: metadataFn
        });
        expect(instance.getMetadata).to.be.a('function');
        expect(instance.getMetadata).to.equal(metadataFn);
    });

    it('should change the default identifier function', function () {
        var identifierFn = function (req, file, cb) {
            cb(null, 'foo');
        };
        instance = storage({
            url: settings.mongoUrl(),
            identifier: identifierFn
        });
        expect(instance.getIdentifier).to.be.a('function');
        expect(instance.getIdentifier).to.equal(identifierFn);
    });

    afterEach(function () {
        instance.removeAllListeners('connection');
        if (instance.gfs) {
            instance.gfs.db.close(false);
        } else {
            instance.once('connection', function (gfs, db) {
                db.close(false);
            });
        }
    });

});




