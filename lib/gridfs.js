var mongo = require('mongodb');
var Grid = require('gridfs-stream');
var crypto = require('crypto');
var Storage = require('./storage');
var util = require('util');

function getFilename(req, file, cb) {
    crypto.pseudoRandomBytes(16, function (err, raw) {
        cb(err, err ? undefined : raw.toString('hex'));
    });
}

function noop(req, file, cb) {
    cb(null, null);
}

Storage.prototype._handleFile = function _handleFile(req, file, cb) {
    var self = this;
    var streamOpts = {
        content_type: file.mimetype
    };
    self.getIdentifier(req, file, function (err, id) {
        if (err) {
            return cb(err);
        } else if (id) {
            streamOpts._id = id;
        }

        self.getFilename(req, file, function (err, filename) {
            if (err) {
                return cb(err);
            } else {
                streamOpts.filename = filename;
                self.getMetadata(req, file, function (err, metadata) {
                    if (err) {
                        return cb(err);
                    } else {
                        streamOpts.metadata = metadata;

                        var writestream = self.gfs.createWriteStream(streamOpts);

                        file.stream.pipe(writestream);
                        writestream.on('error', cb);

                        writestream.on('close', function (f) {
                            self.emit('file', f);
                            if (self.log) {
                                console.log('saved', f);
                            }
                            cb(null, {
                                filename: filename,
                                metadata: metadata,
                                id: f._id,
                                grid: f,
                                size: writestream.bytesWritten
                            });
                        });
                    }
                });
            }
        });
    });
};

Storage.prototype._removeFile = function _removeFile(req, file, cb) {
    var self = this;
    if (file.id) {
        self.gfs.remove({_id: file.id}, function (err) {
            if (err) {
                cb(err);
            } else {
                if (self.log) {
                    console.log('Deleted file ', file);
                }
                cb(null);
            }
        });
    } else {
        cb(null);
    }
};

function GridFSStorage(opts) {
    var self = this;

    if (!opts || (!opts.url && !opts.gfs)) {
        throw new Error('Missing required configuration');
    }
    self.log = opts.log || false;
    self.logLevel = opts.logLevel && opts.logLevel === 'all' ? opts.logLevel : 'file';
    self.getIdentifier = (opts.identifier || noop);
    self.getFilename = (opts.filename || getFilename);
    self.getMetadata = (opts.metadata || noop);

    if (!opts.gfs) {
        self.gfs = null;
        mongo.MongoClient.connect(opts.url, function (err, db) {
            if (err) throw new Error(err);

            self.gfs = new Grid(db, mongo);
            self.emit('connection', self.gfs, db);

            if (self.log && self.logLevel === 'all') {
                console.log('MongoDb connected in url ' + opts.url);

                db.on('close', function () {
                    console.log('Disconnected from MongoDb database');
                });

                db.on('error', function (err) {
                    console.error('Received MongoDb error', err);
                });

                db.on('parseError', function (err) {
                    console.error('Error parsing', err);
                });

                db.on('timeout', function (err) {
                    console.error('MongoDb operation timeout ', err);
                });
            }
        });
    } else {
        self.gfs = opts.gfs;
    }
}

util.inherits(GridFSStorage, Storage);

module.exports = GridFSStorage;
