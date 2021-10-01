import { Db, MongoClient } from 'mongodb';
import { CacheIndex, CacheValue } from './types';
/**
 * Plugin cached connection handling class.
 * @version 3.1.0
 */
export declare class Cache {
    private store;
    private readonly emitter;
    constructor();
    /**
     * Handles creating a new connection from an url and caching if necessary
     * @param {object} options - Options to initialize the cache
     * @param {string} options.url - The url to cache
     * @param {string} options.cacheName - The name of the cache to use
     * @param {any} options.init - The connection options provided
     **/
    initialize(options: any): CacheIndex;
    /**
     * Search the cache for a space stored under an equivalent url.
     *
     * Just swapping parameters can cause two url to be deemed different when in fact they are not.
     * This method finds an url in the cache where another url could be stored even when they are not strictly equal
     * @param cacheName The name of the cache to search
     * @param url The mongodb url to compare
     * @return The similar url already in the cache
     */
    findUri(cacheName: string, url: string): string;
    /**
     * Returns true if the cache has an entry matching the given index
     * @param cacheIndex The index to look for
     * @return Returns if the cache was found
     */
    has(cacheIndex: CacheIndex): boolean;
    /**
     * Returns the contents of the cache in a given index
     * @param cacheIndex {object} The index to look for
     * @return {object} The cache contents or null if was not found
     */
    get(cacheIndex: CacheIndex): CacheValue;
    /**
     * Sets the contents of the cache in a given index
     * @param cacheIndex The index to look for
     * @param value The value to set
     */
    set(cacheIndex: CacheIndex, value: CacheValue): void;
    /**
     * Returns true if a given cache is resolving its associated connection
     * @param cacheIndex {object} The index to look for
     * @return Return true if the connection is not found yet
     */
    isPending(cacheIndex: CacheIndex): boolean;
    /**
     * Return true if a given cache started resolving a connection for itself
     * @param cacheIndex {object} The index to look for
     * @return Return true if no instances have started creating a connection for this cache
     */
    isOpening(cacheIndex: CacheIndex): boolean;
    /**
     * Sets the database and client for a given cache and resolves all instances waiting for it
     * @param cacheIndex {object} The index to look for
     * @param db  The database used to store files
     * @param [client] The client used to open the connection or null if none is provided
     */
    resolve(cacheIndex: CacheIndex, db: Db, client?: MongoClient): void;
    /**
     * Rejects all instances waiting for this connections
     * @param cacheIndex The index to look for
     * @param err The error thrown by the driver
     */
    reject(cacheIndex: CacheIndex, error: any): void;
    /**
     * Allows waiting for a connection associated to a given cache
     * @param cacheIndex The index to look for
     * @return A promise that will resolve when the connection for this cache is created
     */
    waitFor(cacheIndex: CacheIndex): Promise<CacheValue>;
    /**
     * Gives the number of connections created by all cache instances
     * @return {number} The number of created connections
     */
    connections(): number;
    /**
     * Removes a cache entry.
     *
     * > If the cache hasn't resolved yet it will be rejected.
     * @param cacheIndex The index to look for
     */
    remove(cacheIndex: CacheIndex): void;
    /**
     * Removes all entries in the cache and all listeners
     */
    clear(): void;
}
