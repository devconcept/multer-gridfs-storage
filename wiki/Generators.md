# Using generator functions

Generator functions are a new ES6 feature that allows you to write functions
that can be exited and later re-entered. This can sometimes reduce the amount
of code required to accomplish certain tasks.

Do not confuse the term *generator function* with *generator*. They are not the same.
A generator function when invoked will return a generator which in turn can be
used to produce values.

You can read more about this in MDN:

[Generator functions][1]

[Generators][2]

Also you can watch [this][3] great introductory video

## Usage

This module accepts a generator function in many of its configuration properties.
Experienced javascript users can take advantage of it to produce cleaner code.

They are supported in 

- `filename`
- `metadata`
- `identifier` 
- `chunkSize`
- `root`

The syntax is the same for all.

Here is an example:

```javascript
const GridFSStorage = require('multer-gridfs-storage');
const storage = new GridFSStorage({
    url: 'mongodb://localhost:27017/database',
    filename: function* () {
      let counter = 1;
      while (true) {
        yield 'name' + counter;
        counter++;
      }
    }
});
var upload = multer({ storage: storage });
```

Notice the asterisk (*) after the `function` keyword. This is how you define 
a generator function. The previous example will run until it founds the `yield` keyword
and will return the following expression pretty much like a `return` statement will.

The main difference is that the next time the module calls the generator it will continue
its execution in the next line after the `yield`. In a normal function it would start at
the beginning of the function body.

This allows the function to "remember" all its variables and values (it's execution context)
exactly as they were before `yield` was called.

The output of the previous example will be

```javascript
name1
name2
name3
....
```

If you try to write code to generate such values using standard functions, you will probably 
need help from global variables or similar workarounds.

Generators can be *finite* or *infinite*; that means they can produce some values until they reach certain
condition or they will continue to produce values as long as they are called.

> It is very important that you **only** write infinite generators. 

> If the generator is finished, then any file that comes next will fail to upload

# FAQ

Q: Why is there an infinite loop on your example, isn't that a bad thing?

```javascript
filename: function* () {
  ....
  while (true) {
    yield ....
  }
}
```


A: This is how you write an infinite generator function. This code will exit the function 
as soon as it reaches the `yield` statement. You can also write `for(;;) {}` 
or any other loop. As long as the `yield` is inside the loop and 
this continues to iterate indefinitely everything will be fine.

Q: I need the `request` and the `file` objects. How can I get those? 

A: Generators work a little different than normal functions. The first time
the generator is called you can access the values as the parameters like
you normally would.

```javascript
filename: function* (req, file) {
  ....
}
```

Remember that the execution resumes in the `yield` statement so the next value
can be obtained as the result of the call

```javascript
filename: function* () {
  let result = yield...
}
```

Here `result` is an **array** with the `req` and `file` objects in the 0 and 1 indexes.

Q: Why the result is an array? An object wouldn't be better?

A: Because you are using ES6 features you can also use 
[destructuring][4]
 to assign those values producing cleaner code

Compare

```javascript
const storage = new GridFSStorage({
    ...
    filename: function* (r, f) {
      let params;
      // the first loop will grab r and f
      // params is assigned on re-entry 
      let req = params ? values.req : r;
      let file = params ? values.file : f;
      ...
      params = yield 'name' + counter;
    }
    ...
});
```

with

```javascript
const storage = new GridFSStorage({
    ...
    filename: function* (req, file) {
      ... 
      // here variables are automatically reasigned
      // with each value from the array
      [req, file] = yield 'name' + counter;
    }
    ...
});
```

Q: What happens if I finish the generator?

A: All subsequent uploads will fail with an error.

Q: Can I call `return` inside the generator?

A: Don't do that. This will finish the generator with the value returned.
If you want to skip to the next iteration you can `yield` again.

Q: Why there is no callback with generators? What if I need to do some async?

A: Generators by default are syncronous because `yield` cannot be written inside
anything that is not a generator function. 

```javascript
// This fails with the error: Unexpected strict mode reserved word
function* fail (cb) {
  setTimeout(function() {
    yield 1;
    cb();
  })
}
```

But the good news is that you can `yield` 
a [Promise][5]
and this will wait for the 
promise to resolve or reject to produce a value

Q: I tried to use a generator function but got an error. What happened?

A: You must have node version 6 or greater to use them. You also need 
version 1.2.0 or greater of this module. Currently polyfills are not supported.

[1]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function* "Generator function"
[2]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator "Generator"
[3]: https://www.youtube.com/watch?v=qbKWsbJ76-s "Forbes Lindesey - Promises and Generators: control flow utopia"
[4]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring_assignment "Destructuring assignment"
[5]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
