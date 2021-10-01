import crypto from 'crypto';
import anyTest, {TestInterface} from 'ava';
import multer from 'multer';
import request from 'supertest';
import express from 'express';
import {MongoClient} from 'mongodb';
import delay from 'delay';
import {spy, stub, restore} from 'sinon';

import {GridFsStorage} from '../src';
import {storageOptions} from './utils/settings';
import {files, cleanStorage, fakeConnectCb} from './utils/testutils';
import {EdgeCasesContext} from './types/edge-cases-context';

const test = anyTest as TestInterface<EdgeCasesContext>;

test.serial('connection function fails to connect', async (t) => {
	const error = new Error('Failed connection');
	const mongoSpy = stub(MongoClient, 'connect').callsFake(fakeConnectCb(error));

	const connectionSpy = spy();
	const storage = new GridFsStorage(storageOptions());

	storage.once('connectionFailed', connectionSpy);

	await delay(50);
	t.is(connectionSpy.callCount, 1);
	t.is(mongoSpy.callCount, 1);
});

test.serial('errors generating random bytes', async (t) => {
	const app = express();
	const generatedError = new Error('Random bytes error');
	let error: any = {};

	const storage = new GridFsStorage(storageOptions());
	const randomBytesSpy = stub(crypto, 'randomBytes').callsFake((size, cb) => {
		if (cb) {
			cb(generatedError, null);
			return;
		}

		throw generatedError;
	});
	t.context.storage = storage;
	const upload = multer({storage});

	app.post(
		'/url',
		upload.single('photo'),
		(error_, request_, response, next) => {
			error = error_;
			next();
		},
	);

	await storage.ready();
	await request(app).post('/url').attach('photo', files[0]);

	t.is(error, generatedError);
	t.is(error.message, 'Random bytes error');
	t.is(randomBytesSpy.callCount, 1);
});

test.serial.afterEach.always(async (t) => {
	restore();
	await cleanStorage(t.context.storage);
});
