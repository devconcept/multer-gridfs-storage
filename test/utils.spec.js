'use strict';

const chai = require('chai');
const mongoUri = require('mongodb-uri');
const utils = require('../lib/utils');
const testUtils = require('./utils/testutils');

const createBuffer = testUtils.createBuffer;
const expect = chai.expect;

describe('Utility functions', () => {
  describe('compare', () => {
    it('should consider equal any falsey values', () => {
      expect(utils.compare(null, undefined)).to.equal(true);
      expect(utils.compare(undefined, null)).to.equal(true);
    });

    it('should consider equal objects with no keys and falsey values', () => {
      expect(utils.compare(null, {})).to.equal(true);
      expect(utils.compare({}, null)).to.equal(true);
      expect(utils.compare({}, undefined)).to.equal(true);
      expect(utils.compare(undefined, {})).to.equal(true);
      expect(utils.compare({}, {})).to.equal(true);
      expect(utils.compare({}, Object.create(null))).to.equal(true);
    });

    it('should consider different objects with keys and falsey values', () => {
      expect(utils.compare(null, {a: 1})).to.equal(false);
      expect(utils.compare({a: 1}, null)).to.equal(false);
      expect(utils.compare({a: 1}, undefined)).to.equal(false);
      expect(utils.compare(undefined, {a: 1})).to.equal(false);
    });

    it('should consider equal objects by reference', () => {
      const ob1 = {a: 1};
      const ob2 = {b: 2};
      expect(utils.compare(ob1, ob1)).to.equal(true);
      expect(utils.compare(ob2, ob2)).to.equal(true);
    });

    it('should consider equal similar objects', () => {
      function Obj() {
        this.a = 1;
      }

      Obj.prototype.b = 2;
      expect(utils.compare({a: 1}, {a: 1})).to.equal(true);
      expect(utils.compare({a: 1, b: 2}, new Obj())).to.equal(true);
    });

    it('should consider different objects with different keys values', () => {
      expect(utils.compare({a: 1}, {b: 1})).to.equal(false);
      expect(utils.compare({c: 1}, {d: 1})).to.equal(false);
      expect(utils.compare({c: 1}, {})).to.equal(false);
      expect(utils.compare({}, {c: 1})).to.equal(false);
      expect(utils.compare({c: 1}, {c: 1, d: 1})).to.equal(false);
    });

    it('should consider different objects with different keys length', () => {
      expect(utils.compare({a: 1, b: 2}, {a: 1})).to.equal(false);
    });

    it('should include deep properties when comparing', () => {
      expect(utils.compare({a: {b: 1}}, {a: {b: 1}})).to.equal(true);
      expect(utils.compare({a: {b: 1}}, {a: {b: 2}})).to.equal(false);
      expect(utils.compare({a: {}}, {a: {}})).to.equal(true);
      expect(utils.compare({a: {b: {}}}, {a: {b: Object.create(null)}})).to.equal(true);
    });

    it('should include arrays when comparing', () => {
      expect(utils.compare({a: {b: ['1', '2']}}, {a: {b: ['1', '2']}})).to.equal(true);
      expect(utils.compare({a: {b: ['1', '2']}}, {a: {b: ['2', '2']}})).to.equal(false);
      expect(utils.compare({a: {b: ['1']}}, {a: {b: ['1', '1']}})).to.equal(false);
      expect(utils.compare({a: []}, {a: []})).to.equal(true);
    });

    it('should include buffers when comparing', () => {
      expect(utils.compare({a: {b: createBuffer([1, 2])}}, {a: {b: createBuffer([1, 2])}})).to.equal(true);
      expect(utils.compare({a: {b: createBuffer([1, 2])}}, {a: {b: createBuffer([2, 2])}})).to.equal(false);
    });

    it('should include buffers inside arrays when comparing', () => {
      expect(utils.compare({a: {b: ['1', createBuffer([1, 2])]}}, {a: {b: ['1', createBuffer([1, 2])]}})).to.equal(true);
      expect(utils.compare({a: {b: ['1', createBuffer([1, 2])]}}, {a: {b: ['1', createBuffer([2, 2])]}})).to.equal(false);
    });
  });

  describe('hasKeys', () => {
    it('should return true when the object has at least one property', () => {
      expect(utils.hasKeys({a: 1})).to.equal(true);
    });

    it('should return false when the object has no properties', () => {
      expect(utils.hasKeys({})).to.equal(false);
      expect(utils.hasKeys(new Object())).to.equal(false);
    });
  });

  describe('compareArrays', () => {
    it('should return true when the arrays contains identical string or buffer values', () => {
      expect(utils.compareArrays(['a', 'b'], ['a', 'b'])).to.equal(true);
      expect(utils.compareArrays([createBuffer([1, 2]), 'b'], [createBuffer([1, 2]), 'b'])).to.equal(true);
    });

    it('should return false when the arrays contains different values or they are compared by reference', () => {
      expect(utils.compareArrays(['a', 'b'], ['b', 'b'])).to.equal(false);
      expect(utils.compareArrays([undefined], [null])).to.equal(false);
      expect(utils.compareArrays([{a: 1}], [{a: 1}])).to.equal(false);
    });
  });

  describe('compareBy', () => {
    it('should return identity when the objects have different types', () => {
      expect(utils.compareBy(createBuffer([1, 2]), ['a', 'b'])).to.equal('identity');
    });

    it('should return the type of the objects when they have the same type', () => {
      expect(utils.compareBy([], ['a', 'b'])).to.equal('array');
      expect(utils.compareBy(createBuffer([1, 2]), createBuffer(['a', 'b']))).to.equal('buffer');
      expect(utils.compareBy({}, {a: 1})).to.equal('object');
    });
  });

  describe('compareUris', () => {
    it('should return true for urls that contain the same hosts in different order', () => {
      expect(utils.compareUris(
        mongoUri.parse('mongodb://host1:1234,host2:5678/database'),
        mongoUri.parse('mongodb://host2:5678,host1:1234/database')
      )).to.equal(true);
    });

    it('should return false for urls with different parameters', () => {
      expect(utils.compareUris(
        mongoUri.parse('mongodb://host1:1234,host2:5678/database?authSource=admin'),
        mongoUri.parse('mongodb://host2:5678,host1:1234/database')
      )).to.equal(false);
    });

    it('should return true for urls with the same parameters in different order', () => {
      expect(utils.compareUris(
        mongoUri.parse('mongodb://host1:1234/database?authSource=admin&connectTimeoutMS=300000'),
        mongoUri.parse('mongodb://host1:1234/database?connectTimeoutMS=300000&authSource=admin')
      )).to.equal(true);
    });
  });

  describe('getDatabase', () => {
    const database = {};

    it('should return the database object fom a mongoose instance', () => {
      expect(utils.getDatabase({connection: {db: database}})).to.equal(database);
    });

    it('should return the database object fom a mongoose copnnection instance', () => {
      expect(utils.getDatabase({db: database})).to.equal(database);
    });

    it('should return the database object directly if is not a mongoose object', () => {
      expect(utils.getDatabase(database)).to.equal(database);
    });
  });
});
