"use strict";
/**
 * Utility functions
 * @module multer-gridfs-storage/utils
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabase = exports.compareUris = exports.hasKeys = exports.compareBy = exports.compareArrays = exports.compare = exports.shouldListenOnDb = void 0;
const lodash_isplainobject_1 = __importDefault(require("lodash.isplainobject"));
const package_json_1 = require("mongodb/package.json");
function shouldListenOnDb(v = package_json_1.version) {
    const [major, minor, patch] = v.split('.').map((vn) => Number(vn));
    if (major === 3) {
        if (minor <= 5) {
            return true;
        }
        return minor === 6 && patch < 4;
    }
    return major < 4;
}
exports.shouldListenOnDb = shouldListenOnDb;
/**
 * Compare two objects by value.
 *
 * This function is designed taking into account how mongodb connection parsing routines work.
 * @param object1 The target object to compare
 * @param object2 The second object to compare with the first
 * @return Return true if both objects are equal by value
 */
function compare(object1, object2) {
    let prop;
    let comp;
    let value1;
    let value2;
    let keys1 = 0;
    let keys2 = 0;
    // If objects are equal by identity stop testing
    if (object1 === object2) {
        return true;
    }
    // Falsey and plain objects with no properties are equivalent
    if (!object1 || !object2) {
        if (!object1 && !object2) {
            return true;
        }
        return !(object1 ? hasKeys(object1) : hasKeys(object2));
    }
    // Check both own and inherited properties, MongoDb doesn't care where the property was defined
    /* eslint-disable-next-line guard-for-in */
    for (prop in object1) {
        value1 = object1[prop];
        value2 = object2[prop];
        // If one object has one property not present in the other they are different
        if (prop in object2) {
            comp = compareBy(value1, value2);
            switch (comp) {
                case 'object':
                    // If both values are plain objects recursively compare its properties
                    if (!compare(value1, value2)) {
                        return false;
                    }
                    break;
                case 'array':
                    // If both values are arrays compare buffers and strings by content and every other value by identity
                    if (!compareArrays(value1, value2)) {
                        return false;
                    }
                    break;
                case 'buffer':
                    // If both values are buffers compare them by content
                    if (Buffer.compare(value1, value2) !== 0) {
                        return false;
                    }
                    break;
                default:
                    // All other values are compared by identity
                    if (value1 !== value2) {
                        return false;
                    }
                    break;
            }
            keys1++;
        }
        else {
            return false;
        }
    }
    // Count all properties from the target object
    /* eslint-disable-next-line guard-for-in */
    for (prop in object2) {
        keys2++;
    }
    // If the target object has more properties than source they are different
    return keys1 === keys2;
}
exports.compare = compare;
/**
 * Compare arrays by reference unless the values are strings or buffers
 * @param array1 The source array to compare
 * @param array2 The target array to compare with
 * @return Returns true if both arrays are equivalent
 */
function compareArrays(array1, array2) {
    let value1;
    let value2;
    if (array1.length !== array2.length) {
        return false;
    }
    for (const [i, element] of array1.entries()) {
        value1 = element;
        value2 = array2[i];
        // Types other than string or buffers are compared by reference because MongoDb only accepts those two types
        // for configuration inside arrays
        if (compareBy(value1, value2) === 'buffer') {
            if (Buffer.compare(value1, value2) !== 0) {
                return false;
            }
        }
        else if (value1 !== value2) {
            return false;
        }
    }
    return true;
}
exports.compareArrays = compareArrays;
/**
 * Indicates how objects should be compared.
 * @param object1 The source object to compare
 * @param object2 The target object to compare with
 * @return Always returns 'identity' unless both objects have the same type and they are plain objects, arrays
 * or buffers
 */
function compareBy(object1, object2) {
    if (lodash_isplainobject_1.default(object1) && lodash_isplainobject_1.default(object2)) {
        return 'object';
    }
    if (Array.isArray(object1) && Array.isArray(object2)) {
        return 'array';
    }
    if (Buffer.isBuffer(object1) && Buffer.isBuffer(object2)) {
        return 'buffer';
    }
    // All values are compared by identity unless they are both arrays, buffers or plain objects
    return 'identity';
}
exports.compareBy = compareBy;
/**
 * Return true if the object has at least one property inherited or not
 * @param object The object to inspect
 * @return If the object has any properties or not
 */
function hasKeys(object) {
    /* eslint-disable-next-line guard-for-in, no-unreachable-loop */
    for (const prop in object) {
        // Stop testing if the object has at least one property
        return true;
    }
    return false;
}
exports.hasKeys = hasKeys;
/**
 * Compare two parsed uris checking if they are equivalent
 * @param {*} uri1 The source parsed uri
 * @param {*} uri2 The target parsed uri to compare
 * @return {boolean} Return true if both uris are equivalent
 */
function compareUris(uri1, uri2) {
    // Compare properties that are string values
    const stringProps = ['scheme', 'username', 'password', 'database'];
    const diff = stringProps.find((prop) => uri1[prop] !== uri2[prop]);
    if (diff) {
        return false;
    }
    // Compare query parameter values
    if (!compare(uri1.options, uri2.options)) {
        return false;
    }
    const hosts1 = uri1.hosts;
    const hosts2 = uri2.hosts;
    // Check if both uris have the same number of hosts
    if (hosts1.length !== hosts2.length) {
        return false;
    }
    // Check if every host in one array is present on the other array no matter where is positioned
    for (const hostObject of hosts1) {
        if (!hosts2.some((h) => h.host === hostObject.host && h.port === hostObject.port)) {
            return false;
        }
    }
    return true;
}
exports.compareUris = compareUris;
/**
 * Checks if an object is a mongoose instance, a connection or a mongo Db object
 * @param {*} object The object to check
 * @return The database object
 */
function getDatabase(object) {
    var _a;
    // If the object has a db property should be a mongoose connection instance
    // Mongo 2 has a db property but its a function. See issue #14
    if (object.db && typeof object.db !== 'function') {
        return object.db;
    }
    // If it has a connection property with a db property on it is a mongoose instance
    if ((_a = object === null || object === void 0 ? void 0 : object.connection) === null || _a === void 0 ? void 0 : _a.db) {
        return object.connection.db;
    }
    // If none of the above are true it should be a mongo database object
    return object;
}
exports.getDatabase = getDatabase;
//# sourceMappingURL=utils.js.map