"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cache = void 0;
/**
 * Storage cache
 * @module multer-gridfs-storage/cache
 */
const events_1 = require("events");
const mongodb_uri_1 = __importDefault(require("mongodb-uri"));
const utils_1 = require("./utils");
/**
 * Plugin cached connection handling class.
 * @version 3.1.0
 */
class Cache {
    constructor() {
        this.store = new Map();
        this.emitter = new events_1.EventEmitter();
        this.emitter.setMaxListeners(0);
    }
    /**
     * Handles creating a new connection from an url and caching if necessary
     * @param {object} options - Options to initialize the cache
     * @param {string} options.url - The url to cache
     * @param {string} options.cacheName - The name of the cache to use
     * @param {any} options.init - The connection options provided
     **/
    initialize(options) {
        let { url, cacheName: name } = options;
        // If the option is a falsey value or empty object use null as initial value
        const init = utils_1.compare(options.init, null) ? null : options.init;
        // If a cache under that name does not exist create one
        if (!this.store.has(name)) {
            this.store.set(name, new Map());
        }
        // Check if the url has been used for that cache before
        let cached = this.store.get(name).get(url);
        if (!this.store.get(name).has(url)) {
            // If the url matches any equivalent url used before use that connection instead
            const eqUrl = this.findUri(name, url);
            if (!eqUrl) {
                const store = new Map();
                store.set(0, {
                    db: null,
                    client: null,
                    pending: true,
                    opening: false,
                    init,
                });
                this.store.get(name).set(url, store);
                return {
                    url,
                    name,
                    index: 0,
                };
            }
            url = eqUrl;
            cached = this.store.get(name).get(url);
        }
        // Compare connection options to create more only if they are semantically different
        for (const [index, value] of cached) {
            if (utils_1.compare(value.init, options.init)) {
                return {
                    url,
                    name,
                    index,
                };
            }
        }
        cached.set(cached.size, {
            db: null,
            client: null,
            pending: true,
            opening: false,
            init,
        });
        return {
            url,
            name,
            index: cached.size - 1,
        };
    }
    /**
     * Search the cache for a space stored under an equivalent url.
     *
     * Just swapping parameters can cause two url to be deemed different when in fact they are not.
     * This method finds an url in the cache where another url could be stored even when they are not strictly equal
     * @param cacheName The name of the cache to search
     * @param url The mongodb url to compare
     * @return The similar url already in the cache
     */
    findUri(cacheName, url) {
        for (const [storedUrl] of this.store.get(cacheName)) {
            const parsedUri = mongodb_uri_1.default.parse(storedUrl);
            const parsedCache = mongodb_uri_1.default.parse(url);
            if (utils_1.compareUris(parsedUri, parsedCache)) {
                return storedUrl;
            }
        }
    }
    /**
     * Returns true if the cache has an entry matching the given index
     * @param cacheIndex The index to look for
     * @return Returns if the cache was found
     */
    has(cacheIndex) {
        return Boolean(this.get(cacheIndex));
    }
    /**
     * Returns the contents of the cache in a given index
     * @param cacheIndex {object} The index to look for
     * @return {object} The cache contents or null if was not found
     */
    get(cacheIndex) {
        const { name, url, index } = cacheIndex;
        if (!this.store.has(name)) {
            return null;
        }
        if (!this.store.get(name).has(url)) {
            return null;
        }
        if (!this.store.get(name).get(url).has(index)) {
            return null;
        }
        return this.store.get(name).get(url).get(index);
    }
    /**
     * Sets the contents of the cache in a given index
     * @param cacheIndex The index to look for
     * @param value The value to set
     */
    set(cacheIndex, value) {
        const { name, url, index } = cacheIndex;
        this.store.get(name).get(url).set(index, value);
    }
    /**
     * Returns true if a given cache is resolving its associated connection
     * @param cacheIndex {object} The index to look for
     * @return Return true if the connection is not found yet
     */
    isPending(cacheIndex) {
        const cached = this.get(cacheIndex);
        return Boolean(cached) && cached.pending;
    }
    /**
     * Return true if a given cache started resolving a connection for itself
     * @param cacheIndex {object} The index to look for
     * @return Return true if no instances have started creating a connection for this cache
     */
    isOpening(cacheIndex) {
        const cached = this.get(cacheIndex);
        return Boolean(cached === null || cached === void 0 ? void 0 : cached.opening);
    }
    /**
     * Sets the database and client for a given cache and resolves all instances waiting for it
     * @param cacheIndex {object} The index to look for
     * @param db  The database used to store files
     * @param [client] The client used to open the connection or null if none is provided
     */
    resolve(cacheIndex, db, client) {
        const cached = this.get(cacheIndex);
        cached.db = db;
        cached.client = client;
        cached.pending = false;
        cached.opening = false;
        this.emitter.emit('resolve', cacheIndex);
    }
    /**
     * Rejects all instances waiting for this connections
     * @param cacheIndex The index to look for
     * @param err The error thrown by the driver
     */
    reject(cacheIndex, error) {
        const cached = this.get(cacheIndex);
        cached.pending = false;
        this.emitter.emit('reject', cacheIndex, error);
        this.remove(cacheIndex);
    }
    /**
     * Allows waiting for a connection associated to a given cache
     * @param cacheIndex The index to look for
     * @return A promise that will resolve when the connection for this cache is created
     */
    waitFor(cacheIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isPending(cacheIndex) && !this.isOpening(cacheIndex)) {
                return this.get(cacheIndex);
            }
            return new Promise((resolve, reject) => {
                const _resolve = (index) => {
                    if (utils_1.compare(cacheIndex, index)) {
                        this.emitter.removeListener('resolve', _resolve);
                        this.emitter.removeListener('reject', _reject);
                        resolve(this.get(cacheIndex));
                    }
                };
                const _reject = (index, error) => {
                    if (utils_1.compare(cacheIndex, index)) {
                        this.emitter.removeListener('resolve', _resolve);
                        this.emitter.removeListener('reject', _reject);
                        reject(error);
                    }
                };
                this.emitter.on('resolve', _resolve);
                this.emitter.on('reject', _reject);
            });
        });
    }
    /**
     * Gives the number of connections created by all cache instances
     * @return {number} The number of created connections
     */
    connections() {
        let total = 0;
        for (const urlStore of this.store.values()) {
            for (const store of urlStore.values()) {
                total += store.size;
            }
        }
        return total;
    }
    /**
     * Removes a cache entry.
     *
     * > If the cache hasn't resolved yet it will be rejected.
     * @param cacheIndex The index to look for
     */
    remove(cacheIndex) {
        if (this.has(cacheIndex)) {
            if (this.isPending(cacheIndex)) {
                this.emitter.emit('reject', cacheIndex, new Error('The cache entry was deleted'));
            }
            const { name, url, index } = cacheIndex;
            this.store.get(name).get(url).delete(index);
        }
    }
    /**
     * Removes all entries in the cache and all listeners
     */
    clear() {
        this.store = new Map();
        this.emitter.removeAllListeners();
    }
}
exports.Cache = Cache;
//# sourceMappingURL=cache.js.map