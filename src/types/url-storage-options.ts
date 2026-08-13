import { MongoClientOptions } from 'mongodb';
import { MulterGfsOptions } from './multer-gfs-options';

export interface UrlStorageOptions extends MulterGfsOptions {
	url: string;
	options?: MongoClientOptions;
	cache?: boolean | string;
}
