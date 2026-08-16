import { Duplex } from 'node:stream';
import { Document, ObjectId } from 'mongodb';
import { Request } from 'express';

/**
 * The set of properties a file naming function may return to control how an
 * incoming file is stored. Every property is optional; any that is omitted
 * falls back to the storage engine defaults.
 */
export interface FileConfig {
	/** The desired filename for the file (default: 16 byte hex name without extension). */
	filename?: string;
	/** An ObjectId to use as identifier (default: auto-generated). */
	id?: ObjectId;
	/** The metadata for the file (default: `null`). */
	metadata?: Document | null;
	/** The size of file chunks in bytes (default: 261120). */
	chunkSize?: number;
	/** The GridFs collection to store the file (default: `fs`). */
	bucketName?: string;
	/** Optional array of transform streams to pipe the file through before it is stored. */
	transforms?: Duplex[];
}

/**
 * A single value the file function may produce. A `FileConfig` object gives full
 * control, a `string` or `number` is used as the filename, and `null`/`undefined`
 * leaves every property at its default.
 */
export type FileConfigValue = FileConfig | string | number | null | undefined | void;

/**
 * The result the file function may return: a value directly or a promise that
 * resolves with one.
 */
export type FileConfigResult = FileConfigValue | Promise<FileConfigValue>;

/**
 * A plain file naming function, invoked once per file with the request and the
 * incoming file.
 */
export type FileFunction = (request: Request, file: Express.Multer.File) => FileConfigResult;

/**
 * A generator instance produced by a {@link FileGeneratorFunction}. On each new
 * file the storage engine resumes it, sending back the `[request, file]` tuple.
 */
export type FileGenerator = Generator<FileConfigResult, FileConfigResult, [Request, Express.Multer.File]>;

/**
 * A generator-based file naming function. It should be infinite (never reach the
 * `{ done: true }` state) so it can name every uploaded file.
 */
export type FileGeneratorFunction = (request: Request, file: Express.Multer.File) => FileGenerator;

/**
 * The accepted shapes for the `file` option: a plain function or a generator
 * function.
 */
export type FileOption = FileFunction | FileGeneratorFunction;
