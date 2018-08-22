'use strict';

const utils = require('../lib/utils');
const chai = require('chai');
const expect = chai.expect;

describe('Utility functions', () => {
  describe('Compare', () => {
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
      expect(utils.compare({a: 1, b:2}, new Obj())).to.equal(true);
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
      expect(utils.compare({a: {b: new Buffer([1, 2])}}, {a: {b: new Buffer([1, 2])}})).to.equal(true);
      expect(utils.compare({a: {b: new Buffer([1, 2])}}, {a: {b: new Buffer([2, 2])}})).to.equal(false);
    });

    it('should include buffers inside arrays when comparing', () => {
      expect(utils.compare({a: {b: ['1', new Buffer([1, 2])]}}, {a: {b: ['1', new Buffer([1, 2])]}})).to.equal(true);
      expect(utils.compare({a: {b: ['1', new Buffer([1, 2])]}}, {a: {b: ['1', new Buffer([2, 2])]}})).to.equal(false);
    });
  });

  describe('hasKeys', () => {
    expect(utils.hasKeys({a: 1})).to.equal(true);
    expect(utils.hasKeys({})).to.equal(false);
    expect(utils.hasKeys(new Object())).to.equal(false);
  });
});
