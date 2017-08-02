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
let storage = new GridFSStorage({ ... });
```
 
It exports two interfaces that can be used for the options object 

The `DbStorageOptions` interface requires a `db` property expecting a
`Promise<Db>` or a `Db` object installable from `@types/mongodb`.

```typescript
let opts: GridFSStorage.DbStorageOptions;
opts = {
  db: new Db('database', new Server('yourhost', 27017))
};
```

or

```typescript
let opts: GridFSStorage.DbStorageOptions;
opts = {
  db: MongoClient.connect('mongodb://yourhost:27017/database')
};
```

The `UrlStorageOptions` interface requires a `url` property expecting a `string` and 
an optional connectionOpts to customize the internal connection.

```typescript
let opts: GridFSStorage.UrlStorageOptions;
opts = {
  url: 'mongodb://yourhost:27017/database'
};
```

The return type of the file option is also exported as `FileConfig` with the
following signature or optionally a promise that resolves with that interface.

```typescript
interface FileConfig {
  filename?: string;
  id?: any;
  metadata?: any;
  chunkSize?: number;
  bucketName?: string;
  contentType?: string;
}
```
