# Multer's GridFS storage engine

[![Build Status][github-image]][github-url] [![Coverage Status][codecov-image]][codecov-url] ![Npm version][version-image] ![Downloads][downloads-image] [![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fdevconcept%2Fmulter-gridfs-storage.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fdevconcept%2Fmulter-gridfs-storage?ref=badge_shield) [![GitHub Discussions][discussions-image]][discussions-url]

[GridFS](https://docs.mongodb.com/manual/core/gridfs) storage engine for [Multer](https://github.com/expressjs/multer) to store uploaded files directly to MongoDb.

## 🔥 Features

- Compatible with the latest major version of the MongoDB server and its Node.js driver.
- Really simple api.
- Runs on the actively maintained Node.js LTS releases.
- Caching of url based connections.
- Compatible with Mongoose connection objects.
- Promise support.
- Generator function support. 
- Support for existing and promise based database connections.
- Storage operation buffering for incoming files while the connection is opening.
- Use it as a multer plugin or inside an express middleware function.
- Builtin Typescript support.
- Dual package: works with both ESM `import` and CommonJS `require`.

## 🚀 Installation

Using npm

```sh
$ npm install multer-gridfs-storage --save
```

The package ships both ESM and CommonJS builds, so you can load it with either
`import { GridFsStorage } from 'multer-gridfs-storage'` or
`const { GridFsStorage } = require('multer-gridfs-storage')`. The examples below
use ESM `import` syntax; swap in `require` if your project uses CommonJS.

Basic usage example:

```javascript
import express from 'express';
import multer from 'multer';
import { GridFsStorage } from 'multer-gridfs-storage';
const url = 'mongodb://yourhost:27017/database';

// Create a storage object with a given configuration
const storage = new GridFsStorage({ url });

// Set multer storage engine to the newly created object
const upload = multer({ storage });

const app = express();

// Upload your files as usual
app.post('/profile', upload.single('avatar'), (req, res, next) => { 
    /*....*/ 
});

app.post('/photos/upload', upload.array('photos', 12), (req, res, next) => {
    /*....*/ 
});

app.post('/cool-profile', upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'gallery', maxCount: 8 }]), (req, res, next) => {
    /*....*/ 
});
```

## 📄 API

### module(configuration): function

The module returns a function that can be invoked to create a Multer storage engine. It also works as a class. It is up to you to decide the best way to invoke it.

### Configuration

The configuration parameter is an object with the following properties.

#### url

Type: `string`

Required if [`db`][db-option] option is not present

An url pointing to the database used to store the incoming files.

With this option the module will create a mongodb connection for you. It must be a standard mongodb [connection string][connection-string].

If the [`db`][db-option] option is specified this setting is ignored.

Example:

```javascript
import { GridFsStorage } from 'multer-gridfs-storage';

const storage = new GridFsStorage({
    url: 'mongodb://yourhost:27017/database'
});
```

The connected database is available in the `storage.db` property.

#### options

Type: object

Not required

This setting allows you to customize how this module establishes the connection if you are using the [`url`][url-option] option. 

You can set this to an object like is specified in the [`MongoClient.connect`][mongoclient-connect] documentation and change the default behavior without having to create the connection yourself using the [`db`][db-option] option.

#### cache

Type: `boolean` or `string`

Not required

Default value: `false`

Store this connection in the internal cache. You can also use a string to use a named cache. By default, caching is disabled. See [caching](#-caching) to learn more about reusing connections.

> This option only applies when you use an url string to connect to MongoDb. Caching is not enabled when you create instances with a [database][db-option] object directly.

#### db

Type: [`DB`][mongo-db] or `Promise`

Required if [`url`][url-option] option is not present

The database connection to use, or a promise that resolves with the connection object. Mongoose `Connection` objects are supported too.

This is useful to reuse an existing connection to create more storage objects.

Example:

```javascript
import { MongoClient } from 'mongodb';
import { GridFsStorage } from 'multer-gridfs-storage';

// using a database instance
const client = await MongoClient.connect('mongodb://yourhost:27017');
const database = client.db('database');
const storage = new GridFsStorage({ db: database });

// using a promise
const promise = MongoClient
  .connect('mongodb://yourhost:27017')
  .then(client => client.db('database'));
  
const storage = new GridFsStorage({ db: promise });
```

```javascript
import mongoose from 'mongoose';
import { GridFsStorage } from 'multer-gridfs-storage';

// using Mongoose
const connection = mongoose.connect('mongodb://yourhost:27017/database');

const storage = new GridFsStorage({ db: connection });
```

#### file

Type: `function` or `function*`

Not required

A function to control the file storage in the database. Is invoked **per file** with the parameters `req` and `file`, in that order.

This module uses [`GridFSBucket`](https://www.mongodb.com/docs/manual/core/gridfs/) to store files in the database. 

By default, naming behaves exactly like the default Multer disk storage, a 16 bytes long name in a hexadecimal format with no extension is generated for each file to guarantee that there are very low probabilities of collisions. You can override this by passing your own function.

The return value of this function is an object, or a promise that resolves to an object (this also applies to generators) with the following properties. 

| Property name | Description                                                                                                                                                         |
|---------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `filename`    | The desired filename for the file (default: 16 byte hex name without extension)                                                                                     |
| `id`          | An ObjectID to use as identifier (default: auto-generated)                                                                                                          |
| `metadata`    | The metadata for the file (default: `null`)                                                                                                                         |
| `chunkSize`   | The size of file chunks in bytes (default: 261120)                                                                                                                  |
| `bucketName`  | The GridFs collection to store the file (default: `fs`)                                                                                                             |
| `contentType` | The content type for the file (default: inferred from the request)                                                                                                  |
| `aliases`     | Optional array of strings to store in the file document's aliases field (default: `null`)                                                                           |
| `transforms`  | Optional array of transform streams to pipe the file through before it is stored (default: none). See [Transforming the stored file](#transforming-the-stored-file) |

Any missing properties will use the defaults. Also, note that each property must be supported by your installed version of MongoDb.

If you return `null` or `undefined` from the file function, the values for the current file will also be the defaults. This is useful when you want to conditionally change some files while leaving others untouched.

This example will use the collection `'photos'` only for incoming files whose reported mime-type is `image/jpeg`, the others will be stored using default values.

```javascript
import { GridFsStorage } from 'multer-gridfs-storage';

const storage = new GridFsStorage({
  url: 'mongodb://host:27017/database',
  file: (req, file) => {
    if (file.mimetype === 'image/jpeg') {
      return {
        bucketName: 'photos'
      };
    } else {
      return null;
    }
  }
});
const upload = multer({ storage });
```

This other example names every file something like `'file_1504287812377'`, using the date to change the number and to generate unique values

```javascript
import { GridFsStorage } from 'multer-gridfs-storage';

const storage = new GridFsStorage({
  url: 'mongodb://host:27017/database',
  file: (req, file) => {
    return {
      filename: 'file_' + Date.now()
    };
  }
});
const upload = multer({ storage });
```

Is also possible to return values other than objects, like strings or numbers, in which case they will be used as the filename and the remaining properties will use the defaults. This is a simplified version of a previous example

```javascript
import { GridFsStorage } from 'multer-gridfs-storage';

const storage = new GridFsStorage({
  url: 'mongodb://host:27017/database',
  file: (req, file) => {
    // instead of an object a string is returned
    return 'file_' + Date.now();
  }
});
const upload = multer({ storage });
```

Internally the function `crypto.randomBytes` is used to generate names. In this example, files are named using the same format plus the extension as received from the client, also changing the collection where to store files to `uploads`.

```javascript
import crypto from 'node:crypto';
import path from 'node:path';
import { GridFsStorage } from 'multer-gridfs-storage';

const storage = new GridFsStorage({
  url: 'mongodb://host:27017/database',
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads'
        };
        resolve(fileInfo);
      });
    });
  }
});
const upload = multer({ storage });
```

### Using generator functions

The [`file`][file-option] option also accepts a [generator function][gen]. Generators let you produce a sequence of file configurations without keeping counters or other state in outer variables.

You **must** use *infinite* generators — ones that never reach the `{ done: true }` state — by wrapping the `yield` in an endless loop such as `for (;;)`. If a finite generator runs out of values, every file uploaded afterwards will fail.

Asynchronous work inside a generator should `yield` a promise instead of a plain value; the module waits for it to resolve or reject.

```javascript
import { GridFsStorage } from 'multer-gridfs-storage';

const storage = new GridFsStorage({
  url: 'mongodb://yourhost:27017/database',
  file: function* () {
    let counter = 1;
    for (;;) {
      yield { filename: 'name' + counter };
      counter++;
    }
  }
});
const upload = multer({ storage });
```

The `req` and `file` objects arrive as the function parameters on the first file. On each subsequent file, execution resumes right after the `yield`, so they come back as the array it returns — destructure them to reassign:

```javascript
import { GridFsStorage } from 'multer-gridfs-storage';

const storage = new GridFsStorage({
  url: 'mongodb://yourhost:27017/database',
  file: function* (req, file) {
    let counter = 1;
    for (;;) {
      // req and file are reassigned from the yielded array on each new file
      [req, file] = yield { filename: `${file.originalname}_${counter}` };
      counter++;
    }
  }
});
```

### Transforming the stored file

The [`file`][file-option] option can return a `transforms` array of [transform streams][transform]. The incoming file is piped through them, in order, before it reaches the database, which lets you encrypt, compress or otherwise rewrite the bytes as they are stored. If any transform emits an error the upload fails with a [`streamError`](#event-streamerror) event.

Because transform streams can only be used once, return **fresh instances** from the `file` function so every upload gets its own.

```javascript
import crypto from 'node:crypto';
import { GridFsStorage } from 'multer-gridfs-storage';

const storage = new GridFsStorage({
  url: 'mongodb://yourhost:27017/database',
  file: (req, file) => {
    const iv = crypto.randomBytes(16);
    return {
      filename: file.originalname,
      // encrypt the file before it is written to GridFs
      transforms: [crypto.createCipheriv('aes-256-ctr', key, iv)],
      // keep the iv around so the file can be decrypted later
      metadata: { iv: iv.toString('hex') },
    };
  },
});
const upload = multer({ storage });
```

### File information

Each saved file located in `req.file` and `req.files` contain the following properties in addition to the ones that Multer create by default. Most of them can be set using the [`file`][file-option] configuration.

| Key           | Description                                              |
|---------------|----------------------------------------------------------|
| `filename`    | The name of the file within the database                 |
| `metadata`    | The stored metadata of the file                          |
| `id`          | The id of the stored file                                |
| `bucketName`  | The name of the GridFs collection used to store the file |
| `chunkSize`   | The size of file chunks used to store the file           |
| `size`        | The final size of the file in bytes                      |
| `contentType` | Content type of the file in the database                 |
| `uploadDate`  | The timestamp when the file was uploaded                 |

To see all the other properties of the file object, check the Multer's [documentation](https://github.com/expressjs/multer#file-information).

> Do not confuse `contentType` with Multer's `mimetype`. The first is the value in the database while the latter is the value in the request. You could choose to override the value at the moment of storing the file. In most cases both values should be equal. 

### 📀 Caching

You can enable caching by either using a boolean, or a non-empty string in the [cache][cache-option] option, then, when the module is invoked again with the same [url][url-option] it will use the stored db instance instead of creating a new one.

The cache is not a simple object hash. It supports handling asynchronous connections. You could, for example, synchronously create two storage instances for the same cache one after the other and only one of them will try to open a connection. 

This greatly simplifies managing instances in different files of your app. All you have to do now is to store a url string in a configuration file to share the same connection. Scaling your application with a load-balancer, for example, can lead to spawn a great number of database connections for each child process. With this feature no additional code is required to keep opened connections to the exact number you want without any effort.

You can also create named caches by using a string instead of a boolean value. In those cases, the module will uniquely identify the cache allowing for an arbitrary number of cached connections per url and giving you the ability to decide which connection to use and how many of them should be created. 

The following code will create a new connection and store it under a cache named `'default'`.

```javascript
import { GridFsStorage } from 'multer-gridfs-storage';

const storage = new GridFsStorage({
    url: 'mongodb://yourhost:27017/database',
    cache: true
});
```

Other, more complex example, could be creating several files and only two connections to handle them.

```javascript
 // file 1
import { GridFsStorage } from 'multer-gridfs-storage';

const storage = new GridFsStorage({
   url: 'mongodb://yourhost:27017/database',
   cache: '1'
});

// file 2
import { GridFsStorage } from 'multer-gridfs-storage';

const storage = new GridFsStorage({
    url: 'mongodb://yourhost:27017/database',
    cache: '1'
});

 // file 3
import { GridFsStorage } from 'multer-gridfs-storage';

const storage = new GridFsStorage({
   url: 'mongodb://yourhost:27017/database',
   cache: '2'
});

// file 4
import { GridFsStorage } from 'multer-gridfs-storage';

const storage = new GridFsStorage({
    url: 'mongodb://yourhost:27017/database',
    cache: '2'
});
```

The files 1 and 2 will use the connection cached under the key `'1'` and the files 3 and 4 will use the cache named `'2'`. You don't have to worry about managing connections anymore. By setting a simple string value the module manages them for you automatically.

Connection strings are parsed and tested for similarities. In this example the urls are equivalent and only one connection will be created.

```javascript
import { GridFsStorage } from 'multer-gridfs-storage';

// Both configurations are equivalent

const storage1 = new GridFsStorage({
    url: 'mongodb://host1:27017,host2:27017/database',
    cache: 'connections'
});

const storage2 = new GridFsStorage({
    url: 'mongodb://host2:27017,host1:27017/database',
    cache: 'connections'
});
```

Of course if you want to create more connections this is still possible. Caching is disabled by default so setting a `cache: false` or not setting any cache configuration at all will cause the module to ignore caching and create a new connection each time.

Using [options][options-option] has a particular side effect. The cache will spawn more connections only **when they differ in their values**. Objects provided here are not compared by reference as long as they are just plain objects. Falsey values like `null` and `undefined` are considered equal. This is required because various options can lead to completely different connections, for example when using replicas or server configurations. Only connections that are *semantically equivalent* are considered equal.

### 🗂️ Multiple databases

Each storage engine holds a single connection, so to send uploads to a different database depending on the request you keep one engine per connection and pick the right one at request time. A Multer instance is just standard Express middleware (`(req, res, next)`), so it can be dispatched dynamically.

Keep *how* the target is chosen behind a function that returns the engine configuration for the request. It can decide from anything on the request and pick either form the engine accepts, per request: an existing connection (a `Db` or a Mongoose connection) via the `db` option, or a connection string via the `url` option — add `cache: true` so the library opens each database only once.

```javascript
import express from 'express';
import multer from 'multer';
import { GridFsStorage } from 'multer-gridfs-storage';

// Resolve the engine configuration for a request. Replace the body with your own
// logic and return whichever form fits the target database:
//   { db: existingConnection }               -> reuse a connection you manage
//   { url: 'mongodb://.../db', cache: true }  -> let the library open and reuse it
async function resolveStorage(req) {
  // return { db: connectionPool.get(/* ...derive the target from req... */) };
  // return { url: `mongodb://yourhost:27017/${/* ...target database... */}`, cache: true };
}

// Build one upload middleware per target, reusing it on later requests.
const uploaders = new Map();

function uploaderFor(config) {
  // Both forms carry a stable identity: the connection object or the url string.
  const key = config.db ?? config.url;
  if (!uploaders.has(key)) {
    uploaders.set(key, multer({ storage: new GridFsStorage(config) }).single('file'));
  }

  return uploaders.get(key);
}

// Dispatch each request to the engine for its database.
async function upload(req, res, next) {
  try {
    const config = await resolveStorage(req);
    uploaderFor(config)(req, res, next);
  } catch (error) {
    next(error);
  }
}

const app = express();
app.post('/upload', upload, (req, res) => {
  res.json(req.file);
});
```

The `uploaders` map is keyed by the connection or the url itself, so each engine is created once and reused, and databases discovered at runtime get their own engine automatically. Every connection stays isolated with its own state and events, and this needs no special support from the library.

This is only a recipe, not the only way to implement it — the building blocks (one engine per connection, dispatched per request) can be arranged however suits your application.

### 🧰 Utility methods

#### `generateBytes`

A shortcut for `crypto.randomBytes` which uses promises instead of callbacks to generate names and return the value in a property called `filename`.

```javascript
import { GridFsStorage } from 'multer-gridfs-storage';
const {generateBytes} = GridFsStorage;
const result = await generateBytes();
// result will be something like {filename: '37492f9fe13c350667350bcacf0e5b19'}
```

#### `fromStream`

A function that pipe a readable stream to gridfs using the current storage configuration. Useful if you want to upload the received file in multiple storage devices.

```javascript
import fs from 'node:fs';
import express from 'express';
import multer from 'multer';
import { GridFsStorage } from 'multer-gridfs-storage';
const upload = multer({ dest: 'uploads/' });
const app = express();
const storage = new GridFsStorage({url: 'mongodb://yourhost:27017/database'});

app.post('/profile', upload.single('avatar'), function (req, res, next) {
  const {file} = req;
  const stream = fs.createReadStream(file.path);
  storage.fromStream(stream, req, file)
    .then(() => res.send('File uploaded'))
    .catch(() => res.status(500).send('error'));
});
```

#### Storage ready

Each storage has a `ready` method that returns a promise. This allows you to watch for the MongoDb connection instead of using events. These two examples are equivalent.

```javascript
// Using event emitters

const storage = new GridFsStorage({
  url: 'mongodb://yourhost:27017/database'
});

storage.on('connection', (db) => {
  // Db is the database instance
});

storage.on('connectionFailed', (err) => {
  // err is the error received from MongoDb
});
```

```javascript
// Using the ready method

const storage = new GridFsStorage({
  url: 'mongodb://yourhost:27017/database'
});

try {
  const {db, client} = await storage.ready();
  // db is the database instance
  // client is the MongoClient instance
} catch (err) {
 // err is the error received from MongoDb
}
```

Remember that you don't need to wait for the connection to be ready to start uploading files. The module buffers every incoming file until the connection is ready and saves all of them as soon as possible.

The `ready` method is just a convenience function over code written using the `connection` events also with a  couple of advantages. If you set up a listener after the `connection` or  `connectionFailed` events are dispatched your code will not execute while using the `ready` method it will. The module keeps track of these events and resolves or rejects the promises accordingly. Promises in this case are more readable than events and more reliable.

### ⚡ Events

Each storage object is also a standard Node.js Event Emitter. This is done to ensure that some internal events can also be handled in user code.

#### Event: `'connection'`

This event is emitted when the MongoDb connection is ready to use.

*Event arguments*

 - result: Result is an object with the following properties:
 
    `db`: The MongoDb database pointing to the database
    
    `client`: The MongoClient instance that holds the connection


This event is triggered at most once.

#### Event: `'connectionFailed'`

This event is emitted when the connection could not be opened.

 - err: The connection error

This event only triggers at most once. 

> Only one of the events `connection` or `connectionFailed ` will be emitted.

#### Event: `'file'`

This event is emitted every time a new file is stored in the db. 

*Event arguments*

 - file: The uploaded file


#### Event: `'streamError'`

This event is emitted when there is an error streaming the file to the database.

*Event arguments*

 - error: The streaming error
 - conf: The failed file configuration

> Previously this event was named `error` but in Node `error` events are special and crash the process if one is emitted and there is no listener attached. You could choose to handle errors in an [express middleware][error-handling] forcing you to set an empty `error` listener to avoid crashing. To simplify the issue this event was renamed to allow you to choose the best way to handle storage errors.

#### Event: `'dbError'`

This event is emitted when the underlying connection emits an error.

 > Only available when the storage is created with the [`url`][url-option] option.

*Event arguments*

 - error: The error emitted by the database connection

## 🧪 Test

To run the test suite, first install the dependencies, then run `npm test`:

```bash
$ npm install
$ npm test
```

The tests need a MongoDB server reachable at `127.0.0.1:27017` (override with the `MONGO_HOST` / `MONGO_PORT` environment variables). If you already run MongoDB locally, `npm test` works as-is. Otherwise, you can start a throwaway instance with Docker:

```bash
$ npm run db:up    # start MongoDB in a container and wait until it is ready
$ npm test
$ npm run db:down  # stop and remove it
```

Tests are written with the [Vitest](https://vitest.dev) testing framework.

Code coverage thanks to [c8](https://github.com/bcoe/c8)

```bash
$ npm run coverage
```

## 📜 License

[MIT](https://github.com/devconcept/multer-gridfs-storage/blob/master/LICENSE)

[github-url]: https://github.com/devconcept/multer-gridfs-storage/actions
[github-image]: https://github.com/devconcept/multer-gridfs-storage/actions/workflows/node.js.yml/badge.svg "Build status"
[codecov-url]: https://codecov.io/gh/devconcept/multer-gridfs-storage
[codecov-image]: https://codecov.io/gh/devconcept/multer-gridfs-storage/branch/master/graph/badge.svg "Coverage report"
[version-image]:https://img.shields.io/npm/v/multer-gridfs-storage.svg "Npm version"
[downloads-image]: https://img.shields.io/npm/dm/multer-gridfs-storage.svg "Monthly downloads"
[discussions-url]: https://github.com/devconcept/multer-gridfs-storage/discussions
[discussions-image]: https://img.shields.io/github/discussions/devconcept/multer-gridfs-storage "GitHub Discussions"

[connection-string]: https://docs.mongodb.com/manual/reference/connection-string
[mongoclient-connect]: https://www.mongodb.com/docs/drivers/node/current/fundamentals/connection/
[mongo-db]: https://www.mongodb.com/docs/drivers/node/current/
[error-handling]: https://github.com/expressjs/multer#error-handling

[url-option]: #url
[options-option]: #options
[db-option]: #db
[file-option]: #file
[cache-option]: #cache
[gen]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function* "Generator function"
[transform]: https://nodejs.org/api/stream.html#class-streamtransform "Transform stream"
