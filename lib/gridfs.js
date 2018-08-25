/**
 *
 * Plugin definition
 * @module multer-gridfs-storage/gridfs
 *
 */
'use strict';

const mongodb = require('mongodb');
const ObjectID = mongodb.ObjectID;
const MongoClient = mongodb.MongoClient;
const Cache = require('./cache');
const crypto = require('crypto');
const EventEmitter = require('events').EventEmitter;
const util = require('util');

const isPromise = require('is-promise');
const isGenerator = require('is-generator');
const isGeneratorFn = isGenerator.fn;
const pump = require('pump');
const mongoUri = require('mongodb-uri');
const cache = new Cache();

/**
 * Is GridFSBucket present or not
 * @const legacy
 **/
const legacy = !mongodb.GridFSBucket;

/**
 * Default file information
 * @const defaults
 **/
const defaults = {
  metadata: null,
  chunkSize: 261120,
  bucketName: 'fs',
};

/**
 * @class GridFSStorage
 * @classdesc Multer GridFS Storage Engine class definition.
 * @extends EventEmitter
 * @param {object} opts
 * @param {string} [opts.url] - The url pointing to a MongoDb database
 * @param {object} [opts.connectionOpts] - Options to use when connection with an url
 * @param {boolean | string} [opts.cache] - Store this connection in the internal cache.
 * @param {Db | Promise} [opts.db] - The MongoDb database instance to use or a promise that resolves with it
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
  this.caching = !!(opts.cache && opts.url);
  this.cacheName = null;
  this.cacheIndex = null;

  this._file = opts.file;
  this._legacy = legacy;

  if (this.caching) {
    this.cacheName = typeof opts.cache === 'string' ? opts.cache : 'default';
    this.cacheIndex = cache.initialize({
      url: opts.url,
      cacheName: this.cacheName,
      init: opts.connectionOpts,
    });
  }
  this._connect(opts);
}

/**
 * Event emitted when the MongoDb connection is ready to use
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#connection
 * @param {Db} db - The MongoDb database
 * @version 0.0.3
 */

/**
 * Event emitted when the MongoDb connection fails to open
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#connectionFailed
 * @param {Error} err - The error received when attempting to connect
 * @version 2.0.0
 */

/**
 * Event emitted when a new file is uploaded
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#file
 * @param {File} file - The uploaded file
 * @version 0.0.3
 */

/**
 * Event emitted when an error occurs streaming to MongoDb
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#streamError
 * @param {Error} error - The error thrown by the stream
 * @param {Object} conf - The failed file configuration
 * @version 1.3
 */

/**
 * Event emitted when the internal database connection emits an error
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#dbError
 * @param {Error} error - The error thrown by the database connection
 * @version 1.2.2
 **/

util.inherits(GridFSStorage, EventEmitter);

/**
 * Determines if a new connection should be created, a explicit connection is provided or a cached instance is required.
 * @param {object} opts - Configuration object passed in the constructor
 **/
GridFSStorage.prototype._connect = function _connect(opts) {
  let promise, url, cached;

  if (!opts.db) {
    url = opts.url;
    if (this.caching) {
      if (!cache.isOpening(this.cacheIndex) && cache.isPending(this.cacheIndex)) {
        cached = cache.get(this.cacheIndex);
        cached.opening = true;
        this._createConnection(url, opts.connectionOpts);
      }
      cache
        .waitFor(this.cacheIndex)
        .then((cached) => {
          this._setDb(cached.db, cached.client);
        })
        .catch((err) => {
          this._fail(err);
        });
    } else {
      this._createConnection(url, opts.connectionOpts);
    }
  } else {
    if (isPromise(opts.db)) {
      this.connecting = true;
      promise = opts.db;
      promise.then((db) => {
        this._setDb(db);
      }, (err) => {
        this._fail(err);
      });
    } else {
      this._setDb(opts.db);
    }
  }
};

/**
 * Handles creating a new connection from an url and storing it in the cache if necessary
 * @param {string} url - The url connection string
 * @param {object} connectionOpts - Options provided to open the connection
 **/
