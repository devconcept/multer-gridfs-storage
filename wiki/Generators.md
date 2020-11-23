This module supports the optional use of [generator functions][gen] in the [`file`][file-option] option as a way to simplify generation of values and to remove the need for global variables to accomplish certain tasks.

Is important to know that if you want to use them; you **must** write only *infinite generators*, that is, generator functions that never reach the `{done: true}` state. This can be easily accomplished by wrapping the `yield` statement in an infinite loop like `for(;;)` or `while(true) {}`. While you can ignore this warning and yield only a few values; in real life scenarios is not recommended to do so because after the generator is consumed **every** file that comes next will fail to upload.

Asynchronous work inside generators must yield promises instead of the value. This module will handle that case and wait for the promise to resolve or reject.

This is an example of using generator functions

```javascript
const GridFSStorage = require('multer-gridfs-storage');
const storage = new GridFSStorage({
  url: 'mongodb://yourhost:27017/database',
  file: function* () {
    let counter = 1;
    for (;;) {
      yield {
        filename: 'name' + counter
      };
      counter++;
    }
  }
});
var upload = multer({ storage: storage });
```

File and request information can be obtained too but this happens differently than in normal functions because in generator functions every execution resumes in the expression that follows the `yield`. The first time those objects are available as the parameters of the function, the following times can be obtained as result of the `yield` as an array.
 
This is an example of using the `req` and file objects

```javascript
const storage = new GridFsStorage({
  url: 'mongodb://yourhost:27017/database',
  file: function* (req, file) {
    let counter = 1;
    for (;;) {
      // variables req and file are automatically reasigned from the array using destructuring assignment
      [req, file] = yield {
        filename: `${file.originalname}_${counter}`
      };
      counter++;
    }
  }
});
```

Generators are only supported on Node versions >= 4 and polyfills are not supported.

[file-option]: https://github.com/devconcept/multer-gridfs-storage#file
[gen]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function* "Generator function"


