import anyTest, { TestInterface } from 'ava';
import { GridFsStorage } from '../src';
import { cleanStorage } from './utils/testutils';
import { storageOptions } from './utils/settings';
import { ConnectionOptionsContext } from './types/connection-options-context';

const test = anyTest as TestInterface<ConnectionOptionsContext>;

test.afterEach.always('cleanup', async (t) => {
	await cleanStorage(t.context.storage);
});

test('is compatible with an options object on url based connections', async (t) => {
	const { url, options } = storageOptions();
	const storage = new GridFsStorage({
		url,
		options: { ...options, maxPoolSize: 10 },
	});
	t.context.storage = storage;

	await storage.ready();
	const value = storage.db!.client.options.maxPoolSize;
	t.is(value, 10);
});
