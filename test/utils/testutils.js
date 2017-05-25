'use strict';

const Promise = require('bluebird');
const util = require('util');
const path = require('path');

function getNodeVersion() {
  const [, maj, min] = /^v(\d+)\.(\d+)\./.exec(process.version);
  const major = parseInt(maj, 10);
  const minor = parseInt(min, 10);
  return { major, minor };
}

const version = getNodeVersion();

function noop() {

}

function resolve(resolve) {
  resolve();
}

function fn() {
}

const fnExpr = function () {
};

const thenableObj = {
  then: function () {

  }
};

function thenableProto() {

}

thenableProto.prototype.then = function () {

};

const thenableFunction = function () {

};

// Should we manually create inheritance for the purpose of testing?
util.inherits(thenableFunction, thenableProto);

const GeneratorFunction = Object.getPrototypeOf(function*() {
}).constructor;

function* genFn() {
  yield 1;
}

const genFnExpr = function*() {

};

const genCtr = new GeneratorFunction('');

const types = {
  empty: [null, undefined],
  falsey: [null, undefined, false, '', 0],
  // null and undefined are also primitives but they can be merged from the empty type group
  primitives: [1, false, true, 'rainbows'],
  wrappers: [new Boolean(true), new Boolean(false), new Number(1), new String('unicorns')],
  objectLike: [{}, []],
  values: [Infinity, NaN, null, undefined],
  nonObjects: [[], new Error(), new Date(), new RegExp(/foo/)],
  objects: [{}, Object.create(null)],
  functions: [fn, fnExpr, new Function('')],
  generatorFunctions: [],
  generators: [],
  thenables: [new thenableFunction(), thenableObj],
  promises: [new Promise(resolve), new global.Promise(resolve)]
};

if (global.Symbol) {
  types.primitives.push(Symbol());
}

if (version.major >=6) {
  types.generatorFunctions.push(genFn, genFnExpr, genCtr);
  types.generators.push(genFn(), genFnExpr(), genCtr());
}

const files = ['sample1.jpg', 'sample2.jpg']
  .map((file) => path.normalize(__dirname + '/../attachments/' + file));

function cleanDb(storage) {
  if (storage) {
    storage.removeAllListeners();
    if (storage.gfs) {
      const db = storage.gfs.db;
      return db
        .dropDatabase()
        .then(() => db.close(true));
    }
    return Promise.resolve();
  }
  return Promise.resolve();
}

module.exports = {
  types,
  version,
  noop,
  files,
  cleanDb
};

