var path = require('path');
var files = ['sample1.jpg', 'sample2.jpg'].map(function (file) {
    return path.normalize(__dirname + '/../attachments/' + file);
});

module.exports.files = files;
