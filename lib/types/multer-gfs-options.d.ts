import { Request } from 'express';
export interface MulterGfsOptions {
    file?: (request: Request, file: any) => any;
}
