import { MulterGfsOptions } from './multer-gfs-options';
import { MongoClient } from 'mongodb';
import { DbTypes } from './db-types';
export interface DbStorageOptions<T = DbTypes> extends MulterGfsOptions {
    db: T | Promise<T>;
    client?: MongoClient;
}
