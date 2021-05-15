import {MongoClient, MongoClientOptions} from 'mongodb';
import mongoUri from 'mongodb-uri';
import {ConnectionResult} from './types';

export const openConnection = async function (
	url: string,
	options: MongoClientOptions
): Promise<ConnectionResult> {
	let client = null;
	let db;
	const connection = await MongoClient.connect(url, options);
	if (connection instanceof MongoClient) {
		client = connection;
		const parsedUri = mongoUri.parse(url);
		db = client.db(parsedUri.database);
	} else {
		db = connection;
	}

	return {client, db};
};
