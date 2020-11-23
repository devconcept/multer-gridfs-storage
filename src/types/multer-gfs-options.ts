import {Request} from 'express';

export interface MulterGfsOptions {
	file?: (req: Request, file: any) => any;
}
