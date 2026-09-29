import { EventEmitter } from 'node:events';
import { test, expect, afterEach, describe } from 'vitest';
import { restore } from 'sinon';

import { GridFsStorage } from '../src';
import { cleanStorage } from './utils/testutils';

// These tests exercise the defensive guards that run when a storage has no open database
// connection. A db promise that rejects leaves the storage in a settled, failed state:
// connecting=false, db=null and error set.
let storage: any;

afterEach(async () => {
	restore();
	await cleanStorage(storage);
	storage = undefined;
});

class ExposedStorage extends (GridFsStorage as any) {
	createStreamPublic(options: any) {
		return (this as any).createStream(options);
	}
}

async function failedStorage(StorageClass: any = GridFsStorage): Promise<{ storage: any; error: Error }> {
	const error = new Error('Connection failed');
	const failed = new StorageClass({ db: Promise.reject(error) });
	await new Promise<void>((resolve) => {
		failed.once('connectionFailed', () => resolve());
	});
	return { storage: failed, error };
}

describe('GridFsStorage without an open connection', () => {
	test('handling a file calls back with the stored error', async () => {
		const { storage: s, error } = await failedStorage();
		storage = s;
		const err = await new Promise((resolve) => {
			s._handleFile({} as any, {} as any, resolve);
		});
		expect(err).toBe(error);
	});

	test('handling a file calls back with a default error when none was stored', async () => {
		const { storage: s } = await failedStorage();
		storage = s;
		s.error = null;
		const err: any = await new Promise((resolve) => {
			s._handleFile({} as any, {} as any, resolve);
		});
		expect(err).toBeInstanceOf(Error);
		expect(err.message).toBe('The database connection must be open to store files');
	});

	test('removing a file calls back with the stored error', async () => {
		const { storage: s, error } = await failedStorage();
		storage = s;
		const err = await new Promise((resolve) => {
			s._removeFile({} as any, {} as any, resolve);
		});
		expect(err).toBe(error);
	});

	test('removing a file calls back with a default error when none was stored', async () => {
		const { storage: s } = await failedStorage();
		storage = s;
		s.error = null;
		const err: any = await new Promise((resolve) => {
			s._removeFile({} as any, {} as any, resolve);
		});
		expect(err).toBeInstanceOf(Error);
		expect(err.message).toBe('The database connection must be open to remove files');
	});

	test('opening an upload stream throws', async () => {
		const { storage: s, error } = await failedStorage(ExposedStorage);
		storage = s;
		expect(() => s.createStreamPublic({ filename: 'a', bucketName: 'fs' })).toThrow(error);
		s.error = null;
		expect(() => s.createStreamPublic({ filename: 'a', bucketName: 'fs' })).toThrow('The database connection must be open to store files');
	});

	test('closing is a no-op on a storage that never connected', async () => {
		const { storage: s } = await failedStorage();
		storage = s;
		expect(() => s.close()).not.toThrow();
	});

	test('a db object without a client yields a null client and attaches no error listeners', async () => {
		// getDatabase returns the bare object as the Db; it has no `client`, so the `?? null` fallback
		// runs and the error-listener loop is skipped. Kept local (not the module `storage`) because its
		// fake db has no dropDatabase for cleanStorage to call.
		const s: any = new GridFsStorage({ db: {} as any });
		const result: any = await new Promise((resolve) => s.once('connection', resolve));
		expect(result.client).toBe(null);
		s.close();
	});
});

describe('GridFsStorage close()', () => {
	test('closing while connecting does not attach error listeners once the connection resolves', async () => {
		const client = new EventEmitter();
		let resolveDb: (db: any) => void = () => {};
		const s: any = new GridFsStorage({ db: new Promise<any>((resolve) => (resolveDb = resolve)) });
		s.close();
		resolveDb({ client });
		await new Promise((resolve) => setImmediate(resolve));
		expect(s.db).toBeTruthy();
		expect(client.listenerCount('error')).toBe(0);
		expect(s._clientEventSource).toBe(null);
	});

	test('closing rejects pending ready() calls instead of leaving them hanging', async () => {
		const s: any = new GridFsStorage({ db: new Promise<any>(() => {}) });
		const pending = s.ready();
		s.close();
		await expect(pending).rejects.toThrow('The storage was closed');
		await expect(s.ready()).rejects.toThrow('The storage was closed');
	});

	test('pending ready() calls are forgotten once the connection resolves', async () => {
		let resolveDb: (db: any) => void = () => {};
		const s: any = new GridFsStorage({ db: new Promise<any>((resolve) => (resolveDb = resolve)) });
		const pending = [s.ready(), s.ready(), s.ready()];
		expect(s._pendingReady.size).toBe(3);
		resolveDb({});
		await Promise.all(pending);
		expect(s._pendingReady.size).toBe(0);
		s.close();
	});

	test('pending ready() calls are forgotten once the connection fails', async () => {
		let rejectDb: (error: Error) => void = () => {};
		const s: any = new GridFsStorage({ db: new Promise<any>((_, reject) => (rejectDb = reject)) });
		const pending = [s.ready(), s.ready()];
		expect(s._pendingReady.size).toBe(2);
		rejectDb(new Error('Connection failed'));
		await Promise.allSettled(pending);
		expect(s._pendingReady.size).toBe(0);
		s.close();
	});
});

describe('GridFsStorage file settings merge', () => {
	test('undefined values do not override defaults or the generated id', async () => {
		const merged = await (GridFsStorage as any)._mergeProps({
			filename: 'name',
			bucketName: undefined,
			chunkSize: undefined,
			id: undefined,
			metadata: undefined,
		});
		expect(merged.bucketName).toBe('fs');
		expect(merged.chunkSize).toBe(261_120);
		expect(merged.metadata).toBe(null);
		expect(merged.id).toBeTruthy();
		expect(merged.filename).toBe('name');
	});

	test('provided values still override defaults', async () => {
		const merged = await (GridFsStorage as any)._mergeProps({ filename: 'n', bucketName: 'photos', chunkSize: 1024 });
		expect(merged.bucketName).toBe('photos');
		expect(merged.chunkSize).toBe(1024);
	});
});
