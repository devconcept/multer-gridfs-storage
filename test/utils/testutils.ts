import { Readable, Writable } from 'stream';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { ConnectionString } from 'mongodb-connection-string-url';
import { Db, MongoClient } from 'mongodb';

import { GridFsStorageInstance } from '../../src';
import { connection, storageOptions } from './settings';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const files = ['sample1.jpg', 'sample2.jpg'].map((file) => path.join(__dirname, '/../attachments/', file));

export async function cleanStorage(storage: GridFsStorageInstance | null | undefined, { client = null, db = null }: { client?: MongoClient | null; db?: Db | null } = {}) {
	if (storage) {
		storage.removeAllListeners();
		if (!db && !client) {
			db = storage.db;
			client = db?.client ?? null;
		}

		if (db) {
			await db.dropDatabase();
			return closeConnections({ db, client });
		}
	}
}

export function closeConnections({ db, client }: { db?: any; client?: any }) {
	if (client) {
		// MongoClient is ready when it has an open topology
		// isConnected() was removed in mongodb driver 4.x; check the internal topology state instead
		const topology = client.topology;
		if (topology && topology.isConnected) {
			return client.close();
		}
	} else if (db) {
		return db.close();
	}
}

export async function dropDatabase(url: string): Promise<void> {
	if (url) {
		const { options } = storageOptions();
		const _db = await MongoClient.connect(url, options);
		const db = getDb(_db, url);
		const client = getClient(_db);
		await db.dropDatabase();
		if (client) {
			return client.close();
		}

		return (db as any).close();
	}
}

export function getDb(client: MongoClient | Db, url: string): Db {
	if (client instanceof MongoClient) {
		const database = new ConnectionString(url).pathname.slice(1);
		return client.db(database || connection.database);
	}

	return client;
}

export function getClient(client: unknown): MongoClient | null {
	return client instanceof MongoClient ? client : null;
}

export interface Deferred<T = unknown> {
	promise: Promise<T>;
	resolve: (value: T | PromiseLike<T>) => void;
	reject: (reason?: any) => void;
}

export function defer<T = unknown>(): Deferred<T> {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: any) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

export class ErrorReadableStream extends Readable {
	err!: Error;

	_read(_size: number) {
		this.err = new Error('Stream error');
		this.emit('error', this.err);
	}
}
export class ErrorWritableStream extends Writable {
	err!: Error;

	_write(_size: number) {
		this.err = new Error('Stream error');
		this.emit('error', this.err);
	}
}
