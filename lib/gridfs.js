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
  var self = this;
  
  if (!(self instanceof GridFSStorage)) {
    return new GridFSStorage(opts);
  }
  
  EventEmitter.call(self);
  
  __.validateOptions(opts);
  
  self.gfs = null;
  self._log = opts.log || false;
  self._logLevel = opts.logLevel || 'file';
  self._getIdentifier = opts.identifier || __.noop;
  self._getFilename = opts.filename || __.getFilename;
  self._getMetadata = opts.metadata || __.noop;
  if (opts.chunkSize && __.isFuncOrGeneratorFunc(opts.chunkSize)) {
    self._getChunkSize = opts.chunkSize;
  } else {
    self._getChunkSize = __.generateValue(opts.chunkSize ? opts.chunkSize : 261120);
  }
  
  if (opts.root) {
    if (__.isFuncOrGeneratorFunc(opts.root)) {
      self._getRoot = opts.root;
    } else {
      self._getRoot = __.generateValue(opts.root);
    }
  } else {
    self._getRoot = __.noop;
  }
  
  if (!opts.gfs) {
    mongo.MongoClient.connect(opts.url, function (err, db) {
      var gfs;
      if (err) {
        throw err;
      }
      
      function errEvent(err) {
        self._logMessage(err, true);
      }
      
      gfs = new Grid(db, mongo);
      if (self._logLevel === 'all') {
        self._logMessage({ message: 'MongoDb connected in url ' + opts.url, extra: db });
        
        db.on('close', function () {
          self._logMessage('Disconnected from MongoDb database', true);
        });
        
        db.on('error', errEvent).on('parseError', errEvent).on('timeout', errEvent);
      }
      self.gfs = gfs;
      self.emit('connection', self.gfs, self.gfs.db);
    });
  } else {
    if ('then' in opts.gfs) {
      var promise = opts.gfs;
      
      promise
        .then(function (gfs) {
          self.gfs = gfs;
          self.emit('connection', self.gfs, self.gfs.db);
        })
        .catch(function (err) {
          self._logMessage(err, true);
          // re-throw the error to allow it to reach user defined catch clauses
          throw err;
        });
    } else {
      self.gfs = opts.gfs;
      self.emit('connection', self.gfs, self.gfs.db);
    }
  }
}

/**
 * Event emmited when the Storage is instantiated with the `url` option
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#connection
 * @param {Grid} gfs - The created gfs instance
 * @param {MongoDb} db - The MongoDb database used to create the grid instance
 *
 */

/**
 * Event emmited when a new file is uploaded
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#file
 * @param {File} file - The uploaded file
 *
 */

util.inherits(GridFSStorage, EventEmitter);

GridFSStorage.prototype._handleFile = function _handleFile(req, file, cb) {
  var self = this;
  var streamOpts = { content_type: file.mimetype };
  self._generate('_getChunkSize', req, file, function (err, chunkSize) {
    if (err) {
      return cb(err);
    }
    streamOpts.chunkSize = chunkSize;
    self._generate('_getRoot', req, file, function (err, root) {
      if (err) {
        return cb(err);
      }
      streamOpts.root = root;
      self._generate('_getIdentifier', req, file, function (err, id) {
        if (err) {
          return cb(err);
        }
        if (id) {
          streamOpts._id = id;
        }
        
        self._generate('_getFilename', req, file, function (err, filename) {
          if (err) {
            return cb(err);
          }
          streamOpts.filename = filename;
          self._generate('_getMetadata', req, file, function (err, metadata) {
            if (err) {
              return cb(err);
            }
            streamOpts.metadata = metadata;
            
            var writestream = self.gfs.createWriteStream(streamOpts);
            
            file.stream.pipe(writestream);
            writestream.on('error', cb);
            
            writestream.on('close', function (f) {
              self.emit('file', f);
              self._logMessage({ message: 'Saved file', extra: f });
              cb(null, {
                filename: filename,
                metadata: metadata,
                id: f._id,
                grid: f,
                size: f.length
              });
            });
          });
        });
      });
    });
  });
};

GridFSStorage.prototype._removeFile = function _removeFile(req, file, cb) {
  var self = this;
  if (file.grid) {
    self.gfs.remove({ _id: file.id }, function (err) {
      if (err) {
        cb(err);
      }
      self._logMessage({ message: 'Deleted file ', extra: file });
      
      cb(null);
    });
  } else {
    cb(null);
  }
};

GridFSStorage.prototype._generate = function _generate(method, req, file, cb) {
  var result, generator;
  if (__.isGeneratorFunction(this[method])) {
    try {
      generator = this[method](req, file);
      // Should we store a reference?
      this[method + 'Ref'] = this[method];
      this[method] = generator;
      result = generator.next();
      cb(null, result.value);
    } catch (e) {
      cb(e, null);
    }
  } else if (__.isGenerator(this[method])) {
    try {
      generator = this[method];
      result = generator.next({ req: req, file: file });
      cb(null, result.value);
    } catch (e) {
      cb(e, null);
    }
  } else {
    // TODO: Add promise support?
    this[method](req, file, cb);
  }
};

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

module.exports = GridFSStorage;
