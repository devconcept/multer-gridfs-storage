import { test, expect, afterEach } from 'vitest';
import { GridFsStorage } from '../src';
import { cleanStorage } from './utils/testutils';
import { storageOptions } from './utils/settings';

let storage: any;

afterEach(async () => {
	await cleanStorage(storage);
});

test('is compatible with an options object on url based connections', async () => {
	const { url, options } = storageOptions();
	storage = new GridFsStorage({
		url,
		options: { ...options, maxPoolSize: 10 },
	});

	await storage.ready();
	const value = storage.db!.client.options.maxPoolSize;
	expect(value).toBe(10);
});
