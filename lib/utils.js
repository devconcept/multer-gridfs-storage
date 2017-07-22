/**
 *
 * Plugin definition
 * @module multer-gridfs-storage/utils
 *
 */
'use strict';

var crypto = require('crypto');

/**
 * Check is the node version is in the 0.x range
 * @function isOldNode
 * @return {boolean} - Returns true if the node major version number is zero
 *
 * */
function isOldNode() {
  var v = process.versions.node.split('.').map(Number);
  return v[0] === 0;
}

/**
 * Default file information generation function
 * @function getFile
 * @return {object} - Returns the default file configuration
 *
 * */
function getFile() {
  // On node versions up to 0.12 randomBytes could throw an error if there is no enough entropy in the system.
  // In those cases is preferable to use the deprecated pseudoRandomBytes function to preserve backwards compatibility
  // maintaining the same behaviour across node versions
  var randomBytes = isOldNode() ? crypto.pseudoRandomBytes : crypto.randomBytes;
  return new Promise(function (resolve, reject) {
    randomBytes(16, function (err, buffer) {
      if (err) {
        reject(err);
      } else {
        resolve({
          filename: buffer.toString('hex'),
          chunkSize: 261120,
          metadata: null
        });
      }
    });
  });
}

/**
 * Checks if an object is a generator
 * @function isGenerator
 * @param {object} value - The value to test
 * @return {boolean} - Returns true for objects that look like a generator
 * */
function isGenerator(value) {
  return value && typeof value.next === 'function' && typeof value.throw === 'function';
}

module.exports = exports = {
  isOldNode: isOldNode,
  isGenerator: isGenerator,
  getFile: getFile
};
