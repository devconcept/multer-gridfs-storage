/**
 * Storage cache
 * @module multer-gridfs-storage/cache
 */
import { EventEmitter } from 'node:events';
import { ConnectionString } from 'mongodb-connection-string-url';
import { Db } from 'mongodb';
import { compare, compareUris } from './utils.js';
import { CacheIndex, CacheValue } from './types/index.js';

/**
 * Plugin cached connection handling class.
 * @version 3.1.0
 */
export class Cache {
	private store: Map<string, Map<string, Map<number, CacheValue>>> = new Map();
	private readonly emitter = new EventEmitter();

	constructor() {
		this.emitter.setMaxListeners(0);
	}

	/**
	 * Handles creating a new connection from an url and caching if necessary
	 * @param {object} options - Options to initialize the cache
	 * @param {string} options.url - The url to cache
	 * @param {string} options.cacheName - The name of the cache to use
	 * @param {any} options.init - The connection options provided
	 **/
	initialize(options: { url: string; cacheName: string; init?: unknown }): CacheIndex {
		const { cacheName: name } = options;
		let { url } = options;
		// If the option is a falsey value or empty object use null as initial value
		const init = compare(options.init, null) ? null : options.init;

		// If a cache under that name does not exist create one
		let namedCache = this.store.get(name);
		if (!namedCache) {
			namedCache = new Map();
			this.store.set(name, namedCache);
		}

		// Check if the url has been used for that cache before
		let cached = namedCache.get(url);
		if (!namedCache.has(url)) {
			// If the url matches any equivalent url used before use that connection instead
			const eqUrl = this.findUri(name, url);
			if (!eqUrl) {
				const store = new Map<number, CacheValue>();
				store.set(0, {
					db: null,
					pending: true,
					opening: false,
					init,
				});
				namedCache.set(url, store);

				return {
					url,
					name,
					index: 0,
				};
			}

			url = eqUrl;
			cached = namedCache.get(url);
		}

		// After the checks above an entry for this url is guaranteed to exist
		if (!cached) {
			throw new Error('Cache entry not found');
		}

		// Compare connection options to create more only if they are semantically different
		for (const [index, value] of cached) {
			if (compare(value.init, options.init)) {
				return {
					url,
					name,
					index,
				};
			}
		}

		// Use one past the highest existing index rather than the map size: after remove() deletes an
		// entry the size no longer equals the next free key, which would otherwise overwrite an
		// existing entry and return the wrong index.
		const index = cached.size === 0 ? 0 : Math.max(...cached.keys()) + 1;
		cached.set(index, {
			db: null,
			pending: true,
			opening: false,
			init,
		});

		return {
			url,
			name,
			index,
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
	findUri(cacheName: string, url: string): string | undefined {
		const namedCache = this.store.get(cacheName);
		if (!namedCache) {
			return undefined;
		}

		const parsedCache = new ConnectionString(url);
		for (const [storedUrl] of namedCache) {
			const parsedUri = new ConnectionString(storedUrl);
			if (compareUris(parsedUri, parsedCache)) {
				return storedUrl;
			}
		}

		return undefined;
	}

	/**
	 * Returns true if the cache has an entry matching the given index
	 * @param cacheIndex The index to look for
	 * @return Returns if the cache was found
	 */
	has(cacheIndex: CacheIndex): boolean {
		return Boolean(this.get(cacheIndex));
	}

	/**
	 * Returns the contents of the cache in a given index
	 * @param cacheIndex {object} The index to look for
	 * @return {object} The cache contents or null if was not found
	 */
	get(cacheIndex: CacheIndex): CacheValue | null {
		const { name, url, index } = cacheIndex;
		const namedCache = this.store.get(name);
		if (!namedCache) {
			return null;
		}

		const urlCache = namedCache.get(url);
		if (!urlCache) {
			return null;
		}

		return urlCache.get(index) ?? null;
	}

	/**
	 * Sets the contents of the cache in a given index
	 * @param cacheIndex The index to look for
	 * @param value The value to set
	 */
	set(cacheIndex: CacheIndex, value: CacheValue): void {
		const { name, url, index } = cacheIndex;
		this.store.get(name)?.get(url)?.set(index, value);
	}

	/**
	 * Returns true if a given cache is resolving its associated connection
	 * @param cacheIndex {object} The index to look for
	 * @return Return true if the connection is not found yet
	 */
	isPending(cacheIndex: CacheIndex): boolean {
		const cached = this.get(cacheIndex);
		return cached?.pending ?? false;
	}

	/**
	 * Return true if a given cache started resolving a connection for itself
	 * @param cacheIndex {object} The index to look for
	 * @return Return true if no instances have started creating a connection for this cache
	 */
	isOpening(cacheIndex: CacheIndex): boolean {
		const cached = this.get(cacheIndex);
		return Boolean(cached?.opening);
	}

	/**
	 * Sets the database for a given cache and resolves all instances waiting for it
	 * @param cacheIndex {object} The index to look for
	 * @param db  The database used to store files
	 */
	resolve(cacheIndex: CacheIndex, db: Db): void {
		const cached = this.get(cacheIndex);
		if (!cached) {
			return;
		}

		cached.db = db;
		cached.pending = false;
		cached.opening = false;
		this.emitter.emit('resolve', cacheIndex);
	}

	/**
	 * Rejects all instances waiting for this connections
	 * @param cacheIndex The index to look for
	 * @param err The error thrown by the driver
	 */
	reject(cacheIndex: CacheIndex, error: unknown): void {
		const cached = this.get(cacheIndex);
		if (!cached) {
			return;
		}

		cached.pending = false;
		this.emitter.emit('reject', cacheIndex, error);
		this.remove(cacheIndex);
	}

	/**
	 * Allows waiting for a connection associated to a given cache
	 * @param cacheIndex The index to look for
	 * @return A promise that will resolve when the connection for this cache is created
	 */
	async waitFor(cacheIndex: CacheIndex): Promise<CacheValue> {
		if (!this.isPending(cacheIndex) && !this.isOpening(cacheIndex)) {
			const cached = this.get(cacheIndex);
			if (cached) {
				return cached;
			}
		}

		return new Promise((resolve, reject) => {
			const _resolve = (index: CacheIndex) => {
				if (compare(cacheIndex, index)) {
					this.emitter.removeListener('resolve', _resolve);
					this.emitter.removeListener('reject', _reject);
					const cached = this.get(cacheIndex);
					if (cached) {
						resolve(cached);
					} else {
						reject(new Error('The cache entry was deleted'));
					}
				}
			};

			const _reject = (index: CacheIndex, error: unknown) => {
				if (compare(cacheIndex, index)) {
					this.emitter.removeListener('resolve', _resolve);
					this.emitter.removeListener('reject', _reject);
					reject(error);
				}
			};

			this.emitter.on('resolve', _resolve);
			this.emitter.on('reject', _reject);
		});
	}

	/**
	 * Gives the number of connections created by all cache instances
	 * @return {number} The number of created connections
	 */
	connections(): number {
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
	remove(cacheIndex: CacheIndex): void {
		if (this.has(cacheIndex)) {
			if (this.isPending(cacheIndex)) {
				this.emitter.emit('reject', cacheIndex, new Error('The cache entry was deleted'));
			}

			const { name, url, index } = cacheIndex;
			const namedCache = this.store.get(name);
			const urlCache = namedCache?.get(url);
			urlCache?.delete(index);
			// Drop now-empty containers so stale url/name keys don't linger in the store.
			if (urlCache?.size === 0) {
				namedCache?.delete(url);
			}

			if (namedCache?.size === 0) {
				this.store.delete(name);
			}
		}
	}

	/**
	 * Removes all entries in the cache and all listeners
	 */
	clear(): void {
		this.store = new Map();
		this.emitter.removeAllListeners();
	}
}
