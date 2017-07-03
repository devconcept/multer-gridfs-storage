/**
 *
 * Plugin definition
 * @module multer-gridfs-storage/gridfs
 *
 */
'use strict';

var mongodb = require('mongodb');
var crypto = require('crypto');

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var isPromise = require('is-promise');
var isGeneratorFn = require('is-generator-fn');

/**
 * @class GridFSStorage
 * @classdesc Multer GridFS Storage Engine class definition.
 * @extends EventEmitter
 * @param {object} opts
 * @param {string} opts.url - The url pointing to a MongoDb database
 * @param {Grid | Promise} opts.gfs - The Grid instance to use or
 * @param {Function} [opts.filename] - A function to control the file naming in the database
 * @param {Function} [opts.identifier] - A function to control the unique identifier of the file
 * @param {Function} [opts.metadata] - A function to control the metadata object associated to the file
 * @param {Function} [opts.chunkSize] - The preferred size of file chunks in bytes
 * @param {string | Function} [opts.root] - The root collection to store the files
 * @param {boolean | Function} [opts.log=false] - Enable or disable logging
 * @param {string} [opts.logLevel='file'] - The events to be logged out
 * @fires GridFSStorage#connection
 * @fires GridFSStorage#file
 * @version 0.0.3
 */
function GridFSStorage(opts) {
  if (!(this instanceof GridFSStorage)) {
    return new GridFSStorage(opts);
  }

  EventEmitter.call(this);

  this.connected = false;
  this._reconnect = opts.reconnect || false;
  this._retries = opts.retries || 0;
  this._delay = opts.delay || 1000;
  this._getFile = opts.file || _getFile;
  this.mongo = opts.mongo || mongodb;
  this._legacy = !this.mongo.GridFSBucket;

  this._connect(opts);
}

function _getFile() {
  var randomBytes = crypto.randomBytes || crypto.pseudoRandomBytes;
  return new Promise(function (resolve, reject) {
    randomBytes(16, function (err, buffer) {
      if (err) {
        reject(err);
      } else {
        resolve({
          filename: buffer.toString('hex'),
          chunkSize: 261120,
          metadata: null
        });
      }
    });
  });
}

/**
 * Event emitted when the MongoDb connection is ready to use
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#connection
 * @param {Grid} gfs - The created gfs instance
 * @param {MongoDb} db - The MongoDb database used to create the grid instance
 * @version 0.0.3
 *
 */

/**
 * Event emitted when the MongoDb connection fails to open
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#reconnection
 * @param {Error} err - The error received attempting to connect
 * @version 1.3
 *
 */

/**
 * Event emitted when the MongoDb connection fails to open
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#connectionFailed
 * @param {Error} err - The error received attempting to connect
 * @version 1.3
 *
 */

/**
 * Event emitted when a new file is uploaded
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#file
 * @param {File} file - The uploaded file
 * @version 0.0.3
 *
 */

/**
 * Event emitted when an error occurs streaming to MongoDb
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#streamError
 * @param {Error} error - The error thrown by the stream
 * @param {Object} config - The file configuration
 * @version 1.2.1
 *
 */

/**
 * Event emitted when the internal database connection emits an error
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#dbError
 * @param {Error} error - The error thrown by the database connection
 * @version 1.2.2
 *
 */

util.inherits(GridFSStorage, EventEmitter);

/**
 * Handles connection settings and emits connection event
 * @function _connect
 * @instance
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {object} opts - Configuration object passed in the constructor
 *
 * */
GridFSStorage.prototype._connect = function _connect(opts) {
  var promise;
  var MongoClient = this.mongo.MongoClient;

  if (!opts.db) {
    MongoClient.connect(opts.url, function (err, db) {
      if (err) {
        // We can't proceed if the connection fails
        throw err;
      }

      this.connected = true;
      this.db = db;
      this.emit('connection', this.db);
    }.bind(this));
  } else {
    if (opts.db.then) {
      promise = opts.db;
      promise.then(function (db) {
        this.connected = true;
        this.db = db;
        this.emit('connection', db);
      }.bind(this), function () {
        // TODO: Use another method
        process.exit(1);
      });
    } else {
      this.db = opts.db;
      this.connected = this.db.connected;
      this.emit('connection', this.db);
    }
  }
};

/**
 * Create a writable stream with backwards compatibility with MongoStore
 * @function _handleResult
 * @instance
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {object} opts - The stream options
 *
 * */
GridFSStorage.prototype.createStream = function (opts) {
  var gfs, settings;
  var GridFSBucket, GridStore;

  if (this._legacy) {
    settings = {
      chunk_size: opts.chunkSize,
      metadata: opts.metadata,
      content_type: opts.contentType,
      root: opts.bucketName
    };
    GridStore = this.mongo.GridStore;
    gfs = new GridStore(this.db, opts._id, opts.filename, 'w', settings);
    return gfs.stream();

  }
  GridFSBucket = this.mongo.GridFSBucket;
  settings = {
    chunkSizeBytes: opts.chunkSize,
    contentType: opts.contentType,
    metadata: opts.metadata
  };
  gfs = new GridFSBucket(this.db, {bucketName: opts.bucketName});
  return gfs.openUploadStream(opts.filename, settings);
};

