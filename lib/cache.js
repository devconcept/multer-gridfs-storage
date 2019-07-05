/**
 * Storage cache
 * @module multer-gridfs-storage/cache
 */
'use strict';

const EventEmitter = require('events').EventEmitter;
const utils = require('./utils');
const mongoUri = require('mongodb-uri');

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
  const name = opts.cacheName;
  let url = opts.url;
  // If the option is a falsey value or empty object use null as initial value
  const init = utils.compare(opts.init, null) ? null : opts.init;

  // If a cache under that name does not exist create one
  if (!this._connections[name]) {
    this._connections[name] = {};
  }

  // Check if the url has been used for that cache before
  let cached = this._connections[name][url];
  if (!cached) {
    // If the url matches any equivalent url used before use that connection instead
    const eqUrl = this.findUri(name, url);
    if (!eqUrl) {
      this._connections[name][url] = {connections: 1, next: 1};
      this._connections[name][url]['0'] = {
        db: null,
        client: null,
        pending: true,
        opening: false,
        init: init,
      };

      return {
        url,
        name,
        index: '0',
      };
    }
    url = eqUrl;
    cached = this._connections[name][url];
  }

  // Compare connection options to create more only if they are semantically different
  for (const prop in cached) {
    const current = cached[prop];
    if (utils.compare(current.init, opts.init)) {
      return {
        url,
        name,
        index: prop,
      };
    }
  }

  // Allocate a new cache incrementing the autogenerated index for that space
  const index = cached.next.toString();
  cached[index] = {
    db: null,
    client: null,
    pending: true,
    opening: false,
    init: init,
  };
  cached.connections++;
  cached.next++;

  return {
    url,
    name,
    index,
  };
};

/**
 * Search the cache for a space stored under an equivalent url.
 *
 * Just swapping parameters can cause two url to be deemed different when in fact they are not.
 * This method finds an url in the cache where another url could be stored even when they are not strictly equal
 * @param cacheName The name of the cache to search
 * @param url The mongodb url to compare
 * @return {string} The similar url already in the cache
 */
Cache.prototype.findUri = function findUri(cacheName, url) {
  for (const prop in this._connections[cacheName]) {
    const parsedUri = mongoUri.parse(prop);
    const parsedCache = mongoUri.parse(url);
    if (utils.compareUris(parsedUri, parsedCache)) {
      return prop;
    }
  }
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
  const cached = this.get(cacheIndex);
  cached.pending = false;
  this._emitter.emit('reject', cacheIndex, err);
  this.remove(cacheIndex);
};

/**
 * Allows waiting for a connection associated to a given cache
 * @param cacheIndex {object} The index to look for
 * @return {Promise} A promise that will resolve when the connection for this cache is created
 */
Cache.prototype.waitFor = function waitFor(cacheIndex) {
  if (!this.isPending(cacheIndex) && !this.isOpening(cacheIndex)) {
    return Promise.resolve(this.get(cacheIndex));
  }

  return new Promise((resolve, reject) => {
    const _resolve = (index) => {
      if (utils.compare(cacheIndex, index)) {
        this._emitter.removeListener('resolve', _resolve);
        this._emitter.removeListener('reject', _reject);
        resolve(this.get(cacheIndex));
      }
    };

    const _reject = (index, err) => {
      if (utils.compare(cacheIndex, index)) {
        this._emitter.removeListener('resolve', _resolve);
        this._emitter.removeListener('reject', _reject);
        reject(err);
      }
    };

    this._emitter.on('resolve', _resolve);
    this._emitter.on('reject', _reject);
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
 * > If the cache hasn't resolved yet it will be rejected.
 * @param cacheIndex {object} The index to look for
 */
Cache.prototype.remove = function remove(cacheIndex) {
  const name = cacheIndex.name;
  const url = cacheIndex.url;
  const index = cacheIndex.index;

  if (this._connections[name] && this._connections[name][url] && this._connections[name][url][index]) {
    if (this.isPending(cacheIndex)) {
      this._emitter.emit('reject', cacheIndex, new Error('The cache entry was deleted'));
    }
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