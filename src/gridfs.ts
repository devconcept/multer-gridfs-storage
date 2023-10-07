/**
 *
 * Plugin definition
 * @module multer-gridfs-storage/gridfs
 *
 */
import crypto from 'crypto';
import {EventEmitter} from 'events';
import {
	Db,
	GridFSBucket,
	GridFSBucketWriteStream,
	MongoClient,
	MongoClientOptions,
	ObjectId,
} from 'mongodb';
import isPromise from 'is-promise';
import isGenerator from 'is-generator';
import pump from 'pump';
import {Request} from 'express';
import {StorageEngine} from 'multer';
import mongoUri from 'mongodb-uri';

import {getDatabase, shouldListenOnDb} from './utils';
import {Cache} from './cache';
import {
	CacheIndex,
	GridFile,
	ConnectionResult,
	NodeCallback,
	UrlStorageOptions,
	DbStorageOptions,
} from './types';

const isGeneratorFn = isGenerator.fn;

/**
 * Default file information
 * @const defaults
 **/
const defaults = {
	metadata: null,
	chunkSize: 261_120,
	bucketName: 'fs',
	aliases: null,
};

/**
 * Multer GridFS Storage Engine class definition.
 * @extends EventEmitter
 * @param {object} configuration
 * @param {string} [configuration.url] - The url pointing to a MongoDb database
 * @param {object} [configuration.options] - Options to use when connection with an url.
 * @param {object} [configuration.connectionOpts] - DEPRECATED: Use options instead.
 * @param {boolean | string} [configuration.cache] - Store this connection in the internal cache.
 * @param {Db | Promise} [configuration.db] - The MongoDb database instance to use or a promise that resolves with it
 * @param {Function} [configuration.file] - A function to control the file naming in the database
 * @fires GridFsStorage#connection
 * @fires GridFsStorage#connectionFailed
 * @fires GridFsStorage#file
 * @fires GridFsStorage#streamError
 * @fires GridFsStorage#dbError
 * @version 0.0.3
 */
export class GridFsStorage extends EventEmitter implements StorageEngine {
	static cache: Cache = new Cache();
	db: Db = null;
	client: MongoClient = null;
	configuration: DbStorageOptions | UrlStorageOptions;
	connected = false;
	connecting = false;
	caching = false;
	error: any = null;
	private _file: any;
	private readonly _options: any;
	private readonly cacheName: string;
	private readonly cacheIndex: CacheIndex;

	constructor(configuration: UrlStorageOptions | DbStorageOptions) {
		super();

		if (
			!configuration ||
			(!(configuration as UrlStorageOptions).url &&
				!(configuration as DbStorageOptions).db)
		) {
			throw new Error(
				'Error creating storage engine. At least one of url or db option must be provided.',
			);
		}

		this.setMaxListeners(0);
		this.configuration = configuration;
		this._file = this.configuration.file;
		const {url, cache, options} = this.configuration as UrlStorageOptions;
		if (url) {
			this.caching = Boolean(cache);
			this._options = options;
		}

		if (this.caching) {
			const {cache, url} = configuration as UrlStorageOptions;
			const cacheName = typeof cache === 'string' ? cache : 'default';
			this.cacheName = cacheName;
			this.cacheIndex = GridFsStorage.cache.initialize({
				url,
				cacheName,
				init: this._options,
			});
		}

		this._connect();
	}

	/**
	 * Generates 16 bytes long strings in hexadecimal format
	 */
	static async generateBytes(): Promise<{filename: string}> {
		return new Promise((resolve, reject) => {
			crypto.randomBytes(16, (error, buffer) => {
				if (error) {
					reject(error);
					return;
				}

				resolve({filename: buffer.toString('hex')});
			});
		});
	}

	/**
	 * Merge the properties received in the file function with default values
	 * @param extra Extra properties like contentType
	 * @param fileSettings Properties received in the file function
	 * @return An object with the merged properties wrapped in a promise
	 */
	private static async _mergeProps(extra, fileSettings): Promise<any> {
		// If the filename is not provided generate one
		const previous: any = await (fileSettings.filename
			? {}
			: GridFsStorage.generateBytes());
		// If no id is provided generate one
		// If an error occurs the emitted file information will contain the id
		const hasId = fileSettings.id;
		if (!hasId) {
			previous.id = new ObjectId();
		}

		return {...previous, ...defaults, ...extra, ...fileSettings};
	}

