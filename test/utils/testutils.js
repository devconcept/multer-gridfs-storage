'use strict';

const Promise = require('bluebird');

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

thenableFunction.prototype = new thenableProto();

const GeneratorFunction = Object.getPrototypeOf(function*() {
}).constructor;

function* genFn() {
  yield 1;
}

const genFnExpr = function* () {

};

const genCtr = new GeneratorFunction('');

const types = {
  primitives: [1, false, 'rainbows'],
  wrappers: [new Boolean(true), new Number(1), new String('unicorns')],
  objects: [{}, []],
  functions: [fn, fnExpr, new Function('')],
  generatorFunctions: [genFn, genFnExpr, genCtr],
  generators: [genFn(), genFnExpr(), genCtr()],
  thenables: [new thenableFunction(), thenableObj],
  promises: [new Promise(resolve), new global.Promise(resolve)]
};

function getNodeVersion() {
  const [, maj, min] = /^v(\d+)\.(\d+)\./.exec(process.version);
  const major = parseInt(maj, 10);
  const minor = parseInt(min, 10);
  return { major, minor };
}

module.exports.types = types;
module.exports.version = getNodeVersion();
module.exports.noop = noop;
