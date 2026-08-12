import { DbTypes } from './db-types';
import { MulterGfsOptions } from './multer-gfs-options';

export interface DbStorageOptions<T = DbTypes> extends MulterGfsOptions {
	db: T | Promise<T>;
}
