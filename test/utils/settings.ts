import url from 'url';
import random from 'crypto-random-string';

const hostname = process.env.MONGO_HOST || '127.0.0.1';
const port = process.env.MONGO_PORT || 27017;
const database = 'grid_storage';

export const connection = {
	host: hostname,
	port,
	database
};

export const storageOptions = function () {
	return {
		url: url.format({
			protocol: 'mongodb',
			slashes: true,
			hostname,
			port,
			pathname: database + '_' + random({length: 10, type: 'hex'})
		}),
		options: {useNewUrlParser: true, useUnifiedTopology: true}
	};
};
