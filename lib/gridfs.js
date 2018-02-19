/**
 *
 * Plugin definition
 * @module multer-gridfs-storage/gridfs
 *
 */
'use strict';

var mongodb = require('mongodb');
var ObjectID = mongodb.ObjectID;
var MongoClient = mongodb.MongoClient;

var crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var isPromise = require('is-promise');
var isGenerator = require('is-generator');
var isGeneratorFn = isGenerator.fn;
var pump = require('pump');
var mongoUri = require('mongodb-uri');
// es6-promise is only required for node version 0.10 where there is no native support for Promises
var Promise = global.Promise || require('es6-promise'); // eslint-disable-line global-require

/**
 * Is GridFSBucket present or not
 * @const legacy
 *
 * */
var legacy = !mongodb.GridFSBucket;

/**
 * Default file information
 * @const defaults
 *
 * */
var defaults = {
  metadata: null,
  chunkSize: 261120,
  bucketName: 'fs'
};


/**
 * Check if the node version is in the 0.x range
 * @function isOldNode
 * @return {boolean} - Returns true if the node major version number is zero
 *
 * */
function isOldNode() {
  var v = process.versions.node.split('.').map(Number);
  return v[0] === 0;
}

/**
 * @class GridFSStorage
 * @classdesc Multer GridFS Storage Engine class definition.
 * @extends EventEmitter
 * @param {object} opts
 * @param {string} opts.url - The url pointing to a MongoDb database
 * @param {object} [opts.connectionOpts] - Options to use when connection with an url
 * @param {DB | Promise} opts.db - The MongoDb database instance to use or a promise that resolves with it
 * @param {Function} [opts.file] - A function to control the file naming in the database
 * @fires GridFSStorage#connection
 * @fires GridFSStorage#connectionFailed
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
  this.db = null;
  this.client = null;
  this.connected = false;
  this.connecting = false;
  this._file = opts.file;

  this._legacy = legacy;
  this._connect(opts);
}

/**
 * Event emitted when the MongoDb connection is ready to use
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#connection
 * @param {Db} db - The MongoDb database
 * @version 0.0.3
 *
 */

/**
 * Event emitted when the MongoDb connection fails to open
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#connectionFailed
 * @param {Error} err - The error received when attempting to connect
 * @version 2.0.0
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
 * @param {Object} conf - The failed file configuration
 * @version 1.3
 *
 */

/**
 * Event emitted when an error occurs streaming to MongoDb
 *
 * Note: This event is deprecated and not emitted anymore
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#error
 * @param {Error} error - The error thrown by the stream
 * @param {Object} config - The file configuration
 * @deprecated
 * @version 1.2.1
 * @see #event:streamError
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
  var promise, client, _db;

  if (!opts.db) {
    this.connecting = true;
    MongoClient.connect(opts.url, opts.connectionOpts, function (err, db) {
      if (err) {
        return self._fail(err);
      }
      // Mongo 3 returns a client instead of a Db object
      if (db instanceof MongoClient) {
        client = db;
        self.client = client;
        var parsed = mongoUri.parse(opts.url);
        _db = client.db(parsed.database);
        self._setDb(_db);
      } else {
        self._setDb(db);
      }
    });
  } else {
    if (isPromise(opts.db)) {
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
    this.connected = false;
    this.connecting = false;
    return;
  }
  if (this.client) {
    this.connected = this.client.isConnected();
    return;
  }
  this.connected = this.db.topology.isConnected();
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
  var self = this;
  self.connecting = false;
  self.db = db;

  function errEvent(err) {
    // Needs verification. Sometimes the event fires without an error object
    // although the docs specify each of the events has a MongoError argument
    self._updateConnectionStatus();
    var error = err || new Error();
    self.emit('dbError', error);
  }

  // This are all the events that emit errors
  db
    .on('error', errEvent)
    .on('parseError', errEvent)
    .on('timeout', errEvent)
    .on('close', errEvent);
  self._updateConnectionStatus();

  // Emit on next tick so user code can set listeners in case the db object is already available
  process.nextTick(function () {
    self.emit('connection', self.db);
  });
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
  this.db = null;
  this._updateConnectionStatus();
  // Fail event is only emitted after either a then promise handler or an I/O phase so is guaranteed to be asynchronous
  this.emit('connectionFailed', err);
};


/**
 * Create a writable stream with backwards compatibility with GridStore
 * @function createStream
 * @instance
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {object} opts - The stream options
 *
 * */
