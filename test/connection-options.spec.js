import util from 'util';
import test from 'ava';
import {spy, stub, restore} from 'sinon';

import {cleanStorage} from './utils/testutils';
import {generateUrl} from './utils/settings';
import GridFsStorage from '..';

test.afterEach.always('cleanup', t => {
	restore();
	return cleanStorage(t.context.storage);
});

test('is compatible with an options object on url based connections', async t => {
	const url = generateUrl();
	const storage = new GridFsStorage({
		url,
		options: {poolSize: 10}
	});
	t.context.storage = storage;

	await storage.ready();
	t.is(storage.db.serverConfig.s.poolSize, 10);
});

test('preserves compatibility with a connectionOpts options property', async t => {
	const url = generateUrl();
	const warningSpy = spy();
	const deprecate = stub(util, 'deprecate').callThrough();
	process.on('warning', warningSpy);

	const storage = new GridFsStorage({
		url,
		connectionOpts: {poolSize: 10}
	});
	t.context.storage = storage;

	await storage.ready();
	const expectedMessage =
		'The property "connectionOpts" is deprecated. Use "options" instead.';
	t.is(storage.db.serverConfig.s.poolSize, 10);
	t.is(deprecate.callCount, 1);
	t.is(deprecate.getCall(0).args[1], expectedMessage);
	t.truthy(warningSpy.getCalls().find(c => c.args[0].message, expectedMessage));
});
