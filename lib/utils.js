/**
 *
 * Utility functions
 * @module multer-gridfs-storage/utils
 *
 */
'use strict';

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
  var index, nextSource, nextKey, to, hasOwn;

  if (target === null || target === undefined) { // TypeError if undefined or null
    throw new TypeError('Cannot convert undefined or null to object');
  }

  to = Object(target);
  hasOwn = Object.prototype.hasOwnProperty;

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
 * Transverse an object properties filtering all property names not included in the whitelist
 * @param obj {object} The object to check
 * @param whitelist {Array} An array with the property names that are considered valid
 * @return {Array} The property names that were found and are considered valid
 */
function filterKeys(obj, whitelist) {
  var prop, keys = [];
  for (prop in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, prop) && (!whitelist || whitelist.indexOf(prop) !== -1)) {
      keys.push(prop);
    }
  }
  return keys;
}

/**
 * Compare two objects by value
 * @param {any} obj1 The target object to compare
 * @param {any} obj2 The second object to compare with the first
 * @param {Array} [keys] Array of property names that should be included in the comparison
 * @return {boolean} Return true if both objects are equal by value
 */
function compare(obj1, obj2, keys) {
  var keys1, keys2, i, current;

  if (obj1 === obj2) {
    return true;
  }

  if (!obj1 || !obj2) {
    if (!obj1 && !obj2) {
      return true;
    }
    keys1 = obj1 ? filterKeys(obj1, keys) : filterKeys(obj2, keys);
    return keys1.length === 0;
  }

  keys1 = filterKeys(obj1, keys);
  keys2 = filterKeys(obj2, keys);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for(i = 0; i < keys1.length; i++) {
    current = keys1[i];
    if (!obj2.hasOwnProperty(current) || obj1[current] !== obj2[current]) {
      return false;
    }
  }

  return true;
}


module.exports = exports = {
  isOldNode: isOldNode,
  assign: assign,
  compare: compare,
  filterKeys: filterKeys,
};
