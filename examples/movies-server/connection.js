const {MongoClient} = require('mongodb');

const {url} = require('./settings');

const connection = MongoClient.connect(url, {
	useNewUrlParser: true,
	useUnifiedTopology: true
});

function dbReady() {
	return connection;
}

module.exports = {
	dbReady
};
