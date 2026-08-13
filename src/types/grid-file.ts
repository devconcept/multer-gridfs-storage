import { Document, GridFSFile, ObjectId } from 'mongodb';

export interface GridFile {
	id: ObjectId;
	filename: string;
	metadata: Document | null;
	contentType?: string;
	chunkSize: number;
	bucketName: string;
	uploadDate: Date;
	size: number;
}

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		// eslint-disable-next-line @typescript-eslint/no-namespace
		namespace Multer {
			/**
			 * The stored file merges the base multer `File` with the mongodb
			 * `GridFSFile` document (`_id`, `length`, `chunkSize`, `filename`,
			 * `metadata`, `uploadDate`) plus the extra properties this storage engine
			 * assigns to every upload.
			 */
			interface File extends GridFSFile {
				id: ObjectId;
				bucketName: string;
				contentType?: string;
			}
		}
	}
}
