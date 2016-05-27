'use strict';

var GridFsStorage = require('./lib/gridfs');

module.exports = function (opts /*url: string, gfs: object*/) {
    return new GridFsStorage(opts);
};
