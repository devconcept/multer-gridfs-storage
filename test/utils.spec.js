'use strict';

const utils = require('../lib/utils');
const util = require('util');
const chai = require('chai');
const expect = chai.expect;

describe('Utility functions', () => {
  describe('Assign', () => {
    it('should throw an error if the source is null or undefined', () => {
      function errFn1() {
        utils.assign(null, {a: '1'});
      }

      function errFn2() {
        utils.assign(undefined, {a: '1'});
      }

      expect(errFn1).to.throw();
      expect(errFn2).to.throw();
    });

    it('should assign consecutive sources', () => {
      const target = {};
      const dest = utils.assign(target, {a: '1'}, {b: '2'});
      expect(dest).to.equal(target);
      expect(dest).to.have.a.property('a');
      expect(dest.a).to.equal('1');
      expect(dest).to.have.a.property('b');
      expect(dest.b).to.equal('2');
    });

    it('should ignore null sources', () => {
      const target = {};
      const dest = utils.assign(target, null, {b: '2'});
      expect(dest).to.equal(target);
      expect(dest).not.to.have.a.property('a');
      expect(dest).to.have.a.property('b');
      expect(dest.b).to.equal('2');
    });

    it('should ignore undefined sources', () => {
      const target = {};
      const dest = utils.assign(target, undefined, {b: '2'});
      expect(dest).to.equal(target);
      expect(dest).not.to.have.a.property('a');
      expect(dest).to.have.a.property('b');
      expect(dest.b).to.equal('2');
    });

    it('should ignore inherited properties', () => {
      function Parent() {

      }

      Parent.prototype.prop1 = '1';

      function Source() {
        Parent.call(this);
        this.prop2 = '2';
      }

      util.inherits(Source, Parent);

      const target = {};
      const source = new Source();
      const dest = utils.assign(target, source);
      expect(dest).to.equal(target);
      expect(dest).not.to.have.a.property('prop1');
      expect(dest).to.have.a.property('prop2');
      expect(dest.prop2).to.equal('2');
    });
  });

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
