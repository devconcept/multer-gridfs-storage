/**
 * Utility functions
 * @module multer-gridfs-storage/utils
 */
import { Db } from 'mongodb';
import { ComparatorResult } from './types';
export declare function shouldListenOnDb(v?: string): boolean;
/**
 * Compare two objects by value.
 *
 * This function is designed taking into account how mongodb connection parsing routines work.
 * @param object1 The target object to compare
 * @param object2 The second object to compare with the first
 * @return Return true if both objects are equal by value
 */
export declare function compare(object1: any, object2: any): boolean;
/**
 * Compare arrays by reference unless the values are strings or buffers
 * @param array1 The source array to compare
 * @param array2 The target array to compare with
 * @return Returns true if both arrays are equivalent
 */
export declare function compareArrays(array1: any[], array2: any[]): boolean;
/**
 * Indicates how objects should be compared.
 * @param object1 The source object to compare
 * @param object2 The target object to compare with
 * @return Always returns 'identity' unless both objects have the same type and they are plain objects, arrays
 * or buffers
 */
export declare function compareBy(object1: any, object2: any): ComparatorResult;
/**
 * Return true if the object has at least one property inherited or not
 * @param object The object to inspect
 * @return If the object has any properties or not
 */
export declare function hasKeys(object: any): boolean;
/**
 * Compare two parsed uris checking if they are equivalent
 * @param {*} uri1 The source parsed uri
 * @param {*} uri2 The target parsed uri to compare
 * @return {boolean} Return true if both uris are equivalent
 */
export declare function compareUris(uri1: any, uri2: any): boolean;
/**
 * Checks if an object is a mongoose instance, a connection or a mongo Db object
 * @param {*} object The object to check
 * @return The database object
 */
export declare function getDatabase(object: any): Db;
