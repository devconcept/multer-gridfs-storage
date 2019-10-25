import {createReadStream} from 'fs';
import test from 'ava';
import request from 'supertest';
import {MongoClient, GridFSBucket} from 'mongodb';

import {url} from '../settings';
import {dbReady} from '../connection';
import {app} from '../app';
import {cleanup, getDb, getFile, waitForStream, generateBytes} from './helpers';

test.serial.afterEach.always('cleanup', t => {
	const {db, client} = t.context;
	return cleanup({db, client});
});

async function connectToDatabase(t, url) {
	t.context.url = url;
	const client = await MongoClient.connect(url, {
		useNewUrlParser: true,
		useUnifiedTopology: true
	});
	t.context.db = getDb(client, url);
	t.context.client = client;
}

test.serial('upload files to the database', async t => {
	await connectToDatabase(t, url);
	await dbReady();
	const response = await request(app)
		.post('/movie')
		.attach('movie', getFile());

	const {db} = t.context;
	const collection = db.collection('fs.files');
	const count = await collection.estimatedDocumentCount();
	t.is(response.status, 201);
	t.is(count, 1);
});

test.serial('read files from database', async t => {
	await connectToDatabase(t, url);
	await dbReady();
	const file = new GridFSBucket(t.context.db);
	const {filename: name} = await generateBytes();
	const dbStream = file.openUploadStream(name);
	const fileStream = createReadStream(getFile());
	await waitForStream(fileStream, dbStream, 'finish');

	const response = await request(app).get('/movie/' + dbStream.id.toString());

	t.is(response.statusCode, 200);
});

test.serial('return 404 status when getting a file is not found', async t => {
	await connectToDatabase(t, url);
	await dbReady();

	const response = await request(app).get('/movie/f4e5f2aac341ae83a18302fa');

	t.is(response.statusCode, 404);
	t.is(response.text, 'File not found');
});

test.serial('delete files from database', async t => {
	await connectToDatabase(t, url);
	await dbReady();
	const file = new GridFSBucket(t.context.db);
	const {filename: name} = await generateBytes();
	const dbStream = file.openUploadStream(name);
	const fileStream = createReadStream(getFile());
	await waitForStream(fileStream, dbStream, 'finish');

	const response = await request(app).delete(
		'/movie/' + dbStream.id.toString()
	);

	const {db} = t.context;
	const collection = db.collection('fs.files');
	const count = await collection.estimatedDocumentCount();
	t.is(response.status, 204);
	t.is(count, 0);
});

test.serial('return 404 status when deleting a file is not found', async t => {
	await connectToDatabase(t, url);
	await dbReady();

	const response = await request(app).delete('/movie/f4e5f2aac341ae83a18302fa');

	t.is(response.statusCode, 404);
	t.is(response.text, 'File not found');
});
