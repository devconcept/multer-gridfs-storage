import { MulterGfsOptions } from './multer-gfs-options';
export interface UrlStorageOptions extends MulterGfsOptions {
    url: string;
    options?: any;
    cache?: boolean | string;
}
