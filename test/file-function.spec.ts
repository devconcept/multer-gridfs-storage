import { test, expect, beforeAll, afterAll, describe } from 'vitest';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import { ObjectId } from 'mongodb';

import { GridFsStorage } from '../src';
import { files, cleanStorage } from './utils/testutils';
import { storageOptions } from './utils/settings';

let storage: any;
let result: any;
let filenamePrefix: string;
let ids: ObjectId[];
let metadatas: string[];
let sizes: number[];
let bucketNames: string[];

describe('file function returning an object', () => {
	beforeAll(async () => {
		const app = express();
		let counter = 0;
		filenamePrefix = 'file';
		ids = [new ObjectId(), new ObjectId()];
		metadatas = ['foo', 'bar'];
		sizes = [102_400, 204_800];
		bucketNames = ['plants', 'animals'];
		storage = new GridFsStorage({
			...storageOptions(),
			file: () => {
				counter++;
				return {
					filename: `${filenamePrefix}${counter}`,
					// String metadata is stored/read back verbatim; the typed contract is a Document, so cast.
					metadata: metadatas[counter - 1] as any,
					id: ids[counter - 1],
					chunkSize: sizes[counter - 1],
					bucketName: bucketNames[counter - 1],
				};
			},
		});

		const upload = multer({ storage });

		app.post('/url', upload.array('photos', 2), (request_, response) => {
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

	test('request contains the two uploaded files', () => {
		expect(result.files).toBeTruthy();
		expect(Array.isArray(result.files)).toBe(true);
		expect(result.files.length).toBe(2);
	});

	test('files are named with the provided value', () => {
		for (const [idx, f] of result.files.entries()) expect(f.filename).toBe(filenamePrefix + (idx + 1));
	});

	test('files contain a metadata object with the provided object', () => {
		for (const [idx, f] of result.files.entries()) expect(f.metadata).toBe(metadatas[idx]);
	});

	test('files are stored with the provided chunkSize value', () => {
		for (const [idx, f] of result.files.entries()) expect(f.chunkSize).toBe(sizes[idx]);
	});

	test('files have the provided id value', () => {
		for (const [idx, f] of result.files.entries()) expect(f.id).toBe(ids[idx]);
	});

	test('files are stored under a collection with the provided name', async () => {
		const { db } = storage;
		const collections = await db.listCollections({ name: { $in: ['plants.files', 'animals.files'] } }).toArray();
		expect(collections.length).toBe(2);
	});
});