GridFSStorage.prototype.createStream = function createStream(opts) {
  var gfs, settings;
  var GridStore = mongodb.GridStore;
  var GridFSBucket = mongodb.GridFSBucket;

  if (this._legacy) {
    settings = {
      chunk_size: opts.chunkSize,
      metadata: opts.metadata,
      content_type: opts.contentType,
      root: opts.bucketName
    };
    gfs = new GridStore(this.db, opts.id, opts.filename, 'w', settings);
    return gfs.stream();
  }
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
  var connectionListener, failedListener;
  var readStream = file.stream;

  var store = function () {
    self._generate(req, file)
      .then(function (fileSettings) {
        var settings;
        var setType = typeof fileSettings;
        var allowedTypes = ['undefined', 'number', 'string', 'object'];
        if (allowedTypes.indexOf(setType) !== -1) {
          if (fileSettings === null || fileSettings === undefined) {
            settings = {};
          } else if (setType === 'string' || setType === 'number') {
            settings = {
              filename: fileSettings.toString()
            };
          } else {
            settings = fileSettings;
          }
          return mergeProps({
            contentType: file.mimetype
          }, settings);
        } else {
          return Promise.reject(new Error('Invalid type for file settings, got ' + setType));
        }
      })
      .then(function (streamOpts) {
        var writeStream, store, emitFile, emitError;

        emitError = function emitError(streamError) {
          self.emit('streamError', streamError, streamOpts);
          cb(streamError);
        };

        emitFile = function emitFile(f) {
          var storedFile = {
            id: f._id,
            filename: f.filename,
            metadata: f.metadata || null,
            bucketName: streamOpts.bucketName,
            chunkSize: f.chunkSize,
            size: f.length,
            md5: f.md5,
            uploadDate: f.uploadDate,
            contentType: f.contentType
          };
          self.emit('file', storedFile);
          cb(null, storedFile);
        };

        writeStream = self.createStream(streamOpts);

        // Multer already handles the error event on the readable stream(Busboy).
        // Invoking the callback with an error will cause file removal and aborting routines to be called twice

        writeStream.on('error', emitError);

        if (self._legacy) {
          store = writeStream.gs;
          // In older mongo versions there is a race condition when the store is opening and the stream is
          // switched into flowing mode that causes the index not to be properly initialized so is better to open the store first
          store.open(function (error) {
            if (error) {
              return emitError(error);
            }
            writeStream.on('end', function () {

              store.close(function (err, f) {
                if (err) {
                  return emitError(err);
                }
                emitFile(f);
              });
            });
            pump(readStream, writeStream);
          });
        } else {
          writeStream.on('finish', emitFile);
          pump(readStream, writeStream);
        }
      })
      .catch(cb);
  };

  if (self.connecting) {
    // Connection listeners. Only one of them fires, the other is cleaned after the event.
    connectionListener = function () {
      self.removeListener('connectionFailed', failedListener);
      store();
    };

    failedListener = function (err) {
      self.removeListener('connection', connectionListener);
      cb(err);
    };
    self
      .once('connection', connectionListener)
      .once('connectionFailed', failedListener);
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
  var GridStore = mongodb.GridStore;
  var GridFSBucket = mongodb.GridFSBucket;

  if (this._legacy) {

    options = {root: file.bucketName};

    GridStore.unlink(this.db, file.id, options, cb);
  } else {
    options = {bucketName: file.bucketName};
    bucket = new GridFSBucket(this.db, options);
    bucket.delete(file.id, cb);
  }
};


/**
 * Tests for generator functions or plain functions and delegates to the appropriate method
 * @function _generate
 * @instance
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {Express.Request} req - The request that trigger the upload as received in _handleFile
 * @param {Multer.File} file - The uploaded file stream as received in _handleFile
 * @param {function} cb - A standard node callback to signal the end of the upload or an error as received in _handleFile
 *
 * */
GridFSStorage.prototype._generate = function _generate(req, file) {
  var self = this;
  var result, generator;

  if (!this._file) {
    return Promise.resolve({});
  }

  try {
    if (isGeneratorFn(this._file)) {
      generator = self._file(req, file);
      self._file = generator;
      result = generator.next();
      return self._handleResult(result, true);
    } else if (isGenerator(self._file)) {
      generator = self._file;
      result = generator.next([req, file]);
      return self._handleResult(result, true);
    } else {
      result = self._file(req, file);
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

function mergeProps(extra, fileSettings) {
  var randomBytes;
  var promise;

  // If the filename is not provided generate one
  if (!fileSettings.filename) {
    // On node versions up to 0.12 randomBytes could throw an error if there is no enough entropy in the system.
    // In those cases is preferable to use the deprecated pseudoRandomBytes function to preserve backwards compatibility
    // maintaining the same behaviour across node versions.
    randomBytes = isOldNode() ? crypto.pseudoRandomBytes : crypto.randomBytes;
    promise = new Promise(function (resolve, reject) {
      randomBytes(16, function (err, buffer) {
        if (err) {
          return reject(err);
        }
        resolve({filename: buffer.toString('hex')});
      });
    });
  } else {
    promise = Promise.resolve({});
  }

  return promise
    .then(function (prev) {
      // If no id is provided generate one
      // If an error occurs the emitted file information will contain the id
      var hasId = fileSettings.id;
      if (!hasId) {
        prev.id = new ObjectID();
      }
      return prev;
    })
    .then(function (prev) {
      var args, index, nextSource, nextKey, hasOwn, target;
      if (typeof Object.assign === 'function') {
        return Object.assign(prev, defaults, extra, fileSettings);
      }
      // for Node versions 0.10 and 0.12 which lacks Object.assign function
      // remove on engine version upgrade
      args = [prev, defaults, extra, fileSettings];
      hasOwn = Object.prototype.hasOwnProperty;
      target = prev;
      for (index = 1; index < args.length; index++) {
        nextSource = args[index];

        if (nextSource !== null && nextSource !== undefined) {
          for (nextKey in nextSource) {
            if (hasOwn.call(nextSource, nextKey)) {
              target[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return target;
    });
}

module.exports = exports = GridFSStorage;
