import { DbTypes } from './db-types.js';
import { MulterGfsOptions } from './multer-gfs-options.js';

export interface DbStorageOptions<T = DbTypes> extends MulterGfsOptions {
	db: T | Promise<T>;
}
