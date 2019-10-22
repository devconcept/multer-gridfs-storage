import path from 'path';
import {parse} from 'mongodb-uri';
import {MongoClient} from 'mongodb';
import hasOwn from 'has-own-prop';
import {version} from 'mongodb/package.json';
import {connection, storageOpts} from './settings';

export const mongoVersion = version.split('.').map(Number);

export const files = ['sample1.jpg', 'sample2.jpg'].map(file =>
	path.join(__dirname, '/../attachments/', file)
);

export async function cleanStorage(storage, {client, db} = {}) {
	if (storage) {
		storage.removeAllListeners();
		if (!db && !client) {
			db = storage.db;
			client = storage.client;
		}

		if (db) {
			await db.dropDatabase();
			return closeConnections({db, client});
		}
	}
}

export function closeConnections({db, client}) {
	if (client) {
		if (hasOwn(client, 'readyState') && client.readyState === 1) {
			return client.close();
		}

		if (hasOwn(client, 'isConnected') && client.isConnected()) {
			return client.close();
		}
	} else {
		return db.close();
	}
}

export async function dropDatabase(url) {
	if (url) {
		const {options} = storageOpts();
		const _db = await MongoClient.connect(url, options);
		const db = getDb(_db, url);
		const client = getClient(_db);
		await db.dropDatabase();
		if (client) {
			return client.close();
		}

		return db.close();
	}
}

export function getDb(client, url) {
	if (client instanceof MongoClient) {
		const {database} = parse(url);
		return client.db(database || connection.database);
	}

	return client;
}

export function getClient(client) {
	return client instanceof MongoClient ? client : null;
}

export function delay(delay = 0) {
	return new Promise(resolve => {
		setTimeout(() => {
			resolve();
		}, delay);
	});
}

export function fakeConnectCb(err = null) {
	return (...args) => {
		if (args.length === 3) {
			const cb = args[2];
			setTimeout(() => {
				cb(err);
			});
			return;
		}

		return delay().then(() => (err ? Promise.reject(err) : Promise.resolve()));
	};
}
