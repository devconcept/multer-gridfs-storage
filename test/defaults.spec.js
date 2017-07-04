'use strict';

const gridStorage = require('../index');
const chai = require('chai');
const expect = chai.expect;
const settings = require('./utils/settings');
const { cleanDb } = require('./utils/testutils');
const { EventEmitter } = require('events');

const sinon = require('sinon');
const sinonChai = require('sinon-chai');
chai.use(sinonChai);

describe('module defaults', function () {
  this.timeout(3000);
  this.slow(4000);
  let storage;
  let result;
  let connectionSpy;

  before(() => {
    storage = gridStorage({
      url: settings.mongoUrl()
    });
    connectionSpy = sinon.spy();
    storage.once('connection', connectionSpy);
    return storage._getFile(null, null).then(function (res) {
      result = res;
    });
  });

  it('should have the EventEmitter signature', function () {
    expect(storage).to.respondTo('once');
    expect(storage).to.respondTo('on');
    expect(storage).to.be.a.instanceOf(EventEmitter);
  });

  it('should implement Multer plugin definition', function () {
    expect(storage).to.respondTo('_handleFile');
    expect(storage).to.respondTo('_removeFile');
  });

  it('should emit a connection event when using the url parameter', function (done) {
    setTimeout(() => {
      expect(connectionSpy).to.have.callCount(1);
      done();
    }, 2000);
  });

  it('should set the default filename to a 16 bytes hexadecimal string', function () {
    expect(result.filename).to.match(/^[0-9a-f]{32}$/);
  });

  it('should set the default metadata to null', function () {
    expect(result.metadata).to.equal(null);
  });

  it('should set the default chunkSize to 261120', function () {
    expect(result.chunkSize).to.equal(261120);
  });

  after(() => cleanDb(storage));

});
