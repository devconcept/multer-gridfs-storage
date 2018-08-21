/**
 *
 * Utility functions
 * @module multer-gridfs-storage/utils
 *
 */
'use strict';
var isPlainObject = require('lodash.isplainobject');
var hasOwn = Object.prototype.hasOwnProperty;

/**
 * Check if the node version is in the 0.x range
 * @function isOldNode
 * @return {boolean} - Returns true if the node major version number is zero
 *
 **/
function isOldNode() {
  var v = process.versions.node.split('.').map(Number);
  return v[0] === 0;
}

/**
 * Object assign implementation for Node 0.x versions
 * @param target The object that will receive all copied properties
 * @param sources One or more source objects to copy properties from
 * @return {any} The target object
 */
function assign(target, sources) { // eslint-disable-line no-unused-vars
  var index, nextSource, nextKey, to;

  if (target === null || target === undefined) { // TypeError if undefined or null
    throw new TypeError('Cannot convert undefined or null to object');
  }

  to = Object(target);

  for (index = 1; index < arguments.length; index++) {
    nextSource = arguments[index];

    if (nextSource !== null && nextSource !== undefined) { // Skip over if undefined or null
      for (nextKey in nextSource) {
        // Avoid bugs when hasOwnProperty is shadowed
        if (hasOwn.call(nextSource, nextKey)) {
          to[nextKey] = nextSource[nextKey];
        }
      }
    }
  }
  return to;
}

/**
 * Compare two objects by value
 * @param {any} obj1 The target object to compare
 * @param {any} obj2 The second object to compare with the first
 * @return {boolean} Return true if both objects are equal by value
 */
function compare(obj1, obj2) {
  var prop, comp, val1, val2;
  var keys1 = 0, keys2 = 0;

  // If objects are equal by identity stop testing
  if (obj1 === obj2) {
    return true;
  }

  // Falsey and plain objects with no properties are equivalent
  if (!obj1 || !obj2) {
    if (!obj1 && !obj2) {
      return true;
    }
    return !(obj1 ? hasKeys(obj1) : hasKeys(obj2));
  }

  // Check both own and inherited properties, MongoDb doesn't care where the property was defined
  for (prop in obj1) {
    val1 = obj1[prop];
    val2 = obj2[prop];
    // If one object has one property not present in the other they are different
    if (prop in obj2) {
      comp = compareBy(val1, val2);
      switch (comp) {
      case 'object':
        if (!compare(val1, val2)) {
          return false;
        }
        break;
      case 'array':
        if (!compareArrays(val1, val2)) {
          return false;
        }
        break;
      case 'buffer':
        if (Buffer.compare(val1, val2) !== 0) {
          return false;
        }
        break;
      default:
        if (val1 !== val2) {
          return false;
        }
        break;
      }
      keys1++;
    } else {
      return false;
    }
  }

  for (prop in obj2) {
    keys2++;
  }

  return keys1 === keys2;
}

function compareArrays(arr1, arr2) {
  var val1, val2, i;
  if (arr1.length !== arr2.length) {
    return false;
  }
  for (i = 0; i < arr1.length; i++) {
    val1 = arr1[i];
    val2 = arr2[i];
    if (compareBy(val1, val2) === 'buffer') {
      if (Buffer.compare(val1, val2) !== 0) {
        return false;
      }
    } else if (val1 !== val2) {
      return false;
    }
  }
  return true;
}

function compareBy(obj1, obj2) {
  if (isPlainObject(obj1) && isPlainObject(obj2)) {
    return 'object';
  }
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    return 'array';
  }
  if (Buffer.isBuffer(obj1) && Buffer.isBuffer(obj2)) {
    return 'buffer';
  }
  return 'identity';
}

/**
 * Return true if the object has at least one property inherited or not
 * @param obj The object to inspect
 * @return {boolean} If the object has any properties or not
 */
function hasKeys(obj) {
  for (var prop in obj) { // eslint-disable-line no-unused-vars
    return true;
  }
  return false;
}


module.exports = exports = {
  isOldNode: isOldNode,
  assign: assign,
  compare: compare,
  hasKeys: hasKeys,
};