GridFSStorage.prototype._createConnection = function _createConnection(url, connectionOpts) {
  let db, client = null;

  this.connecting = true;
  MongoClient.connect(url, connectionOpts, (err, _db) => {
    let parsedUri;

    if (err) {
      return this.cacheIndex ? cache.reject(this.cacheIndex, err) : this._fail(err);
    }
    // Mongo 3 returns a client instead of a Db object
    if (_db instanceof MongoClient) {
      client = _db;
      parsedUri = mongoUri.parse(url);
      db = client.db(parsedUri.database);
    } else {
      db = _db;
    }
    if (this.caching) {
      cache.resolve(this.cacheIndex, db, client);
    } else {
      this._setDb(db, client);
    }
  });
};

/**
 * Updates the connection status based on the internal db object
 **/
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
 * @param {object} db - Database instance
 * @param {object} [client] - Optional Mongo client for MongoDb v3
 **/
GridFSStorage.prototype._setDb = function _setDb(db, client) {
  this.connecting = false;
  this.db = db;
  if (client) {
    this.client = client;
  }

  const errEvent = (err) => {
    // Needs verification. Sometimes the event fires without an error object
    // although the docs specify each of the events has a MongoError argument
    this._updateConnectionStatus();
    const error = err || new Error();
    this.emit('dbError', error);
  };

  // This are all the events that emit errors
  db
    .on('error', errEvent)
    .on('parseError', errEvent)
    .on('timeout', errEvent)
    .on('close', errEvent);
  this._updateConnectionStatus();

  // Emit on next tick so user code can set listeners in case the db object is already available
  process.nextTick(() => {
    this.emit('connection', this.db, this.client);
  });
};

/**
 * Removes the database reference and emit the connectionFailed event
 * @param {object} err - The error received while trying to connect
 **/
GridFSStorage.prototype._fail = function _fail(err) {
  this.db = null;
  this.client = null;
  this._updateConnectionStatus();
  // Fail event is only emitted after either a then promise handler or an I/O phase so is guaranteed to be asynchronous
  this.emit('connectionFailed', err);
};


/**
 * Create a writable stream with backwards compatibility with GridStore
 * @param {object} opts - The stream options
 **/
GridFSStorage.prototype.createStream = function createStream(opts) {
  let gfs, settings;
  const GridStore = mongodb.GridStore;
  const GridFSBucket = mongodb.GridFSBucket;

  if (this._legacy) {
    settings = {
      chunk_size: opts.chunkSize,
      metadata: opts.metadata,
      content_type: opts.contentType,
      root: opts.bucketName,
    };
    gfs = new GridStore(this.db, opts.id, opts.filename, 'w', settings);
    return gfs.stream();
  }
  settings = {
    id: opts.id,
    chunkSizeBytes: opts.chunkSize,
    contentType: opts.contentType,
    metadata: opts.metadata,
  };
  gfs = new GridFSBucket(this.db, {bucketName: opts.bucketName});
  return gfs.openUploadStream(opts.filename, settings);
};

/**
 * Storage interface method to handle incoming files
 * @param {Request} req - The request that trigger the upload
 * @param {File} file - The uploaded file stream
 * @param {function} cb - A standard node callback to signal the end of the upload or an error
 **/
