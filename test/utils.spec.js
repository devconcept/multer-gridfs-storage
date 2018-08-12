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
    });

    it('should consider different objects with keys and falsey values', () => {
      expect(utils.compare(null, {db: 1})).to.equal(false);
      expect(utils.compare({db: 1}, null)).to.equal(false);
      expect(utils.compare({db: 1}, undefined)).to.equal(false);
      expect(utils.compare(undefined, {db: 1})).to.equal(false);
    });

    it('should consider equal objects by reference', () => {
      const ob1 = {bar: 1};
      const ob2 = {test: 2};
      expect(utils.compare(ob1, ob1)).to.equal(true);
      expect(utils.compare(ob2, ob2)).to.equal(true);
    });

    it('should consider equal similar objects', () => {
      expect(utils.compare({db: 1}, {db: 1})).to.equal(true);
    });

    it('should consider different objects with different keys values', () => {
      expect(utils.compare({db: 1}, {test: 1})).to.equal(false);
      expect(utils.compare({bar: 1}, {foo: 1})).to.equal(false);
    });

    it('should consider different objects with different keys length', () => {
      expect(utils.compare({db: 1, test: 2}, {db: 1})).to.equal(false);
    });

    it('should ignore non listed keys', () => {
      expect(utils.compare({db: 1, test: 2}, {db: 1}, ['db'])).to.equal(true);
    });
  });
});
