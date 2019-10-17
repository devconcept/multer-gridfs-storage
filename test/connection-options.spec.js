import test from 'ava';

import {cleanStorage} from './utils/testutils';
import {generateUrl} from './utils/settings';
import GridFsStorage from '..';

test.afterEach.always('cleanup', t => {
	return cleanStorage(t.context.storage);
});

test('is compatible with an options object on url based connections', async t => {
	const url = generateUrl();
	const storage = new GridFsStorage({
		url,
		options: {useNewUrlParser: true, poolSize: 10}
	});
	t.context.storage = storage;

	await storage.ready();
	t.is(storage.db.serverConfig.s.poolSize, 10);
});
