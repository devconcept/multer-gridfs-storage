'use strict';

const __ = require('../lib/utils');
const chai = require('chai');
const expect = chai.expect;
const mute = require('mute');
const validate = __.validateOptions;
const settings = require('./utils/settings');
const { noop } = require('./utils/testutils');

describe('Validation function', function () {
  let unmute;

  before(() => unmute = mute(process.stderr));

  it('should throw an error when no url and gfs parameters are passed in', function () {
    const fn = () => {
      validate({});
    };
    expect(fn).to.throw(Error, /^Missing required configuration$/);
  });

  it('should not allow objects of different type than GridFs in gfs configuration option', function () {
    const errorRegexp = /^Expected gfs configuration to be a Grid instance or a promise$/;

    function errorFn1() {
      validate({ gfs: [] });
    }

    function errorFn2() {
      validate({ gfs: '' });
    }

    function errorFn3() {
      validate({ gfs: {} });
    }

    function errorFn4() {
      validate({ gfs: 10 });
    }

    expect(errorFn1).to.throw(Error, errorRegexp);
    expect(errorFn2).to.throw(Error, errorRegexp);
    expect(errorFn3).to.throw(Error, errorRegexp);
    expect(errorFn4).to.throw(Error, errorRegexp);
  });

  it('should only allow functions and generator functions in the filename option', function () {
    const errorRegexp = /^Expected filename configuration to be a function or a generator function$/;

    function errorFn1() {
      validate({ url: settings.mongoUrl(), filename: [] });
    }

    function errorFn2() {
      validate({ url: settings.mongoUrl(), filename: '' });
    }

    function errorFn3() {
      validate({ url: settings.mongoUrl(), filename: {} });
    }

    function errorFn4() {
      validate({ url: settings.mongoUrl(), filename: 10 });
    }

    function successFn() {
      validate({ url: settings.mongoUrl(), filename: noop });
    }

    expect(errorFn1).to.throw(Error, errorRegexp);
    expect(errorFn2).to.throw(Error, errorRegexp);
    expect(errorFn3).to.throw(Error, errorRegexp);
    expect(errorFn4).to.throw(Error, errorRegexp);
    expect(successFn).not.to.throw();
  });

  it('should only allow functions and generator functions in the identifier option', function () {
    const errorRegexp = /^Expected identifier configuration to be a function or a generator function$/;

    function errorFn1() {
      validate({ url: settings.mongoUrl(), identifier: [] });
    }

    function errorFn2() {
      validate({ url: settings.mongoUrl(), identifier: '' });
    }

    function errorFn3() {
      validate({ url: settings.mongoUrl(), identifier: {} });
    }

    function errorFn4() {
      validate({ url: settings.mongoUrl(), identifier: 10 });
    }

    function successFn() {
      validate({ url: settings.mongoUrl(), identifier: noop });
    }

    expect(errorFn1).to.throw(Error, errorRegexp);
    expect(errorFn2).to.throw(Error, errorRegexp);
    expect(errorFn3).to.throw(Error, errorRegexp);
    expect(errorFn4).to.throw(Error, errorRegexp);
    expect(successFn).not.to.throw();
  });

  it('should only allow functions and generator functions in the metadata option', function () {
    const errorRegexp = /^Expected metadata configuration to be a function or a generator function$/;

    function errorFn1() {
      validate({ url: settings.mongoUrl(), metadata: [] });
    }

    function errorFn2() {
      validate({ url: settings.mongoUrl(), metadata: '' });
    }

    function errorFn3() {
      validate({ url: settings.mongoUrl(), metadata: {} });
    }

    function errorFn4() {
      validate({ url: settings.mongoUrl(), metadata: 10 });
    }

    function successFn() {
      validate({ url: settings.mongoUrl(), metadata: noop });
    }

    expect(errorFn1).to.throw(Error, errorRegexp);
    expect(errorFn2).to.throw(Error, errorRegexp);
    expect(errorFn3).to.throw(Error, errorRegexp);
    expect(errorFn4).to.throw(Error, errorRegexp);
    expect(successFn).not.to.throw();
  });

  it('should only allow functions, generator functions or numbers in the chunkSize option', function () {
    const errorRegexp = /^Expected chunkSize configuration to be a function, a generator function or a Number$/;

    function errorFn1() {
      validate({ url: settings.mongoUrl(), chunkSize: [] });
    }

    function errorFn2() {
      validate({ url: settings.mongoUrl(), chunkSize: '' });
    }

    function errorFn3() {
      validate({ url: settings.mongoUrl(), chunkSize: {} });
    }

    function successFn1() {
      validate({ url: settings.mongoUrl(), chunkSize: noop });
    }

    function successFn2() {
      validate({ url: settings.mongoUrl(), chunkSize: 10 });
    }

    expect(errorFn1).to.throw(Error, errorRegexp);
    expect(errorFn2).to.throw(Error, errorRegexp);
    expect(errorFn3).to.throw(Error, errorRegexp);
    expect(successFn1).not.to.throw();
    expect(successFn2).not.to.throw();
  });

  it('should only allow functions, generator functions or strings in the root option', function () {
    const errorRegexp = /^Expected root configuration to be a function, a generator function or a String/;

    function errorFn1() {
      validate({ url: settings.mongoUrl(), root: [] });
    }

    function errorFn2() {
      validate({ url: settings.mongoUrl(), root: {} });
    }

    function errorFn3() {
      validate({ url: settings.mongoUrl(), root: 10 });
    }

    function successFn1() {
      validate({ url: settings.mongoUrl(), root: noop });
    }

    function successFn2() {
      validate({ url: settings.mongoUrl(), root: '123' });
    }

    expect(errorFn1).to.throw(Error, errorRegexp);
    expect(errorFn2).to.throw(Error, errorRegexp);
    expect(errorFn3).to.throw(Error, errorRegexp);
    expect(successFn1).not.to.throw();
    expect(successFn2).not.to.throw();
  });

  it('should only allow functions or booleans in the log option', function () {
    const errorRegexp = /^Expected log configuration to be a function or a Boolean/;

    function errorFn1() {
      validate({ url: settings.mongoUrl(), log: [] });
    }

    function errorFn2() {
      validate({ url: settings.mongoUrl(), log: {} });
    }

    function errorFn3() {
      validate({ url: settings.mongoUrl(), log: 10 });
    }

    function successFn1() {
      validate({ url: settings.mongoUrl(), log: noop });
    }

    function successFn2() {
      validate({ url: settings.mongoUrl(), log: true });
    }

    function successFn3() {
      validate({ url: settings.mongoUrl(), log: false });
    }

    expect(errorFn1).to.throw(Error, errorRegexp);
    expect(errorFn2).to.throw(Error, errorRegexp);
    expect(errorFn3).to.throw(Error, errorRegexp);
    expect(successFn1).not.to.throw();
    expect(successFn2).not.to.throw();
    expect(successFn3).not.to.throw();
  });

  it('should only allow logLevel with the value "file" or "all"', function () {
    const errorRegexp = /^Invalid log level configuration. Must be either "file" or "all"/;

    function errorFn1() {
      validate({ url: settings.mongoUrl(), logLevel: [] });
    }

    function errorFn2() {
      validate({ url: settings.mongoUrl(), logLevel: {} });
    }

    function errorFn3() {
      validate({ url: settings.mongoUrl(), logLevel: 10 });
    }

    function errorFn4() {
      validate({ url: settings.mongoUrl(), logLevel: '' });
    }

    function successFn1() {
      validate({ url: settings.mongoUrl(), logLevel: 'file' });
    }

    function successFn2() {
      validate({ url: settings.mongoUrl(), logLevel: 'all' });
    }


    expect(errorFn1).to.throw(Error, errorRegexp);
    expect(errorFn2).to.throw(Error, errorRegexp);
    expect(errorFn3).to.throw(Error, errorRegexp);
    expect(errorFn4).to.throw(Error, errorRegexp);
    expect(successFn1).not.to.throw();
    expect(successFn2).not.to.throw();
  });

  after(() => unmute());

});
