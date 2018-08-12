'use strict';

const url = require('url');

const connection = {
  host: process.env.MONGO_HOST || '127.0.0.1',
  port: process.env.MONGO_PORT || 27017,
  database: 'gridfsstorage',
};

const mongoUrl = url.format({
  protocol: 'mongodb',
  slashes: true,
  hostname: connection.host,
  port: connection.port,
  pathname: connection.database,
});

module.exports.connection = connection;
module.exports.mongoUrl = mongoUrl;
