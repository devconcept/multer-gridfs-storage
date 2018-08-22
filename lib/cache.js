/**
 * Storage cache
 * @module multer-gridfs-storage/cache
 */
'use strict';

const EventEmitter = require('events').EventEmitter;
const utils = require('./utils');
/* istanbul ignore next */
const Promise = global.Promise || require('es6-promise'); // eslint-disable-line global-require

/**
 * @class Cache
 * @classdesc Plugin cached connection handling class.
 * @version 3.1.0
 */
function Cache() {
  this._connections = {};
  this._emitter = new EventEmitter();
  this._emitter.setMaxListeners(0);
}

/**
 * Handles creating a new connection from an url and caching if necessary
 * @param {object} opts - Options to initialize the cache
 * @param {string} opts.url - The url to cache
 * @param {string} opts.cacheName - The name of the cache to use
 * @param {any} opts.init - The connection options provided
 *
 **/
Cache.prototype.initialize = function initialize(opts) {
  const key = opts.cacheName;
  const url = opts.url;
  const init = utils.compare(opts.init, null) ? null : opts.init;

  if (!this._connections[key]) {
    this._connections[key] = {};
  }

  const cached = this._connections[key][url];
  if (!cached) {
    this._connections[key][url] = {connections: 1, next: 1};
    this._connections[key][url]['0'] = {
      db: null,
      client: null,
      pending: true,
      opening: false,
      init: init,
    };

    return {
      url: url,
      name: key,
      index: '0',
    };
  }


  for (const prop in cached) {
    const current = cached[prop];
    if (utils.compare(current.init, opts.init)) {
      return {
        url: url,
        name: key,
        index: prop,
      };
    }
  }

  const idx = cached.next.toString();
  cached[idx] = {
    db: null,
    client: null,
    pending: true,
    opening: false,
    init: init,
  };
  cached.connections++;
  cached.next++;

  return {
    url: url,
    name: key,
    index: idx,
  };
};

/**
 * Returns true if the cache has an entry matching the given index
 * @param cacheIndex {object} The index to look for
 * @return {boolean} Returns if the cache was found
 */
Cache.prototype.has = function has(cacheIndex) {
  return !!this.get(cacheIndex);
};

/**
 * Returns the contents of the cache in a given index
 * @param cacheIndex {object} The index to look for
 * @return {object} The cache contents or null if was not found
 */
Cache.prototype.get = function get(cacheIndex) {
  const name = cacheIndex.name;
  const url = cacheIndex.url;
  const index = cacheIndex.index;
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

/**
 * Sets the contents of the cache in a given index
 * @param cacheIndex {object} The index to look for
 * @param value {object} The value to set
 */
Cache.prototype.set = function set(cacheIndex, value) {
  this._connections[cacheIndex.name][cacheIndex.url][cacheIndex.index] = value;
};

/**
 * Returns true if a given cache is resolving its associated connection
 * @param cacheIndex {object} The index to look for
 * @return {boolean} Return true if the connection is not found yet
 */
Cache.prototype.isPending = function isPending(cacheIndex) {
  const cached = this.get(cacheIndex);
  return !!cached && cached.pending;
};

/**
 * Return true if a given cache started resolving a connection for itself
 * @param cacheIndex {object} The index to look for
 * @return {boolean} Return true if no instances have started creating a connection for this cache
 */
Cache.prototype.isOpening = function isOpening(cacheIndex) {
  const cached = this.get(cacheIndex);
  return cached && cached.opening;
};

/**
 * Sets the database and client for a given cache and resolves all instances waiting for it
 * @param cacheIndex {object} The index to look for
 * @param db {Db} The database used to store files
 * @param client {MongoClient} The client used to open the connection or null if none is provided
 */
Cache.prototype.resolve = function resolve(cacheIndex, db, client) {
  const cached = this.get(cacheIndex);
  cached.db = db;
  cached.client = client;
  cached.pending = false;
  cached.opening = false;
  this._emitter.emit('resolve', cacheIndex);
};

/**
 * Rejects all instances waiting for this connections
 * @param cacheIndex {object} The index to look for
 * @param err {Error} The error thrown by the driver
 */
Cache.prototype.reject = function reject(cacheIndex, err) {
  this._emitter.emit('reject', cacheIndex, err);
  this.remove(cacheIndex);
};

/**
 * Allows waiting for a connection associated to a given cache
 * @param cacheIndex {object} The index to look for
 * @return {Promise} A promise that will resolve when the connection for this cache is created
 */
Cache.prototype.waitFor = function waitFor(cacheIndex) {
  const self = this;

  if (!this.isPending(cacheIndex) && !this.isOpening(cacheIndex)) {
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

/**
 * Gives the number of connections created by all cache instances
 * @return {number} The number of created connections
 */
Cache.prototype.connections = function connections() {
  let total = 0;
  for (const con in this._connections) {
    const current = this._connections[con];
    for (const url in current) {
      total = total + current[url].connections;
    }
  }
  return total;
};

/**
 * Removes a cache entry.
 *
 * > Make sure the cache has resolved or rejected before calling this method.
 * @param cacheIndex {object} The index to look for
 */
Cache.prototype.remove = function remove(cacheIndex) {
  const name = cacheIndex.name;
  const url = cacheIndex.url;
  const index = cacheIndex.index;
  if (this._connections[name] && this._connections[name][url] && this._connections[name][url][index]) {
    delete this._connections[name][url][index];
    this._connections[name][url].connections--;
  }
};

/**
 * Removes all entries in the cache and all listeners
 */
Cache.prototype.clear = function clear() {
  this._connections = {};
  this._emitter.removeAllListeners();
};

module.exports = exports = Cache;
