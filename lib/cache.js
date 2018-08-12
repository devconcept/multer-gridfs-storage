/**
 *
 * Storage cache
 * @module multer-gridfs-storage/cache
 *
 */
'use strict';

var EventEmitter = require('events').EventEmitter;
var utils = require('./utils');
/* istanbul ignore next */
var Promise = global.Promise || require('es6-promise'); // eslint-disable-line global-require

function Cache() {
  this.connectProps = ['uri_decode_auth', 'db', 'server', 'replSet', 'mongos', 'promiseLibrary'];
  this._connections = {};
  this._emitter = new EventEmitter();
  this._emitter.setMaxListeners(0);
}

/**
 * Handles creating a new connection from an url and caching if necessary
 * @function initialize
 * @instance
 * @memberOf module:multer-gridfs-storage/gridfs~Cache
 * @param {object} opts - Options to initialize the cache
 * @param {string} opts.url - The url to cache
 * @param {string} opts.cacheName - The name of the cache to use
 * @param {string} opts.init - The connection options provided
 *
 **/
Cache.prototype.initialize = function initialize(opts) {
  var i, cached, current, url, init;
  var key = opts.cacheName;
  url = opts.url;
  init = utils.compare(opts.init, null) ? null : opts.init;

  if (!this._connections[key]) {
    this._connections[key] = {};
  }

  cached = this._connections[key][url];
  if (!cached) {
    this._connections[key][url] = [{
      db: null,
      client: null,
      pending: true,
      opening: false,
      init: init,
    }];

    return {
      url: url,
      name: key,
      index: 0,
    };
  }

  for (i = 0; i < cached.length; i++) {
    current = cached[i];
    if (utils.compare(current.init, opts.init, this.connectProps)) {
      return {
        url: url,
        name: key,
        index: i,
      };
    }
  }

  cached.push({
    db: null,
    client: null,
    pending: true,
    opening: false,
    init: init,
  });

  return {
    url: url,
    name: key,
    index: cached.length - 1,
  };
};

Cache.prototype.has = function has(cacheIndex) {
  return !!this.get(cacheIndex);
};

Cache.prototype.get = function get(cacheIndex) {
  var name = cacheIndex.name;
  var url = cacheIndex.url;
  var index = cacheIndex.index;
  if (!this._connections[name]) {
    return null;
  }
  if (!this._connections[name][url]) {
    return null;
  }
  if (!this._connections[name][url][index]) {
    return null;
  }
  return this._connections[name][url][index];
};

Cache.prototype.set = function set(cacheIndex, value) {
  this._connections[cacheIndex.name][cacheIndex.url][cacheIndex.index] = value;
};

Cache.prototype.isPending = function isPending(cacheIndex) {
  var cached = this.get(cacheIndex);
  return cached && cached.pending;
};

Cache.prototype.isOpening = function isOpening(cacheIndex) {
  var cached = this.get(cacheIndex);
  return cached && cached.opening;
};

Cache.prototype.resolve = function resolve(cacheIndex, db, client) {
  var _client = client || null;
  var cached;

  cached = this.get(cacheIndex);
  cached.db = db;
  cached.client = _client;
  cached.pending = false;
  cached.opening = false;
  this._emitter.emit('resolve', cacheIndex);
};

Cache.prototype.reject = function reject(cacheIndex, err) {
  if (this.has(cacheIndex)) {
    this.remove(cacheIndex);
  }
  this._emitter.emit('reject', cacheIndex, err);
};

Cache.prototype.waitFor = function waitFor(cacheIndex) {
  var self = this;

  if (!this.isPending(cacheIndex)) {
    return Promise.resolve(self.get(cacheIndex));
  }

  return new Promise(function (resolve, reject) {
    function _resolve(index) {
      if (utils.compare(cacheIndex, index)) {
        self._emitter.removeListener('resolve', _resolve);
        self._emitter.removeListener('reject', _reject);
        resolve(self.get(cacheIndex));
      }
    }

    function _reject(index, err) {
      if (utils.compare(cacheIndex, index)) {
        self._emitter.removeListener('resolve', _resolve);
        self._emitter.removeListener('reject', _reject);
        reject(err);
      }
    }

    self._emitter.on('resolve', _resolve);
    self._emitter.on('reject', _reject);
  });
};

Cache.prototype.connections = function connections() {
  var con, url, current, total = 0;
  for (con in this._connections) {
    if (Object.prototype.hasOwnProperty.call(this._connections, con)) {
      current = this._connections[con];
      for(url in current) {
        if (Object.prototype.hasOwnProperty.call(current, url)) {
          total = total + current[url].length;
        }
      }
    }
  }
  return total;
};

Cache.prototype.remove = function remove(cacheIndex) {
  var name = cacheIndex.name;
  var url = cacheIndex.url;
  var index = cacheIndex.index;
  if (this._connections[name] && this._connections[name][url]) {
    if (this._connections[name][url].length === 1) {
      delete this._connections[name][url];
    } else {
      this._connections[name][url].splice(index, 1);
    }
  }
};

Cache.prototype.clear = function clear() {
  this._connections = {};
  this._emitter.removeAllListeners();
};

module.exports = exports = Cache;
