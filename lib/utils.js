/**
 *
 * Utility functions
 * @module multer-gridfs-storage/utils
 *
 * */
'use strict';

var crypto = require('crypto');
var Grid = require('gridfs-stream');

function builtinTag(target) {
  return Object.prototype.toString.call(target);
}


/**
 * Test a value to see if is a Promise
 * @function isPromise
 * @static
 * @param {object} target - The object to be tested
 * @since 1.1.0
 * @returns {boolean} Returns true if the target parameter is a thenable (Promsie)
 * */
function isPromise(target) {
  // Promise A+ spec - 1.1
  // promise is an object or function with a then method
  return (typeof target === 'object' || isFunction(target)) && 'then' in target;
}

/**
 * Test a value to see if is a Promise or a Grid instance
 * @function isGfsOrPromise
 * @static
 * @param {object} target - The object to be tested
 * @since 1.1.0
 * @returns {boolean} Returns true if the target parameter is a promise or an instance of gridfs-stream
 * */
function isGfsOrPromise(target) {
  return target instanceof Grid || isPromise(target);
}

/**
 * Test a value to see if is a function or a generator function
 * @function isFuncOrGeneratorFunc
 * @static
 * @param {object} target - The object to be tested
 * @since 1.1.0
 * @returns {boolean} Returns true if the target parameter is a promise or an instance of gridfs-stream
 * */
function isFuncOrGeneratorFunc(target) {
  return isFunction(target) || isGeneratorFunction(target);
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
  return target !== null && mayBeFunc && builtinTag(target) === '[object Function]';
}

/**
 * Checks if a value is a generator function
 * @function isGeneratorFunction
 * @static
 * @param {any} target - The value to test
 * @since 1.2.0
 * */
function isGeneratorFunction(target) {
  return builtinTag(target) === '[object GeneratorFunction]';
}

/**
 * Checks if a value is a generator
 * @function isGenerator
 * @static
 * @param {any} target - The value to test
 * @since 1.2.0
 * */
function isGenerator(target) {
  if (target === null || target === undefined) {
    return false;
  }
  return builtinTag(target) === '[object Generator]';
  
  /* Since this module only accepts generator functions as input (and not generator objects) we can safely disable the other checks
  
  var isGen = objClass(target) === '[object Generator]';
  if (isGen) {
    return true;
  }
  var isSymbolSupported = !!global.Symbol;
  if (isSymbolSupported) {
    var iteratorProp = target[Symbol.iterator];
    var isIterable = isFunction(iteratorProp) && iteratorProp.length === 0;
    if (!isIterable) {
      return false;
    }
    // In some implementations if called as iteratorProp() throws an error because `this` is undefined
    var iterator = target[Symbol.iterator]();
    // Make sure is a well-formed iterable
    // The spec says `next` is "suposed" to be called without arguments but they might receive some
    // Doesn't specify how many
    // Eg:
    // generator.next(value);
    // ...Inside the generator
    // var parameter = yield nextValue; // parameter === value
    return iterator !== null && iterator !== undefined && isFunction(iterator.next);
  }
  return false;
  */
}

/**
 * Input validation function
 * Checks the properties of the configuration object to see if they match their intended type and throw useful error messages
 * to help debugging
 * @function validateOptions
 * @static
 * @param {object} opts - The options passed to the constructor
 * @since 1.1.0
 *
 * @todo Use joi or similar to validate input
 * @todo Reduce ciclomatic complexity
 * */
function validateOptions(opts) {
  var i, prop, fnOpts, type, value, gen, matchTypes;
  
  if (!opts || typeof opts !== 'object' || !('url' in opts) && !('gfs' in opts)) {
    throw new Error('Missing required configuration');
  }
  
  if ('gfs' in opts) {
    if (!isGfsOrPromise(opts.gfs)) {
      throw new Error('Expected gfs configuration to be a Grid instance or a promise');
    }
  }
  
  if ('logLevel' in opts && opts.logLevel !== 'file' && opts.logLevel !== 'all') {
    throw new Error('Invalid log level configuration. Must be either "file" or "all"');
  }
  
  fnOpts = ['identifier', 'filename', 'metadata'];
  
  for (i = 0; i < fnOpts.length; i++) {
    prop = fnOpts[i];
    value = opts[prop];
    if (prop in opts && !isFuncOrGeneratorFunc(value)) {
      throw new Error('Expected ' + prop + ' configuration to be a function or a generator function');
    }
  }
  
  var valueOrFnOpts = [{
    prop: 'chunkSize',
    gen: true,
    type: Number
  }, {
    prop: 'root',
    gen: true,
    type: String
  }, {
    prop: 'log',
    type: Boolean
  }];
  
  for (i = 0; i < valueOrFnOpts.length; i++) {
    prop = valueOrFnOpts[i].prop;
    type = valueOrFnOpts[i].type;
    gen = valueOrFnOpts[i].gen;
    value = opts[prop];
    if (prop in opts) {
      matchTypes = type(value) === value || value instanceof type;
      if (gen) {
        if (!isFuncOrGeneratorFunc(value) && !matchTypes) {
          throw new Error('Expected ' + prop + ' configuration to be a function, a generator function or a ' + type.name);
        }
      } else {
        if (!isFunction(value) && !matchTypes) {
          throw new Error('Expected ' + prop + ' configuration to be a function or a ' + type.name);
        }
      }
    }
  }
}

module.exports = {
  getFilename: getFileName,
  generateValue: generateValue,
  noop: noop,
  isFunction: isFunction,
  isPromise: isPromise,
  isGeneratorFunction: isGeneratorFunction,
  isFuncOrGeneratorFunc: isFuncOrGeneratorFunc,
  isGenerator: isGenerator,
  isGfsOrPromise: isGfsOrPromise,
  validateOptions: validateOptions
};

