import test from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import mongo, {MongoClient, Db, Server} from 'mongodb';
import {spy, stub, restore} from 'sinon';

import {connection, storageOpts} from './utils/settings';
import {cleanStorage, files, mongoVersion} from './utils/testutils';
import GridFsStorage from '..';

const {host, port, database} = connection;

test.serial.afterEach.always(t => {
	restore();
	return cleanStorage(t.context.storage);
});

test.serial('handle GridStore open error', async t => {
	const app = express();
	const errorSpy = spy();
	const fileSpy = spy();
	const err = new Error();

	stub(mongo, 'GridStore').returns({
		stream: stub().returns({
			on: stub(),
			gs: {
				open: stub().callsFake(cb => cb(err))
			}
		})
	});
	const storage = new GridFsStorage(storageOpts());
	t.context.storage = storage;
	storage._legacy = true;
	storage.on('streamError', errorSpy);
	storage.on('file', fileSpy);

	const upload = multer({storage});

	/* eslint-disable-next-line no-unused-vars, handle-callback-err */
	app.post('/url', upload.single('photo'), (err, req, res, next) => {
		res.end();
	});

	await request(app)
		.post('/url')
		.attach('photo', files[0]);

	t.is(errorSpy.callCount, 1);
	t.is(fileSpy.callCount, 0);
	const call = errorSpy.getCall(0);
	t.is(call.args[0], err);
});

test.serial('handle GridStore close error', async t => {
	const app = express();
	const errorSpy = spy();
	const fileSpy = spy();
	const err = new Error();

	const emitterStub = stub().callsFake((evt, cb) => {
		if (evt === 'end') {
			return cb();
		}
	});
	stub(mongo, 'GridStore').returns({
		stream: stub().returns({
			on: emitterStub,
			gs: {
				open: stub().callsFake(cb => cb()),
				close: stub().callsFake(cb => cb(err))
			}
		})
	});
	const storage = new GridFsStorage(storageOpts());
	storage._legacy = true;
	t.context.storage = storage;
	storage.on('streamError', errorSpy);
	storage.on('file', fileSpy);

	const upload = multer({storage});

	/* eslint-disable-next-line no-unused-vars, handle-callback-err */
	app.post('/url', upload.single('photo'), (err, req, res, next) => {
		res.end();
	});

	await request(app)
		.post('/url')
		.attach('photo', files[0]);

	t.is(errorSpy.callCount, 1);
	t.is(fileSpy.callCount, 0);
	const call = errorSpy.getCall(0);
	t.is(call.args[0], err);
});

test.serial('handles MongoClient and Db objects', async t => {
	const server = new Server(host, port);
	const db = new Db(database, server);

	const mongoSpy = stub(MongoClient, 'connect').callsFake((...args) => {
		const callback = args.length > 2 ? args[2] : null;
		if (callback) {
			return callback(null, db);
		}

		return Promise.resolve(db);
	});
	const storage = new GridFsStorage(storageOpts());

	await storage.ready();
	t.is(mongoSpy.callCount, 1);
	t.true(storage.db instanceof Db);
	t.is(storage.client, null);
});

if (!mongoVersion.startsWith('2')) {
	test.serial('handles the client instance returned in mongo 3', async t => {
		const server = new Server(host, port);
		const db = new Db(database, server);
		const client = new MongoClient(server);
		stub(client, 'db').callsFake(() => db);
		const mongoSpy = stub(MongoClient, 'connect').callsFake((...args) => {
			const callback = args.length > 2 ? args[2] : null;
			if (callback) {
				return callback(null, client);
			}

			return Promise.resolve(client);
		});
		const storage = new GridFsStorage(storageOpts());
		await storage.ready();
		t.is(mongoSpy.callCount, 1);
		t.true(db instanceof Db);
		t.true(client instanceof MongoClient);
	});
}
