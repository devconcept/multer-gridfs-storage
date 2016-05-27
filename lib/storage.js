'use strict';

var EventEmitter = require('events').EventEmitter;
var util = require('util');

// Empty function to avoid modifications in the Event Emmiter prototype
function Storage() {}

util.inherits(Storage, EventEmitter);

module.exports = Storage;
