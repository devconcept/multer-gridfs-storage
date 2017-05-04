'use strict';

module.exports.values = [1, false, {}, [], 'rainbows', new Number(1), new String('unicorns')];

module.exports.getNodeVersion = function () {
  var ver = /^v(\d+)\.(\d+)\./.exec(process.version);
  var major = parseInt(ver[1], 10);
  var minor = parseInt(ver[2], 10);
  return { major: major, minor: minor };
};