GridFSStorage.prototype._handleFile = function _handleFile(req, file, cb) {
  let connectionListener, failedListener;
  const readStream = file.stream;

  const store = () => {
    this._generate(req, file)
      .then((fileSettings) => {
        let settings;
        const setType = typeof fileSettings;
        const allowedTypes = ['undefined', 'number', 'string', 'object'];
        if (allowedTypes.indexOf(setType) !== -1) {
          if (fileSettings === null || fileSettings === undefined) {
            settings = {};
          } else if (setType === 'string' || setType === 'number') {
            settings = {
              filename: fileSettings.toString(),
            };
          } else {
            settings = fileSettings;
          }
          return GridFSStorage._mergeProps({
            contentType: file.mimetype,
          }, settings);
        } else {
          return Promise.reject(new Error('Invalid type for file settings, got ' + setType));
        }
      })
      .then((streamOpts) => {
        let store;

        const emitError = (streamError) => {
          this.emit('streamError', streamError, streamOpts);
          cb(streamError);
        };

        const emitFile = (f) => {
          const storedFile = {
            id: f._id,
            filename: f.filename,
            metadata: f.metadata || null,
            bucketName: streamOpts.bucketName,
            chunkSize: f.chunkSize,
            size: f.length,
            md5: f.md5,
            uploadDate: f.uploadDate,
            contentType: f.contentType,
          };
          this.emit('file', storedFile);
          cb(null, storedFile);
        };

        const writeStream = this.createStream(streamOpts);

        // Multer already handles the error event on the readable stream(Busboy).
        // Invoking the callback with an error will cause file removal and aborting routines to be called twice

        writeStream.on('error', emitError);

        if (this._legacy) {
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

  if (this.connecting) {
    // Connection listeners. Only one of them fires, the other is cleaned after the event.
    connectionListener = () => {
      this.removeListener('connectionFailed', failedListener);
      store();
    };

    failedListener = (err) => {
      this.removeListener('connection', connectionListener);
      cb(err);
    };
    this
      .once('connection', connectionListener)
      .once('connectionFailed', failedListener);
  } else {
    this._updateConnectionStatus();
    if (this.connected) {
      store();
    } else {
      return cb(new Error('The database connection must be open to store files'));
    }
  }
};

/**
 * Storage interface method to delete files in case an error turns the request invalid
 * @param {Express.Request} req - The request that trigger the upload
 * @param {Multer.File} file - The uploaded file stream
 * @param {function} cb - A standard node callback to signal the end of the upload or an error
 **/
GridFSStorage.prototype._removeFile = function _removeFile(req, file, cb) {
  let bucket, options;
  const GridStore = mongodb.GridStore;
  const GridFSBucket = mongodb.GridFSBucket;

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
 * @param {Express.Request} req - The request that trigger the upload as received in _handleFile
 * @param {Multer.File} file - The uploaded file stream as received in _handleFile
 * @return {Promise} A promise with the value generated by the file function
 **/
GridFSStorage.prototype._generate = function _generate(req, file) {
  let result, generator;

  if (!this._file) {
    return Promise.resolve({});
  }

  try {
    if (isGeneratorFn(this._file)) {
      generator = this._file(req, file);
      this._file = generator;
      result = generator.next();
      return this._handleResult(result, true);
    } else if (isGenerator(this._file)) {
      generator = this._file;
      result = generator.next([req, file]);
      return this._handleResult(result, true);
    } else {
      result = this._file(req, file);
      return this._handleResult(result, false);
    }
  } catch (err) {
    return Promise.reject(err);
  }
};

/**
 * Handles generator function and promise results
 * @param {object} result - Can be a promise or a generator yielded value
 * @param {boolean} isGen - True if is a yielded value
 * @return {Promise} The generator value or a plain value wrapped in a Promise
 *
 **/
GridFSStorage.prototype._handleResult = function _handleResult(result, isGen) {
  let value = result;

  if (isGen) {
    if (result.done) {
      throw new Error('Generator ended unexpectedly');
    }
    value = result.value;
  }
  return Promise.resolve(value);
};

/**
 * Merge the properties received in the file function with default values
 * @param extra {object} Extra properties like contentType
 * @param fileSettings {object} Properties received in the file function
 * @return {Promise} An object with the merged properties wrapped in a promise
 */
GridFSStorage._mergeProps = function _mergeProps(extra, fileSettings) {
  let promise;

  // If the filename is not provided generate one
  if (!fileSettings.filename) {
    promise = new Promise(function (resolve, reject) {
      crypto.randomBytes(16, function (err, buffer) {
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
      const hasId = fileSettings.id;
      if (!hasId) {
        prev.id = new ObjectID();
      }
      return prev;
    })
    .then(function (prev) {
      return Object.assign(prev, defaults, extra, fileSettings);
    });
};

/**
 * The cache used by the module
 * @type {Cache}
 */
GridFSStorage.cache = cache;

module.exports = exports = GridFSStorage;