	/**
	 * Handles generator function and promise results
	 * @param result - Can be a promise or a generator yielded value
	 * @param isGen - True if is a yielded value
	 **/
	private static async _handleResult(
		result: any,
		isGen: boolean,
	): Promise<any> {
		let value = result;

		if (isGen) {
			if (result.done) {
				throw new Error('Generator ended unexpectedly');
			}

			value = result.value;
		}

		return value;
	}

	/**
	 * Storage interface method to handle incoming files
	 * @param {Request} request - The request that trigger the upload
	 * @param {File} file - The uploaded file stream
	 * @param cb - A standard node callback to signal the end of the upload or an error
	 **/
	_handleFile(request: Request, file, cb: NodeCallback): void {
		if (this.connecting) {
			this.ready()
				/* eslint-disable-next-line promise/prefer-await-to-then */
				.then(async () => this.fromFile(request, file))
				/* eslint-disable-next-line promise/prefer-await-to-then */
				.then((file) => {
					cb(null, file);
				})
				.catch(cb);
			return;
		}

		this._updateConnectionStatus();
		if (this.connected) {
			this.fromFile(request, file)
				/* eslint-disable-next-line promise/prefer-await-to-then */
				.then((file) => {
					cb(null, file);
				})
				.catch(cb);
			return;
		}

		cb(new Error('The database connection must be open to store files'));
	}

	/**
	 * Storage interface method to delete files in case an error turns the request invalid
	 * @param request - The request that trigger the upload
	 * @param {File} file - The uploaded file stream
	 * @param cb - A standard node callback to signal the end of the upload or an error
	 **/
	_removeFile(request: Request, file, cb: NodeCallback): void {
		const options = {bucketName: file.bucketName};
		const bucket = new GridFSBucket(this.db, options);
		bucket.delete(file.id, cb);
	}

	/**
	 * Waits for the MongoDb connection associated to the storage to succeed or fail
	 */
	async ready(): Promise<ConnectionResult> {
		if (this.error) {
			throw this.error;
		}

		if (this.connected) {
			return {db: this.db, client: this.client};
		}

		return new Promise((resolve, reject) => {
			const done = (result) => {
				this.removeListener('connectionFailed', fail);
				resolve(result);
			};

			const fail = (error) => {
				this.removeListener('connection', done);
				reject(error);
			};

			this.once('connection', done);
			this.once('connectionFailed', fail);
		});
	}

	/**
	 * Pipes the file stream to the MongoDb database. The file requires a property named `file` which is a readable stream
	 * @param request - The http request where the file was uploaded
	 * @param {File} file - The file stream to pipe
	 * @return  {Promise} Resolves with the uploaded file
	 */
	async fromFile(request: Request, file): Promise<GridFile> {
		return this.fromStream(file.stream, request, file);
	}

	/**
	 * Pipes the file stream to the MongoDb database. The request and file parameters are optional and used for file generation only
	 * @param readStream - The http request where the file was uploaded
	 * @param [request] - The http request where the file was uploaded
	 * @param {File} [file] - The file stream to pipe
	 * @return Resolves with the uploaded file
	 */
	async fromStream(
		readStream: NodeJS.ReadableStream,
		request: Request,
		file: any,
	): Promise<GridFile> {
		return new Promise<GridFile>((resolve, reject) => {
			readStream.on('error', reject);
			this.fromMulterStream(readStream, request, file)
				/* eslint-disable-next-line promise/prefer-await-to-then */
				.then(resolve)
				.catch(reject);
		});
	}

	protected async _openConnection(
		url: string,
		options: MongoClientOptions,
	): Promise<ConnectionResult> {
		let client = null;
		let db;
		const connection = await MongoClient.connect(url, options);
		if (connection instanceof MongoClient) {
			client = connection;
			const parsedUri = mongoUri.parse(url);
			db = client.db(parsedUri.database);
		} else {
			db = connection;
		}

		return {client, db};
	}

