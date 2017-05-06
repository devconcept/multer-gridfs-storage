'use strict';

const path = require('path');

const files = ['sample1.jpg', 'sample2.jpg']
  .map((file) => path.normalize(__dirname + '/../attachments/' + file));

module.exports.files = files;