/**
 * Storage interface method to handle incoming files
 * @function _handleFile
 * @instance
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {Express.Request} req - The request that trigger the upload
 * @param {Multer.File} file - The uploaded file stream
 * @param {function} cb - A standard node callback to signal the end of the upload or an error
 *
 * */
GridFSStorage.prototype._handleFile = function _handleFile(req, file, cb) {
  var self = this;
  var writeStream;
  var event = self._legacy ? 'close' : 'finish';

  self._generate('_getFile', req, file, function (err, fileSettings) {
    var streamOpts;
    if (err) {
      return cb(err);
    }
    streamOpts = {
      contentType: fileSettings.contentType || file.mimetype,
      id: fileSettings.id,
      filename: fileSettings.filename,
      metadata: fileSettings.metadata,
      bucketName: fileSettings.bucketName,
      chunkSize: fileSettings.chunkSize
    };

    writeStream = self.createStream(streamOpts);

    writeStream.on('error', function (streamError) {
      self.emit('streamError', streamError, streamOpts);
      cb(streamError);
    });

    writeStream.on(event, function (f) {
      var file = {
        id: f._id,
        filename: f.filename,
        metadata: f.metadata || null,
        bucketName: fileSettings.bucketName || 'fs',
        chunkSize: f.chunkSize,
        size: f.length,
        md5: f.md5,
        uploadDate: f.uploadDate
      };
      self.emit('file', file);
      cb(null, file);
    });

    file.stream.pipe(writeStream);
  });
};

/**
 * Storage interface method to delete files in case an error turns the request invalid
 * @function _removeFile
 * @instance
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {Express.Request} req - The request that trigger the upload
 * @param {Multer.File} file - The uploaded file stream
 * @param {function} cb - A standard node callback to signal the end of the upload or an error
 *
 * */
GridFSStorage.prototype._removeFile = function _removeFile(req, file, cb) {
  var store, bucket, options;
  var GridFSBucket, GridStore;

  if (this._legacy) {
    GridStore = this.mongo.GridStore;
    if (file.bucketName) {
      options = {root: file.bucketName};
    }
    store = new GridStore(this.db, file.id, 'w', options);
    store.open()
      .then(function () {
        return store.unlink();
      })
      .then(function () {
        cb();
      })
      .catch(function (err) {
        cb(err);
      });
  } else {
    if (file.bucketName) {
      options = {bucketName: file.bucketName};
    }
    GridFSBucket = this.mongo.GridFSBucket;
    bucket = new GridFSBucket(this.db, options);
    bucket.delete(file.id)
      .then(function () {
        cb();
      })
      .catch(function (err) {
        cb(err);
      });
  }
};

function isGenerator(value) {
  return value && typeof value.next === 'function' && typeof value.throw === 'function';
}

/**
 * Tests for generator functions or plain functions and delegates to the appropriate method
 * @function _generate
 * @instance
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {string} method - The internal function name that should be executed
 * @param {Express.Request} req - The request that trigger the upload as received in _handleFile
 * @param {Multer.File} file - The uploaded file stream as received in _handleFile
 * @param {function} cb - A standard node callback to signal the end of the upload or an error as received in _handleFile
 *
 * */
GridFSStorage.prototype._generate = function _generate(method, req, file, cb) {
  var result, generator;
  try {
    if (isGeneratorFn(this[method])) {
      generator = this[method](req, file);
      // Should we store a reference?
      //this[method + 'Ref'] = this[method];
      this[method] = generator;
      result = generator.next();
      this._handleResult(result, cb, true);
    } else if (isGenerator(this[method])) {
      generator = this[method];
      result = generator.next([req, file]);
      this._handleResult(result, cb, true);
    } else {
      result = this[method](req, file, cb);
      // Avoid extra processing if we are dealing with callbacks
      // Prevents duplicate calls when a callback is used and any value is returned from the function
      if (result && isPromise(result)) {
        this._handleResult(result, cb, false);
      }
    }
  } catch (e) {
    return cb(e, null);
  }

};

/**
 * Handles generator function and promise results
 * @function _handleResult
 * @instance
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {object} result - Can be a promise or a generator yielded value
 * @param {function} cb - A standard node callback to signal the end of the upload or an error as received in _handleFile
 * @param {boolean} isGen - True if is a yielded value
 *
 * */
GridFSStorage.prototype._handleResult = function _handleResult(result, cb, isGen) {
  var value = result;

  function onFulfill(data) {
    cb(null, data);
  }

  function onReject(err) {
    cb(err, null);
  }

  if (isGen) {
    if (result.done) {
      throw new Error('Generator ended unexpectedly');
    }
    value = result.value;
  }
  if (isPromise(value)) {
    value.then(onFulfill, onReject);
  } else {
    return cb(null, value);
  }
};


module.exports = exports = GridFSStorage;
