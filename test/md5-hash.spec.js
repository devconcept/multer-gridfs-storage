import test from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';

import {files, cleanStorage, mongoVersion} from './utils/testutils';
import {generateUrl} from './utils/settings';
import GridFsStorage from '..';

test.before(async t => {
	const url = generateUrl();
	const app = express();
	const storage = new GridFsStorage({
		url,
		file: () => ({disableMD5: true})
	});
	t.context.storage = storage;
	const upload = multer({storage});

	app.post('/url', upload.array('photo', 2), (req, res) => {
		t.context.result = {headers: req.headers, files: req.files, body: req.body};
		res.end();
	});

	await storage.ready();
	await request(app).post('/url')
		.attach('photo', files[0])
		.attach('photo', files[0]);
});

test.after.always('cleanup', t => {
	cleanStorage(t.context.storage);
});

test('files don\'t have a computed MD5 hash', t => {
	const [major, minor] = mongoVersion.split('.');
	if (major < 3 || (major === 3 && minor < 1)) {
		return t.pass('Md5 hash is not supported in this mongo version');
	}

	const {result} = t.context;
	t.is(result.files[0].md5, undefined);
	t.is(result.files[1].md5, undefined);
});
