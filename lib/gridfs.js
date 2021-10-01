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
exports.GridFsStorageCtr = exports.GridFsStorage = void 0;
/**
 *
 * Plugin definition
 * @module multer-gridfs-storage/gridfs
 *
 */
const crypto_1 = __importDefault(require("crypto"));
const events_1 = require("events");
const mongodb_1 = require("mongodb");
const is_promise_1 = __importDefault(require("is-promise"));
const is_generator_1 = __importDefault(require("is-generator"));
const pump_1 = __importDefault(require("pump"));
const mongodb_uri_1 = __importDefault(require("mongodb-uri"));
const utils_1 = require("./utils");
const cache_1 = require("./cache");
const isGeneratorFn = is_generator_1.default.fn;
/**
 * Default file information
 * @const defaults
 **/
const defaults = {
    metadata: null,
    chunkSize: 261120,
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
class GridFsStorage extends events_1.EventEmitter {
    constructor(configuration) {
        super();
        this.db = null;
        this.client = null;
        this.connected = false;
        this.connecting = false;
        this.caching = false;
        this.error = null;
        if (!configuration ||
            (!configuration.url &&
                !configuration.db)) {
            throw new Error('Error creating storage engine. At least one of url or db option must be provided.');
        }
        this.setMaxListeners(0);
        this.configuration = configuration;
        this._file = this.configuration.file;
        const { url, cache, options } = this.configuration;
        if (url) {
            this.caching = Boolean(cache);
            this._options = options;
        }
        if (this.caching) {
            const { cache, url } = configuration;
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
    static generateBytes() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                crypto_1.default.randomBytes(16, (error, buffer) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve({ filename: buffer.toString('hex') });
                });
            });
        });
    }
    /**
     * Merge the properties received in the file function with default values
     * @param extra Extra properties like contentType
     * @param fileSettings Properties received in the file function
     * @return An object with the merged properties wrapped in a promise
     */
    static _mergeProps(extra, fileSettings) {
        return __awaiter(this, void 0, void 0, function* () {
            // If the filename is not provided generate one
            const previous = yield (fileSettings.filename
                ? {}
                : GridFsStorage.generateBytes());
            // If no id is provided generate one
            // If an error occurs the emitted file information will contain the id
            const hasId = fileSettings.id;
            if (!hasId) {
                previous.id = new mongodb_1.ObjectId();
            }
            return Object.assign(Object.assign(Object.assign(Object.assign({}, previous), defaults), extra), fileSettings);
        });
    }
    /**
     * Handles generator function and promise results
     * @param result - Can be a promise or a generator yielded value
     * @param isGen - True if is a yielded value
     **/
    static _handleResult(result, isGen) {
        return __awaiter(this, void 0, void 0, function* () {
            let value = result;
            if (isGen) {
                if (result.done) {
                    throw new Error('Generator ended unexpectedly');
                }
                value = result.value;
            }
            return value;
        });
    }
    /**
     * Storage interface method to handle incoming files
     * @param {Request} request - The request that trigger the upload
     * @param {File} file - The uploaded file stream
     * @param cb - A standard node callback to signal the end of the upload or an error
     **/
    _handleFile(request, file, cb) {
        if (this.connecting) {
            this.ready()
                /* eslint-disable-next-line promise/prefer-await-to-then */
                .then(() => __awaiter(this, void 0, void 0, function* () { return this.fromFile(request, file); }))
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
    _removeFile(request, file, cb) {
        const options = { bucketName: file.bucketName };
        const bucket = new mongodb_1.GridFSBucket(this.db, options);
        bucket.delete(file.id, cb);
    }
    /**
     * Waits for the MongoDb connection associated to the storage to succeed or fail
     */
    ready() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.error) {
                throw this.error;
            }
            if (this.connected) {
                return { db: this.db, client: this.client };
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
        });
    }
    /**
     * Pipes the file stream to the MongoDb database. The file requires a property named `file` which is a readable stream
     * @param request - The http request where the file was uploaded
     * @param {File} file - The file stream to pipe
     * @return  {Promise} Resolves with the uploaded file
     */
    fromFile(request, file) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.fromStream(file.stream, request, file);
        });
    }
    /**
     * Pipes the file stream to the MongoDb database. The request and file parameters are optional and used for file generation only
     * @param readStream - The http request where the file was uploaded
     * @param [request] - The http request where the file was uploaded
     * @param {File} [file] - The file stream to pipe
     * @return Resolves with the uploaded file
     */
    fromStream(readStream, request, file) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                readStream.on('error', reject);
                this.fromMulterStream(readStream, request, file)
                    /* eslint-disable-next-line promise/prefer-await-to-then */
                    .then(resolve)
                    .catch(reject);
            });
        });
    }
    _openConnection(url, options) {
        return __awaiter(this, void 0, void 0, function* () {
            let client = null;
            let db;
            const connection = yield mongodb_1.MongoClient.connect(url, options);
            if (connection instanceof mongodb_1.MongoClient) {
                client = connection;
                const parsedUri = mongodb_uri_1.default.parse(url);
                db = client.db(parsedUri.database);
            }
            else {
                db = connection;
            }
            return { client, db };
        });
    }
    /**
     * Create a writable stream with backwards compatibility with GridStore
     * @param {object} options - The stream options
     */
    createStream(options) {
        const settings = {
            id: options.id,
            chunkSizeBytes: options.chunkSize,
            contentType: options.contentType,
            metadata: options.metadata,
            aliases: options.aliases,
            disableMD5: options.disableMD5,
        };
        const gfs = new mongodb_1.GridFSBucket(this.db, { bucketName: options.bucketName });
        return gfs.openUploadStream(options.filename, settings);
    }
    fromMulterStream(readStream, request, file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.connecting) {
                yield this.ready();
            }
            const fileSettings = yield this._generate(request, file);
            let settings;
            const setType = typeof fileSettings;
            const allowedTypes = new Set(['undefined', 'number', 'string', 'object']);
            if (!allowedTypes.has(setType)) {
                throw new Error('Invalid type for file settings, got ' + setType);
            }
            if (fileSettings === null || fileSettings === undefined) {
                settings = {};
            }
            else if (setType === 'string' || setType === 'number') {
                settings = {
                    filename: fileSettings.toString(),
                };
            }
            else {
                settings = fileSettings;
            }
            const contentType = file ? file.mimetype : undefined;
            const streamOptions = yield GridFsStorage._mergeProps({ contentType }, settings);
            return new Promise((resolve, reject) => {
                const emitError = (streamError) => {
                    this.emit('streamError', streamError, streamOptions);
                    reject(streamError);
                };
                const emitFile = (f) => {
                    const storedFile = {
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
                pump_1.default([readStream, writeStream]);
            });
        });
    }
    /**
     * Determines if a new connection should be created, a explicit connection is provided or a cached instance is required.
     */
    _connect() {
        const { db, client = null } = this.configuration;
        if (db && !is_promise_1.default(db) && !is_promise_1.default(client)) {
            this._setDb(db, client);
            return;
        }
        this._resolveConnection()
            /* eslint-disable-next-line promise/prefer-await-to-then */
            .then(({ db, client }) => {
            this._setDb(db, client);
        })
            .catch((error) => {
            this._fail(error);
        });
    }
    /**
     * Returns a promise that will resolve to the db and client from the cache or a new connection depending on the provided configuration
     */
    _resolveConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            this.connecting = true;
            const { db, client = null } = this.configuration;
            if (db) {
                const [_db, _client] = yield Promise.all([db, client]);
                return { db: _db, client: _client };
            }
            if (!this.caching) {
                return this._createConnection();
            }
            const { cache } = GridFsStorage;
            if (!cache.isOpening(this.cacheIndex) && cache.isPending(this.cacheIndex)) {
                const cached = cache.get(this.cacheIndex);
                cached.opening = true;
                return this._createConnection();
            }
            return cache.waitFor(this.cacheIndex);
        });
    }
    /**
     * Handles creating a new connection from an url and storing it in the cache if necessary*}>}
     */
    _createConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            const { url } = this.configuration;
            const options = this._options;
            const { cache } = GridFsStorage;
            try {
                const { db, client } = yield this._openConnection(url, options);
                if (this.caching) {
                    cache.resolve(this.cacheIndex, db, client);
                }
                return { db, client };
            }
            catch (error) {
                if (this.cacheIndex) {
                    cache.reject(this.cacheIndex, error);
                }
                throw error;
            }
        });
    }
    /**
     * Updates the connection status based on the internal db or client object
     **/
    _updateConnectionStatus() {
        var _a, _b;
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
        this.connected = ((_b = (_a = this.db) === null || _a === void 0 ? void 0 : _a.topology) === null || _b === void 0 ? void 0 : _b.isConnected()) || true;
    }
    /**
     * Sets the database connection and emit the connection event
     * @param db - Database instance or Mongoose instance to set
     * @param [client] - Optional Mongo client for MongoDb v3
     **/
    _setDb(db, client) {
        this.connecting = false;
        // Check if the object is a mongoose instance, a mongoose Connection or a mongo Db object
        this.db = utils_1.getDatabase(db);
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
        if (utils_1.shouldListenOnDb()) {
            eventSource = this.db;
        }
        else if (this.client) {
            eventSource = this.client;
        }
        if (eventSource) {
            for (const evt of errorEventNames)
                eventSource.on(evt, errorEvent);
        }
        this._updateConnectionStatus();
        // Emit on next tick so user code can set listeners in case the db object is already available
        process.nextTick(() => {
            this.emit('connection', { db: this.db, client: this.client });
        });
    }
    /**
     * Removes the database reference and emit the connectionFailed event
     * @param err - The error received while trying to connect
     **/
    _fail(error) {
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
    _generate(request, file) {
        return __awaiter(this, void 0, void 0, function* () {
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
            }
            else if (is_generator_1.default(this._file)) {
                isGen = true;
                generator = this._file;
                result = generator.next([request, file]);
            }
            else {
                result = this._file(request, file);
            }
            return GridFsStorage._handleResult(result, isGen);
        });
    }
}
exports.GridFsStorage = GridFsStorage;
GridFsStorage.cache = new cache_1.Cache();
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
exports.GridFsStorageCtr = new Proxy(GridFsStorage, {
    apply(target, thisArg, argumentsList) {
        // @ts-expect-error
        return new target(...argumentsList); // eslint-disable-line new-cap
    },
});
//# sourceMappingURL=gridfs.js.map