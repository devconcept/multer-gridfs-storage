# Multer's GridFS storage engine

[![Build Status][travis-image]][travis-url] [![Coverage Status][coveralls-image]][coveralls-url] ![Npm version][version-image] ![Downloads][downloads-image]

[GridFS](https://docs.mongodb.com/manual/core/gridfs) storage engine for [Multer](https://github.com/expressjs/multer) to store uploaded files directly to MongoDb.

This module is intended to be used with the v1.x branch of Multer.

The new version 2 brings a simplified api and more features. If you still need the old version 
you can switch to the v1.x branch.

## Installation

Using npm

```sh
$ npm install multer-gridfs-storage --save
```

You should have mongodb installed. See the [`mongodb`][mongodb-option] option for more information.

Basic usage example:

```javascript
const express = require('express');
const multer  = require('multer');

// Create a storage object with a given configuration
const storage = require('multer-gridfs-storage')({
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

Check the [wiki][wiki] for an in depth guide on how to use this module.

### Options

The options parameter is an object with the following properties.

#### url

Type: `string`

Required if [`db`][db-option] option is not present

The mongodb connection uri. 

A string pointing to the database used to store the incoming files. This must be a standard mongodb [connection string](https://docs.mongodb.com/manual/reference/connection-string).

With this option the module will create a mongodb connection for you instead. 

Note: If the [`db`][db-option] option is specified this setting is ignored.

Example:

```javascript
const storage = require('multer-gridfs-storage')({
    url: 'mongodb://yourhost:27017/database'
});
```

#### db

Type: `DB` or `Promise`

Required if [`url`][url-option] option is not present

The database connection to use or a promise that resolves with the connection.

This is useful to reuse an existing connection to create more storage objects.

Example:

```javascript
MongoClient.connect('url').then((database) => {
  storage = new GridFSStorage({ db: database });
});
```

or

```javascript
const promise = MongoClient.connect('url');
storage = new GridFSStorage({ db: promise });
```

#### file

Type: `function` or `function*`

Not required

A function to control the file storage in the database. Is invoked **per file** with
the parameters `req` and `file`, in that order.

By default, this module behaves exactly like the default Multer disk storage does.
It generates a 16 bytes long name in hexadecimal format with no extension for the file
to guarantee that there are very low probabilities of naming collisions. You can override this 
by passing your own function.

The return value of this function must be an object or a promise (this also applies to generators) with
the following properties. You should at least provide the `filename` property. All missing
properties will use the defaults for mongodb.

Property name | Description
------------- | -----------
`filename` | The desired filename for the file
`id` | A mongodb ObjectID which will be used as the identifier
`metadata` | The metadata for the file
`chunkSize` | The size of file chunks in bytes (defaults to 261120)
`bucketName` | The name of the GridFs collection to store the file

#### mongo

Type: `function`

Not required

By default this module will call `require('mongodb')` and use whatever module is available. If you want to
use a specific version of mongo this options lets you change it. Just pass the result of the `require` call to
it and this will be the mongodb module used for all operations.

### File information

Each file in `req.file` and `req.files` contain the following properties in addition
to the ones that Multer create by default. Some of them can be set using the `file` configuration.

Key | Description
--- | -----------
`filename` | The name of the file within the database
`metadata` | The stored metadata of the file
`id` | The id of the stored file
`bucketName` | The name of the GridFs collection used to store the file
`chunkSize` | The size of file chunks used to store the file
`size` | The size of the stored file
`md5` | The md5 hash of the file
`uploadDate` | The upload timestamp of the file

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

#### Event: `'file'`

This event is emitted every time a new file is stored in the db. 

*Event arguments*

 - file: The uploaded file


#### Event: `'streamError'`

This event is emitted when there is an error streaming the file to the database.

*Event arguments*

 - error: The streaming error
 - config: The failed upload configuration
 
#### Event: `'dbError'`
 
This event is emitted when there underlying connection emits an error.
 
 > Only available when the storage is created with the [`url`][url-option] option.
 
*Event arguments*
 
 - error: The error emitted by the database connection


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
[options-options]: #options
[db-option]: #db
[file-option]: #file
[mongodb-option]: #mongodb
[wiki]: https://github.com/devconcept/multer-gridfs-storage/wiki
