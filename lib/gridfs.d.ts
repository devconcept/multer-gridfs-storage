/// <reference types="node" />
import { EventEmitter } from 'events';
import { Db, GridFSBucketWriteStream, MongoClient, MongoClientOptions } from 'mongodb';
import { Request } from 'express';
import { StorageEngine } from 'multer';
import { Cache } from './cache';
import { GridFile, ConnectionResult, NodeCallback, UrlStorageOptions, DbStorageOptions } from './types';
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
export declare class GridFsStorage extends EventEmitter implements StorageEngine {
    static cache: Cache;
    db: Db;
    client: MongoClient;
    configuration: DbStorageOptions | UrlStorageOptions;
    connected: boolean;
    connecting: boolean;
    caching: boolean;
    error: any;
    private _file;
    private readonly _options;
    private readonly cacheName;
    private readonly cacheIndex;
    constructor(configuration: UrlStorageOptions | DbStorageOptions);
    /**
     * Generates 16 bytes long strings in hexadecimal format
     */
    static generateBytes(): Promise<{
        filename: string;
    }>;
    /**
     * Merge the properties received in the file function with default values
     * @param extra Extra properties like contentType
     * @param fileSettings Properties received in the file function
     * @return An object with the merged properties wrapped in a promise
     */
    private static _mergeProps;
    /**
     * Handles generator function and promise results
     * @param result - Can be a promise or a generator yielded value
     * @param isGen - True if is a yielded value
     **/
    private static _handleResult;
    /**
     * Storage interface method to handle incoming files
     * @param {Request} request - The request that trigger the upload
     * @param {File} file - The uploaded file stream
     * @param cb - A standard node callback to signal the end of the upload or an error
     **/
    _handleFile(request: Request, file: any, cb: NodeCallback): void;
    /**
     * Storage interface method to delete files in case an error turns the request invalid
     * @param request - The request that trigger the upload
     * @param {File} file - The uploaded file stream
     * @param cb - A standard node callback to signal the end of the upload or an error
     **/
    _removeFile(request: Request, file: any, cb: NodeCallback): void;
    /**
     * Waits for the MongoDb connection associated to the storage to succeed or fail
     */
    ready(): Promise<ConnectionResult>;
    /**
     * Pipes the file stream to the MongoDb database. The file requires a property named `file` which is a readable stream
     * @param request - The http request where the file was uploaded
     * @param {File} file - The file stream to pipe
     * @return  {Promise} Resolves with the uploaded file
     */
    fromFile(request: Request, file: any): Promise<GridFile>;
    /**
     * Pipes the file stream to the MongoDb database. The request and file parameters are optional and used for file generation only
     * @param readStream - The http request where the file was uploaded
     * @param [request] - The http request where the file was uploaded
     * @param {File} [file] - The file stream to pipe
     * @return Resolves with the uploaded file
     */
    fromStream(readStream: NodeJS.ReadableStream, request: Request, file: any): Promise<GridFile>;
    protected _openConnection(url: string, options: MongoClientOptions): Promise<ConnectionResult>;
    /**
     * Create a writable stream with backwards compatibility with GridStore
     * @param {object} options - The stream options
     */
    protected createStream(options: any): GridFSBucketWriteStream;
    private fromMulterStream;
    /**
     * Determines if a new connection should be created, a explicit connection is provided or a cached instance is required.
     */
    private _connect;
    /**
     * Returns a promise that will resolve to the db and client from the cache or a new connection depending on the provided configuration
     */
    private _resolveConnection;
    /**
     * Handles creating a new connection from an url and storing it in the cache if necessary*}>}
     */
    private _createConnection;
    /**
     * Updates the connection status based on the internal db or client object
     **/
    private _updateConnectionStatus;
    /**
     * Sets the database connection and emit the connection event
     * @param db - Database instance or Mongoose instance to set
     * @param [client] - Optional Mongo client for MongoDb v3
     **/
    private _setDb;
    /**
     * Removes the database reference and emit the connectionFailed event
     * @param err - The error received while trying to connect
     **/
    private _fail;
    /**
     * Tests for generator functions or plain functions and delegates to the appropriate method
     * @param request - The request that trigger the upload as received in _handleFile
     * @param {File} file - The uploaded file stream as received in _handleFile
     * @return A promise with the value generated by the file function
     **/
    private _generate;
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
export declare const GridFsStorageCtr: typeof GridFsStorage;
