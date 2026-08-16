import { test, expect, beforeAll, afterAll, describe } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import multer from 'multer';
import { ObjectId } from 'mongodb';
import hasOwn from 'has-own-prop';

import { GridFsStorage } from '../src';
import { files, cleanStorage } from './utils/testutils';
import { storageOptions } from './utils/settings';

let storage: any;
let result: any;
let req: any;
let params: any[];
let filePrefix: string;
let metadatas: string[];
let ids: ObjectId[];
let sizes: number[];
let collections: string[];

describe('generator file function', () => {
	beforeAll(async () => {
		const app = express();
		filePrefix = 'file';
		metadatas = ['foo', 'bar'];
		ids = [new ObjectId(), new ObjectId()];
		sizes = [102_400, 204_800];
		collections = ['plants', 'animals'];
		storage = new GridFsStorage({
			...storageOptions(),
			*file(request_, file): Generator<Record<string, unknown>, void, any> {
				let counter = 0;
				params = [{ req: request_, file }];
				for (;;) {
					const response = yield {
						filename: filePrefix + (counter + 1).toString(),
						metadata: metadatas[counter],
						id: ids[counter],
						chunkSize: sizes[counter],
						bucketName: collections[counter],
					};
					params.push({ req: response[0], file: response[1] });
					counter++;
				}
			},
		});

		const upload = multer({ storage });

		app.post('/url', upload.array('photos', 2), (request_: Request, response: Response) => {
			req = request_;
			result = {
				headers: request_.headers,
				files: request_.files,
				body: request_.body,
			};
			response.end();
		});

		await storage.ready();
		await request(app).post('/url').attach('photos', files[0]).attach('photos', files[1]);
	});

	afterAll(async () => {
		await cleanStorage(storage);
	});

	test('the request contains the two uploaded files', () => {
		expect(Array.isArray(result.files)).toBe(true);
		expect(result.files.length).toBe(2);
	});

	test('files are named with the yielded value', () => {
		for (const [idx, f] of result.files.entries()) expect(f.filename).toBe(filePrefix + (idx + 1).toString());
	});

	test('files contain a metadata object with the yielded object', () => {
		for (const [idx, f] of result.files.entries()) expect(f.metadata).toBe(metadatas[idx]);
	});

	test('should be stored with the yielded chunkSize value', () => {
		for (const [idx, f] of result.files.entries()) expect(f.chunkSize).toBe(sizes[idx]);
	});

	test('should change the id with the yielded value', () => {
		for (const [idx, f] of result.files.entries()) expect(f.id).toBe(ids[idx]);
	});

	test('files are stored under a collection with the yielded name', async () => {
		const { db } = storage;
		const dbCollections = await db.listCollections({ name: { $in: ['plants.files', 'animals.files'] } }).toArray();
		expect(dbCollections.length).toBe(2);
	});

	test('should the parameters be a request and a file objects', () => {
		const appRequest = req;
		for (const p of params) {
			const { req: paramReq, file } = p;
			expect(paramReq).toBe(appRequest);
			// Use `in` rather than an own-property check: since Express 5, `req.query` is a lazy
			// getter on the prototype instead of an own property.
			for (const k of ['body', 'query', 'params', 'files']) {
				expect(k in paramReq).toBe(true);
			}

			for (const k of ['fieldname', 'originalname', 'encoding', 'mimetype']) {
				expect(hasOwn(file, k)).toBe(true);
			}
		}
	});
});
