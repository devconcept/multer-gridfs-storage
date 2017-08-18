/**
 *
 * Plugin definition
 * @module multer-gridfs-storage/gridfs
 *
 */
'use strict';

var mongo = require('mongodb');
var Grid = require('gridfs-stream');

var EventEmitter = require('events').EventEmitter;
var util = require('util');
var __ = require('./utils');

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

  __.validateOptions(opts);

  this.gfs = null;
  this._configure(opts);
  this._connect(opts);
}

/**
 * Event emitted when the Storage is instantiated with the `url` option
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
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#error
 * @param {Error} error - The error thrown by the stream
 * @param {Object} config - The file configuration
 * @version 1.2.1
 * @deprecated
 *
 */

/**
 * Event emitted when an error occurs streaming to MongoDb
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#streamError
 * @param {Error} error - The error thrown by the stream
 * @param {Object} config - The file configuration
 * @version 1.3.0
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
  var streamOpts = {content_type: file.mimetype};

  self._generate('_getFilename', req, file, function (err, filename) {
    if (err) {
      return cb(err);
    }
    streamOpts.filename = filename;

    self._generate('_getIdentifier', req, file, function (err, id) {
      if (err) {
        return cb(err);
      }
      if (id) {
        streamOpts._id = id;
      }

      self._generate('_getMetadata', req, file, function (err, metadata) {
        if (err) {
          return cb(err);
        }
        streamOpts.metadata = metadata;

        self._generate('_getChunkSize', req, file, function (err, chunkSize) {
          if (err) {
            return cb(err);
          }
          streamOpts.chunkSize = chunkSize;

          self._generate('_getRoot', req, file, function (err, root) {
            var writeStream;

            if (err) {
              return cb(err);
            }

            streamOpts.root = root;
            writeStream = self.gfs.createWriteStream(streamOpts);

            writeStream.on('error', function (streamError) {
              var errorEvents;
              // Backwards compatibility with the deprecated error event
              if (self.listenerCount) {
                errorEvents = self.listenerCount('error');
              } else {
                errorEvents = EventEmitter.listenerCount(self, 'error');
              }
              if (errorEvents) {
                self.emit('error', streamError, streamOpts);
              }
              self.emit('streamError', streamError, streamOpts);
              self._logError(streamError);
              cb(streamError);
            });

            writeStream.on('close', function (f) {
              self.emit('file', f);
              self._logMessage({message: 'Saved file', extra: f});
              cb(null, {
                filename: filename,
                metadata: metadata,
                id: f._id,
                grid: f,
                size: f.length
              });
            });

            file.stream.pipe(writeStream);
          });
        });
      });
    });
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
  function onRemove(err) {
    if (err) {
      return cb(err);
    }
    this._logMessage({message: 'Deleted file ', extra: file});
    return cb(null);
  }

  this.gfs.remove({_id: file.id}, onRemove.bind(this));
};

/**
 * Tests for generator functions or plain functions and delegates to the apropiate method
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
    if (__.isGeneratorFunction(this[method])) {
      generator = this[method](req, file);
      // Should we store a reference?
      //this[method + 'Ref'] = this[method];
      this[method] = generator;
      result = generator.next();
      this._handleResult(result, cb, true);
    } else if (__.isGenerator(this[method])) {
      generator = this[method];
      result = generator.next([req, file]);
      this._handleResult(result, cb, true);
    } else {
      result = this[method](req, file, cb);
      // Avoid extra processing if we are dealing with callbacks
      if (result) {
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
GridFSStorage.prototype._handleResult = function (result, cb, isGen) {
  var value = result;

  function onFullfill(data) {
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
  if (__.isPromise(value)) {
    value.then(onFullfill, onReject);
  } else {
    return cb(null, value);
  }
};

/**
 * Handles optional configuration properties
 * @function _configure
 * @instance
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {object} opts - Configuration object passed in the constructor
 *
 * */
GridFSStorage.prototype._configure = function (opts) {
  this._log = opts.log || false;
  this._logLevel = opts.logLevel || 'file';
  this._getIdentifier = opts.identifier || __.noop;
  this._getFilename = opts.filename || __.getFilename;
  this._getMetadata = opts.metadata || __.noop;
  if (opts.chunkSize && __.isFuncOrGeneratorFunc(opts.chunkSize)) {
    this._getChunkSize = opts.chunkSize;
  } else {
    this._getChunkSize = __.generateValue(opts.chunkSize ? opts.chunkSize : 261120);
  }

  if (opts.root) {
    if (__.isFuncOrGeneratorFunc(opts.root)) {
      this._getRoot = opts.root;
    } else {
      this._getRoot = __.generateValue(opts.root);
    }
  } else {
    this._getRoot = __.noop;
  }
};

/**
 * Handles connection settings and emits connection event
 * @function _connect
 * @instance
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {object} opts - Configuration object passed in the constructor
 *
 * */
GridFSStorage.prototype._connect = function (opts) {
  var self = this;
  var promise;

  function onFullfill(gfs) {
    self.gfs = gfs;
    self.emit('connection', self.gfs, self.gfs.db);
  }

  function onReject(err) {
    self._logError(err);
  }

  if (!opts.gfs) {
    mongo.MongoClient.connect(opts.url, function (err, db) {
      var gfs;
      if (err) {
        // We can't proceed if the connection fails
        throw err;
      }

      function errEvent(err) {
        // Needs verification. Sometimes the event fires without an error object
        // although the docs specify each of the events has a MongoError argument
        var error = err || new Error();
        self._logError(error);
        self.emit('dbError', error);
      }

      gfs = new Grid(db, mongo);
      if (self._logLevel === 'all') {
        self._logMessage({message: 'MongoDb connected in url ' + opts.url, extra: db});

        // This are all the events that emit errors
        db.on('error', errEvent)
          .on('parseError', errEvent)
          .on('timeout', errEvent)
          .on('close', errEvent);
      }
      self.gfs = gfs;
      self.emit('connection', self.gfs, self.gfs.db);
    });
  } else {
    if ('then' in opts.gfs) {
      promise = opts.gfs;
      promise.then(onFullfill, onReject);
    } else {
      self.gfs = opts.gfs;
      self.emit('connection', self.gfs, self.gfs.db);
    }
  }
};

/**
 * Logs messages or errors
 * Use the console if enabled or the passed function in the constructor `log` option
 * @function _logMessage
 * @instance
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {object | string | Error} log - The object or error to log
 * @param {boolean} error - If true logs the message as an error
 *
 * */
GridFSStorage.prototype._logMessage = function _logMessage(log, error) {
  var method = error ? 'error' : 'log';

  function logConsole() {
    /*eslint-disable no-console */
    console[method](log.message, log.extra);
    /*eslint-enable no-console */
  }

  var logFn = this._log === true ? logConsole : this._log;

  if (logFn) {
    if (error) {
      return logFn(log, null);
    }
    logFn(null, log);
  }
};

/**
 * Logs errors only. Uses `_logMessage` under the hood.
 * @function _logError
 * @instance
 * @memberOf module:multer-gridfs-storage/gridfs~GridFSStorage
 * @param {string | Error} err - The error to log
 *
 * */
GridFSStorage.prototype._logError = function (err) {
  this._logMessage(err, true);
};

module.exports = GridFSStorage;
