import path from 'path';
import {MongoClient} from 'mongodb';
import {connection} from './settings';

export {version as mongoVersion} from 'mongodb/package.json';

export const files = ['sample1.jpg', 'sample2.jpg']
	.map(file => path.resolve(__dirname, '/../attachments/', file));

export async function cleanStorage(storage, {client, db} = {}) {
	if (storage) {
		storage.removeAllListeners();
		if (!db && !client) {
			db = storage.db;
			client = storage.client;
		}

		if (db) {
			await db.dropDatabase();
			if (client) {
				if (Object.hasOwnProperty.call(client, 'isConnected') && client.isConnected()) {
					client.close();
				}

				if (Object.hasOwnProperty.call(client, 'readyState') && client.readyState === 1) {
					client.close();
				}
			} else {
				db.close();
			}
		}
	}
}

export function getDb(client) {
	if (client instanceof MongoClient) {
		return client.db(connection.database);
	}

	return client;
}

export function getClient(client) {
	return (client instanceof MongoClient) ? client : null;
}

export function createBuffer(arr) {
	return Buffer.from ? Buffer.from(arr) : Buffer.from(arr);
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

		return delay().then(() => err ? Promise.reject(err) : Promise.resolve());
	};
}

