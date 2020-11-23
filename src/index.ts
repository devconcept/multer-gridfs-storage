/**
 * Module entry point
 * @module multer-gridfs-storage
 */

import {GridFsStorageCtr} from './gridfs';

export * from './cache';
export * from './types';
export const GridFsStorage = GridFsStorageCtr;
