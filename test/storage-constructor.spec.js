import test from 'ava';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import pify from 'pify';
import mongoose from 'mongoose';
import md5FileCb from 'md5-file';
import {MongoClient} from 'mongodb';

import {files, cleanStorage, getDb, getClient, dropDatabase} from './utils/testutils';
import {generateUrl, storageOpts} from './utils/settings';
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

	t.truthy(result.files);
	t.true(Array.isArray(result.files));
	t.is(result.files.length, 2);
	const md5 = await Promise.all(
		result.files.map(async (f, idx) => {
			const computed = await md5File(files[idx]);
			return {md5: f.md5, computed};
		})
	);
	t.true(md5.every(f => f.md5 === f.computed));
});

test('create storage from db parameter', async t => {
	const url = generateUrl();
	t.context.url = url;
	let result = {};
	const _db = await MongoClient.connect(url, {useNewUrlParser: true});
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

	t.truthy(result.files);
	t.true(Array.isArray(result.files));
	t.is(result.files.length, 2);
	const md5 = await Promise.all(
		result.files.map(async (f, idx) => {
			const computed = await md5File(files[idx]);
			return {md5: f.md5, computed};
		})
	);
	t.true(md5.every(f => f.md5 === f.computed));
});

test('connects to a mongoose instance', async t => {
	const url = generateUrl();
	t.context.url = url;
	let result = {};
	const promise = mongoose.connect(url, {useNewUrlParser: true});
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
	t.truthy(result.files);
	t.true(Array.isArray(result.files));
	t.is(result.files.length, 2);
	const md5 = await Promise.all(
		result.files.map(async (f, idx) => {
			const computed = await md5File(files[idx]);
			return {md5: f.md5, computed};
		})
	);
	t.true(md5.every(f => f.md5 === f.computed));

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

	t.truthy(result.files);
	t.true(Array.isArray(result.files));
	t.is(result.files.length, 2);
	const md5 = await Promise.all(
		result.files.map(async (f, idx) => {
			const computed = await md5File(files[idx]);
			return {md5: f.md5, computed};
		})
	);
	t.true(md5.every(f => f.md5 === f.computed));
});
