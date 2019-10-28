import {resolve} from 'path';
import {randomBytes} from 'crypto';
import {parse} from 'mongodb-uri';

export async function cleanup({db, client}) {
	if (db) {
		await db.dropDatabase();
	}

	if (client && client.isConnected()) {
		return client.close();
	}
}

export function getDb(client, url) {
	const {database} = parse(url);
	return client.db(database);
}

export function getFile() {
	return resolve(__dirname, 'field.jpg');
}

export function generateBytes() {
	return new Promise((resolve, reject) => {
		randomBytes(16, (err, buffer) => {
			if (err) {
				return reject(err);
			}

			resolve({filename: buffer.toString('hex')});
		});
	});
}
