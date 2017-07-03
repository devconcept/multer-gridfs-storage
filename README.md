# Multer's GridFS storage engine

[![Build Status][travis-image]][travis-url] [![Coverage Status][coveralls-image]][coveralls-url] ![Npm version][version-image] ![Downloads][downloads-image]

[GridFS](https://docs.mongodb.com/manual/core/gridfs) storage engine for [Multer](https://github.com/expressjs/multer) to store uploaded files directly to MongoDb.

This module is intended to be used with the v1.x branch of Multer.

## Installation

Using npm

```sh
$ npm install multer-gridfs-storage --save
```

Basic usage example:

```javascript
const express = require('express');
const multer  = require('multer');

// Create a storage object with a given configuration
var storage = require('multer-gridfs-storage')({
   url: 'mongodb://yourhost:27017/database'
});

// Set multer storage engine to the newly created object
const upload = multer({ storage: storage });

const app = express()

// Upload your files as usual
const sUpload = upload.single('avatar');
app.post('/profile', sUpload, (req, res, next) => { 
    /*....*/ 
})

const arrUpload = upload.array('photos', 12);
app.post('/photos/upload', arrUpload, (req, res, next) => {
    /*....*/ 
})

const fUpload = upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'gallery', maxCount: 8 }])
app.post('/cool-profile', fUpload, (req, res, next) => {
    /*....*/ 
})
```

## API

### module(options) : function

The module returns a function that can be invoked with options to create a Multer storage engine.

Starting from version 1.1.0 the module function can be called with 
or without the javascript `new` operator.

The 1.2 version brings full support for promises and ES6 generators. 

Check the [wiki][wiki] for an in depth guide on how to use this module.

### Options

The options parameter is an object with the following properties.

#### url

Type: `string`

Required if [`gfs`][gfs-option] option is not present

The mongodb connection uri. 

A string pointing to the database used to store the incoming files. This must be a standard mongodb [connection string](https://docs.mongodb.com/manual/reference/connection-string).

With this option the module will create a GridFS stream instance for you instead. 

Note: If the [`gfs`][gfs-option] option is specified this setting is ignored.

Example:

```javascript
const storage = require('multer-gridfs-storage')({
    url: 'mongodb://yourhost:27017/database'
});
```

Examples: *connecting*

#### gfs

Type: `object` or `Promise`

Required if [`url`][url-option] option is not present

The [gridfs-stream](https://github.com/aheckmann/gridfs-stream/) instance 
to use or a promise that resolves with the instance.

If this option is provided, files are stored using this stream. This is 
useful to reuse an existing stream to create more storage objects.

Example:

```javascript
const gfs = Grid(db, mongo);
storage = new GridFSStorage({ gfs: gfs });
```

More examples in *connecting*

#### filename

Type: `function` or `function*`

Not required

A function to control the file naming in the database. Is invoked with
the parameters `req`, `file` and `callback`, in that order, like all the Multer configuration
functions.

By default, this module behaves exactly like the default Multer disk storage does.
It generates a 16 bytes long name in hexadecimal format with no extension for the file
to guarantee that there are very low probabilities of naming collisions. You can override this 
by passing your own function.

Examples: *naming*

#### identifier

Type: `function` or `function*`

Not required

A function to control the unique identifier of the file. 

This function is invoked as all the others with the `req`, `file` and `callback` 
parameters and can be used to change the default identifier ( the `_id` property)
created by MongoDb. You must guarantee that this value is unique 
otherwise you will get an error.

Please note that the identifiers must conform to the MongoDb spec for ObjectID, that is, a 24 bytes hex string, 12 byte binary string or a Number.

To use the default generated identifier invoke the callback with a [falsey](http://james.padolsey.com/javascript/truthy-falsey/) value like `null` or `undefined`.  

Example:

```javascript
var path = require('path');
var storage = require('multer-gridfs-storage')({
   url: 'mongodb://yourhost:27017/database',
   identifier: function(req, file, cb) {
      cb(null, Math.floor(Math.random() * 1000000));
   }
});
var upload = multer({ storage: storage });
```

In this example a random number is used for the file identifier. 

***Note:***

> Normally you shouldn't use this function
unless you want granular control of your file ids because auto-generated identifiers are guaranteed to be unique.

#### metadata

Type: `function` or `function*`

Not required

A function to control the metadata object associated to the file. 

This function is called with the `req`, `file` and `callback` parameters and is used
to store metadata with the file. 

By default, the stored metadata value for uploaded files is `null`.

Example:

```javascript
var storage = require('multer-gridfs-storage')({
   url: 'mongodb://yourhost:27017/database',
   metadata: function(req, file, cb) {
      cb(null, req.body);
   }
});
var upload = multer({ storage: storage });
```

In this example the contents of the request body are stored with the file. 
This is only for illustrative purposes. If your users send passwords or other sensitive data in the request 
those will be stored unencrypted in the database as well, inside the metadata of the file.

#### chunkSize

Type: `number`, `function` or `function*`

Not required

The preferred size of file chunks in bytes. 

Default value is 261120 (255kb). 

You can use a fixed number as the value or a function to use different values per upload.

Example using fixed value:

```javascript
var storage = require('multer-gridfs-storage')({
   url: 'mongodb://yourhost:27017/database',
   chunkSize: 2048
});
var upload = multer({ storage: storage });
```

Example using dynamic value:

```javascript
var storage = require('multer-gridfs-storage')({
   url: 'mongodb://yourhost:27017/database',
   chunkSize: function(req, file, cb) {
       if (file.originalname === 'myphoto.jpg') {
           cb(null, 12345);
       } else {
           cb(null, 261120);
       }
   }
});
var upload = multer({ storage: storage });
```

#### root

Type: `string`, `function` or `function*`

Not required

The root collection to store the files. By default, this value is `null`.
When the value of this property is `null` MongoDb will use the default collection name `'fs'`
to store files. This value can be changed with this option and you can use a different fixed value
or a dynamic one per file.

Example using a fixed value:

```javascript
var storage = require('multer-gridfs-storage')({
   url: 'mongodb://yourhost:27017/database',
   root: 'myfiles'
});
var upload = multer({ storage: storage });
```

Later on you can query the GridFS collection using

```javascript
db.collection('myfiles.files')//...
db.collection('myfiles.chunks')//...
```

Example using a dynamic value:

```javascript
var storage = require('multer-gridfs-storage')({
   url: 'mongodb://yourhost:27017/database',
   root: function(req, file, cb) {
       if (file.fieldname = 'plants') {
           cb(null, 'plants');
       } else {
           cb(null, 'animals')
       }
   }
});
var upload = multer({ storage: storage });
```

This will create two collections of files for animals and plants based on the fieldname used to upload the file.

### File information

Each file in `req.file` and `req.files` contain the following properties in addition
to the ones that Multer create by default.

Key | Description
--- | -----------
`filename` | The name of the file within the database
`metadata` | The stored metadata of the file
`id` | The id of the stored file
`grid` | The GridFS information of the stored file
`size` | The size of the stored file

To see all the other properties of the file object check the Multer's [documentation](https://github.com/expressjs/multer#file-information).

### Events

Each storage object is also a standard Node.js Event Emitter. This is 
done to ensure that some internal events can also be handled in user code.

#### Event: `'connection'`

This event is emitted when the MongoDb connection is ready to use.

*Event arguments*

 - gfs: The newly created GridFS instance
 - db: The native MongoDb database object

This event is only triggered once.

#### Event: `'connectionFailed'`

This event is emitted when the connection could not be opened.

*Event arguments*

 - err: The connection error

This event only triggers once. Only one of `connection` or `connectionFailed `
will be fired.

#### Event: `'file'`

This event is emitted every time a new file is stored in the db. 

*Event arguments*

 - file: The uploaded file


#### Event: `'streamError'`

This event is emitted when there is an error streaming the file to the database.

*Event arguments*

 - error: The streaming error
 - config: The failed upload configuration
 
 > This was previously emitted as the `error` event but there was a bug that causes
 the application to exit if you don't set any listener for this and the event is
 emitted. Since you can also catch errors with an express error handler and bypass events
 altogether this was renamed to avoid potential errors.
 
#### Event: `'dbError'`
 
This event is emitted when there underlying connection emits an error.
 
 > Only available when the storage is created with the [`url`][url-option] option.
 
*Event arguments*
 
 - error: The error emitted by the database connection

## Debugging

To make debugging easy you can use any of the logging options in the storage constructor. 

### log

Type: `boolean` or `function`

Default: `false`

Not required

Enable or disable logging.

By default, the module will not output anything. Set this option to `true` to log when the connection is opened,
files are stored or an error occurs. This is useful when you want to see logging about incoming files.

If a function is provided it will be called in every log event with two arguments `err` y `log` with the error or
the message respectively. 

The `log` object contains two properties `message` and `extra` corresponding to the
event that triggered the log and any additional info, e.g. the uploaded file

```javascript
var storage = require('multer-gridfs-storage')({
   url: 'mongodb://yourhost:27017/database',
   log: function(err, log) {
      if (err) {
        console.error(err);
      } else {
        console.log(log.message, log.extra);
      }
   }
});
var upload = multer({ storage: storage });
```

See [`logLevel`][logLevel-option] for more information on how logging behaves on different options.

The console is used to log information to `stdout` or `stderr`

### logLevel

Not required

The events to be logged out. Only applies if logging is enabled.

Type: `string`

Default: `'file'`

Possible values: `'all'` or `'file'`

If set to `'all'` and the connection is established using the [`url`][url-option] option 
some events are attached to the MongoDb connection to output to `stdout` and `stderr`
when the connection is established and files are uploaded.

If set to `'file'` only successful file uploads will be registered. This setting applies to
both the `gfs` and the `url` configuration.

This option is useful when you also want to log when the connection is opened
or an error has occurs. Setting it to `'all'` and using the [`gfs`][gfs-option] option
has no effect and behaves like if it were set to `'file'`.

## Test

To run the test suite, first install the dependencies, then run `npm test`:

```bash
$ npm install
$ npm test
```

Tests are written with [mocha](https://mochajs.org/) and [chai](http://chaijs.com/). You can also run the tests with:

Code coverage thanks to [istanbul](https://github.com/gotwarlost/istanbul)

```bash
$ npm coverage
```

## License

[MIT](https://github.com/devconcept/multer-gridfs-storage/blob/master/LICENSE)

[travis-url]: https://travis-ci.org/devconcept/multer-gridfs-storage
[travis-image]: https://travis-ci.org/devconcept/multer-gridfs-storage.svg?branch=master "Build status"
[coveralls-url]: https://coveralls.io/github/devconcept/multer-gridfs-storage?branch=master
[coveralls-image]: https://coveralls.io/repos/github/devconcept/multer-gridfs-storage/badge.svg?branch=master "Coverage report"
[version-image]:https://img.shields.io/npm/v/multer-gridfs-storage.svg "Npm version"
[downloads-image]: https://img.shields.io/npm/dm/multer-gridfs-storage.svg "Monthly downloads"

[url-option]: #url
[gfs-option]: #gfs
[filename-option]: #filename
[identifier-option]: #identifier
[metadata-option]: #metadata
[chunkSize-option]: #chunkSize
[root-option]: #root
[log-option]: #log
[logLevel-option]: #loglevel
[wiki]: https://github.com/devconcept/multer-gridfs-storage/wiki