	/**
	 * Create a writable stream with backwards compatibility with GridStore
	 * @param {object} options - The stream options
	 */
	protected createStream(options): GridFSBucketWriteStream {
		const settings = {
			id: options.id,
			chunkSizeBytes: options.chunkSize,
			contentType: options.contentType,
			metadata: options.metadata,
			aliases: options.aliases,
			disableMD5: options.disableMD5,
		};
		const gfs = new GridFSBucket(this.db, {bucketName: options.bucketName});
		return gfs.openUploadStream(options.filename, settings);
	}

	private async fromMulterStream(
		readStream: NodeJS.ReadableStream,
		request: Request,
		file: any,
	): Promise<GridFile> {
		if (this.connecting) {
			await this.ready();
		}

		const fileSettings = await this._generate(request, file);
		let settings;
		const setType = typeof fileSettings;
		const allowedTypes = new Set(['undefined', 'number', 'string', 'object']);
		if (!allowedTypes.has(setType)) {
			throw new Error('Invalid type for file settings, got ' + setType);
		}

		if (fileSettings === null || fileSettings === undefined) {
			settings = {};
		} else if (setType === 'string' || setType === 'number') {
			settings = {
				filename: fileSettings.toString(),
			};
		} else {
			settings = fileSettings;
		}

		const contentType = file ? file.mimetype : undefined;
		const streamOptions = await GridFsStorage._mergeProps(
			{contentType},
			settings,
		);
		return new Promise((resolve, reject) => {
			const emitError = (streamError) => {
				this.emit('streamError', streamError, streamOptions);
				reject(streamError);
			};

			const emitFile = (f) => {
				if (f === undefined) {
					// @ts-ignore - outdated types file this does exist
					f = writeStream.gridFSFile;
				}
				const storedFile: GridFile = {
					id: f._id,
					filename: f.filename,
					metadata: f.metadata || null,
					bucketName: streamOptions.bucketName,
					chunkSize: f.chunkSize,
					size: f.length,
					md5: f.md5,
					uploadDate: f.uploadDate,
					contentType: f.contentType,
				};
				this.emit('file', storedFile);
				resolve(storedFile);
			};

			const writeStream = this.createStream(streamOptions);

			// Multer already handles the error event on the readable stream(Busboy).
			// Invoking the callback with an error will cause file removal and aborting routines to be called twice
			writeStream.on('error', emitError);
			writeStream.on('finish', emitFile);
			// @ts-ignore
			pump([readStream, writeStream]);
		});
	}

	/**
	 * Determines if a new connection should be created, a explicit connection is provided or a cached instance is required.
	 */
	private _connect() {
		const {db, client = null} = this.configuration as DbStorageOptions<Db>;

		if (db && !isPromise(db) && !isPromise(client)) {
			this._setDb(db, client);
			return;
		}

		this._resolveConnection()
			/* eslint-disable-next-line promise/prefer-await-to-then */
			.then(({db, client}) => {
				this._setDb(db, client);
			})
			.catch((error) => {
				this._fail(error);
			});
	}

	/**
	 * Returns a promise that will resolve to the db and client from the cache or a new connection depending on the provided configuration
	 */
	private async _resolveConnection(): Promise<ConnectionResult> {
		this.connecting = true;
		const {db, client = null} = this.configuration as DbStorageOptions<Db>;
		if (db) {
			const [_db, _client] = await Promise.all([db, client]);
			return {db: _db, client: _client};
		}

		if (!this.caching) {
			return this._createConnection();
		}

		const {cache} = GridFsStorage;
		if (!cache.isOpening(this.cacheIndex) && cache.isPending(this.cacheIndex)) {
			const cached = cache.get(this.cacheIndex);
			cached.opening = true;
			return this._createConnection();
		}

		return cache.waitFor(this.cacheIndex);
	}

	/**
	 * Handles creating a new connection from an url and storing it in the cache if necessary*}>}
	 */
	private async _createConnection(): Promise<ConnectionResult> {
		const {url} = this.configuration as UrlStorageOptions;
		const options: MongoClientOptions = this._options;

		const {cache} = GridFsStorage;
		try {
			const {db, client} = await this._openConnection(url, options);
			if (this.caching) {
				cache.resolve(this.cacheIndex, db, client);
			}

			return {db, client};
		} catch (error: unknown) {
			if (this.cacheIndex) {
				cache.reject(this.cacheIndex, error);
			}

			throw error;
		}
	}

