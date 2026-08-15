import { readFile } from 'node:fs/promises';
import { test, expect, beforeAll, afterAll, describe } from 'vitest';
import express from 'express';
import request from 'supertest';
import multer from 'multer';
import hasOwn from 'has-own-prop';

import { GridFsStorage } from '../src';
import { files, cleanStorage } from './utils/testutils';
import { storageOptions } from './utils/settings';

let storage: any;
let result: any;
let size: number;

describe('an uploaded file', () => {
	beforeAll(async () => {
		const app = express();
		storage = new GridFsStorage(storageOptions());
		const upload = multer({ storage });

		app.post('/url', upload.single('photo'), (request_, response) => {
			result = {
				headers: request_.headers,
				file: request_.file,
				body: request_.body,
			};
			response.end();
		});

		await storage.ready();
		await request(app).post('/url').attach('photo', files[0]);

		const f = await readFile(files[0]);
		size = f.length;
	});

	afterAll(async () => {
		await cleanStorage(storage);
	});

	test('has a filename property', () => {
		expect(hasOwn(result.file, 'filename')).toBe(true);
		expect(typeof result.file.filename).toBe('string');
		expect(result.file.filename).toMatch(/^[\da-f]{32}$/);
	});

	test('has a metadata property', () => {
		expect(hasOwn(result.file, 'metadata')).toBe(true);
		expect(result.file.metadata).toBe(null);
	});

	test('has an id property', () => {
		expect(hasOwn(result.file, 'id')).toBe(true);
		expect(result.file.id.toHexString()).toMatch(/^[\da-f]{24}$/);
	});

	test('has a size property with the length of the file', () => {
		expect(hasOwn(result.file, 'size')).toBe(true);
		expect(result.file.size).toBe(size);
	});

	test('has the default bucket name pointing to the fs collection', () => {
		expect(hasOwn(result.file, 'bucketName')).toBe(true);
		expect(result.file.bucketName).toBe('fs');
	});

	test('has the date of the upload', () => {
		expect(hasOwn(result.file, 'uploadDate')).toBe(true);
		expect(result.file.uploadDate instanceof Date).toBe(true);
	});
});
