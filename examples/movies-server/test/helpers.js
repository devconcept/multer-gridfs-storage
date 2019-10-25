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

// Replace with proper library
export function waitForStream(readable, writable, event = 'end') {
	let processed = false;
	return new Promise((resolve, reject) => {
		const process = (fn, toDestroy) => {
			return result => {
				if (!processed) {
					processed = true;
					readable.removeAllListeners();
					writable.removeAllListeners();
					if (toDestroy) {
						toDestroy.destroy();
					}

					fn(result);
				}
			};
		};

		readable.once('error', process(reject, writable));
		writable.once('error', process(reject, readable));
		writable.once(event, process(resolve));
		readable.pipe(writable);
	});
}
