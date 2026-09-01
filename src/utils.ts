/**
 * Utility functions
 * @module multer-gridfs-storage/utils
 */

import isPlainObject from 'lodash.isplainobject';
import { Db } from 'mongodb';
import { ConnectionString } from 'mongodb-connection-string-url';

import { ComparatorResult, MongooseConnectionInstance, MongooseInstance } from './types/index.js';

/**
 * Return true if the given value is a thenable/promise.
 * @param value The value to inspect
 * @return Whether the value is a promise
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
	return Boolean(value) && (typeof value === 'object' || typeof value === 'function') && typeof (value as { then?: unknown }).then === 'function';
}

/**
 * Creates a gate that runs the first callback it receives and silently ignores every call after that.
 *
 * Useful when several independent listeners can each try to settle the same outcome (e.g. a promise
 * that can be resolved or rejected by more than one stream event) and only the first one should count.
 * @return A function that invokes its argument only the first time it is called
 */
export function createOnceGuard(): (fn: () => void) => void {
	let triggered = false;
	return (fn: () => void) => {
		if (triggered) {
			return;
		}

		triggered = true;
		fn();
	};
}

/**
 * Shape of the parts of a GridFSBucketWriteStream that {@link abortIncompleteUpload} needs. Kept
 * minimal (rather than importing the driver's own type) so it can be exercised with lightweight
 * test doubles instead of a real database connection.
 */
export interface AbortableWriteStream {
	state?: {
		streamEnd: boolean;
		aborted: boolean;
	};
	abort?: () => Promise<void>;
}

/**
 * Best-effort cleanup for a GridFS upload that failed before it finished.
 *
 * The driver only deletes chunks already written to GridFS when abort() is called explicitly; a
 * plain stream destroy leaves them orphaned. Does nothing if the stream already finished or was
 * already aborted (abort() throws in both cases), or if it isn't shaped like a real
 * GridFSBucketWriteStream at all - a caller may hand it a test double or another kind of writable
 * that has no state/abort of its own. Any rejection from abort() itself is swallowed: cleanup is a
 * courtesy, not something the caller's own error should depend on.
 * @param writeStream The write stream to abort if it is still in-flight
 */
export function abortIncompleteUpload(writeStream: AbortableWriteStream): void {
	if (writeStream.state && !writeStream.state.streamEnd && !writeStream.state.aborted && typeof writeStream.abort === 'function') {
		writeStream.abort().catch(() => {
			// Best-effort cleanup: the caller's own error is what the consumer sees either way.
		});
	}
}

/**
 * Compare two objects by value.
 *
 * This function is designed taking into account how mongodb connection parsing routines work.
 * @param object1 The target object to compare
 * @param object2 The second object to compare with the first
 * @return Return true if both objects are equal by value
 */
