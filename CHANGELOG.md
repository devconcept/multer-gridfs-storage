# Unreleased

* Added: A `close()` method that detaches a storage from its database connection, removing the `dbError` listeners it registered on the underlying `MongoClient` (and its own listeners). Call it for short-lived storages — for example per-request engines — so they no longer accumulate listeners on a shared or cached connection. Previously those listeners were never removed, leaking the storage and eventually triggering a `MaxListenersExceeded` warning.
* Changed: Switched the test runner to [Vitest](https://vitest.dev).
* Fixed: The connection cache could assign a new entry the wrong index and overwrite an existing one after an earlier entry for the same url was removed (for example when a cached connection with different options failed). New cache entries now take a fresh index past the highest existing one.
* Fixed: Connection strings that differ only in a repeated query parameter (for example `readPreferenceTags`) are no longer treated as the same connection by the cache; duplicate parameters are compared instead of being collapsed.
* Changed: Passing a database connection whose `db` is not available yet (an unopened connection) now throws a clear error instead of failing later with a confusing message.

# 6.0.0

This is a major release. Upgrading requires Node.js 22 or newer, installing `mongodb` yourself, and Multer 2. See the breaking changes below.

* Breaking: Raised the minimum supported Node.js version to **22**.
* Breaking: `mongodb` is now a **peer dependency** (`^7.5.0`) instead of a bundled dependency. Install it alongside this package. The bundled `@types/mongodb` and `@types/express` type packages were removed because the mongodb driver now ships its own types, which also resolves the type conflicts reported in [#529](https://github.com/devconcept/multer-gridfs-storage/issues/529), [#554](https://github.com/devconcept/multer-gridfs-storage/issues/554) and [#502](https://github.com/devconcept/multer-gridfs-storage/issues/502).
* Breaking: Raised the Multer peer dependency to `^2.2.0`, and `@types/multer` is now a peer dependency (`^2.2.0`). This clears the install conflicts reported in [#517](https://github.com/devconcept/multer-gridfs-storage/issues/517) and [#490](https://github.com/devconcept/multer-gridfs-storage/issues/490).
* Breaking: Removed the `client` option. The `MongoClient` is now inferred from the provided `db`, so it no longer needs to be passed separately.
* Added: The `file` option can return a `transforms` array of transform streams, piped in order between the incoming file and GridFS before it is stored (for example to encrypt or compress uploads). Resolves [#405](https://github.com/devconcept/multer-gridfs-storage/issues/405).
* Removed: Dropped the `md5` file property and the `disableMD5` file option. MongoDB removed automatic md5 hashing from GridFS in the mongodb Node.js driver 4.0.0 (`disableMD5` has had no effect since), so stored files no longer expose an md5 hash.
* Changed: Replaced the `mongodb-uri` dependency with `mongodb-connection-string-url` (the parser used by the mongodb driver itself) for connection string comparison. The database name is now resolved by the driver via `client.db()` instead of being parsed manually.
* Changed: The package is now a dual ESM/CommonJS module, built with [tshy](https://github.com/isaacs/tshy). It exposes an `exports` map with both `import` and `require` entry points (output moved from `lib/` to `dist/`).
* Changed: Modernized the test toolchain to run TypeScript through `tsx` (replacing `ts-node`), and switched coverage from `nyc` to `c8`.
* Changed: Updated development dependencies to their latest versions (including Express 5, supertest 7 and sinon 22 in the test suite) and migrated ESLint to v10 with a flat `eslint.config.js` (replacing `.eslintrc.json`/`.eslintignore`).
* Changed: Replaced the unmaintained `coveralls` package (which pulled in the deprecated `request` dependency and its security advisories) with Codecov coverage uploads from CI.
* Removed: Dropped the `is-promise` dependency; the trivial promise check is now inlined.
* Fixed: Uploads no longer throw `TypeError: Cannot read properties of undefined (reading '_id')` with recent MongoDB driver versions ([#560](https://github.com/devconcept/multer-gridfs-storage/issues/560)). The stored file's id and metadata are read from the write stream's `gridFSFile` property, and a `finish` event without a stored file now rejects with an error instead of leaving the request hanging.

# 5.0.2

* Fixed: Solved bug when not using the client parameter and the topology is not present in the db object #377
* Update: Updated dependencies

# 5.0.1

  * Fixed: Updated ObjectID reference to ObjectId to allow compatibility with mongodb4.

# 5.0.0

  * Feature: Module rewritten in Typescript. Separate definition files are no longer required.
  * Fixed: If using the `fromStream` method the readable source emits an error the promise is rejected. #205
  * Fixed: Attached events to `MongoClient` or `Db` object depending on the installed mongo version.
  * Fixed: Replaced mongoose reference with mongoose like object to avoid version conflicts.
  * Update: Updated dependencies.

# 4.2.0

  * Feature: Added the `fromFile` and `fromStream` public methods
  * Update: Documented the `generateBytes` method
  * Update: Updated dependencies

# 4.1.0

  * Breaking change: Removed Node 8 support
  * Update: Updated dependencies

# 4.0.3

  * Update: Updated dependencies

# 4.0.2

  * Update: Updated dependencies

# 4.0.1

  * Fix: Moved multer from dependencies to peerDependencies
  * Fix: Removed xo from dependencies
  * Update: Updated `pump` dependency

# 4.0.0

  * Feature: Added the `client` option to the constructor
  * Feature: Supported `client` as a promise
  * Update: Removed the `connectionOpts` setting
  * Breaking change: Removed Node 6 support
  * Breaking change: The `ready` method and the `connection` event now produces an object with the `db` and the `client` 

# 3.3.0

  * Update: Removed compatibility with Node 4

# 3.2.3

  * Fix: Solved bug in mongodb@2 and mongoose compatibility

# 3.2.2

  * Fix: Removed multer extra dependency from `package.json`

# 3.2.1

  * Feature: Added `aliases` and `disableMD5` properties to file naming configuration

# 3.2.0

 * Feature: Support for Mongoose connections
 * Feature: Ready method to wait for the MongoDb connection
 * Breaking change: Deprecated "connectionOpts" in favor of "options"

# 3.1.0

 * Feature: Added caching feature
 * Fix: Updated dependencies
 * Fix: Moved multer to peer dependencies
 * Breaking change: Dropped support for node 0.x
 * Breaking change: Removed es6-promise dependency
 * Breaking change: Added lodash.isplainobject dependency

# 3.0.1

 * Fix: Changed mongodb dependency version from 3 to >=2

# 3.0.0

 * Feature: Added support for mongodb version 3 in url connection string
 * Feature: Added `client` property to storage object

# 2.1.0

 * Feature: Allowed strings, numbers and null values as file configuration
 * Fix: Added examples to the readme

# 2.0.0

 * Breaking change: Removed gridfs-stream dependency
 * Breaking change: Removed all old file configuration options
 * Breaking change: Removed logging functions
 * Breaking change: The grid property in the file object was removed and its properties merged directly with the file object
 * Feature: Simplified api by adding a new option `file` to control file configuration
 * Feature: Added delayed file storage after successful connection instead of failing with an error

# 1.3.0

  * Fix: Renamed 'error' event to 'streamError' to prevent a bug where the the user does not set any listener for that event and emitting it causes the program to crash.


# 1.2.2

  * Feature: Added 'dbError' event
  * Fix: Call log function in 'error' event

# 1.2.1

  * Feature: Added 'error' event

# 1.2.0

  * Feature: Added generator function support
  * Feature: Allow to use promises in configuration options instead of callbacks

# 1.1.1

  * Fix: Fixed UnhandledPromiseRejection error
  

# 1.1.0

  * Feature: Added support for connection promises
  * Feature: Added file size information
  * Feature: Allow the api to be called with the `new` operator
  * Feature: Added Typescript support

# 1.0.3

  * Fix: Fixed code coverage

# 1.0.2

  * Feature: Changed log option to accept a function

# 1.0.1

  * Fix: Added validation for options

# 1.0.0

  * Initial stable release
  
# 0.0.5
  
  * Feature: Added support for changing the default collection with the root option
  
# 0.0.4
  
  * Feature: Added support for changing the chunk size
  
# 0.0.3
  
  * First release
