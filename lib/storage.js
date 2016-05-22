var EventEmmiter = require('events').EventEmitter;

// Empty function to avoid modifications in the Event Emmiter prototype
function Storage() {}

Storage.prototype = new EventEmmiter();

module.exports = new Storage();