	/**
	 * Updates the connection status based on the internal db or client object
	 **/
	private _updateConnectionStatus(): void {
		if (!this.db) {
			this.connected = false;
			this.connecting = false;
			return;
		}

		if (this.client) {
			// @ts-ignore
			this.connected = this.client.isConnected
				? // @ts-ignore
				  this.client.isConnected()
				: true;
			return;
		}

		// @ts-expect-error
		this.connected = this.db?.topology?.isConnected() || true;
	}

	/**
	 * Sets the database connection and emit the connection event
	 * @param db - Database instance or Mongoose instance to set
	 * @param [client] - Optional Mongo client for MongoDb v3
	 **/
	private _setDb(db: Db, client?: MongoClient): void {
		this.connecting = false;
		// Check if the object is a mongoose instance, a mongoose Connection or a mongo Db object
		this.db = getDatabase(db);
		if (client) {
			this.client = client;
		}

		const errorEvent = (error_) => {
			// Needs verification. Sometimes the event fires without an error object
			// although the docs specify each of the events has a MongoError argument
			this._updateConnectionStatus();
			const error = error_ || new Error('Unknown database error');
			this.emit('dbError', error);
		};

		// This are all the events that emit errors
		const errorEventNames = ['error', 'parseError', 'timeout', 'close'];
		let eventSource;
		if (shouldListenOnDb()) {
			eventSource = this.db;
		} else if (this.client) {
			eventSource = this.client;
		}

		if (eventSource) {
			for (const evt of errorEventNames) eventSource.on(evt, errorEvent);
		}

		this._updateConnectionStatus();

		// Emit on next tick so user code can set listeners in case the db object is already available
		process.nextTick(() => {
			this.emit('connection', {db: this.db, client: this.client});
		});
	}

	/**
	 * Removes the database reference and emit the connectionFailed event
	 * @param err - The error received while trying to connect
	 **/
	private _fail(error: any): void {
		this.connecting = false;
		this.db = null;
		this.client = null;
		this.error = error;
		this._updateConnectionStatus();
		// Fail event is only emitted after either a then promise handler or an I/O phase so is guaranteed to be asynchronous
		this.emit('connectionFailed', error);
	}

	/**
	 * Tests for generator functions or plain functions and delegates to the appropriate method
	 * @param request - The request that trigger the upload as received in _handleFile
	 * @param {File} file - The uploaded file stream as received in _handleFile
	 * @return A promise with the value generated by the file function
	 **/
	private async _generate(request: Request, file): Promise<any> {
		let result;
		let generator;
		let isGen = false;

		if (!this._file) {
			return {};
		}

		if (isGeneratorFn(this._file)) {
			isGen = true;
			generator = this._file(request, file);
			this._file = generator;
			result = generator.next();
		} else if (isGenerator(this._file)) {
			isGen = true;
			generator = this._file;
			result = generator.next([request, file]);
		} else {
			result = this._file(request, file);
		}

		return GridFsStorage._handleResult(result, isGen);
	}
}

/**
 * Event emitted when the MongoDb connection is ready to use
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#connection
 * @param {{db: Db, client: MongoClient}} result - An object containing the mongodb database and client
 * @version 0.0.3
 */

/**
 * Event emitted when the MongoDb connection fails to open
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#connectionFailed
 * @param {Error} err - The error received when attempting to connect
 * @version 2.0.0
 */

/**
 * Event emitted when a new file is uploaded
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#file
 * @param {File} file - The uploaded file
 * @version 0.0.3
 */

/**
 * Event emitted when an error occurs streaming to MongoDb
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#streamError
 * @param {Error} error - The error thrown by the stream
 * @param {Object} conf - The failed file configuration
 * @version 1.3
 */

/**
 * Event emitted when the internal database connection emits an error
 * @event module:multer-gridfs-storage/gridfs~GridFSStorage#dbError
 * @param {Error} error - The error thrown by the database connection
 * @version 1.2.2
 **/

export const GridFsStorageCtr = new Proxy(GridFsStorage, {
	apply(target, thisArg, argumentsList) {
		// @ts-expect-error
		return new target(...argumentsList); // eslint-disable-line new-cap
	},
});
