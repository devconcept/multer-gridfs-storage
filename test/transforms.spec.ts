import { Readable, Transform } from 'node:stream';
import anyTest, { TestFn } from 'ava';
import { GridFSBucket } from 'mongodb';

import { GridFsStorage } from '../src';
import { storageOptions } from './utils/settings';
import { cleanStorage } from './utils/testutils';

const test = anyTest as TestFn<{ storage: any }>;

test.afterEach.always(async (t) => cleanStorage(t.context.storage));

function upperCaseTransform(): Transform {
	return new Transform({
		transform(chunk, encoding, callback) {
			callback(null, Buffer.from(chunk.toString().toUpperCase()));
		},
	});
}

async function downloadFile(storage: any, id: any, bucketName: string): Promise<string> {
	const bucket = new GridFSBucket(storage.db, { bucketName });
	const chunks: Buffer[] = [];
	for await (const chunk of bucket.openDownloadStream(id)) {
		chunks.push(chunk as Buffer);
	}

	return Buffer.concat(chunks).toString();
}

test('applies transforms to the stored file', async (t) => {
	const storage = new GridFsStorage({
		...storageOptions(),
		file: () => ({ filename: 'transformed.txt', transforms: [upperCaseTransform()] }),
	});
	t.context.storage = storage;
	await storage.ready();

	const readable = Readable.from([Buffer.from('hello world')]);
	const result: any = await storage.fromStream(readable, undefined, undefined);
	const content = await downloadFile(storage, result.id, result.bucketName);

	t.is(content, 'HELLO WORLD');
});

test('chains multiple transforms in order', async (t) => {
	const exclaim = new Transform({
		transform(chunk, encoding, callback) {
			callback(null, Buffer.from(chunk.toString() + '!'));
		},
	});
	const storage = new GridFsStorage({
		...storageOptions(),
		file: () => ({ filename: 'chained.txt', transforms: [upperCaseTransform(), exclaim] }),
	});
	t.context.storage = storage;
	await storage.ready();

	const readable = Readable.from([Buffer.from('hi')]);
	const result: any = await storage.fromStream(readable, undefined, undefined);
	const content = await downloadFile(storage, result.id, result.bucketName);

	t.is(content, 'HI!');
});

test('surfaces transform errors as a stream error instead of hanging', async (t) => {
	const failing = new Transform({
		transform(chunk, encoding, callback) {
			callback(new Error('transform failed'));
		},
	});
	const storage = new GridFsStorage({
		...storageOptions(),
		file: () => ({ filename: 'failing.txt', transforms: [failing] }),
	});
	t.context.storage = storage;
	await storage.ready();

	const streamErrors: Error[] = [];
	storage.on('streamError', (error: Error) => streamErrors.push(error));

	const readable = Readable.from([Buffer.from('data')]);
	const error: any = await t.throwsAsync(storage.fromStream(readable, undefined, undefined));

	t.is(error.message, 'transform failed');
	t.is(streamErrors.length, 1);
});
