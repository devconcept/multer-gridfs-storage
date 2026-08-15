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
