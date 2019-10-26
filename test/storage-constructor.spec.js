import test from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import mongoose from 'mongoose';
import {MongoClient} from 'mongodb';

import {
	files,
	cleanStorage,
	getDb,
	getClient,
	dropDatabase, delay
} from './utils/testutils';
import {storageOpts} from './utils/settings';
import {fileMatchMd5Hash} from './utils/macros';
import GridFsStorage from '..';

function prepareTest(t, opts) {
	const app = express();
	const storage = new GridFsStorage(opts);
	const upload = multer({storage});
	t.context.storage = storage;
	t.context.upload = upload;
	t.context.app = app;
}

test.afterEach.always('cleanup', async t => {
	const {storage, url} = t.context;
	await cleanStorage(storage);
	return dropDatabase(url);
});

test('create storage from url parameter', async t => {
	let result = {};
	prepareTest(t, storageOpts());
	const {app, storage, upload} = t.context;

	app.post('/url', upload.array('photos', 2), (req, res) => {
		result = {headers: req.headers, files: req.files, body: req.body};
		res.end();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	return fileMatchMd5Hash(t, result.files);
});

test('create storage from db parameter', async t => {
	const {url, options} = storageOpts();
	t.context.url = url;
	let result = {};
	const _db = await MongoClient.connect(url, options);
	const db = getDb(_db, url);
	prepareTest(t, {db});
	const {app, storage, upload} = t.context;
	storage.client = getClient(_db);

	app.post('/url', upload.array('photos', 2), (req, res) => {
		result = {headers: req.headers, files: req.files, body: req.body};
		res.end();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	return fileMatchMd5Hash(t, result.files);
});

test('connects to a mongoose instance', async t => {
	const {url, options} = storageOpts();
	t.context.url = url;
	let result = {};
	const promise = mongoose.connect(url, options);
	prepareTest(t, {db: promise});
	const {app, storage, upload} = t.context;

	app.post('/url', upload.array('photos', 2), (req, res) => {
		result = {headers: req.headers, files: req.files, body: req.body};
		res.end();
	});

	const instance = await storage.ready();
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	t.true(instance instanceof mongoose.mongo.Db);
	await fileMatchMd5Hash(t, result.files);

	storage.client = mongoose.connection;
});

test('creates an instance without the new keyword', async t => {
	let result = {};
	const app = express();
	/* eslint-disable-next-line new-cap */
	const storage = GridFsStorage(storageOpts());
	const upload = multer({storage});
	t.context.storage = storage;

	app.post('/url', upload.array('photos', 2), (req, res) => {
		result = {headers: req.headers, files: req.files, body: req.body};
		res.end();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	return fileMatchMd5Hash(t, result.files);
});

test('accept the client as one of the parameters', async t => {
	const {url, options} = storageOpts();
	t.context.url = url;
	let result = {};
	const _db = await MongoClient.connect(url, options);
	const db = getDb(_db, url);
	const client = getClient(_db);
	prepareTest(t, {db, client});
	const {app, storage, upload} = t.context;
	t.is(storage.client, client);

	app.post('/url', upload.array('photos', 2), (req, res) => {
		result = {headers: req.headers, files: req.files, body: req.body};
		res.end();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	return fileMatchMd5Hash(t, result.files);
});

test('waits for the client if is a promise', async t => {
	const {url, options} = storageOpts();
	t.context.url = url;
	let result = {};
	const _db = await MongoClient.connect(url, options);
	const db = getDb(_db, url);
	const client = delay(100).then(() => getClient(_db));
	prepareTest(t, {db, client});
	const {app, storage, upload} = t.context;
	t.is(storage.client, null);

	app.post('/url', upload.array('photos', 2), (req, res) => {
		result = {headers: req.headers, files: req.files, body: req.body};
		res.end();
	});

	await storage.ready();
	await request(app)
		.post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	t.not(storage.client, null);
	return fileMatchMd5Hash(t, result.files);
});
