'use strict';

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

function generateValue(value) {
    return function getValue(req, file, cb) {
        cb(null, value);
    }
}

function noop(req, file, cb) {
    cb(null, null);
}

Storage.prototype._handleFile = function _handleFile(req, file, cb) {
    var self = this;
    var streamOpts = {
        content_type: file.mimetype,
        chunkSize: self._getChunkSize
    };
    self._getChunkSize(req, file, function (err, chunkSize) {
        if (err) {
            return cb(err);
        } else {
            streamOpts.chunkSize = chunkSize;
            self._getRoot(req, file, function (err, root) {
                if (err) {
                    return cb(err);
                } else {
                    streamOpts.root = root;
                    self._getIdentifier(req, file, function (err, id) {
                        if (err) {
                            return cb(err);
                        } else if (id) {
                            streamOpts._id = id;
                        }

                        self._getFilename(req, file, function (err, filename) {
                            if (err) {
                                return cb(err);
                            } else {
                                streamOpts.filename = filename;
                                self._getMetadata(req, file, function (err, metadata) {
                                    if (err) {
                                        return cb(err);
                                    } else {
                                        streamOpts.metadata = metadata;

                                        var writestream = self.gfs.createWriteStream(streamOpts);

                                        file.stream.pipe(writestream);
                                        writestream.on('error', cb);

                                        writestream.on('close', function (f) {
                                            self.emit('file', f);
                                            if (self._log) {
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
                }
            });
        }
    });
};

Storage.prototype._removeFile = function _removeFile(req, file, cb) {
    var self = this;
    if (file.grid) {
        self.gfs.remove({_id: file.grid._id}, function (err) {
            if (err) {
                cb(err);
            } else {
                if (self._log) {
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
    self._log = opts.log || false;
    self._logLevel = opts.logLevel && opts.logLevel === 'all' ? opts.logLevel : 'file';
    self._getIdentifier = (opts.identifier || noop);
    self._getFilename = (opts.filename || getFilename);
    self._getMetadata = (opts.metadata || noop);
    if (opts.chunkSize) {
        if (typeof opts.chunkSize === 'function') {
            self._getChunkSize = opts.chunkSize;
        } else {
            self._getChunkSize = generateValue(opts.chunkSize);
        }
    } else {
        self._getChunkSize = generateValue(261120);
    }

    if (opts.root) {
        if (typeof opts.root === 'function') {
            self._getRoot = opts.root;
        } else {
            self._getRoot = generateValue(opts.root);
        }
    } else {
        self._getRoot = noop;
    }

    if (!opts.gfs) {
        self.gfs = null;
        mongo.MongoClient.connect(opts.url, function (err, db) {
            if (err) throw new Error(err);

            self.gfs = new Grid(db, mongo);
            self.emit('connection', self.gfs, db);

            if (self._log && self._logLevel === 'all') {
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
