import path from 'path';
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
	return path.resolve(__dirname, 'field.jpg');
}