export function compare(object1: unknown, object2: unknown): boolean {
	let prop: string;
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

		return !(object1 ? hasKeys(object1 as object) : hasKeys(object2 as object));
	}

	// Both values are truthy here; index them as records to walk their properties.
	const record1 = object1 as Record<string, unknown>;
	const record2 = object2 as Record<string, unknown>;

	// Check both own and inherited properties, MongoDb doesn't care where the property was defined
	for (prop in record1) {
		const value1 = record1[prop];
		const value2 = record2[prop];
		// If one object has one property not present in the other they are different
		if (prop in record2) {
			// The comparator narrows how each pair should be compared; the casts below are safe
			// because a branch is only entered when both values share that runtime type.
			switch (compareBy(value1, value2)) {
				case 'object':
					// If both values are plain objects recursively compare its properties
					if (!compare(value1, value2)) {
						return false;
					}

					break;
				case 'array':
					// If both values are arrays compare buffers and strings by content and every other value by identity
					if (!compareArrays(value1 as unknown[], value2 as unknown[])) {
						return false;
					}

					break;
				case 'buffer':
					// If both values are buffers compare them by content
					if (Buffer.compare(value1 as Buffer, value2 as Buffer) !== 0) {
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
		} else {
			return false;
		}
	}

	// Count all properties from the target object
	for (prop in record2) {
		keys2++;
	}

	// If the target object has more properties than source they are different
	return keys1 === keys2;
}

/**
 * Compare arrays by reference unless the values are strings or buffers
 * @param array1 The source array to compare
 * @param array2 The target array to compare with
 * @return Returns true if both arrays are equivalent
 */
export function compareArrays(array1: unknown[], array2: unknown[]): boolean {
	if (array1.length !== array2.length) {
		return false;
	}

	for (const [i, value1] of array1.entries()) {
		const value2 = array2[i];
		// Types other than string or buffers are compared by reference because MongoDb only accepts those two types
		// for configuration inside arrays
		if (compareBy(value1, value2) === 'buffer') {
			if (Buffer.compare(value1 as Buffer, value2 as Buffer) !== 0) {
				return false;
			}
		} else if (value1 !== value2) {
			return false;
		}
	}

	return true;
}

/**
 * Indicates how objects should be compared.
 * @param object1 The source object to compare
 * @param object2 The target object to compare with
 * @return Always returns 'identity' unless both objects have the same type and they are plain objects, arrays
 * or buffers
 */
export function compareBy(object1: unknown, object2: unknown): ComparatorResult {
	if (isPlainObject(object1) && isPlainObject(object2)) {
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

/**
 * Return true if the object has at least one property inherited or not
 * @param obj The object to inspect
 * @return If the object has any properties or not
 */
export function hasKeys(obj: object): boolean {
	for (const prop in obj) {
		// Stop testing if the object has at least one property
		return true;
	}

	return false;
}

/**
 * Compare two parsed uris checking if they are equivalent
 * @param {*} uri1 The source parsed uri
 * @param {*} uri2 The target parsed uri to compare
 * @return {boolean} Return true if both uris are equivalent
 */
export function compareUris(uri1: ConnectionString, uri2: ConnectionString): boolean {
	// Compare properties that are string values
	const stringProps: Array<keyof ConnectionString> = ['protocol', 'username', 'password', 'pathname'];
	const diff = stringProps.find((prop) => uri1[prop] !== uri2[prop]);
	if (diff) {
		return false;
	}

	// Compare query parameters as a multiset of key/value pairs, regardless of order. Iterating the
	// entries (rather than Object.fromEntries) preserves parameters that legitimately repeat, such as
	// `readPreferenceTags`, which collapsing into an object would drop.
	const sortPairs = (params: Iterable<[string, string]>): Array<[string, string]> => [...params].sort(([k1, v1], [k2, v2]) => k1.localeCompare(k2) || v1.localeCompare(v2));
	const params1 = sortPairs(uri1.searchParams);
	const params2 = sortPairs(uri2.searchParams);
	if (params1.length !== params2.length || params1.some(([key, value], index) => key !== params2[index][0] || value !== params2[index][1])) {
		return false;
	}

	const hosts1 = uri1.hosts;
	const hosts2 = uri2.hosts;
	// Check if both uris have the same number of hosts
	if (hosts1.length !== hosts2.length) {
		return false;
	}

	// Check if every host in one array is present on the other array no matter where is positioned
	for (const host of hosts1) {
		if (!hosts2.includes(host)) {
			return false;
		}
	}

	return true;
}

/**
 * Checks if an object is a mongoose instance, a connection or a mongo Db object
 * @param {*} obj The object to check
 * @return The database object
 */
export function getDatabase(obj: MongooseConnectionInstance | MongooseInstance | Db): Db {
	// A db property means it is a mongoose connection instance.
	// Mongo 2 had a db property but it was a function. See issue #14
	if ('db' in obj && typeof obj.db !== 'function') {
		if (obj.db) {
			return obj.db;
		}

		// The db slot is present but empty: the connection has not opened yet, so there is no usable
		// database. Fail clearly here instead of returning a non-Db object that breaks later with a
		// confusing error.
		throw new Error('The provided database connection is not open yet (its `db` is not available)');
	}

	// If it has a connection property with a db property on it is a mongoose instance
	if ('connection' in obj && obj.connection?.db) {
		return obj.connection.db;
	}

	// If none of the above are true it should be a mongo database object
	return obj as Db;
}
