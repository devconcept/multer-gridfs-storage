import url from 'url';
import random from 'crypto-random-string';
import {version} from 'mongodb/package.json';

const [major, minor, patch] = version.split('.').map(v => Number(v));
const hostname = process.env.MONGO_HOST || '127.0.0.1';
const port = process.env.MONGO_PORT || 27_017;
const database = 'grid_storage';

interface ConnectionSettings {
	host: string;
	port: string | number;
	database: string;
}

export function getMongoDbMajorVersion(): number {
	return major;
}

export function getMongoDbMinorVersion(): number {
	return minor;
}

export function getMongoDbPatchVersion(): number {
	return patch;
}

export const connection: ConnectionSettings = {
	host: hostname,
	port,
	database,
};

type KeyValuePair = Record<string, any>;

interface StorageOptionsSettings {
	url: string;
	options: KeyValuePair;
}

export const storageOptions = function (): StorageOptionsSettings {
	return {
		url: url.format({
			protocol: 'mongodb',
			slashes: true,
			hostname,
			port,
			pathname: database + '_' + random({length: 10, type: 'hex'}),
		}),
		options: major < 4 ? {useNewUrlParser: true, useUnifiedTopology: true} : {},
	};
};
