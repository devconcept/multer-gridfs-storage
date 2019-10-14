import test from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import pify from 'pify';
import mongoose from 'mongoose';
import md5FileCb from 'md5-file';
import {MongoClient} from 'mongodb';

import {files, cleanStorage, getDb, getClient} from './utils/testutils';
import {generateUrl} from './utils/settings';
import GridFsStorage from '..';

const md5File = pify(md5FileCb);

function prepareTest(t, opts) {
	const app = express();
	const storage = new GridFsStorage(opts);
	const upload = multer({storage});
	t.context.storage = storage;
	t.context.upload = upload;
	t.context.app = app;
}

test.afterEach.always('cleanup', t => {
	cleanStorage(t.context.storage);
});

test('create storage from url parameter', async t => {
	const url = generateUrl();
	let result = {};
	prepareTest(t, {url});
	const {app, storage, upload} = t.context;

	app.post('/url', upload.array('photos', 2), (req, res) => {
		result = {headers: req.headers, files: req.files, body: req.body};
		res.end();
	});

	await storage.ready();
	await request(app).post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	t.truthy(result.files);
	t.true(Array.isArray(result.files));
	t.is(result.files.length, 2);
	for (let i = 0; i < result.files.length; i++) {
		const file = result.files[i];
		t.is(file.md5, await md5File(files[i]));
	}
});

test('create storage from db parameter', async t => {
	const url = generateUrl();
	let result = {};
	const dbOrClient = await MongoClient.connect(url, {useNewUrlParser: true});
	const db = getDb(dbOrClient);
	prepareTest(t, {db});
	const {app, storage, upload} = t.context;
	storage.client = getClient(dbOrClient);

	app.post('/url', upload.array('photos', 2), (req, res) => {
		result = {headers: req.headers, files: req.files, body: req.body};
		res.end();
	});

	await storage.ready();
	await request(app).post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	t.truthy(result.files);
	t.true(Array.isArray(result.files));
	t.is(result.files.length, 2);
	for (let i = 0; i < result.files.length; i++) {
		const file = result.files[i];
		t.is(file.md5, await md5File(files[i]));
	}
});

test('connects to a mongoose instance', async t => {
	const url = generateUrl();
	let result = {};
	const promise = mongoose.connect(url, {useNewUrlParser: true});
	prepareTest(t, {db: promise});
	const {app, storage, upload} = t.context;

	app.post('/url', upload.array('photos', 2), (req, res) => {
		result = {headers: req.headers, files: req.files, body: req.body};
		res.end();
	});

	const instance = await storage.ready();
	await request(app).post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	t.true(instance instanceof mongoose.mongo.Db);
	t.truthy(result.files);
	t.true(Array.isArray(result.files));
	t.is(result.files.length, 2);
	for (let i = 0; i < result.files.length; i++) {
		const file = result.files[i];
		t.is(file.md5, await md5File(files[i]));
	}

	storage.client = mongoose.connection;
});

test('creates an instance without the new keyword', async t => {
	const url = generateUrl();
	let result = {};
	const app = express();
	const storage = GridFsStorage({url});
	const upload = multer({storage});
	t.context.storage = storage;

	app.post('/url', upload.array('photos', 2), (req, res) => {
		result = {headers: req.headers, files: req.files, body: req.body};
		res.end();
	});

	await storage.ready();
	await request(app).post('/url')
		.attach('photos', files[0])
		.attach('photos', files[1]);

	t.truthy(result.files);
	t.true(Array.isArray(result.files));
	t.is(result.files.length, 2);
	for (let i = 0; i < result.files.length; i++) {
		const file = result.files[i];
		t.is(file.md5, await md5File(files[i]));
	}
});
