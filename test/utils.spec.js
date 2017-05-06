'use strict';

const __ = require('../lib/utils');
const {expect} = require('chai');
const Grid = require('gridfs-stream');
const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const settings = require('./utils/settings');
const { version, types } = require('./utils/testutils');

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
      const values = types.objects.concat(types.primitives, types.wrappers, types.functions);
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
      const values = types.objects.concat(types.primitives, types.wrappers, types.functions);
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
  
  describe('isFunction', function () {
    
    it('should return false for non function values', function () {
      const values = types.objects.concat(types.primitives, types.wrappers);
      values.forEach((value) => {
        expect(__.isFunction(value)).to.equal(false);
      });
    });
    
    it('should return true for functions', function () {
      types.functions.forEach((fn) => {
        expect(__.isFunction(fn)).to.equal(true);
      });
    });
  
    it('should return false for generator functions', function () {
      if (version.major < 6) {
        return this.skip();
      }
      types.generatorFunctions.forEach((value) => {
        expect(__.isFunction(value)).to.equal(false);
      });
    });
  });
  
  describe('isGeneratorFunction', function () {
    if (version.major < 6) {
      return this.skip();
    }

    it('should return false for non generator function values', function () {
      const values = types.objects.concat(types.primitives, types.wrappers, types.generators, types.functions);
      values.forEach((value) => {
        expect(__.isGeneratorFunction(value)).to.equal(false);
      });
    });
    
    it('should return true for generator functions', function () {
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
      const values = types.objects.concat(types.primitives, types.wrappers, types.generators);
      values.forEach((value) => {
        expect(__.isFuncOrGeneratorFunc(value)).to.equal(false);
      });
    });
  });
  
  describe('isGenerator', function () {
    if (version.major < 6) {
      return this.skip();
    }

    it('should return false for non generators', function () {
      const values = types.objects.concat(types.primitives, types.wrappers, types.generatorFunctions, types.functions);
      values.forEach((value) => {
        expect(__.isGenerator(value)).to.equal(false);
      });
    });
    
    it('should return true for generators', function () {
      types.generators.forEach((generator) => {
        expect(__.isGenerator(generator)).to.equal(true);
      });
    });
  });
});
