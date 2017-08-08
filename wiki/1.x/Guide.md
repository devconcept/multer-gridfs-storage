> Deprecation notice:

> This information only applies to the version 1.x of this module which has been deprecated.

This module comes with a lot of configuration options which can be confusing at first for someone not familiar with its usage or the Multer module. 

In this guide you will find some tips on how to use this module more effectively.

The configuration options can be divided in three categories

- [connection][connection]
- [configuration][configuration]
- [debugging][debugging]

### connection

The connection options are those used to set the database connection and configure its behavior. Currently there are only two and you will always need only one of them set. They are used **once** per storage instance to open or store the database connection.

These are:
 
- [`url`][url-option]
- [`gfs`][gfs-option]

Is recommended that you reuse the storage objects as much as possible. Every one of them can potentially hold a different connection to a MongoDb server increasing
your application start up time and become problematic as your application scales.

You should use the `url` option when you store files in different databases or have a single storage object in your application. 

The `gfs` options allows you to reuse the same connection. This could be beneficial when you have several storage objects that share a common connection. This option
supports promises so you can use the same to instantiate different storage objects.

### configuration

The configuration options are those that define the properties of the stored files like name, metadata, id, etc. For most use cases the default values are enough, however you may find yourself in a situation where further customization is required.

These are:

- [`filename`][filename-option]
- [`identifier`][identifier-option]
- [`metadata`][metadata-option]
- [`chunkSize`][chunkSize-option]
- [`root`][root-option]

Two of them, `chunkSize` and `root`, accept a fixed value to be used for all files. All of them accept a function or a [generator function][wiki-generators] as input. Using those will allow you to choose which value will be used for every file. Each one of them is called **per file** in the listed order if they are present.

What this mean is that if you have a multiple upload in a single path ([array][multer-array], [fields][multer-fields], [any][multer-any]), these functions will be called once for every file in the same request but if you share the same storage object for different paths or routes they will be called for every file received in different requests. The call order is not guaranteed since they will be invoked as the files are received from the clients and processed. You could use `req.baseUrl` to figure out which route is being processed.
 
### debugging

This options aid in debugging your application. They are:

- [`log`][log-option]
- [`logLevel`][logLevel-option]

Note that this module emits events in some situations. It's recommended that you only use this options for debugging and logging and that you use events for all 
other cases like, for example, recovering from an error inserting a file in the database.


[connection]: #connection
[configuration]: #configuration
[debugging]: #debugging

[url-option]: https://github.com/devconcept/multer-gridfs-storage#url
[gfs-option]: https://github.com/devconcept/multer-gridfs-storage#gfs
[filename-option]: https://github.com/devconcept/multer-gridfs-storage#filename
[identifier-option]: https://github.com/devconcept/multer-gridfs-storage#identifier
[metadata-option]: https://github.com/devconcept/multer-gridfs-storage#metadata
[chunkSize-option]: https://github.com/devconcept/multer-gridfs-storage#chunkSize
[root-option]: https://github.com/devconcept/multer-gridfs-storage#root
[log-option]: https://github.com/devconcept/multer-gridfs-storage#log
[logLevel-option]: https://github.com/devconcept/multer-gridfs-storage#loglevel

[wiki-generators]: https://github.com/devconcept/multer-gridfs-storage/wiki/Using-generator-functions
[wiki-promises]: https://github.com/devconcept/multer-gridfs-storage/wiki/Using-promises

[multer-array]: https://github.com/expressjs/multer#arrayfieldname-maxcount
[multer-fields]: https://github.com/expressjs/multer#fieldsfields
[multer-any]: https://github.com/expressjs/multer#any
