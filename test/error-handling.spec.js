import test from 'ava';
import multer from 'multer';
import request from 'supertest';
import express from 'express';
import {MongoClient} from 'mongodb';
import {spy, restore} from 'sinon';

import {generateUrl} from './utils/settings';
import {files, cleanStorage, getDb, getClient} from './utils/testutils';
import GridFsStorage from '..';

test.afterEach.always(t => {
	restore();
	return cleanStorage(t.context.storage);
});

test('invalid configurations', t => {
	const errFn = () => new GridFsStorage({});
	const errFn2 = () => new GridFsStorage();

	t.throws(
		errFn,
		'Error creating storage engine. At least one of url or db option must be provided.'
	);
	t.throws(
		errFn2,
		'Error creating storage engine. At least one of url or db option must be provided.'
	);
});

test('invalid types as file configurations', async t => {
	const url = generateUrl();
	let error = {};
	const app = express();
	const storage = new GridFsStorage({
		url,
		file: () => true
	});
	t.context.storage = storage;
	const upload = multer({storage});
	app.post('/url', upload.single('photo'), (err, req, res, next) => {
		error = err;
		next();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photo', files[0]);

	t.true(error instanceof Error);
	t.is(error.message, 'Invalid type for file settings, got boolean');
});

test('fails gracefully if an error is thrown inside the configuration function', async t => {
	const url = generateUrl();
	let error = {};
	const app = express();
	const storage = new GridFsStorage({
		url,
		file: () => {
			throw new Error('Error thrown');
		}
	});

	const upload = multer({storage});

	app.post('/url', upload.single('photo'), (err, req, res, next) => {
		error = err;
		next();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photo', files[0]);

	t.true(error instanceof Error);
	t.is(error.message, 'Error thrown');
});

test('fails gracefully if an error is thrown inside a generator function', async t => {
	const url = generateUrl();
	let error = {};
	const app = express();
	const storage = new GridFsStorage({
		url,
		/* eslint-disable-next-line require-yield */
		*file() {
			throw new Error('File error');
		}
	});

	const upload = multer({storage});

	app.post('/url', upload.single('photo'), (err, req, res, next) => {
		error = err;
		next();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photo', files[0]);

	t.true(error instanceof Error);
	t.is(error.message, 'File error');
});

test('connection promise fails to connect', async t => {
	const error = new Error('Failed promise');
	const app = express();
	const errorSpy = spy();

	const promise = new Promise((resolve, reject) => {
		setTimeout(() => reject(error), 200);
	});

	const storage = new GridFsStorage({db: promise});

	const upload = multer({storage});

	/* eslint-disable-next-line no-unused-vars, handle-callback-err */
	app.post('/url', upload.single('photo'), (err, req, res, next) => {
		res.end();
	});

	storage.on('connectionFailed', errorSpy);

	await request(app)
		.post('/url')
		.attach('photo', files[0]);

	t.is(errorSpy.callCount, 1);
	t.true(errorSpy.calledWith(error));
	t.is(storage.db, null);
});

test('connection is not opened', async t => {
	const url = generateUrl();
	let error = {};
	const app = express();
	const _db = await MongoClient.connect(url, {useNewUrlParser: true});
	const db = getDb(_db);
	const client = getClient(_db);
	if (client) {
		await client.close();
	} else {
		await db.close();
	}

	const storage = new GridFsStorage({db});
	const upload = multer({storage});

	app.post('/url', upload.array('photos', 2), (err, req, res, next) => {
		error = err;
		next();
	});

	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[0]);

	t.true(error instanceof Error);
	t.is(error.message, 'The database connection must be open to store files');
});
