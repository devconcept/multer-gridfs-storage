> Deprecation notice:

> This information only applies to the version 1.x of this module which has been deprecated.

Typings for this module can be installed using npm

```bash
$ npm install @types/multer-gridfs-storage --save
```

When using typescript the module export a `class` definition 
named `MulterGridfsStorage`.

You can use `import` and write your own name for it

```typescript
import * as GridFSStorage from 'multer-gridfs-storage';
```

```typescript
let gfsCtr = new GridFSStorage({ ... });
```
 
It also exports two interfaces that can be used for the options object 

The `GfsStorageOptions` interface requires a `gfs` property expecting a
`Promise<Grid>` or a `Grid` object installable from `@types/gridfs-stream`.

```typescript
let opts: GridFSStorage.GfsStorageOptions;
opts = {
  gfs: ...
};
```

The `UrlStorageOptions` interface requires a `url` property expecting a `string`.

```typescript
let opts: GridFSStorage.UrlStorageOptions;
opts = {
  url: 'mongodb://address'
};
```

All the other configurations are optional.
