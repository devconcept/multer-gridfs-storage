import { Readable, Transform } from 'node:stream';
import { test, expect, afterEach, describe } from 'vitest';
import { GridFSBucket } from 'mongodb';

import { GridFsStorage } from '../src';
import { storageOptions } from './utils/settings';
import { cleanStorage } from './utils/testutils';

let storage: any;

function upperCaseTransform(): Transform {
	return new Transform({
		transform(chunk, encoding, callback) {
			callback(null, Buffer.from(chunk.toString().toUpperCase()));
		},
	});
}

async function downloadFile(id: any, bucketName: string): Promise<string> {
	const bucket = new GridFSBucket(storage.db, { bucketName });
	const chunks: Buffer[] = [];
	for await (const chunk of bucket.openDownloadStream(id)) {
		chunks.push(chunk as Buffer);
	}

	return Buffer.concat(chunks).toString();
}

describe('file transforms', () => {
	afterEach(async () => cleanStorage(storage));

	test('applies transforms to the stored file', async () => {
		storage = new GridFsStorage({
			...storageOptions(),
			file: () => ({ filename: 'transformed.txt', transforms: [upperCaseTransform()] }),
		});
		await storage.ready();

		const readable = Readable.from([Buffer.from('hello world')]);
		const result: any = await storage.fromStream(readable, undefined, undefined);
		const content = await downloadFile(result.id, result.bucketName);

		expect(content).toBe('HELLO WORLD');
	});

	test('chains multiple transforms in order', async () => {
		const exclaim = new Transform({
			transform(chunk, encoding, callback) {
				callback(null, Buffer.from(chunk.toString() + '!'));
			},
		});
		storage = new GridFsStorage({
			...storageOptions(),
			file: () => ({ filename: 'chained.txt', transforms: [upperCaseTransform(), exclaim] }),
		});
		await storage.ready();

		const readable = Readable.from([Buffer.from('hi')]);
		const result: any = await storage.fromStream(readable, undefined, undefined);
		const content = await downloadFile(result.id, result.bucketName);

		expect(content).toBe('HI!');
	});

	test('surfaces transform errors as a stream error instead of hanging', async () => {
		const failing = new Transform({
			transform(chunk, encoding, callback) {
				callback(new Error('transform failed'));
			},
		});
		storage = new GridFsStorage({
			...storageOptions(),
			file: () => ({ filename: 'failing.txt', transforms: [failing] }),
		});
		await storage.ready();

		const streamErrors: Error[] = [];
		storage.on('streamError', (error: Error) => streamErrors.push(error));

		const readable = Readable.from([Buffer.from('data')]);
		let caught: any;
		try {
			await storage.fromStream(readable, undefined, undefined);
		} catch (error) {
			caught = error;
		}

		expect(caught.message).toBe('transform failed');
		expect(streamErrors.length).toBe(1);
	});
});
