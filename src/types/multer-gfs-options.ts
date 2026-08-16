import { FileOption } from './file-config.js';

export interface MulterGfsOptions {
	/**
	 * A function (or generator function) invoked once per file to control how it
	 * is stored. See {@link FileOption}.
	 */
	file?: FileOption;
}
