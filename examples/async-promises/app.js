const http = require('http');
const createError = require('http-errors');
const logger = require('morgan');
const express = require('express');
const debug = require('debug')('examples');

const routes = require('./routes');

const app = express();
const port = 3000;

if (process.env.NODE_ENV === 'development') {
	app.use(logger('dev'));
}

app.use('/', routes);

app.use(function(req, res, next) {
	next(createError(404));
});

/* eslint-disable-next-line no-unused-vars */
app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.send(err.message);
});

app.set('port', port);

const server = http.createServer(app);

server.listen(port);

server.on('error', error => {
	if (error.syscall !== 'listen') {
		throw error;
	}

	const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

	if (error.code === 'EACCES') {
		console.error(bind + ' requires elevated privileges');
	} else if (error.code === 'EADDRINUSE') {
		console.error(bind + ' is already in use');
	}

	throw error;
});

server.on('listening', () => {
	const addr = server.address();
	const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
	debug('Listening on ' + bind);
});

module.exports = {
	server,
	app
};
