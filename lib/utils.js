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
 * Returns the ES6 built-in tag of the tested value (The internal [[Class]] slot in ES5)
 * @function builtinTag
 * @inner
 * @param {object} target - The object to be tested
 * @since 1.1.0
 * @returns {string} The built in tag of the target
 *
 * */
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
 *
 * */
function isPromise(target) {
  // Promise A+ spec - 1.1
  // "Promise is an object or function with a then method"
  // The spec also specifies that it must conform to a certain behavior but this is impossible to check by just inspecting the target
  // So we can only check if is a valid thenable
  return target !== null && (typeof target === 'object' || isFunction(target)) && isFunction(target.then);
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
 * @returns {boolean} Returns true if the target parameter is a function or a generator function
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
 * Test a value to see if is a plain function
 * Return false for proxies, generator functions and async functions
 * @function isFunction
 * @static
 * @param {any} target - The value to test
 * @returns {boolean} Returns true if the target parameter is a function
 * @since 1.1.0
 * */
function isFunction(target) {
  // taken from: lodash - isFunction method
  // https://github.com/lodash/lodash/blob/master/isFunction.js
  // lodash also returns true for Proxy, async and generator functions which is not the desired behavior in this case
  var type = typeof target;
  var mayBeFunc = (type === 'object' || type === 'function');
  return target !== null && mayBeFunc && builtinTag(target) === '[object Function]';
}


/**
 * Test a value to see if is a plain object
 * Return false for any "object" like value that is not created with an Object or null prototype
 * @function isObject
 * @static
 * @param {any} target - The value to test
 * @returns {boolean} Returns true if the target parameter is an object
 * @since 1.2.0
 * */
function isObject(target) {
  // taken from: lodash - isPlainObject method
  // https://github.com/lodash/lodash/blob/master/isPlainObject.js
  // avoid having an extra dependency
  var notAnObject, proto, toStr, Ctor;
  notAnObject = target === null || typeof target !== 'object' || builtinTag(target) !== '[object Object]';
  if (notAnObject) {
    return false;
  }
  proto = Object.getPrototypeOf(target);
  // true for Object.create(null);
  if (proto === null) {
    return true;
  }
  toStr = Function.prototype.toString;
  Ctor = Object.prototype.hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return proto.hasOwnProperty('constructor') && typeof Ctor === 'function' &&
    Ctor instanceof Ctor && toStr.call(Object) === toStr.call(proto.constructor);
}

/**
 * Test an object to see if it has all of the given properties
 * @function hasProps
 * @static
 * @param {any} target - The value to test
 * @param {array} props - An array of property names that should be present in the target
 * @returns {boolean} Return false if any of the properties is missing
 * @since 1.2.0
 * */
function hasProps(target, props) {
  var prop, i;
  var valid = false;
  if (typeof props === 'string') {
    valid = props in target;
  } else {
    for (i = 0; i < props.length; i++) {
      prop = props[i];
      if (prop in target) {
        valid = true;
        break;
      }
    }
  }
  return valid;
}

/**
 * Checks if a value is a generator function
 * @function isGeneratorFunction
 * @static
 * @param {any} target - The value to test
 * @returns {boolean} Return true if the target is a generator function
 * @since 1.2.0
 * @todo Support polyfills which are plain functions that returns a generator like object
 * */
function isGeneratorFunction(target) {
  return builtinTag(target) === '[object GeneratorFunction]';
}

/**
 * Checks if a value is a generator
 * @function isGenerator
 * @static
 * @param {any} target - The value to test
 * @returns {boolean} Return true only if the target is a generator created as the result of invoking a generator function
 * @since 1.2.0
 * @todo Support polyfills
 * */
function isGenerator(target) {
  if (target === null || target === undefined) {
    return false;
  }
  return builtinTag(target) === '[object Generator]';

  /*
  // Since this module only accepts generator functions as input (and not generator objects) we can safely disable the other checks
  // These might be required for polyfills
  var isGen = builtinTag(target) === '[object Generator]';
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
    // The Iterator spec says `next` is "suposed" to be called without arguments but they might receive some
    // Doesn't specify how many
    // The generator spec specifies at most one
    // Eg:
    // generator.next(value);
    // ...Inside the generator
    // var parameter = yield nextValue; // parameter === value
    return iterator !== null && iterator !== undefined && isFunction(iterator.next) && isFunction(iterator.return) && isFunction(iterator.throw);
  }
  return false;
  */
}

/**
 * Checks a value to see if has a given type
 * @function matchType
 * @static
 * @param {any} value - The value to test
 * @param {Function} type - The constructor function that defines the type
 * @returns {boolean} Return true if the target is an instance of the given type or if is a primitive value from a given type
 * @since 1.2.0
 *
 * */
function matchType(value, type) {
  return value instanceof type || type(value) === value;
}

/**
 * Checks a value to see if it belong to a given set of values
 * @function hasValue
 * @static
 * @param {any} target - The value to compare
 * @param {array} set - An array consisting of values to compare
 * @returns {boolean} Return true if the target is one of the items of the set
 * @since 1.2.0
 *
 * */
function hasValue(target, set) {
  return set.indexOf(target) !== -1;
}

/**
 * A function to check if value applied to a validation rule is valid or not
 * @function checkRule
 * @static
 * @param {object} target - The object to test for validity
 * @param {object} rule - The rule to check
 * @param {string|null} rule.prop - If null the rule is applied to the target object otherwise is applied to the specified property
 * @param {array} rule.validations - An array of validations to execute
 * @param {string} rule.error - The error message to throw in case validation fails
 * @param {string} rule.condition - The logical operation to use when checking. It defaults to `and`
 * @returns {boolean} Return true if target passes the validation rule, false otherwise
 * @since 1.2.0
 *
 * */
function checkRule(target, rule) {
  var i, validation, args;
  var source = rule.prop ? target[rule.prop] : target;
  var result;
  var isAnd = !rule.condition || rule.condition !== 'or';
  var isValid = true;

  if (source !== undefined) {
    isValid = isAnd === true;
    for (i = 0; i < rule.validations.length; i++) {
      validation = rule.validations[i];
      args = [source];

      if (validation.args) {
        args.push(validation.args);
      }

      result = validation.check.apply(null, args);
      if (isAnd) {
        if (!result) {
          isValid = false;
          break;
        }
      } else {
        if (result) {
          isValid = true;
          break;
        }
      }
    }
  }
  return isValid;
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
 * */
function validateOptions(opts) {
  var i, failed, error;
  var errorRegexp = /%prop%/;

  var rules = [
    {
      prop: null,
      validations: [
        {check: isObject},
        {check: hasProps, args: ['url', 'gfs']}
      ],
      error: 'Missing required configuration'
    },
    {
      prop: 'gfs',
      validations: [
        {check: isGfsOrPromise}
      ],
      error: 'Expected gfs configuration to be a Grid instance or a promise'
    },
    {
      prop: 'logLevel',
      validations: [
        {check: hasValue, args: ['file', 'all']}
      ],
      error: 'Invalid log level configuration. Must be either "file" or "all"'
    },
    {
      prop: 'identifier',
      validations: [
        {check: isFuncOrGeneratorFunc}
      ],
      error: 'Expected %prop% configuration to be a function or a generator function'
    },
    {
      prop: 'filename',
      validations: [
        {check: isFuncOrGeneratorFunc}
      ], error: 'Expected %prop% configuration to be a function or a generator function'
    },
    {
      prop: 'metadata',
      validations: [
        {check: isFuncOrGeneratorFunc}
      ],
      error: 'Expected %prop% configuration to be a function or a generator function'
    },
    {
      prop: 'chunkSize',
      validations: [
        {check: isFuncOrGeneratorFunc},
        {check: matchType, args: Number}
      ],
      condition: 'or',
      error: 'Expected %prop% configuration to be a function, a generator function or a Number'
    },
    {
      prop: 'root',
      validations: [
        {check: isFuncOrGeneratorFunc},
        {check: matchType, args: String}
      ],
      condition: 'or',
      error: 'Expected %prop% configuration to be a function, a generator function or a String'
    },
    {
      prop: 'log',
      validations: [
        {check: isFunction},
        {check: matchType, args: Boolean}
      ],
      condition: 'or',
      error: 'Expected %prop% configuration to be a function or a Boolean'
    }
  ];

  for (i = 0; i < rules.length; i++) {
    if (!checkRule(opts, rules[i])) {
      failed = rules[i];
      break;
    }
  }
  if (failed) {
    error = failed.error;
    if (errorRegexp.test(failed.error)) {
      error = error.replace(errorRegexp, failed.prop);
    }
    throw new Error(error);
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
  isObject: isObject,
  validateOptions: validateOptions,
  hasValue: hasValue,
  hasProps: hasProps,
  checkRule: checkRule,
  matchType: matchType
};

