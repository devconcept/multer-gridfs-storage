import { test, expect, describe } from 'vitest';
import ConnectionString from 'mongodb-connection-string-url';
import { Db } from 'mongodb';
import { abortIncompleteUpload, compare, compareArrays, compareBy, compareUris, createOnceGuard, getDatabase, hasKeys, isPromise } from '../src/utils';

describe('utils', () => {
	describe('compare', () => {
		test('considers equal any falsey values', () => {
			expect(compare(null, undefined)).toBe(true);
			expect(compare(undefined, null)).toBe(true);
		});

		test('considers equal objects with no keys and falsey values', () => {
			expect(compare(null, {})).toBe(true);
			expect(compare({}, null)).toBe(true);
			expect(compare({}, undefined)).toBe(true);
			expect(compare(undefined, {})).toBe(true);
			expect(compare({}, {})).toBe(true);
			expect(compare({}, Object.create(null))).toBe(true);
		});

		test('considers different objects with keys and falsey values', () => {
			expect(compare(null, { a: 1 })).toBe(false);
			expect(compare({ a: 1 }, null)).toBe(false);
			expect(compare({ a: 1 }, undefined)).toBe(false);
			expect(compare(undefined, { a: 1 })).toBe(false);
		});

		test('considers equal objects by reference', () => {
			const ob1 = { a: 1 };
			const ob2 = { b: 2 };
			expect(compare(ob1, ob1)).toBe(true);
			expect(compare(ob2, ob2)).toBe(true);
		});

		test('considers equal objects with same property values', () => {
			class Object_ {
				a = 1;
			}

			(Object_.prototype as any).b = 2;
			expect(compare({ a: 1 }, { a: 1 })).toBe(true);
			expect(compare({ a: 1, b: 2 }, new Object_())).toBe(true);
		});

		test('considers different objects with different keys values', () => {
			expect(compare({ a: 1 }, { b: 1 })).toBe(false);
			expect(compare({ c: 1 }, { d: 1 })).toBe(false);
			expect(compare({ c: 1 }, {})).toBe(false);
			expect(compare({}, { c: 1 })).toBe(false);
			expect(compare({ c: 1 }, { c: 1, d: 1 })).toBe(false);
		});

		test('considers different objects with different keys length', () => {
			expect(compare({ a: 1, b: 2 }, { a: 1 })).toBe(false);
		});

		test('includes deep properties when comparing', () => {
			expect(compare({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
			expect(compare({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
			expect(compare({ a: {} }, { a: {} })).toBe(true);
			expect(compare({ a: { b: {} } }, { a: { b: Object.create(null) } })).toBe(true);
		});

		test('includes arrays when comparing', () => {
			expect(compare({ a: { b: ['1', '2'] } }, { a: { b: ['1', '2'] } })).toBe(true);
			expect(compare({ a: { b: ['1', '2'] } }, { a: { b: ['2', '2'] } })).toBe(false);
			expect(compare({ a: { b: ['1'] } }, { a: { b: ['1', '1'] } })).toBe(false);
			expect(compare({ a: [] }, { a: [] })).toBe(true);
		});

		test('includes buffers when comparing', () => {
			expect(compare({ a: { b: Buffer.from([1, 2]) } }, { a: { b: Buffer.from([1, 2]) } })).toBe(true);
			expect(compare({ a: { b: Buffer.from([1, 2]) } }, { a: { b: Buffer.from([2, 2]) } })).toBe(false);
		});

		test('includes buffers inside arrays when comparing', () => {
			expect(compare({ a: { b: ['1', Buffer.from([1, 2])] } }, { a: { b: ['1', Buffer.from([1, 2])] } })).toBe(true);
			expect(compare({ a: { b: ['1', Buffer.from([1, 2])] } }, { a: { b: ['1', Buffer.from([2, 2])] } })).toBe(false);
		});
	});

	describe('hasKeys', () => {
		test('returns true when the object has at least one property', () => {
			expect(hasKeys({ a: 1 })).toBe(true);
		});

		test('returns false when the object has no properties', () => {
			expect(hasKeys({})).toBe(false);
			expect(hasKeys(new Object())).toBe(false);
		});
	});

	describe('compareArrays', () => {
		test('returns true when the arrays contains identical string or buffer values', () => {
			expect(compareArrays(['a', 'b'], ['a', 'b'])).toBe(true);
			expect(compareArrays([Buffer.from([1, 2]), 'b'], [Buffer.from([1, 2]), 'b'])).toBe(true);
		});

		test('returns false when the arrays contains different values or they are compared by reference', () => {
			expect(compareArrays(['a', 'b'], ['b', 'b'])).toBe(false);
			expect(compareArrays([undefined], [null])).toBe(false);
			expect(compareArrays([{ a: 1 }], [{ a: 1 }])).toBe(false);
		});
	});

	describe('compareBy', () => {
		test('returns identity when the objects have different types', () => {
			expect(compareBy(Buffer.from([1, 2]), ['a', 'b'])).toBe('identity');
		});

		test('returns the type of the objects when they have the same type', () => {
			expect(compareBy([], ['a', 'b'])).toBe('array');
			expect(compareBy(Buffer.from([1, 2]), Buffer.from('ab'))).toBe('buffer');
			expect(compareBy({}, { a: 1 })).toBe('object');
		});
	});

	describe('compareUris', () => {
		test('returns true for urls that contain the same hosts in different order', () => {
			expect(compareUris(new ConnectionString('mongodb://host1:1234,host2:5678/database'), new ConnectionString('mongodb://host2:5678,host1:1234/database'))).toBe(true);
		});

		test('returns false for urls with different parameters', () => {
			expect(compareUris(new ConnectionString('mongodb://host1:1234,host2:5678/database?authSource=admin'), new ConnectionString('mongodb://host2:5678,host1:1234/database'))).toBe(
				false,
			);
		});

		test('returns true for urls with the same parameters in different order', () => {
			expect(
				compareUris(
					new ConnectionString('mongodb://host1:1234/database?authSource=admin&connectTimeoutMS=300000'),
					new ConnectionString('mongodb://host1:1234/database?connectTimeoutMS=300000&authSource=admin'),
				),
			).toBe(true);
		});

		test('returns false for urls whose repeated parameters differ before the last value', () => {
			// A repeated key keeps every value: these differ (tags a,b vs c,b) even though the last value matches.
			expect(
				compareUris(
					new ConnectionString('mongodb://host1:1234/database?readPreferenceTags=a&readPreferenceTags=b'),
					new ConnectionString('mongodb://host1:1234/database?readPreferenceTags=c&readPreferenceTags=b'),
				),
			).toBe(false);
		});

		test('returns true for identical urls with repeated parameters', () => {
			expect(
				compareUris(
					new ConnectionString('mongodb://host1:1234/database?readPreferenceTags=a&readPreferenceTags=b'),
					new ConnectionString('mongodb://host1:1234/database?readPreferenceTags=a&readPreferenceTags=b'),
				),
			).toBe(true);
		});
	});

	describe('getDatabase', () => {
		test('returns the database object fom a mongoose instance', () => {
			const database = {} as Db;
			expect(getDatabase({ connection: { db: database } })).toBe(database);
		});

		test('returns the database object fom a mongoose connection instance', () => {
			const database = {} as Db;
			expect(getDatabase({ db: database })).toBe(database);
		});

		test('returns the database object directly if is not a mongoose object', () => {
			const database = {} as Db;
			expect(getDatabase(database)).toBe(database);
		});

		test('throws when a mongoose connection has no database available', () => {
			// A connection object that exposes a `db` slot which is not yet populated cannot yield a database.
			expect(() => getDatabase({ db: undefined } as any)).toThrow('is not open yet');
		});
	});

	describe('isPromise', () => {
		test('returns true for native promises', () => {
			expect(isPromise(Promise.resolve())).toBe(true);
			expect(isPromise(new Promise(() => undefined))).toBe(true);
		});

		test('returns true for thenable objects and functions', () => {
			expect(isPromise({ then: () => undefined })).toBe(true);
			const thenableFn = () => undefined;
			(thenableFn as any).then = () => undefined;
			expect(isPromise(thenableFn)).toBe(true);
		});

		test('returns false for non-thenable values', () => {
			expect(isPromise(null)).toBe(false);
			expect(isPromise(undefined)).toBe(false);
			expect(isPromise(42)).toBe(false);
			expect(isPromise('then')).toBe(false);
			expect(isPromise({})).toBe(false);
			expect(isPromise({ then: 'not a function' })).toBe(false);
			expect(isPromise(() => undefined)).toBe(false);
		});
	});

	describe('createOnceGuard', () => {
		test('runs the first callback it receives', () => {
			const guard = createOnceGuard();
			const fn = () => 'ran';
			let result: string | undefined;
			guard(() => {
				result = fn();
			});

			expect(result).toBe('ran');
		});

		test('ignores every call after the first, even with a different callback', () => {
			const guard = createOnceGuard();
			const calls: string[] = [];

			guard(() => calls.push('first'));
			guard(() => calls.push('second'));
			guard(() => calls.push('third'));

			expect(calls).toEqual(['first']);
		});

		test('each gate instance tracks its own state independently', () => {
			const guardA = createOnceGuard();
			const guardB = createOnceGuard();
			const calls: string[] = [];

			guardA(() => calls.push('a'));
			guardB(() => calls.push('b'));

			expect(calls).toEqual(['a', 'b']);
		});
	});

	describe('abortIncompleteUpload', () => {
		test('aborts a write stream that has not finished or been aborted yet', () => {
			let called = false;
			abortIncompleteUpload({
				state: { streamEnd: false, aborted: false },
				abort: async () => {
					called = true;
				},
			});

			expect(called).toBe(true);
		});

		test('does nothing when the stream already finished', () => {
			let called = false;
			abortIncompleteUpload({
				state: { streamEnd: true, aborted: false },
				abort: async () => {
					called = true;
				},
			});

			expect(called).toBe(false);
		});

		test('does nothing when the stream was already aborted', () => {
			let called = false;
			abortIncompleteUpload({
				state: { streamEnd: false, aborted: true },
				abort: async () => {
					called = true;
				},
			});

			expect(called).toBe(false);
		});

		test('does nothing when the stream has no state (not a real GridFSBucketWriteStream)', () => {
			let called = false;
			abortIncompleteUpload({
				abort: async () => {
					called = true;
				},
			});

			expect(called).toBe(false);
		});

		test('does nothing when the stream has state but no abort method', () => {
			expect(() => abortIncompleteUpload({ state: { streamEnd: false, aborted: false } })).not.toThrow();
		});

		test('swallows a rejection from abort() instead of throwing', async () => {
			expect(() =>
				abortIncompleteUpload({
					state: { streamEnd: false, aborted: false },
					abort: async () => {
						throw new Error('abort failed');
					},
				}),
			).not.toThrow();

			// Let the rejected promise's .catch() run before the test ends.
			await new Promise((resolve) => setImmediate(resolve));
		});
	});
});
