import url from 'url';
import random from 'crypto-random-string';

const hostname = process.env.MONGO_HOST || '127.0.0.1';
const port = process.env.MONGO_PORT || 27_017;
const database = 'grid_storage';

interface ConnectionSettings {
	host: string;
	port: string | number;
	database: string;
}

export const connection: ConnectionSettings = {
	host: hostname,
	port,
	database,
};

interface StorageOptionsSettings {
	url: string;
	options: Record<string, any>;
}

export const storageOptions = function (): StorageOptionsSettings {
	return {
		url: url.format({
			protocol: 'mongodb',
			slashes: true,
			hostname,
			port,
			pathname: database + '_' + random({ length: 10, type: 'hex' }),
		}),
		options: {},
	};
};
