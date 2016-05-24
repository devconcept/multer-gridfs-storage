var url = require('url');

var connection = {
    host: process.env.MONGO_HOST || '127.0.0.1',
    port: process.env.MONGO_PORT || 27017,
    database: 'gridfsstorage'
};

var mongoUrl = function () {
    return url.format({
        protocol: 'mongodb',
        slashes: true,
        hostname: connection.host,
        port: connection.port,
        pathname: connection.database
    });
};

module.exports.connection = connection;
module.exports.mongoUrl = mongoUrl;