/**
 * Module entry point
 * @module multer-gridfs-storage
 */

export * from './cache.js';
export * from './types/index.js';

export { GridFsStorageCtr as GridFsStorage } from './gridfs.js';
// The `GridFsStorage` export above is the callable Proxy value; expose the class under a distinct
// name so consumers can type storage instances (e.g. `let storage: GridFsStorageInstance`).
export type { GridFsStorage as GridFsStorageInstance } from './gridfs.js';
