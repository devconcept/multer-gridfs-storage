'use strict';

const __ = require('../lib/utils');
const { expect } = require('chai');
const Grid = require('gridfs-stream');
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const settings = require('./utils/settings');
const sinon = require('sinon');
const chai = require('chai');
const { version, types } = require('./utils/testutils');
chai.use(require('sinon-chai'));

describe('utility functions', function () {
  
  describe('isPromise', function () {
    
    it('should return true for Promise objects', () => {
      types.promises.forEach((promise) => {
        expect(__.isPromise(promise)).to.equal(true);
      });
    });
    
    it('should return true for thenable objects', function () {
      types.thenables.forEach((thenable) => {
        expect(__.isPromise(thenable)).to.equal(true);
      });
    });
    
    it('should return false for non promise objects', function () {
      const values = [].concat(
        types.objects,
        types.primitives,
        types.wrappers,
        types.functions,
        types.empty,
        types.generators,
        types.generatorFunctions
      );
      
      values.forEach((value) => {
        expect(__.isPromise(value)).to.equal(false);
      });
    });
  });
  
  
  describe('isGfsOrPromise', function () {
    let db, gfs;
    before(() => {
      return MongoClient
        .connect(settings.mongoUrl())
        .then((database) => {
          db = database;
          gfs = new Grid(db, mongo);
        });
    });
    
    it('should return true for Promise objects', () => {
      types.promises.forEach((promise) => {
        expect(__.isPromise(promise)).to.equal(true);
      });
    });
    
    it('should return true for thenable objects', function () {
      types.thenables.forEach((thenable) => {
        expect(__.isPromise(thenable)).to.equal(true);
      });
    });
    
    it('should return true for Grid objects', function () {
      expect(__.isGfsOrPromise(gfs)).to.equal(true);
    });
    
    it('should return false for non promise objects', function () {
      const values = [].concat(
        types.objects,
        types.primitives,
        types.wrappers,
        types.functions,
        types.empty,
        types.generators,
        types.generatorFunctions
      );
      
      values.forEach((value) => {
        expect(__.isPromise(value)).to.equal(false);
      });
    });
    
    after(() => {
      db.dropDatabase()
        .then(() => db.close(true));
    });
  });
  
  describe('getFileName', function () {
    
    it('should generate a 16 bytes hex string', function () {
      __.getFilename(null, null, (err, data) => {
        expect(err).to.equal(null);
        expect(data).to.match(/^[a-f0-9]{16}$/);
      });
      
    });
  });
  
  describe('generateValue', function () {
    
    it('should generate the same value passed in args', function () {
      __.generateValue(123)(null, null, (err, data) => {
        expect(err).to.equal(null);
        expect(data).to.equal(123);
      });
      
    });
  });
  
  describe('noop', function () {
    
    it('should generate null in both arguments', function () {
      __.noop(null, null, (err, data) => {
        expect(err).to.equal(null);
        expect(data).to.equal(null);
      });
    });
  });
  
  describe('isObject', function () {
    
    it('should return false for non objects', function () {
      const values = [].concat(
        types.functions,
        types.primitives,
        types.wrappers,
        types.generatorFunctions,
        types.generators,
        types.empty,
        types.nonObjects,
        types.generatorFunctions,
        types.generators
      );
      values.forEach((value) => {
        expect(__.isObject(value)).to.equal(false);
      });
    });
    
    it('should return true for objects only', function () {
      types.objects.forEach((value) => {
        expect(__.isObject(value)).to.equal(true);
      });
    });
  });
  
  describe('isFunction', function () {
    
    it('should return false for non plain function values', function () {
      const values = [].concat(
        types.primitives,
        types.wrappers,
        types.objects,
        types.nonObjects,
        types.generatorFunctions
      );
      values.forEach((value) => {
        expect(__.isFunction(value)).to.equal(false);
      });
    });
    
    it('should return true for functions', function () {
      types.functions.forEach((fn) => {
        expect(__.isFunction(fn)).to.equal(true);
      });
    });
  });
  
  describe('isGeneratorFunction', function () {
   
    it('should return false for non generator function values', function () {
      if (version.major < 6) {
        return this.skip();
      }
      
      const values = [].concat(
        types.primitives,
        types.wrappers,
        types.generators,
        types.functions,
        types.objects,
        types.empty,
        types.nonObjects
      );
      values.forEach((value) => {
        expect(__.isGeneratorFunction(value)).to.equal(false);
      });
    });
    
    it('should return true for generator functions', function () {
      if (version.major < 6) {
        return this.skip();
      }
      
      types.generatorFunctions.forEach((value) => {
        expect(__.isGeneratorFunction(value)).to.equal(true);
      });
    });
  });
  
  describe('isFuncOrGeneratorFunc', function () {
    
    it('should return true for functions', function () {
      types.functions.forEach((fn) => {
        expect(__.isFuncOrGeneratorFunc(fn)).to.equal(true);
      });
    });
    
    it('should return true for generator functions', function () {
      if (version.major < 6) {
        return this.skip();
      }
      
      types.generatorFunctions.forEach((fn) => {
        expect(__.isFuncOrGeneratorFunc(fn)).to.equal(true);
      });
    });
    
    it('should return false for other value types', function () {
      const values = [].concat(
        types.objects,
        types.primitives,
        types.wrappers,
        types.generators,
        types.nonObjects,
        types.empty
      );
      values.forEach((value) => {
        expect(__.isFuncOrGeneratorFunc(value)).to.equal(false);
      });
    });
  });
  
  describe('isGenerator', function () {
    
    it('should return false for non generators', function () {
      const values = [].concat(
        types.primitives,
        types.wrappers,
        types.generatorFunctions,
        types.functions,
        types.objects,
        types.nonObjects,
        types.empty
      );
      values.forEach((value) => {
        expect(__.isGenerator(value)).to.equal(false);
      });
    });
    
    it('should return true for generators', function () {
      if (version.major < 6) {
        return this.skip();
      }
      
      types.generators.forEach((generator) => {
        expect(__.isGenerator(generator)).to.equal(true);
      });
    });
  });
  
  describe('matchType', function () {
    let matches, mismatch;
    
    before(() => {
      matches = [
        { value: 0, type: Number },
        { value: 123, type: Number },
        { value: 1234.45, type: Number },
        { value: '', type: String },
        { value: '123', type: String },
        { value: true, type: Boolean },
        { value: false, type: Boolean },
        { value: new Number(0), type: Number },
        { value: new Number(123), type: Number },
        { value: new Number(1234.45), type: Number },
        { value: new String(''), type: String },
        { value: new String('123'), type: String },
        { value: new Boolean(true), type: Boolean },
        { value: new Boolean(false), type: Boolean }
      ];
      
      mismatch = [
        { value: 0, type: Boolean },
        { value: '', type: Number },
        { value: 1234.45, type: String },
        { value: '', type: Boolean },
        { value: '123', type: Number },
        { value: true, type: Number },
        { value: false, type: String },
        { value: new Number(0), type: Boolean },
        { value: new Number(123), type: String },
        { value: new Number(1234.45), type: Boolean },
        { value: new String(''), type: Boolean },
        { value: new String('123'), type: Number },
        { value: new Boolean(true), type: String },
        { value: new Boolean(false), type: Number }
      ];
    });
    
    it('should return true if the value is a primitive or a wrapper of the given type', function () {
      matches.forEach((pair) => {
        expect(__.matchType(pair.value, pair.type)).to.equal(true);
      });
    });
    
    it('should return false if the value does not match the given type', function () {
      mismatch.forEach((pair) => {
        expect(__.matchType(pair.value, pair.type)).to.equal(false);
      });
    });
  });
  
  
  describe('hasValue', function () {
    let arr;
    
    before(() => {
      arr = [1, 2, 3, 4, 5];
    });
    
    it('should accept the array in the second position to be compatible with the validation function', function () {
      function failed() {
        __.hasValue(arr, 1);
      }
      
      function success() {
        __.hasValue(1, arr);
      }
      
      expect(failed).to.throw();
      expect(success).not.to.throw();
    });
    
    it('should return true the value is present', function () {
      expect(__.hasValue(1, arr)).to.equal(true);
      expect(__.hasValue(5, arr)).to.equal(true);
    });
    
    it('should return false if the value is not present', function () {
      expect(__.hasValue(6, arr)).to.equal(false);
      expect(__.hasValue(10, arr)).to.equal(false);
    });
    
  });
  
  describe('hasValue', function () {
    let arr;
    
    before(() => {
      arr = [1, 2, 3, 4, 5];
    });
    
    it('should accept the array in the second position to be compatible with the validation function', function () {
      function failed() {
        __.hasValue(arr, 1);
      }
      
      function success() {
        __.hasValue(1, arr);
      }
      
      expect(failed).to.throw();
      expect(success).not.to.throw();
    });
    
    it('should return true the value is present', function () {
      expect(__.hasValue(1, arr)).to.equal(true);
      expect(__.hasValue(5, arr)).to.equal(true);
    });
    
    it('should return false if the value is not present', function () {
      expect(__.hasValue(6, arr)).to.equal(false);
      expect(__.hasValue(10, arr)).to.equal(false);
    });
    
  });
  
  describe('checkRule', function () {
    let testSubject, passedArgs;
    let rule1, rule2, validateSpy1, validateSpy2, validateArgSpy1, validateArgSpy2, result1, result2;
    
    before(() => {
      testSubject = {
        bar: '123'
      };
      passedArgs = [1, 2, 3];
    });
    
    it('should invoke the rule with the right arguments', function () {
      validateSpy1 = sinon.spy((target) => target.hasOwnProperty('bar'));
      validateSpy2 = sinon.spy((target) => target === '123');
      validateArgSpy1 = sinon.spy((target, args) => target.hasOwnProperty('bar') && passedArgs.every((i) => args.indexOf(i) !== -1));
      validateArgSpy2 = sinon.spy((target, args) => target === args.join(''));
      
      rule1 = {
        prop: null,
        validations: [
          { check: validateSpy1 },
          { check: validateArgSpy1, args: passedArgs }
        ],
        error: 'Custom error in object'
      };
      
      rule2 = {
        prop: 'bar',
        validations: [
          { check: validateSpy2 },
          { check: validateArgSpy2, args: passedArgs }
        ],
        error: 'Custom error in property'
      };
      
      result1 = __.checkRule(testSubject, rule1);
      result2 = __.checkRule(testSubject, rule2);
      
      expect(validateSpy1).to.be.calledOnce;
      expect(validateSpy1).to.be.calledWith(testSubject);
      expect(validateSpy2).to.be.calledOnce;
      expect(validateSpy2).to.be.calledWith('123');
      expect(validateArgSpy1).to.be.calledOnce;
      expect(validateArgSpy1).to.be.calledWith(testSubject, passedArgs);
      expect(validateArgSpy2).to.be.calledOnce;
      expect(validateArgSpy2).to.be.calledWith('123', passedArgs);
    });
    
    it('should return true for valid objects', function () {
      expect(result1).to.equal(true);
      expect(result2).to.equal(true);
    });
    
    it('should return true if the property is missing', function () {
      const neverMatchRule = {
        prop: 'not_there',
        validations: {
          check: (target) => target.hasOwnProperty('not_there')
        }
      };
      expect(__.checkRule(testSubject, neverMatchRule)).to.equal(true);
    });
    
    it('should return false if the rule is not valid', function () {
      const invalidRule = {
        prop: null,
        validations: [{
          check: (target) => target.hasOwnProperty('not_there')
        }]
      };
      expect(__.checkRule(testSubject, invalidRule)).to.equal(false);
    });
    
    it('should not continue executing rules if at least one is not valid', function () {
      validateSpy1 = sinon.spy((target) => target.hasOwnProperty('not_there'));
      validateSpy2 = sinon.spy((target) => target.bar === '123');
      const invalidRule = {
        prop: null,
        validations: [{ check: validateSpy1 }, { check: validateSpy2 }]
      };
      result1 = __.checkRule(testSubject, invalidRule);
      
      expect(result1).to.equal(false);
      expect(validateSpy1).to.have.callCount(1);
      expect(validateSpy2).to.have.callCount(0);
    });
    
    it('should return true if at least one rule is valid when using the or operator', function () {
      validateSpy1 = sinon.spy((target) => target.hasOwnProperty('not_there'));
      validateSpy2 = sinon.spy((target) => target.bar === '123');
      const invalidRule = {
        prop: null,
        validations: [{ check: validateSpy1 }, { check: validateSpy2 }],
        condition: 'or'
      };
      result1 = __.checkRule(testSubject, invalidRule);
      
      expect(result1).to.equal(true);
      expect(validateSpy1).to.have.callCount(1);
      expect(validateSpy2).to.have.callCount(1);
    });
  });
  
});
