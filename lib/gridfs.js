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
var isGeneratorFn = require('is-generator-fn');
var Promise = global.Promise || require('es6-promise'); // eslint-disable-line global-require
var Grid = require('gridfs-stream');

/**
 * @class GridFSStorage
 * @classdesc Multer GridFS Storage Engine class definition.
 * @extends EventEmitter
 * @param {object} opts
 * @param {string} opts.url - The url pointing to a MongoDb database
 * @param {DB | Promise} opts.db - The MongoDb database instance to use or a promise that resolves with it
 * @param {Function} [opts.filename] - A function to control the file naming in the database
 * @param {Function} [opts.identifier] - A function to control the unique identifier of the file
 * @param {Function} [opts.metadata] - A function to control the metadata object associated to the file
 * @param {Function} [opts.chunkSize] - The preferred size of file chunks in bytes
 * @param {string | Function} [opts.root] - The root collection to store the files
 * @param {boolean | Function} [opts.log=false] - Enable or disable logging
 * @param {string} [opts.logLevel='file'] - The events to be logged out
 * @fires GridFSStorage#connection
 * @fires GridFSStorage#file
 * @fires GridFSStorage#streamError
 * @fires GridFSStorage#dbError
 * @version 0.0.3
 */
function GridFSStorage(opts) {
  if (!(this instanceof GridFSStorage)) {
    return new GridFSStorage(opts);
  }

  EventEmitter.call(this);

  this.setMaxListeners(0);
  this.connected = false;
  this.connecting = false;
  this._getFile = opts.file || _getFile;

  this._legacy = !mongodb.GridFSBucket;
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
 * @version 1.3
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
 * Handles connection settings
 * @function _connect
 * @instance
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {object} opts - Configuration object passed in the constructor
 *
 * */
GridFSStorage.prototype._connect = function _connect(opts) {
  var self = this;
  var promise;
  var MongoClient = mongodb.MongoClient;

  if (!opts.db) {
    this.connecting = true;
    MongoClient.connect(opts.url, opts.connectionOpts, function (err, db) {
      if (err) {
        return self._fail(err);
      }

      function errEvent(err) {
        // Needs verification. Sometimes the event fires without an error object
        // although the docs specify each of the events has a MongoError argument
        self._updateConnectionStatus();
        var error = err || new Error();
        self.emit('dbError', error);
      }

      // This are all the events that emit errors
      db.on('error', errEvent)
        .on('parseError', errEvent)
        .on('timeout', errEvent)
        .on('close', errEvent);

      self._setDb(db);
    });
  } else {
    if (opts.db.then) {
      self.connecting = true;
      promise = opts.db;
      promise.then(function (db) {
        self._setDb(db);
      }, function (err) {
        self._fail(err);
      });
    } else {
      self._setDb(opts.db);
    }
  }
};


/**
 * Updates the connection status based on the internal db object
 * @function _updateConnectionStatus
 * @instance
 * @private
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 *
 * */
GridFSStorage.prototype._updateConnectionStatus = function _updateConnectionStatus() {
  if (!this.db) {
    return false;
  }
  this.connected = this.db.serverConfig.isConnected();
};

/**
 * Sets the database connection and emit the connection event
 * @function _setDb
 * @instance
 * @private
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {object} db - Database instance
 *
 * */
GridFSStorage.prototype._setDb = function _setDb(db) {
  this.connecting = false;
  this.db = db;
  this._updateConnectionStatus();

  // Emit on next tick so user code can set listeners in case the db object is already available
  process.nextTick(function () {
    this.emit('connection', this.db);
  }.bind(this));
};

/**
 * Removes the database reference and emit the connectionFailed event
 * @function _fail
 * @instance
 * @private
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {object} err - The error received while trying to connect
 *
 * */
GridFSStorage.prototype._fail = function _fail(err) {
  this.connecting = false;
  this.db = null;
  this._updateConnectionStatus();

  process.nextTick(function () {
    this.emit('connectionFailed', err);
  }.bind(this));
};


/**
 * Create a writable stream with backwards compatibility with GridStore
 * @function _handleResult
 * @instance
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {object} opts - The stream options
 *
 * */
GridFSStorage.prototype.createStream = function (opts) {
  var gfs, settings;
  var GridFSBucket;

  if (this._legacy) {
    settings = {
      _id: opts.id,
      filename: opts.filename,
      chunk_size: opts.chunkSize,
      metadata: opts.metadata,
      content_type: opts.contentType,
      root: opts.bucketName
    };
    gfs = new Grid(this.db, mongodb);
    return gfs.createWriteStream(settings);
  }
  GridFSBucket = mongodb.GridFSBucket;
  settings = {
    id: opts.id,
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

  var store = function () {
    self._generate('_getFile', req, file)
      .then(function (fileSettings) {
        var writeStream;
        var event = self._legacy ? 'close' : 'finish';
        var streamOpts;

        streamOpts = {
          contentType: fileSettings.contentType || file.mimetype,
          id: fileSettings.id,
          filename: fileSettings.filename,
          metadata: fileSettings.metadata,
          bucketName: fileSettings.bucketName,
          chunkSize: fileSettings.chunkSize
        };

        writeStream = self.createStream(streamOpts);

        writeStream
          .on('error', function (streamError) {
            self.emit('streamError', streamError, streamOpts);
            cb(streamError);
          });

        writeStream
          .on(event, function (f) {
            var file = {
              id: f._id,
              filename: f.filename,
              metadata: f.metadata || null,
              bucketName: (self._legacy ? f.root : writeStream.bucketName) || 'fs',
              chunkSize: f.chunkSize,
              size: f.length,
              md5: f.md5,
              uploadDate: f.uploadDate
            };
            self.emit('file', file);
            cb(null, file);
          });

        file.stream.pipe(writeStream);
      })
      .catch(cb);
  };

  if (self.connecting) {
    self
      .once('connection', store)
      .once('connectionFailed', cb);
  } else {
    self._updateConnectionStatus();
    if (self.connected) {
      store();
    } else {
      return cb(new Error('The database connection must be open to store files'));
    }
  }
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
  var bucket, options;
  var GridFSBucket, GridStore;

  if (this._legacy) {
    GridStore = mongodb.GridStore;
    if (file.bucketName) {
      options = {root: file.bucketName};
    }

    GridStore.unlink(this.db, file.id, options, cb);
  } else {
    if (file.bucketName) {
      options = {bucketName: file.bucketName};
    }
    GridFSBucket = mongodb.GridFSBucket;
    bucket = new GridFSBucket(this.db, options);
    bucket.delete(file.id, cb);
  }
};

/**
 * Checks if an object is a generator
 * @function isGenerator
 * @param {object} value - The value to test
 *
 * */
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
GridFSStorage.prototype._generate = function _generate(method, req, file) {
  var self = this;
  var result, generator;
  try {
    if (isGeneratorFn(this[method])) {
      generator = self[method](req, file);
      self[method] = generator;
      result = generator.next();
      return self._handleResult(result, true);
    } else if (isGenerator(self[method])) {
      generator = self[method];
      result = generator.next([req, file]);
      return self._handleResult(result, true);
    } else {
      result = self[method](req, file);
      return self._handleResult(result, false);
    }
  } catch (err) {
    return Promise.reject(err);
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
GridFSStorage.prototype._handleResult = function _handleResult(result, isGen) {
  var value = result;

  if (isGen) {
    if (result.done) {
      throw new Error('Generator ended unexpectedly');
    }
    value = result.value;
  }
  return Promise.resolve(value);
};


module.exports = exports = GridFSStorage;
