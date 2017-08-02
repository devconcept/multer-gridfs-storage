> Deprecation notice:

> This information only applies to the version 1.x of this module which has been deprecated.

Promises are an ES6 feature that allows you to represent a value that **may**
be available in the future. This concept has been around for a while now in
many javascript libraries but ES6 brings the official language support.

You can return promises instead of invoking callbacks if you prefer and this 
will allow you to reuse any existing promise and avoid [callback hell][cb-hell].

## Usage

How you use the promise depends on the option you are configuring.
If is a [connection option][connection-option] you must pass the promise directly,
if is a [configuration option][configuration-option] you must return the promise
from the function or the generator function.

### connection

The `gfs` options expects a Grid object or a promise. When using the promise you can write

```javascript
var promise = MongoClient
  .connect('mongodb://mydatabaseurl')
  .then(function(database) {
    return Grid(database, mongo)
  });
  
var storage = GridFSStorage({
   gfs: promise
});
var upload = multer({ storage: storage });
```

This way the storage will wait until the promise is resolved to use
the Grid object.

> Please note that if you try to upload a file before the promise is resolved
the upload will fail.

### configuration

In any of the configuration options you can return a promise instead of invoking
the callback and this will handle the error or return the value when the
promise is resolved or rejected.

```javascript 
var storage = GridFSStorage({
    filename: function (req, file) {
        return new Promise(function (resolve) {
            .....
            resolve('value');
        });  
    }
});
var upload = multer({ storage: storage });
```

> Use either promises or callbacks but not both.

### generators

When using generator functions you can `yield` a promise in case 
you need to do some async. 

Callbacks are not supported in generators, so promises are the other alternative 
to wait for a given value.

```javascript 
var storage = GridFSStorage({
    filename: function*() {
        yield new Promise(function (resolve) {
            .....
            resolve('value');
        });    
    }
});
var upload = multer({ storage: storage });
```

This will wait for the result of the promise and use it as the value required
to store the file.

[cb-hell]: http://callbackhell.com/
[connection-option]: https://github.com/devconcept/multer-gridfs-storage/wiki/Guide#connection
[configuration-option]: https://github.com/devconcept/multer-gridfs-storage/wiki/Guide#configuration
