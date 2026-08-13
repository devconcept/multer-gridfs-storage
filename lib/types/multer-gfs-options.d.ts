import { Request } from 'express';
export interface MulterGfsOptions {
    file?: (request: Request, file: Express.Multer.File) => unknown;
}
