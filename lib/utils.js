'use strict';

var crypto = require('crypto');
var Grid = require('gridfs-stream');

function isGfsOrPromise(target) {
  return target instanceof Grid || ((typeof target === 'object' || isFunction(target)) && 'then' in target);
}

function getFileName(req, file, cb) {
  var randomBytes = crypto.randomBytes || crypto.pseudoRandomBytes;
  
  randomBytes(16, function (err, buffer) {
    cb(err, err ? null : buffer.toString('hex'));
  });
}

function generateValue(value) {
  return function getValue(req, file, cb) {
    cb(null, value);
  };
}

function noop(req, file, cb) {
  cb(null, null);
}

function isFunction(target) {
  var type = typeof target;
  var mayBeFunc = (type === 'object' || type === 'function');
  var objClass = Object.prototype.toString.call(target);
  return target !== null && mayBeFunc && objClass === '[object Function]';
}

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
  
  var valueOrFnOpts = [{prop: 'chunkSize', type: Number}, {prop: 'root', type: String}, {prop: 'log', type: Boolean}];
  
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

