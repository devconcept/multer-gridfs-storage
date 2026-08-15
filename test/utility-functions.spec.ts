import { test, expect } from 'vitest';
import ConnectionString from 'mongodb-connection-string-url';
import { Db } from 'mongodb';
import { compare, compareArrays, compareBy, compareUris, getDatabase, hasKeys, isPromise } from '../src/utils';

/* Compare */
test('compare considers equal any falsey values', () => {
	expect(compare(null, undefined)).toBe(true);
	expect(compare(undefined, null)).toBe(true);
});

test('compare considers equal objects with no keys and falsey values', () => {
	expect(compare(null, {})).toBe(true);
	expect(compare({}, null)).toBe(true);
	expect(compare({}, undefined)).toBe(true);
	expect(compare(undefined, {})).toBe(true);
	expect(compare({}, {})).toBe(true);
	expect(compare({}, Object.create(null))).toBe(true);
});

test('compare considers different objects with keys and falsey values', () => {
	expect(compare(null, { a: 1 })).toBe(false);
	expect(compare({ a: 1 }, null)).toBe(false);
	expect(compare({ a: 1 }, undefined)).toBe(false);
	expect(compare(undefined, { a: 1 })).toBe(false);
});

test('compare considers equal objects by reference', () => {
	const ob1 = { a: 1 };
	const ob2 = { b: 2 };
	expect(compare(ob1, ob1)).toBe(true);
	expect(compare(ob2, ob2)).toBe(true);
});

test('compare considers equal objects with same property values', () => {
	class Object_ {
		a = 1;
	}

	(Object_.prototype as any).b = 2;
	expect(compare({ a: 1 }, { a: 1 })).toBe(true);
	expect(compare({ a: 1, b: 2 }, new Object_())).toBe(true);
});

test('compare considers different objects with different keys values', () => {
	expect(compare({ a: 1 }, { b: 1 })).toBe(false);
	expect(compare({ c: 1 }, { d: 1 })).toBe(false);
	expect(compare({ c: 1 }, {})).toBe(false);
	expect(compare({}, { c: 1 })).toBe(false);
	expect(compare({ c: 1 }, { c: 1, d: 1 })).toBe(false);
});

test('compare considers different objects with different keys length', () => {
	expect(compare({ a: 1, b: 2 }, { a: 1 })).toBe(false);
});

test('compare includes deep properties when comparing', () => {
	expect(compare({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
	expect(compare({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
	expect(compare({ a: {} }, { a: {} })).toBe(true);
	expect(compare({ a: { b: {} } }, { a: { b: Object.create(null) } })).toBe(true);
});

test('compare includes arrays when comparing', () => {
	expect(compare({ a: { b: ['1', '2'] } }, { a: { b: ['1', '2'] } })).toBe(true);
	expect(compare({ a: { b: ['1', '2'] } }, { a: { b: ['2', '2'] } })).toBe(false);
	expect(compare({ a: { b: ['1'] } }, { a: { b: ['1', '1'] } })).toBe(false);
	expect(compare({ a: [] }, { a: [] })).toBe(true);
});

test('compare includes buffers when comparing', () => {
	expect(compare({ a: { b: Buffer.from([1, 2]) } }, { a: { b: Buffer.from([1, 2]) } })).toBe(true);
	expect(compare({ a: { b: Buffer.from([1, 2]) } }, { a: { b: Buffer.from([2, 2]) } })).toBe(false);
});

test('compare includes buffers inside arrays when comparing', () => {
	expect(compare({ a: { b: ['1', Buffer.from([1, 2])] } }, { a: { b: ['1', Buffer.from([1, 2])] } })).toBe(true);
	expect(compare({ a: { b: ['1', Buffer.from([1, 2])] } }, { a: { b: ['1', Buffer.from([2, 2])] } })).toBe(false);
});

/* HasKeys */
test('returns true when the object has at least one property', () => {
	expect(hasKeys({ a: 1 })).toBe(true);
});

test('returns false when the object has no properties', () => {
	expect(hasKeys({})).toBe(false);
	expect(hasKeys(new Object())).toBe(false);
});

/* CompareArrays */
test('returns true when the arrays contains identical string or buffer values', () => {
	expect(compareArrays(['a', 'b'], ['a', 'b'])).toBe(true);
	expect(compareArrays([Buffer.from([1, 2]), 'b'], [Buffer.from([1, 2]), 'b'])).toBe(true);
});

test('returns false when the arrays contains different values or they are compared by reference', () => {
	expect(compareArrays(['a', 'b'], ['b', 'b'])).toBe(false);
	expect(compareArrays([undefined], [null])).toBe(false);
	expect(compareArrays([{ a: 1 }], [{ a: 1 }])).toBe(false);
});

/* CompareBy */
test('returns identity when the objects have different types', () => {
	expect(compareBy(Buffer.from([1, 2]), ['a', 'b'])).toBe('identity');
});

test('returns the type of the objects when they have the same type', () => {
	expect(compareBy([], ['a', 'b'])).toBe('array');
	expect(compareBy(Buffer.from([1, 2]), Buffer.from('ab'))).toBe('buffer');
	expect(compareBy({}, { a: 1 })).toBe('object');
});

/* CompareUris */
test('returns true for urls that contain the same hosts in different order', () => {
	expect(compareUris(new ConnectionString('mongodb://host1:1234,host2:5678/database'), new ConnectionString('mongodb://host2:5678,host1:1234/database'))).toBe(true);
});

test('returns false for urls with different parameters', () => {
	expect(compareUris(new ConnectionString('mongodb://host1:1234,host2:5678/database?authSource=admin'), new ConnectionString('mongodb://host2:5678,host1:1234/database'))).toBe(false);
});

test('returns true for urls with the same parameters in different order', () => {
	expect(
		compareUris(
			new ConnectionString('mongodb://host1:1234/database?authSource=admin&connectTimeoutMS=300000'),
			new ConnectionString('mongodb://host1:1234/database?connectTimeoutMS=300000&authSource=admin'),
		),
	).toBe(true);
});

/* GetDatabase */
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

/* IsPromise */
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
