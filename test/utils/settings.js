var url = require('url');

var connection = {
    host: '127.0.0.1',
    port: 27017,
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