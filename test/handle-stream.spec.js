import test from 'ava';
import hasOwn from 'has-own-prop';
import fs from 'fs';

import {cleanStorage, files} from './utils/testutils';
import {storageOptions} from './utils/settings';
import GridFsStorage from '..';

test.before(async (t) => {
	const storage = new GridFsStorage({
		...storageOptions(),
		file: () => 'test.jpg'
	});
	t.context.storage = storage;
	const file = {stream: fs.createReadStream(files[0])};

	await storage.ready();
	t.context.result = await storage.fromFile(null, file);
});

test.after.always('cleanup', (t) => {
	return cleanStorage(t.context.storage);
});

test('upload a file using the fromFile method', (t) => {
	const {result} = t.context;
	t.true(hasOwn(result, 'filename'));
	t.is(result.filename, 'test.jpg');
});
