/**
 *
 * Utility functions
 * @module multer-gridfs-storage/utils
 *
 * */
'use strict';

var crypto = require('crypto');
var Grid = require('gridfs-stream');

/**
 * Test a value to see if is a Promise or a Grid instance
 * @function isGfsOrPromise
 * @static
 * @param {object} target - The object to be tested
 * @since 1.1.0
 * @returns {boolean} Returns true if the target parameter is a promise or an instance of gridfs-stream
 * */

function isGfsOrPromise(target) {
  return target instanceof Grid || ((typeof target === 'object' || isFunction(target)) && 'then' in target);
}

/**
 * Generates a random string to use as the filename
 * @function getFileName
 * @static
 * @param {Request} req - A reference to the request object
 * @param {File} file - A reference to the file being uploaded
 * @param {Function} cb - A callback function to return the name used
 * @since 1.1.0
 * */

function getFileName(req, file, cb) {
  var randomBytes = crypto.randomBytes || crypto.pseudoRandomBytes;
  
  randomBytes(16, function (err, buffer) {
    cb(err, err ? null : buffer.toString('hex'));
  });
}

/**
 * Generate any fixed value using a callback
 * @function generateValue
 * @static
 * @param {any} value - A function to generate callbacks that invokes with a given value
 * @since 1.1.0
 * */

function generateValue(value) {
  return function getValue(req, file, cb) {
    cb(null, value);
  };
}

/**
 * Generates a null value using a callback
 * @function noop
 * @static
 * @param {Request} req - A reference to the request object
 * @param {File} file - A reference to the file being uploaded
 * @param {Function} cb - A callback function to return the name used
 * @since 1.1.0
 * */
function noop(req, file, cb) {
  cb(null, null);
}

/**
 * Test a value to see if is a function
 * @function isFunction
 * @static
 * @param {any} target - The value to test
 * @returns {boolean} Returns true if the target parameter is a function
 * @since 1.1.0
 * */
function isFunction(target) {
  var type = typeof target;
  var mayBeFunc = (type === 'object' || type === 'function');
  var objClass = Object.prototype.toString.call(target);
  return target !== null && mayBeFunc && objClass === '[object Function]';
}

/**
 * Checks instance configuration and logs messages
 * @function logMessage
 * @static
 * @param {GridFSStorage} instance - The current instance
 * @param {object} log - The message to log
 * @param {boolean} error - True if the message is an error
 * @since 1.1.0
 * */
function logMessage(instance, log, error) {
  var method = error ? 'error' : 'log';
  
  function logConsole() {
    /*eslint-disable no-console */
    console[method](log.message, log.extra);
    /*eslint-enable no-console */
  }
  
  var logFn = instance._log === true ? logConsole : instance._log;
  
  if (logFn) {
    if (error) {
      return logFn(log, null);
    }
    logFn(null, log);
  }
}

/**
 * Input validation function
 * @function validateOptions
 * @static
 * @param {object} opts - The options passed to the constructor
 * @since 1.1.0
 * */
// TODO: Use joi or similar module to validate input
function validateOptions(opts) {
  var i, prop, fnOpts, type;
  
  if (!opts || (!('url' in opts) && !('gfs' in opts))) {
    throw  new Error('Missing required configuration');
  }
  
  if ('gfs' in opts) {
    if (!isGfsOrPromise(opts.gfs)) {
      throw new Error('Expected gfs configuration to be a Grid instance or a promise');
    }
  }
  
  if ('logLevel' in opts && !(opts.logLevel === 'file' || opts.logLevel === 'all')) {
    throw new Error('Invalid log level configuration. Must be either "file" or "all"');
  }
  
  fnOpts = ['identifier', 'filename', 'metadata'];
  
  for (i = 0; i < fnOpts.length; i++) {
    prop = fnOpts[i];
    if (prop in opts && !isFunction(opts[prop])) {
      throw new Error('Expected ' + prop + ' configuration to be a function');
    }
  }
  
  var valueOrFnOpts = [{ prop: 'chunkSize', type: Number }, { prop: 'root', type: String }, { prop: 'log', type: Boolean }];
  
  for (i = 0; i < valueOrFnOpts.length; i++) {
    prop = valueOrFnOpts[i].prop;
    type = valueOrFnOpts[i].type;
    if (prop in opts && !isFunction(opts[prop]) && type(opts[prop]) !== opts[prop] && !(opts[prop] instanceof type)) {
      throw new Error('Expected ' + prop + ' configuration to be a function or a ' + type.name);
    }
  }
}

module.exports = {
  getFilename: getFileName,
  generateValue: generateValue,
  noop: noop,
  isFunction: isFunction,
  logMessage: logMessage,
  validateOptions: validateOptions
};

