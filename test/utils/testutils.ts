import { Readable, Writable } from 'stream';
import path from 'path';
import { parse } from 'mongodb-uri';
import { Db, MongoClient } from 'mongodb';
import delay from 'delay';

import { connection, storageOptions } from './settings';

export const files = ['sample1.jpg', 'sample2.jpg'].map((file) => path.join(__dirname, '/../attachments/', file));

export async function cleanStorage(storage: any, { client = null, db = null }: { client?: MongoClient | null; db?: Db | null } = {}) {
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

export async function dropDatabase(url: string): Promise<any> {
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
		const { database } = parse(url);
		return client.db(database || connection.database);
	}

	return client;
}

export function getClient(client: unknown): MongoClient | null {
	return client instanceof MongoClient ? client : null;
}

export function fakeConnectCb(error: Error | null = null) {
	return async (...args: any[]) => {
		if (args.length === 3) {
			const cb = args[2];
			setTimeout(() => {
				cb(error);
			});
			return;
		}

		await delay(1);
		if (error) {
			return Promise.reject(error);
		}
	};
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
