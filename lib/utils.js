'use strict';

var crypto = require('crypto');
var Grid = require('gridfs-stream');

function getFileName(req, file, cb) {
  crypto.pseudoRandomBytes(16, function (err, raw) {
    cb(err, err ? undefined : raw.toString('hex'));
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
  var mayBeFunc = (type == 'object' || type == 'function');
  var objClass = Object.prototype.toString.call(target);
  return target !== null && mayBeFunc && objClass == '[object Function]';
}

function logMessage(instance, message, error) {
  var method = error ? 'error' : 'log';
  /*eslint-disable no-console */
  var logFn = instance._log === true ? console[method] : instance._log;
  /*eslint-enable no-console */
  
  if (logFn) {
    if (error) {
      return logFn(message, null);
    }
    logFn(null, message);
  }
}

function validateOptions(opts) {
  var i, prop, fnOpts, type;
  
  if (!opts || (!('url' in opts) && !('gfs' in opts))) {
    throw  new Error('Missing required configuration');
  }
  
  var typeOpts = [{prop: 'gfs', type: Grid}];
  
  for (i = 0; i < typeOpts.length; i++) {
    prop = typeOpts[i].prop;
    type = typeOpts[i].type;
    if (prop in opts && !(opts[prop] instanceof type)) {
      throw new Error('Expected ' + prop + ' configuration to be a ' + type.name + ' instance');
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

