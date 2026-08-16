import { Document, GridFSFile, ObjectId } from 'mongodb';

export interface GridFile {
	id: ObjectId;
	filename: string;
	metadata: Document | null;
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
			 * `uploadDate`) plus the extra properties this storage engine assigns to
			 * every upload. `metadata` is redeclared as `Document | null` because this
			 * engine emits `null` (not the driver's `undefined`) when a file has none,
			 * matching {@link GridFile}.
			 */
			interface File extends Omit<GridFSFile, 'metadata'> {
				id: ObjectId;
				bucketName: string;
				metadata: Document | null;
			}
		}
	}
}
