import test from 'ava';
import request from 'supertest';
import {MongoClient} from 'mongodb';

import {app} from '../app';
import {url1, url2} from '../settings';
import {cleanup, getDb, getFile} from './helpers';

const options = {useNewUrlParser: true, useUnifiedTopology: true};

test.afterEach.always('cleanup', t => {
	const {db, client} = t.context;
	return cleanup({db, client});
});

async function connectToDatabase(t, url) {
	t.context.url = url;
	const client = await MongoClient.connect(url, options);
	t.context.db = getDb(client, url);
	t.context.client = client;
}

async function assertFileWasUploaded(t, response) {
	const {db} = t.context;
	const collection = db.collection('fs.files');
	const count = await collection.estimatedDocumentCount();
	t.is(response.status, 201);
	t.is(count, 1);
}

test('upload files using async promises', async t => {
	await connectToDatabase(t, url1);
	const response = await request(app)
		.post('/async')
		.attach('field', getFile());

	return assertFileWasUploaded(t, response);
});

test('upload files using plain promises', async t => {
	await connectToDatabase(t, url2);
	const response = await request(app)
		.post('/promise')
		.attach('field', getFile());

	return assertFileWasUploaded(t, response);
});
